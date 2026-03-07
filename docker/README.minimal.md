# Minimal Docker stack (Postgres + EMQX + InfluxDB)

Use this to run only the infrastructure locally. The app and connector gateway run on the host and read MQTT/InfluxDB config from the platform UI (Settings > Integrations).

## Start

From **repo root**:

```bash
npm run docker:minimal
```

Or with docker compose directly (must be from repo root):

```bash
docker compose -f docker/docker-compose.minimal.yml up -d
```

If you are already in the `docker` folder:

```bash
docker compose -f docker-compose.minimal.yml up -d
```

## Services

| Service   | Port(s)        | Purpose                    |
|-----------|----------------|----------------------------|
| Postgres  | 5432           | App DB                     |
| InfluxDB  | 8086           | Time-series (tag values)   |
| EMQX      | 1883, 8083, 18083 | MQTT broker, WS, Dashboard |

## After starting

1. Set **DATABASE_URL** in `.env` for local Postgres (no SSL):

   ```env
   DATABASE_URL="postgresql://uns_user:uns_password@localhost:5432/uns_manufacturing?schema=public"
   ```

   Use the same user/password/database as in `docker-compose.minimal.yml` (e.g. `uns_user`, `uns_password`, `uns_manufacturing`). If your Postgres container uses different env vars, match them in the URL.

2. **Deploy the Prisma schema** (creates/updates tables):

   ```bash
   npm run db:push
   ```
   Or, if you use migrations: `npm run db:migrate`

3. **Seed the database** (demo data; uses upserts, does not wipe existing data):

   ```bash
   npm run db:seed
   ```
   Seeding against local Postgres is much faster than a remote DB.

4. Run the app: `npm run dev`.

5. In the app, go to **Administration > Integrations** and set:
   - **MQTT broker URL:** `mqtt://localhost:1883`
   - **InfluxDB URL:** `http://localhost:8086`
   - **InfluxDB token:** `uns-platform-super-secret-token`
   - **InfluxDB org:** `uns-platform`
   - **InfluxDB bucket:** `manufacturing`
5. Save. The app and (when run) the connector gateway will use this config from the DB.

## Stop

```bash
docker compose -f docker/docker-compose.minimal.yml down
```
