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

```bash
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions -N ""
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/github_actions          # the private key, for the secret below
```

**Settings → Secrets and variables → Actions**

*Secrets*

| Name | Value |
| ---- | ----- |
| `DEPLOY_HOST` | the Elastic IP |
| `DEPLOY_USER` | `ec2-user` |
| `DEPLOY_SSH_KEY` | the private key printed above, in full |

*Variables*

| Name | Value |
| ---- | ----- |
| `DEPLOY_ENABLED` | `true` |
| `ARENA_DOMAIN` | `arena.bortle.app` |

Push to `main`: both images build, publish to GHCR, get pulled on the instance,
and the run fails if the site does not report healthy afterwards.

---

## 8. Monitoring with CloudWatch (optional, free)

Worth doing once the stack is up and verified. Everything below sits inside
CloudWatch's permanently-free tier — 5 GB of log ingestion, 10 custom metrics
and 10 alarms per month — so it costs nothing at this scale.

**Skip CloudWatch Synthetics.** Its free tier is 100 canary runs a month, which
is one check every seven hours; a useful five-minute canary would be ~8,600 runs
and cost real money. Alarms on the metrics below do the same job for $0.

### Give the instance permission

**IAM → Policies → Create policy → JSON**, paste `deploy/iam-instance-policy.json`,
name it `arena-master-observability`.

**IAM → Roles → Create role → AWS service → EC2**, attach that policy, name it
`arena-master-instance`.

**EC2 → your instance → Actions → Security → Modify IAM role** → select it. No
restart needed.

### Ship container logs

```bash
cd ~/arena-master
curl -O https://raw.githubusercontent.com/days-hub/arena-master/main/deploy/compose.cloudwatch.yaml

docker compose -f compose.prod.yaml -f compose.cloudwatch.yaml up -d
```

Logs now appear under **CloudWatch → Log groups → `/arena-master/*`**.

Two things to know. `docker compose logs` shows nothing once this is on, because
nothing is written locally — read logs in the console instead. And log groups
default to keeping data forever, so set retention or you will eventually drift
past the free 5 GB archive:

```bash
for g in backend frontend db; do
  aws logs put-retention-policy --log-group-name "/arena-master/$g" --retention-in-days 14
done
```

### Memory and disk metrics

EC2 publishes CPU and network for free, but not memory or disk usage — the
hypervisor cannot see inside the guest. On a 2 GB box shared by a JVM,
PostgreSQL and nginx, memory is the most likely thing to go wrong.

```bash
sudo dnf install -y amazon-cloudwatch-agent
sudo curl -o /opt/aws/amazon-cloudwatch-agent/etc/cloudwatch-agent.json \
  https://raw.githubusercontent.com/days-hub/arena-master/main/deploy/cloudwatch-agent.json
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 -s -c file:/opt/aws/amazon-cloudwatch-agent/etc/cloudwatch-agent.json
```

Two custom metrics, well inside the free ten.

### Alarms worth having

First create somewhere for them to go: **SNS → Topics → Create topic** (Standard,
`arena-master-alerts`), then **Create subscription** → Email → your address, and
confirm the email. 1,000 email notifications a month are free.

**CloudWatch → Alarms → Create alarm**, four of them:

| Metric | Condition | Catches |
| ------ | --------- | ------- |
| `StatusCheckFailed` (EC2) | `>= 1` for 2 minutes | The instance is unreachable or unhealthy |
| `CPUUtilization` (EC2) | `> 80%` for 15 minutes | A runaway process or genuine load |
| `MemoryUsedPercent` (ArenaMaster) | `> 85%` for 10 minutes | The JVM crowding out Postgres — the failure mode this size of box actually has |
| `DiskUsedPercent` (ArenaMaster) | `> 80%` | Images and logs filling the volume |

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
docker exec arena-db pg_dump -U arena arenamaster | gzip > backup-$(date +%F).sql.gz
```

Worth a cron entry, and worth copying off the instance.

**Restore**

```bash
gunzip -c backup-2026-08-16.sql.gz | docker exec -i arena-db psql -U arena -d arenamaster
```

**Seed demo data** so the site is not empty for visitors — run from a machine
with the repository, pointed at the deployed API.

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
