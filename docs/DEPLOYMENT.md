# Deploying Arena Master to AWS

A single EC2 instance runs the app, its PostgreSQL database, and Caddy for TLS,
all through Docker Compose. GitHub Actions builds the image and rolls it out on
every push to `main`.

## Why this shape

App Runner was the obvious first choice, and it doesn't survive contact with the
networking. Reaching a private RDS instance requires a VPC connector, and
attaching one routes *all* the service's outbound traffic through your VPC — so
the calls to Discord for OAuth and to Riot for ranks would need a NAT Gateway at
roughly $32/month, more than the rest of the stack combined. The alternative,
leaving RDS publicly reachable, means a database on the open internet, since App
Runner has no fixed egress IPs to restrict a security group to.

One instance running Compose avoids the NAT, avoids a load balancer at ~$16/month,
and is close to what runs on a laptop. The trade is real: you own patching and
backups, and there is no redundancy. For a project of this size that is the right
trade; at meaningful traffic it would not be.

| Component | Choice | ~Monthly |
| --------- | ------ | -------- |
| Compute | EC2 `t4g.small` (2 vCPU, 2 GB, ARM) | ~$12 |
| Database | PostgreSQL 18 container on the same box | $0 |
| TLS | Caddy with Let's Encrypt | $0 |
| Registry | GitHub Container Registry | $0 (public repo) |
| Storage | 20 GB gp3 root volume | ~$1.60 |

Roughly **$14/month**, so $200 of account credits covers the full six months.

## Prerequisites

- An AWS account (new accounts get $100 credits, up to $200 by completing the
  onboarding tasks — do them, it doubles your runway)
- **A domain name.** Let's Encrypt will not issue certificates for
  `*.amazonaws.com`, and Discord requires HTTPS for any non-localhost OAuth
  redirect. A `.com` costs about $12/year; a free DuckDNS subdomain also works.
- The Discord and Riot credentials already in your local `.env`

---

## 1. Set a billing alert first

Before creating anything billable. **Billing and Cost Management → Budgets →
Create budget → Zero spend budget**, with your email address.

Two minutes, and it is the difference between noticing a mistake on day one and
noticing it on the invoice.

## 2. Launch the instance

**EC2 → Launch instance**

| Setting | Value |
| ------- | ----- |
| Name | `arena-master` |
| AMI | Amazon Linux 2023 (**Arm** variant) |
| Instance type | `t4g.small` |
| Key pair | Create one, download the `.pem`, keep it safe |
| Storage | 20 GB gp3 |

Under **Network settings → Edit**, create a security group allowing:

| Type | Port | Source | Why |
| ---- | ---- | ------ | --- |
| SSH | 22 | **My IP** | Administration. Not `0.0.0.0/0` |
| HTTP | 80 | Anywhere | Let's Encrypt's challenge, and the redirect to HTTPS |
| HTTPS | 443 | Anywhere | The site |

Nothing opens 5432. The database is only reachable on the Compose network.

Then **Elastic IP → Allocate → Associate** with the instance, so the address
survives a reboot. An Elastic IP is free while attached to a running instance
and charged when it is not.

## 3. Point DNS at it

Create an `A` record for your domain pointing at the Elastic IP. Verify before
continuing, because Caddy will fail to get a certificate otherwise:

```bash
dig +short your-domain.com     # should print the Elastic IP
```

## 4. Install Docker

```bash
ssh -i arena-master.pem ec2-user@your-domain.com

sudo dnf update -y
sudo dnf install -y docker
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user

# Compose v2 as a CLI plugin
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-aarch64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

exit   # log back in so the docker group applies
```

## 5. Configure the stack

```bash
mkdir -p ~/arena-master && cd ~/arena-master
```

Copy `deploy/compose.prod.yaml` and `deploy/Caddyfile` from the repository into
that directory, then create `.env` beside them:

```bash
cat > .env <<'EOF'
ARENA_DOMAIN=your-domain.com
ARENA_IMAGE=ghcr.io/days-hub/arena-master:latest

POSTGRES_DB=arenamaster
POSTGRES_USER=arena
POSTGRES_PASSWORD=<generate a long random password>

DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_BOT_TOKEN=...
DISCORD_GUILD_ID=...
DISCORD_WEBHOOK_URL=...
ADMIN_DISCORD_IDS=...

ARENA_SERVICE_KEY=<generate a fresh one, do not reuse the local value>
RIOT_API_KEY=...
RIOT_PLATFORM=na1
EOF

chmod 600 .env
```

Generate secrets rather than copying the development ones:

```bash
openssl rand -base64 36    # once for POSTGRES_PASSWORD, once for ARENA_SERVICE_KEY
```

A development secret that has lived on a laptop should not become a production
credential.

## 6. Add the production redirect to Discord

[Discord Developer Portal](https://discord.com/developers/applications) → your
app → **OAuth2 → Redirects → Add**:

```
https://your-domain.com/login/oauth2/code/discord
```

Save. Keep the localhost entry so development still works.

## 7. Start it

```bash
cd ~/arena-master
docker compose -f compose.prod.yaml up -d
docker compose -f compose.prod.yaml logs -f app
```

Flyway creates the schema on first boot. Watch for `Started ArenaMasterApiApplication`,
then check:

```bash
curl https://your-domain.com/actuator/health
```

Caddy's first certificate takes a few seconds. If it fails, the cause is almost
always DNS not yet pointing at the instance, or port 80 being unreachable.

## 8. Turn on automatic deployments

Create a deploy key on the instance and give the public half to itself:

```bash
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions -N ""
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/github_actions          # the private key, for the secret below
```

In the repository, **Settings → Secrets and variables → Actions**:

*Secrets*

| Name | Value |
| ---- | ----- |
| `DEPLOY_HOST` | your domain or Elastic IP |
| `DEPLOY_USER` | `ec2-user` |
| `DEPLOY_SSH_KEY` | the private key printed above, in full |

*Variables*

| Name | Value |
| ---- | ----- |
| `DEPLOY_ENABLED` | `true` |
| `ARENA_DOMAIN` | `your-domain.com` |

Push to `main`. The workflow builds the image, publishes it to GHCR, pulls it on
the instance, restarts the app container, and fails the run if the site does not
report healthy afterwards.

The GHCR package defaults to private. Make it public
(**Packages → arena-master → Package settings → Change visibility**) or the
instance cannot pull it without credentials.

---

## Running it

**Logs**

```bash
docker compose -f compose.prod.yaml logs -f app
```

**Back up the database** — nothing does this for you:

```bash
docker exec arena-db pg_dump -U arena arenamaster | gzip > backup-$(date +%F).sql.gz
```

Worth a cron entry, and worth copying somewhere off the instance.

**Restore**

```bash
gunzip -c backup-2026-08-16.sql.gz | docker exec -i arena-db psql -U arena -d arenamaster
```

**Seed demo data** so the site is not empty for visitors:

```bash
# From a machine with the repository, against the deployed API
python seed_data.py
```

## Known limitations

Deliberate, and worth being able to explain rather than pretending otherwise:

- **No redundancy.** One instance. It reboots, the site is down for a minute.
- **Backups are manual** unless you add the cron job above.
- **A deploy has a few seconds of downtime** while the app container restarts.
  Zero-downtime would mean two app containers and Caddy load-balancing between
  them — worth doing when anyone would notice.
- **The database shares the instance.** Fine at this size; the first thing to
  move to RDS if traffic ever justified it.
- **The Discord bot is not deployed.** It is a separate process; it can run
  locally against the production API, or be added as another Compose service.
