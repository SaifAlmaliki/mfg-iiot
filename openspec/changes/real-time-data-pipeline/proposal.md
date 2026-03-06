## Why

The platform has Tag and TagValue models and ISA-95–style MQTT topics in the schema, but no live data path. To support operator HMIs, trending, and alarms we need a real-time pipeline: ingest tag values from an MQTT broker (EMQX), store time-series in InfluxDB, and push updates to the frontend over WebSockets. This unblocks SCADA-style graphics, live dashboards, and historian features at roughly thousands-of-tags scale.

## What Changes

- **EMQX integration**: MQTT client that connects to EMQX, subscribes to tag topics (from `Tag.mqttTopic`), and forwards messages into the pipeline.
- **InfluxDB for time-series**: All tag value writes go to InfluxDB only; Postgres remains the source of truth for metadata (Tags, mappings, equipment, etc.). TagValue in Postgres is no longer the write target for live data (historical/legacy reads can be addressed separately).
- **Real-time tag streaming**: Pipeline that ingests MQTT messages, writes points to InfluxDB, and broadcasts updates to subscribed frontend clients.
- **Socket.IO server**: Backend Socket.IO server with rooms/subscriptions so the frontend (existing `socket.io-client`) receives live tag updates for selected tags or assets.
- **APIs**: Read APIs for time-series data from InfluxDB (e.g. last value, range, aggregation) used by UI and optional REST endpoints.
- **Deployment**: All components run via **Docker Compose** as **multiple Docker images** (app, Postgres, Redis, InfluxDB, EMQX, Grafana, optional admin tools). No primary “run without Docker” path; `docker compose up` is the standard way to run the full platform.

## Capabilities

### New Capabilities

- `mqtt-emqx-connector`: EMQX MQTT client; connect, subscribe to tag topics from metadata, parse messages, and publish into the internal pipeline (e.g. in-memory/queue or direct write path).
- `influxdb-tag-values`: InfluxDB as the only write target for tag time-series; bucket/schema design, write API, and read API for last value, time range, and downsampling for UI and APIs.
- `realtime-tag-pipeline`: End-to-end flow: MQTT messages → decode → write to InfluxDB → notify Socket.IO layer so subscribed clients get updates; error handling and backpressure at thousands-of-tags scale.
- `socketio-realtime-server`: Socket.IO server integrated with the app; rooms or channels per tag/asset/area; broadcast of tag value updates to connected frontend clients; optional auth and subscription scoping.

### Modified Capabilities

- None (no existing specs in openspec/specs/).

## Impact

- **New dependencies**: EMQX MQTT client library (e.g. `mqtt`), InfluxDB client (e.g. `@influxdata/influxdb-client`), Socket.IO server (align with existing `socket.io-client` on frontend). `ws` remains available for low-level use if needed.
- **Infrastructure**: All services run as Docker containers orchestrated by Docker Compose. EMQX, InfluxDB, Postgres, Redis, and the app are separate images; configuration via env (broker URL, InfluxDB URL/token, buckets) using **service names** (e.g. `emqx`, `influxdb`, `postgres`) for inter-container communication.
- **Application**: New services or modules: MQTT connector, InfluxDB read/write, pipeline orchestration, Socket.IO server (e.g. in Next.js custom server or separate Node process). No change to Prisma schema for Tags/metadata; TagValue may be deprecated for writes or used only for legacy/export.
- **Frontend**: Consume Socket.IO events for live tag values; existing `socket.io-client` and UI components can subscribe to tag/asset rooms and update state.
- **APIs**: New or extended routes for time-series reads (last value, range, aggregates) backed by InfluxDB.
