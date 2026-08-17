# Deploying Arena Master to AWS

```
arena.bortle.app
       │
   CloudFront          TLS (free ACM cert), CDN, DDoS protection
       │
      EC2  t4g.small
       │
  Docker Compose
   ├─ nginx / React     serves the bundle, proxies /api to the backend
   ├─ Spring Boot       the API
   └─ PostgreSQL        EBS-backed volume
```

GitHub Actions builds both images, publishes them to GHCR, and rolls them out
on every push to `main`.

## Why this shape

**One instance, several containers.** EC2 bills for the instance, not for what
runs inside it, so there is no saving in cramming everything into one image —
only a loss of separation. nginx serves static files far better than a JVM, and
a frontend change no longer rebuilds the backend.

**nginx is the only public entry point** and proxies `/api`, `/oauth2`,
`/login` and `/actuator` to Spring Boot. The browser sees a single origin, so
there is no CORS to configure and no cross-site cookie handling.

**App Runner was the first choice and doesn't survive the networking.** Reaching
a private RDS needs a VPC connector, and attaching one routes *all* outbound
traffic through your VPC — so the calls to Discord for OAuth and Riot for ranks
would need a NAT Gateway at roughly $32/month, more than the rest of the stack
combined.

**CloudFront terminates TLS**, which removes Let's Encrypt, certificate renewal
and a reverse-proxy container from the picture. Its 1 TB/month free tier is
permanent rather than a 12-month trial.

| Component | Choice | ~Monthly |
| --------- | ------ | -------- |
| CDN + TLS | CloudFront + ACM certificate | $0 (free tier) |
| Compute | EC2 `t4g.small` (2 vCPU, 2 GB, ARM) | ~$12.26 |
| Storage | 20 GB gp3 root volume | ~$1.60 |
| Database | PostgreSQL 18 container on the same box | $0 |
| Registry | GitHub Container Registry | $0 (public repo) |

About **$14/month**, so the $100 of credits a new account starts with covers the
full six months.

Moving Postgres to RDS later is a `SPRING_DATASOURCE_URL` change plus a dump and
restore — roughly +$15/month for automated backups and point-in-time recovery.

## Prerequisites

- An AWS account, with a **zero-spend budget alert set before anything else**
- A hostname you control — this guide assumes `arena.bortle.app`
- The Discord and Riot credentials from your local `.env`

---

## 1. Set a billing alert

**Billing and Cost Management → Budgets → Create budget → Zero spend budget**,
with your email. Two minutes, and it is the difference between noticing a
mistake on day one and noticing it on the invoice.

## 2. Launch the instance

**EC2 → Launch instance**

| Setting | Value |
| ------- | ----- |
| Name | `arena-master` |
| AMI | Amazon Linux 2023 (**Arm** variant) |
| Instance type | `t4g.small` |
| Key pair | Create one, download the `.pem` |
| Storage | 20 GB gp3 |

Security group:

| Type | Port | Source | Why |
| ---- | ---- | ------ | --- |
| SSH | 22 | **My IP** | Administration. Never `0.0.0.0/0` |
| HTTP | 80 | *see below* | CloudFront reaches the origin |

Leave HTTP open to anywhere for now; step 5 locks it to CloudFront. Nothing ever
opens 5432 or 8000 — the database and API are only reachable on the compose
network.

Then **Elastic IP → Allocate → Associate**. Free while attached to a running
instance, charged when it is not.

## 3. Install Docker

```bash
ssh -i arena-master.pem ec2-user@<elastic-ip>

sudo dnf update -y
sudo dnf install -y docker
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user

sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-aarch64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

exit   # log back in so the docker group applies
```

## 4. Configure and start the stack

```bash
mkdir -p ~/arena-master && cd ~/arena-master
```

Copy `deploy/compose.prod.yaml` from the repository here, then create `.env`:

```bash
cat > .env <<'EOF'
POSTGRES_DB=arenamaster
POSTGRES_USER=arena
POSTGRES_PASSWORD=<generate>

BACKEND_IMAGE=ghcr.io/days-hub/arena-master-backend:latest
FRONTEND_IMAGE=ghcr.io/days-hub/arena-master-frontend:latest

DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_BOT_TOKEN=...
DISCORD_GUILD_ID=...
DISCORD_WEBHOOK_URL=...
ADMIN_DISCORD_IDS=...

ARENA_SERVICE_KEY=<generate>
RIOT_API_KEY=...
RIOT_PLATFORM=na1
EOF

chmod 600 .env
```

Generate the two secrets rather than copying the development ones — a secret
that has lived on a laptop should not become a production credential:

```bash
openssl rand -base64 36
```

The GHCR packages default to private. Make both public under
**Packages → Package settings → Change visibility**, or the instance cannot
pull them.

```bash
docker compose -f compose.prod.yaml up -d
docker compose -f compose.prod.yaml logs -f backend
```

Flyway creates the schema on first boot. Watch for
`Started ArenaMasterApiApplication`, then confirm the origin works over plain
HTTP before putting CloudFront in front of it:

```bash
curl http://<elastic-ip>/actuator/health
```

## 5. Put CloudFront in front

**Request the certificate first, in `us-east-1`** — CloudFront only accepts
certificates from that region regardless of where the instance lives.

**ACM (us-east-1) → Request public certificate** for `arena.bortle.app`, then
add the CNAME it gives you to the `bortle.app` DNS and wait for *Issued*.

**CloudFront → Create distribution**

| Setting | Value |
| ------- | ----- |
| Origin domain | the Elastic IP or the instance's public DNS |
| Protocol | **HTTP only** (TLS ends at CloudFront) |
| Viewer protocol policy | **Redirect HTTP to HTTPS** |
| Allowed methods | **GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE** |
| Cache policy | **CachingDisabled** |
| Origin request policy | **AllViewer** |
| Alternate domain name | `arena.bortle.app` |
| Custom SSL certificate | the ACM certificate above |

`CachingDisabled` with `AllViewer` at the default behaviour is deliberate:
cookies, the `Host` header and query strings all have to reach the origin
intact or the login flow breaks. nginx already sets far-future cache headers on
`/static/*`, so add a second behaviour for `/static/*` with **CachingOptimized**
to get CDN caching where it is safe.

Finally, point `arena.bortle.app` at the distribution with a CNAME to the
`d111111abcdef8.cloudfront.net` hostname.

### Lock the origin to CloudFront

Back in the EC2 security group, change the HTTP rule's source from anywhere to
the managed prefix list **`com.amazonaws.global.cloudfront.origin-facing`**.
The instance then only accepts traffic that came through CloudFront.

## 6. Add the production redirect to Discord

[Discord Developer Portal](https://discord.com/developers/applications) → your
app → **OAuth2 → Redirects → Add**:

```
https://arena.bortle.app/login/oauth2/code/discord
```

Keep the localhost entry so development still works.

## 7. Turn on automatic deployments

Deployment runs through **AWS Systems Manager**, not SSH.

SSH would need GitHub's runners to reach port 22, and they have no fixed egress
addresses to allow-list — GitHub publishes thousands of CIDRs and a security group
caps at 60 rules. The only way to make SSH work would be opening port 22 to the
internet, undoing the lockdown in step 2. The SSM agent instead connects *outbound*
to AWS, so the instance needs no inbound access at all.

### Let the instance talk to SSM

**IAM → Roles → Create role → AWS service → EC2**, attach the AWS managed policy
**`AmazonSSMManagedInstanceCore`**, name it `arena-master-instance`.

**EC2 → your instance → Actions → Security → Modify IAM role** → select it.

The agent ships with Amazon Linux 2023, so nothing to install. Within a minute or
two the instance should appear in **Systems Manager → Fleet Manager**. If it does
not, restart the agent:

```bash
sudo systemctl restart amazon-ssm-agent
```

### Let GitHub assume a role

**IAM → Identity providers → Add provider → OpenID Connect**

| Field | Value |
| ----- | ----- |
| Provider URL | `https://token.actions.githubusercontent.com` |
| Audience | `sts.amazonaws.com` |

Then **IAM → Roles → Create role → Web identity**, pick that provider and the
`sts.amazonaws.com` audience. Name it `arena-master-github-actions`.

Edit its **trust policy** to match `deploy/iam-github-actions-trust.json`, replacing
`ACCOUNT_ID`. The `sub` condition is what makes this safe — only workflows on this
repository's `main` branch can assume the role, so a pull request from a fork
cannot.

Attach an inline policy from `deploy/iam-github-actions-policy.json`, replacing
`ACCOUNT_ID` and `INSTANCE_ID`. It permits running one SSM document on one
instance and nothing else.

Copy the role ARN.

### Configure the repository

**Settings → Secrets and variables → Actions → Variables**

| Name | Value |
| ---- | ----- |
| `DEPLOY_ENABLED` | `true` |
| `ROLLOUT_ENABLED` | `true` |
| `ARENA_DOMAIN` | `arena.bortle.app` |
| `AWS_REGION` | `us-east-1` |
| `AWS_ROLE_ARN` | the role ARN |
| `INSTANCE_ID` | `i-...` |

No secrets are needed. There are no AWS keys to store: GitHub mints a short-lived
OIDC token per run and AWS exchanges it for temporary credentials.

Push to `main`: both images build, publish to GHCR, the instance pulls and restarts
them, and the run fails if the site does not report healthy afterwards.

---

## 8. Monitoring with CloudWatch (optional, free)

Worth doing once the stack is up and verified. Everything below sits inside
CloudWatch's permanently-free tier — 5 GB of log ingestion, 10 custom metrics
and 10 alarms per month — so it costs nothing at this scale.

**Skip CloudWatch Synthetics.** Its free tier is 100 canary runs a month, which
is one check every seven hours; a useful five-minute canary would be ~8,600 runs
and cost real money. Alarms on the metrics below do the same job for $0.

### Give the instance permission

The instance already carries the `arena-master-instance` role from step 7, so this
extends that role rather than creating a second one:

**IAM → Roles → `arena-master-instance` → Add permissions → Create inline policy →
JSON**, paste `deploy/iam-instance-policy.json`, name it
`arena-master-observability`.

Use the **JSON** tab rather than the visual editor — the policy spans three
services (`logs`, `cloudwatch`, `ec2`) and the visual editor makes you build one
block per service. Role credentials refresh on their own, so nothing needs
restarting.

The policy deliberately omits `logs:DescribeLogGroups`. It is a list-level action
that cannot be scoped to a log-group prefix, so granting it would mean
`Resource: "*"` — a wider grant than the instance needs to *write* its own logs.
Verification below uses `DescribeLogStreams`, which is scoped, or the console.

### Ship container logs

Do any pending seeding or debugging *before* this step. Once the overlay is on,
`docker compose logs` shows nothing, because nothing is written locally any more —
logs go straight to CloudWatch. Finish anything that needs local logs first.

```bash
cd ~/arena-master
curl -sL -o compose.cloudwatch.yaml \
  https://github.com/days-hub/arena-master/raw/main/deploy/compose.cloudwatch.yaml

docker compose -f compose.prod.yaml -f compose.cloudwatch.yaml up -d
```

Fetch through `github.com/.../raw/...` rather than `raw.githubusercontent.com`,
which caches aggressively and has served a stale copy of a file minutes after it
was pushed.

Logs now appear under **CloudWatch → Log groups → `/arena-master/*`**. Log groups
default to keeping data forever, so set retention or you will eventually drift past
the free 5 GB archive:

```bash
for g in backend frontend db; do
  aws logs put-retention-policy --log-group-name "/arena-master/$g" --retention-in-days 14
done

aws logs describe-log-streams --log-group-name /arena-master/backend \
  --query 'logStreams[].[logStreamName,lastEventTimestamp]' --output table
```

A row with a recent epoch-millisecond timestamp means the `awslogs` driver is
delivering. Retention itself shows as a column in **CloudWatch → Log groups** —
reading it from the instance would need the wider permission described above.

### Memory and disk metrics

EC2 publishes CPU and network for free, but not memory or disk usage — the
hypervisor cannot see inside the guest. On a 2 GB box shared by a JVM,
PostgreSQL and nginx, memory is the most likely thing to go wrong.

```bash
sudo dnf install -y amazon-cloudwatch-agent
sudo curl -sL -o /opt/aws/amazon-cloudwatch-agent/etc/cloudwatch-agent.json \
  https://github.com/days-hub/arena-master/raw/main/deploy/cloudwatch-agent.json
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 -s -c file:/opt/aws/amazon-cloudwatch-agent/etc/cloudwatch-agent.json

sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a status
sudo tail -5 /opt/aws/amazon-cloudwatch-agent/logs/amazon-cloudwatch-agent.log
```

Want `"status": "running"` and a log tail with no `AccessDenied`. Two custom
metrics, well inside the free ten. The first datapoints land about five minutes
later — the collection interval — after which **CloudWatch → Metrics →
ArenaMaster** lists them.

### Alarms worth having

First create somewhere for them to go: **SNS → Topics → Create topic** (Standard,
`arena-master-alerts`), then **Create subscription** → Email → your address, and
click the confirmation link. An unconfirmed subscription silently drops everything.
1,000 email notifications a month are free. SNS is listed in the console under
**Application Integration → Simple Notification Service**.

**CloudWatch → Alarms → Create alarm**, four of them, each notifying
`arena-master-alerts`:

| Name | Metric | Statistic / Period | Condition | Catches |
| ---- | ------ | ------------------ | --------- | ------- |
| `arena-instance-unhealthy` | `StatusCheckFailed` (AWS/EC2) | Maximum / 1 min | `>= 1`, 2 of 2 datapoints | The instance is unreachable or unhealthy |
| `arena-cpu-high` | `CPUUtilization` (AWS/EC2) | Average / 5 min | `> 80`, 3 of 3 | A runaway process or genuine load |
| `arena-memory-high` | `MemoryUsedPercent` (ArenaMaster) | Average / 5 min | `> 85`, 2 of 2 | The JVM crowding out Postgres — the failure mode this size of box actually has |
| `arena-disk-high` | `DiskUsedPercent` (ArenaMaster) | Average / 5 min | `> 80`, 1 of 1 | Images and logs filling the volume |

Two settings apply to `arena-instance-unhealthy` alone. Set **missing data
treatment** to *breaching*: a stopped or wedged instance stops publishing
altogether, and the default would leave the alarm parked in `INSUFFICIENT_DATA`
rather than telling you about the outage. And add a second notification with the
**OK** state trigger, so you hear that it recovered as well as that it broke. The
other three keep the default missing-data handling and alert on `In alarm` only —
they flap more, and a gap during a deploy is not worth an email.

The threshold on the status check is `>= 1` because the metric is the OR of the
system and instance checks: it is 0 or 1 and never reaches 2. The other three use
`>` (Greater), not Greater/Equal.

Each new alarm emails once as it settles from `INSUFFICIENT_DATA` to `OK`. That
first message is not an outage — it is the whole pipeline proving itself, from
metric through alarm through SNS to your inbox, without having to break anything.

Four of ten free alarms used.

### A dashboard

**CloudWatch → Dashboards → Create**, add CPU, memory, disk and network. Three
dashboards are free, and it is the single most useful thing to have open while
you are demonstrating the project to someone.

---

## Running it

**Logs**

```bash
docker compose -f compose.prod.yaml logs -f backend
docker compose -f compose.prod.yaml logs -f frontend
```

**Back up the database** — nothing does this for you:

```bash
mkdir -p ~/backups
docker exec arena-db pg_dump -U arena arenamaster | gzip > ~/backups/arena-$(date +%F).sql.gz
```

To run it nightly, note that Amazon Linux 2023 has no cron installed — it favours
systemd timers, so `crontab` is missing until you add it:

```bash
sudo dnf install -y cronie
sudo systemctl enable --now crond

cat <<'EOF' | crontab -
0 3 * * * docker exec arena-db pg_dump -U arena arenamaster | gzip > ~/backups/arena-$(date +\%F).sql.gz 2>>~/backups/backup.log
0 4 * * 0 find ~/backups -name 'arena-*.sql.gz' -mtime +14 -delete
EOF
```

Run the dump by hand once afterwards to confirm it produces a non-empty file;
a backup job first discovered to be broken during a restore is not a backup.

These stay on the same disk as the database, so they cover a bad migration or a
dropped table, not a lost volume. Copying them to S3 would close that gap for a
few cents a month.

**Restore**

```bash
gunzip -c backup-2026-08-16.sql.gz | docker exec -i arena-db psql -U arena -d arenamaster
```

**Seed demo data** so the site is not empty for visitors. Simplest from the
instance itself, where `.env` already holds `ARENA_SERVICE_KEY` and
`ADMIN_DISCORD_IDS`:

```bash
cd ~/arena-master
curl -sL -o seed_data.py https://github.com/days-hub/arena-master/raw/main/seed_data.py
python3 seed_data.py --reset --api http://localhost/api
```

Port 80 rather than 8000 sends the requests through nginx, the same path a browser
takes, so a successful seed also proves the proxy. `--as-user` is optional; it
defaults to the first id in `ADMIN_DISCORD_IDS`.

This announces every seeded result to Discord. To seed quietly, comment out
`DISCORD_WEBHOOK_URL` in `.env`, restart the backend, seed, then restore it.

## Known limitations

Deliberate, and worth being able to explain rather than pretending otherwise:

- **The deployment is single-tenant.** `DISCORD_GUILD_ID`, `DISCORD_WEBHOOK_URL`
  and `ADMIN_DISCORD_IDS` are one-per-deployment environment variables, and
  `AccessControl.requireGuildMember()` gates creation on membership of that one
  guild. So a visitor from outside that Discord server can browse brackets and
  standings but cannot create anything. That is intentional for a community
  tool and for a public demo, but it does mean this is not a product other
  servers can sign up for.

  Making it multi-tenant is a known path rather than an open question:

  1. A `discord_guilds` table holding each installation's guild id, name and
     webhook URL.
  2. An install flow using Discord's `webhook.incoming` OAuth scope. Discord
     presents a server and channel picker during authorization, creates the
     webhook itself, and returns its URL in the token response — so nobody
     ever copies a webhook URL by hand.
  3. `guild_id` on tournaments and teams, so each server sees its own.
  4. Permission checks against the tournament's guild rather than a global
     one, and `DiscordNotifier` resolving the webhook per tournament.

- **No redundancy.** One instance. It reboots, the site is briefly down.
- **Backups are manual** unless you add the cron job above.
- **A deploy has a few seconds of downtime** while the containers restart.
  Zero-downtime would mean two backends and nginx balancing between them —
  worth doing when someone would notice.
- **The database shares the instance.** Fine at this size, and the first thing
  to move to RDS if traffic ever justified it.
- **The Discord bot is not deployed.** It can run locally against the
  production API, or be added as a fourth compose service.
