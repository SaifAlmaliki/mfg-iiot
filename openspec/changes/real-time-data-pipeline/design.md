## Context

The platform (Next.js, Prisma/Postgres) already has Tag metadata (including `mqttTopic`, `dataType`, `scanRate`) and TagValue in Postgres. There is no MQTT client, no time-series store, and no real-time push to the frontend. The frontend has `socket.io-client` and `ws`; no Socket.IO server exists yet. The goal is to add a real-time data pipeline: EMQX (MQTT) → InfluxDB (time-series) → Socket.IO (live updates), with Postgres used only for Tag/equipment/mapping metadata. Scale target is on the order of thousands of tags.

## Goals / Non-Goals

**Goals:**

- Ingest tag values from EMQX via MQTT using topic metadata from Postgres.
- Store all tag time-series in InfluxDB (no live writes to Postgres TagValue for the pipeline).
- Run a Socket.IO server so the frontend receives live tag updates for subscribed tags/assets.
- Expose read APIs for time-series (last value, range, aggregation) backed by InfluxDB.
- Support thousands of tags with clear error handling and optional backpressure.

**Non-Goals:**

- Migrating or backfilling existing Postgres TagValue data into InfluxDB (can be a follow-up).
- EMQX or InfluxDB cluster administration, HA, or multi-region design.
- Replacing or changing Prisma schema for Tags/metadata; TagValue remains in schema but is not the write target for this pipeline.
- Full historian UI (trending, export); this design enables it via InfluxDB APIs.

## Decisions

**1. MQTT client: Node `mqtt` library → EMQX**

- Use the standard `mqtt` npm package to connect to EMQX (protocol-compliant). Alternatives: MQTT.js (same ecosystem), or a separate ingest service in another language; Node keeps the stack unified and reuses Prisma for tag metadata.

**2. InfluxDB 2.x client and data model**

- Use `@influxdata/influxdb-client` (InfluxDB 2.x). One bucket per environment (e.g. `tag-values`). Measurement: `tag_value`; tags: `tagId` (from Postgres Tag.id), optional `equipmentId`/`workUnitId` for filtering; fields: `value` (string), `quality` (string); timestamp from message. This aligns with existing Tag.dataType and TagValue.quality and allows querying by tag or asset.

**3. Pipeline topology: single process vs separate worker**

- Run MQTT subscriber, InfluxDB writer, and Socket.IO in the same Node process (e.g. Next.js custom server or a dedicated `server.ts`) for simplicity. At thousands-of-tags scale, a single connection to EMQX and batched writes to InfluxDB are sufficient. If load grows, the MQTT→InfluxDB path can be moved to a worker or queue later without changing the external contracts.

**4. Socket.IO server: colocated with Next.js**

- Run Socket.IO on the same server as the Next.js app (custom server using `next/dist/server/next-server` or Express + Next handler) so one port serves both HTTP and WebSocket. The frontend already uses `socket.io-client`; no change to the client library. Rooms: e.g. `tag:{tagId}` and optionally `asset:{equipmentId}` or `area:{workUnitId}` so the UI can subscribe to the right scope.

**5. Subscription model: tag-based rooms**

- When a client subscribes to a tag (or list of tags), join the client to rooms `tag:{tagId}`. On each new value from the pipeline, write to InfluxDB then emit to the corresponding room(s). No need for a separate pub/sub store (e.g. Redis) at current scale; in-process broadcast is enough.

**6. Configuration**

- All external endpoints and secrets via env: `EMQX_BROKER_URL` (or `MQTT_BROKER_URL`), `EMQX_CLIENT_ID`, optional credentials; `INFLUXDB_URL`, `INFLUXDB_TOKEN`, `INFLUXDB_ORG`, `INFLUXDB_BUCKET`. Socket.IO uses the same origin; CORS only if the client is on a different host.

**7. Deployment: Docker Compose only, multi-container**

- **Everything runs through Docker Compose.** All components (app, Postgres, Redis, InfluxDB, EMQX, Grafana, optional PgAdmin) run as **separate Docker images**; there is no primary “run the app or brokers locally without Docker” path. The app container connects to EMQX, InfluxDB, and Postgres using **service names** as hostnames (e.g. `emqx`, `influxdb`, `postgres`) as defined in `docker-compose.yml`. Standard run: `docker compose up -d`; rebuild app with `docker compose up -d --build app`. This keeps dev, staging, and production aligned.

## Risks / Trade-offs

- **InfluxDB or EMQX down**: Pipeline stops ingesting; no automatic replay. Mitigation: reconnect with backoff; optional dead-letter or local buffer in a follow-up.
- **Backpressure**: Burst of MQTT messages can overwhelm InfluxDB writes. Mitigation: batch writes (e.g. by time or count), drop or sample if buffer exceeds a threshold (documented).
- **Tag metadata changes**: New tags or topic changes require the MQTT client to refresh subscriptions. Mitigation: periodic reload of active topics from Postgres or an admin-triggered refresh.
- **Socket.IO scaling**: Single-node in-process broadcast. Mitigation: sufficient for thousands of tags and moderate client count; later add Redis adapter if we need horizontal scaling of Socket.IO.
- **Postgres TagValue**: Becomes legacy for live pipeline. Mitigation: document that new live data is InfluxDB-only; keep TagValue for optional sync/export or deprecate in a later change.

## Migration Plan

1. Add dependencies: `mqtt`, `@influxdata/influxdb-client`, `socket.io` (server). Ensure **Docker Compose** defines all services (app, postgres, redis, influxdb, emqx, grafana) as separate images; app env in compose uses service hostnames (e.g. `mqtt://emqx:1883`, `http://influxdb:8086`, `postgresql://...@postgres:5432/...`).
2. Implement in feature branches: (a) InfluxDB client and bucket/schema, (b) MQTT connector and topic subscription from Prisma, (c) pipeline that writes to InfluxDB and notifies Socket.IO, (d) Socket.IO server and room subscription API, (e) time-series read API.
3. **Deploy**: Run the full stack with `docker compose up -d`. App image depends on postgres, influxdb, emqx (and optionally redis) with healthchecks; no DB migration required for Postgres (metadata unchanged).
4. Rollback: disable MQTT connector and/or Socket.IO via feature flag or env; or scale down app and keep only data services running.

## Open Questions

- Whether to add a small in-memory or Redis cache for “last value” to avoid hitting InfluxDB on every Socket.IO broadcast (optimization).
- Exact Socket.IO event names and payload shape (e.g. `tag:value` with `{ tagId, value, quality, timestamp }`) to be fixed in specs/tasks.
- Optional authentication for Socket.IO (e.g. reuse Next-Auth session) and scoping subscriptions by user/role in a later iteration.
