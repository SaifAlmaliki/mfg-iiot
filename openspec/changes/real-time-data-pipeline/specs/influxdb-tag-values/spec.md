## ADDED Requirements

### Requirement: Tag time-series are written only to InfluxDB

The system SHALL write all real-time tag values from the pipeline to InfluxDB only. Postgres TagValue table SHALL NOT be written by the real-time pipeline for live ingest.

#### Scenario: New value is written to InfluxDB

- **WHEN** the pipeline receives a tag value (tagId, value, quality, timestamp)
- **THEN** the system SHALL write a point to the configured InfluxDB bucket with measurement and tags/fields as defined in the design

#### Scenario: No write to Postgres TagValue for live data

- **WHEN** a tag value is processed by the real-time pipeline
- **THEN** the system SHALL NOT insert or update the Postgres TagValue table for that value

### Requirement: InfluxDB schema supports querying by tag and time

The system SHALL use a consistent InfluxDB data model: measurement for tag values, tagId (and optional equipmentId/workUnitId) as tags, value and quality as fields, and message timestamp. Queries SHALL support filtering by tagId and time range.

#### Scenario: Point has correct structure

- **WHEN** a point is written to InfluxDB
- **THEN** it SHALL include tagId (and optional asset/area tags), value, quality, and timestamp as specified

#### Scenario: Query by tag and time range

- **WHEN** a client requests time-series for a tagId and time range
- **THEN** the read API SHALL return points from InfluxDB for that tag within the range

### Requirement: Read API for last value and time range

The system SHALL provide a read API (used by UI or REST) that returns the last value for one or more tags and SHALL support time-range queries with optional aggregation or downsampling for trending.

#### Scenario: Last value for a tag

- **WHEN** a client requests the last value for a tagId
- **THEN** the API SHALL return the most recent value, quality, and timestamp from InfluxDB for that tag

#### Scenario: Time range query

- **WHEN** a client requests values for a tagId and time range
- **THEN** the API SHALL return points (or downsampled/aggregated series) from InfluxDB within that range
