## 1. Setup and configuration

- [x] 1.1 Add dependencies: mqtt, @influxdata/influxdb-client, socket.io (server) to package.json
- [x] 1.2 Add env vars and config: MQTT_BROKER_URL (or EMQX_BROKER_URL), EMQX_CLIENT_ID, INFLUXDB_URL, INFLUXDB_TOKEN, INFLUXDB_ORG, INFLUXDB_BUCKET; document in .env.example; ensure app reads same vars as docker-compose.yml
- [x] 1.3 Create InfluxDB bucket (or document manual step) and define measurement/tag/field schema for tag_value
- [x] 1.4 Ensure Docker Compose runs all pipeline components as multi-container stack: app, postgres, redis, influxdb, emqx (and optional grafana); app uses service hostnames (emqx, influxdb, postgres) for URLs; document single-command run in DOCKER.md

## 2. InfluxDB client and write/read

- [x] 2.1 Implement InfluxDB client module: init from env, write single point (tagId, value, quality, timestamp) to configured bucket
- [x] 2.2 Add batched write path for high throughput: buffer by count or interval, flush to InfluxDB
- [x] 2.3 Implement last-value read: query InfluxDB for most recent point by tagId, return value, quality, timestamp
- [x] 2.4 Implement time-range read: query InfluxDB for tagId and time range, optional downsampling/aggregation for trending

## 3. MQTT (EMQX) connector

- [x] 3.1 Implement MQTT client: connect to EMQX using env config, support reconnection with backoff
- [x] 3.2 Load active tag MQTT topics from Postgres (Tag.mqttTopic where isActive) and subscribe to them on connect
- [x] 3.3 Parse incoming MQTT messages: map topic to tagId (via metadata), extract value, quality, timestamp; emit pipeline event (tagId, value, quality, timestamp)
- [x] 3.4 Add subscription refresh: reload topics from Postgres on interval or admin trigger and update MQTT subscriptions

## 4. Real-time pipeline orchestration

- [x] 4.1 Implement pipeline handler: on tag value from MQTT connector, write to InfluxDB (using batched path if enabled), then notify Socket.IO layer with same payload
- [x] 4.2 Add error handling: log InfluxDB write failures, apply retry or drop policy per design; ensure process does not crash on bad message or DB error
- [x] 4.3 Integrate MQTT connector with pipeline: start connector and pipe decoded messages into the handler

## 5. Socket.IO server

- [x] 5.1 Attach Socket.IO server to Next.js (custom server or Express + Next handler) so it listens on same origin
- [x] 5.2 Implement subscription API: client can subscribe to one or more tagIds; join client to rooms tag:{tagId}
- [x] 5.3 On pipeline notification, broadcast to corresponding tag room(s) with payload { tagId, value, quality, timestamp }
- [x] 5.4 Document event names and payload shape for frontend (e.g. tag:value or tag:update)

## 6. Time-series read API

- [x] 6.1 Add API route (or tRPC) for last value: input tagId(s), return latest value, quality, timestamp from InfluxDB
- [x] 6.2 Add API route for time range: input tagId, start, end, optional interval; return points or aggregated series from InfluxDB

## 7. Integration and docs

- [x] 7.1 Wire pipeline and Socket.IO so app start starts MQTT connector and Socket.IO server; add optional feature flag or env to disable MQTT
- [x] 7.2 Update frontend example or docs: connect to Socket.IO, subscribe to tags, display live updates
- [x] 7.3 Document rollback: how to disable MQTT connector and/or Socket.IO via env or flag

## 8. Docker Compose and multi-container

- [x] 8.1 Verify docker-compose.yml defines app (build from Dockerfile), postgres, redis, influxdb, emqx as separate services with healthchecks; app depends_on postgres, influxdb, emqx with conditions
- [x] 8.2 Ensure app container env in compose uses service names for MQTT (e.g. mqtt://emqx:1883), InfluxDB (http://influxdb:8086), DATABASE_URL (postgres host); no localhost for inter-service URLs
- [x] 8.3 Document in DOCKER.md that the platform is intended to run only via Docker Compose (all components as multi Docker images); include `docker compose up -d` and rebuild instructions
