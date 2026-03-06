# UNS Manufacturing Platform - Docker Deployment Guide

**Deployment model:** The platform is designed to run **only via Docker Compose**. All components (app, Postgres, Redis, InfluxDB, EMQX, Grafana, optional PgAdmin) run as **multiple Docker images**; there is no primary “run without Docker” path. Use `docker compose up -d` as the standard way to run the full stack.

## 🚀 Quick Start

**Single-command run:** Start the full platform (app, Postgres, Redis, InfluxDB, EMQX, Grafana) as multi-container stack:

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f app

# Check status
docker compose ps
```

**Rebuild the app image** after code changes:

```bash
docker compose up -d --build app
```

## 📦 Services Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           UNS Platform                                    │
│                        (Next.js App :3000)                               │
└────────────┬────────────┬────────────┬────────────┬────────────────────┘
             │            │            │            │
             ▼            ▼            ▼            ▼
       ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
       │PostgreSQL│ │ InfluxDB │ │   EMQX   │ │  Redis   │
       │  :5432   │ │  :8086   │ │ :1883    │ │  :6379   │
       │          │ │          │ │ :8083 WS │ │          │
       └──────────┘ └────┬─────┘ └──────────┘ └──────────┘
                         │
                         ▼
                  ┌──────────┐
                  │ Grafana  │
                  │  :3001   │
                  └──────────┘
```

## 📊 Service Endpoints

| Service | URL | Description | Credentials |
|---------|-----|-------------|-------------|
| **UNS Platform** | http://localhost:3000 | Main Application | - |
| **Grafana** | http://localhost:3001 | Dashboards | admin / admin |
| **InfluxDB** | http://localhost:8086 | Time-series DB | admin / adminpassword |
| **EMQX Dashboard** | http://localhost:18083 | MQTT Broker | admin / uns_emqx_2024 |
| **PgAdmin** | http://localhost:5050 | PostgreSQL Admin | admin@uns-platform.local / admin |

## 🔌 MQTT Topics (ISA-95 Standard)

The platform uses ISA-95 compliant MQTT topic hierarchy:

### Topic Structure
```
Enterprise/Site/Area/WorkCenter/WorkUnit/Equipment/Attribute
```

### Examples
```
# Tag values
ACME/HOUSTON/PROD-A/LINE-01/R-101/temperature/value
ACME/HOUSTON/PROD-A/LINE-01/R-101/pressure/value

# Alarms
ACME/HOUSTON/PROD-A/LINE-01/R-101/temperature/alarm

# Equipment status
ACME/HOUSTON/PROD-A/LINE-01/R-101/status

# Batch execution
ACME/HOUSTON/PROD-A/LINE-01/batch/BATCH-001/state

# Production orders
ACME/HOUSTON/PROD-A/LINE-01/order/PO-2024-001/status
```

### Topic Categories
| Category | Suffix | Description |
|----------|--------|-------------|
| `value` | `/value` | Current process value |
| `alarm` | `/alarm` | Alarm status |
| `setpoint` | `/setpoint` | Writable setpoint |
| `status` | `/status` | Equipment status |
| `command` | `/command` | Command topic |
| `event` | `/event` | Event notification |
| `metadata` | `/metadata` | Tag metadata |
| `history` | `/history` | Historical data |

## 🛠️ Commands

### Container Management
```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# Restart a specific service
docker compose restart app

# View logs
docker compose logs -f app
docker compose logs -f emqx
docker compose logs -f postgres

# Check status
docker compose ps

# Execute command in container
docker compose exec app sh
docker compose exec postgres psql -U uns_user -d uns_manufacturing
```

### Database Operations
```bash
# Run database seed
docker compose exec app npx prisma db seed

# Run migrations
docker compose exec app npx prisma migrate deploy

# Open Prisma Studio
docker compose exec app npx prisma studio

# PostgreSQL CLI
docker compose exec postgres psql -U uns_user -d uns_manufacturing
```

### Backup & Restore
```bash
# Backup database
docker compose exec postgres pg_dump -U uns_user uns_manufacturing > backup_$(date +%Y%m%d).sql

# Restore database
cat backup.sql | docker compose exec -T postgres psql -U uns_user uns_manufacturing
```

### MQTT Testing
```bash
# Subscribe to all topics
docker compose exec emqx mosquitto_sub -h localhost -t "#" -v

# Subscribe to specific enterprise
docker compose exec emqx mosquitto_sub -h localhost -t "ACME/#" -v

# Publish test message
docker compose exec emqx mosquitto_pub -h localhost -t "ACME/HOUSTON/test/value" -m '{"value": 42.5}'
```

## 🔧 Environment Variables

### Required Variables
```env
# Database
DATABASE_URL=postgresql://uns_user:uns_password@postgres:5432/uns_manufacturing?schema=public

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secure-random-string

# InfluxDB
INFLUXDB_URL=http://influxdb:8086
INFLUXDB_TOKEN=uns-platform-super-secret-token
INFLUXDB_ORG=uns-platform
INFLUXDB_BUCKET=manufacturing

# MQTT
MQTT_BROKER_URL=mqtt://emqx:1883
MQTT_WS_URL=ws://localhost:8083/mqtt

# Redis
REDIS_URL=redis://redis:6379
```

### Generate Secure Secrets
```bash
# NextAuth secret
openssl rand -base64 32

# InfluxDB token
openssl rand -base64 64
```

## 🏭 Database Seeding

The database is automatically seeded on first run with:

- **Enterprise**: Acme Manufacturing Corp (ACME)
- **Sites**: Houston Manufacturing Plant, Berlin Production Facility
- **Areas**: Production Area A, Packaging Area B
- **Work Centers**: Production Line 1, Production Line 2, Utility Systems
- **Work Units**: Reactor R-101, Mixer M-101, Storage Tank T-101
- **Equipment**: Pumps, Motors, VFDs, PLCs
- **Tags**: Temperature, Pressure, Level, Flow, Speed
- **Recipes**: Gamma Production Recipe
- **Production Orders**: PO-2024-001
- **Users**: admin@acme.com, engineer@acme.com, operator@acme.com

## 🔒 Production Checklist

Before deploying to production:

- [ ] Change all default passwords
- [ ] Generate secure `NEXTAUTH_SECRET`
- [ ] Configure EMQX authentication
- [ ] Enable TLS/SSL certificates
- [ ] Set up database backups
- [ ] Configure firewall rules
- [ ] Review Grafana security settings
- [ ] Disable anonymous MQTT access
- [ ] Configure proper ACL rules

### Rollback: disable real-time pipeline

- **Disable MQTT connector only**: set `ENABLE_MQTT_CONNECTOR=false` in app env. Tag ingest stops; Socket.IO and time-series API keep running.
- **Stop live updates to frontend**: frontend can stop connecting to Socket.IO (port 3001); the app and pipeline continue to run.

---

### EMQX Security Configuration
```bash
# Create authentication user
docker compose exec emqx emqx ctl users add "uns-platform" "secure-password"

# Enable authentication
# Edit EMQX configuration to require authentication
```

## 🐛 Troubleshooting

### Container won't start
```bash
# Check logs
docker compose logs app

# Common issues:
# 1. Port already in use - change ports in docker-compose.yml
# 2. Volume permission issues
# 3. Memory issues - increase Docker memory limit
```

### Database connection issues
```bash
# Check PostgreSQL
docker compose logs postgres

# Test connection
docker compose exec postgres psql -U uns_user -d uns_manufacturing -c "SELECT 1"
```

### MQTT connection issues
```bash
# Check EMQX status
docker compose logs emqx

# Test MQTT connection
docker compose exec emqx mosquitto_sub -h localhost -t "$SYS/#" -v
```

### Reset everything
```bash
# WARNING: This deletes all data!
docker compose down -v
docker compose up -d --build
```

## 📁 Volume Locations

| Volume | Location | Purpose |
|--------|----------|---------|
| `uns-postgres-data` | Docker volume | PostgreSQL data |
| `uns-redis-data` | Docker volume | Redis persistence |
| `uns-influxdb-data` | Docker volume | InfluxDB time-series data |
| `uns-emqx-data` | Docker volume | EMQX broker data |
| `uns-grafana-data` | Docker volume | Grafana dashboards |

## 📦 Optional Profiles

### Admin Tools
```bash
# Start with admin tools (PgAdmin)
docker compose --profile admin up -d
```

## 🔄 Rebuilding

```bash
# Rebuild after code changes
docker compose up -d --build app

# Full rebuild (no cache)
docker compose build --no-cache app
docker compose up -d app
```

## 📊 Grafana Dashboards

Pre-configured datasources:
- **InfluxDB**: Time-series metrics (temperature, pressure, etc.)
- **PostgreSQL**: Relational data (orders, batches, genealogy)
- **EMQX**: MQTT broker metrics

Import dashboards from `grafana/dashboards/` directory.
