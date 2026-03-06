# InfluxDB tag value schema

The real-time pipeline writes tag values to InfluxDB 2.x. Use a single bucket per environment (e.g. `manufacturing`); the bucket is created via Docker Compose init or manually in InfluxDB UI.

## Measurement and fields

- **Measurement**: `tag_value`
- **Tags** (indexed):
  - `tagId` (string): Postgres Tag.id (cuid)
  - `equipmentId` (string, optional): from Tag.equipmentId for filtering by asset
  - `workUnitId` (string, optional): from Tag.workUnitId for filtering by area
- **Fields**:
  - `value` (string): tag value as string (cast in queries as needed by dataType)
  - `quality` (string): GOOD, BAD, UNCERTAIN, INIT
- **Timestamp**: from message or write time (nanosecond precision)

## Example point (Flux / API)

```
tag_value,tagId=clxx...,equipmentId=clyy... value="42.5",quality="GOOD" 1709123456000000000
```

## Bucket creation

When using Docker Compose, InfluxDB is initialized with org `uns-platform` and bucket `manufacturing` via `DOCKER_INFLUXDB_INIT_*` env vars. For a new environment, create the bucket in the InfluxDB UI or via the API using the same name.
