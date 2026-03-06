## ADDED Requirements

### Requirement: Pipeline flows MQTT to InfluxDB to Socket.IO

The system SHALL implement an end-to-end pipeline: MQTT messages are consumed by the connector, decoded, written to InfluxDB, and the same value SHALL be used to notify the Socket.IO layer so subscribed frontend clients receive the update.

#### Scenario: Value flows through pipeline

- **WHEN** an MQTT message is received and parsed for a known tag
- **THEN** the system SHALL first write the point to InfluxDB, then SHALL trigger a broadcast to the Socket.IO room(s) for that tag so clients get the update

#### Scenario: Order of operations

- **WHEN** processing a tag value
- **THEN** the system SHALL persist to InfluxDB before or concurrently with emitting to Socket.IO; Socket.IO SHALL not emit without a defined source (pipeline) after write

### Requirement: Pipeline handles errors and backpressure at scale

The system SHALL handle InfluxDB write failures and SHALL support batching or backpressure so that at thousands-of-tags scale the pipeline does not unboundedly buffer or crash. Failures SHALL be logged and SHALL not silently drop data without a documented strategy (e.g. drop, retry, or dead-letter).

#### Scenario: InfluxDB write failure

- **WHEN** an InfluxDB write fails (network, rate limit, or server error)
- **THEN** the system SHALL log the failure and SHALL apply a defined behavior (retry with limit, drop, or buffer) as specified in implementation

#### Scenario: High throughput

- **WHEN** message rate is high (thousands of tags updating)
- **THEN** the system SHALL use batching or backpressure so that memory and write load remain bounded
