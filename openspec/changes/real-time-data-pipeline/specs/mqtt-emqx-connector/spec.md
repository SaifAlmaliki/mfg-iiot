## ADDED Requirements

### Requirement: Connector connects to EMQX broker

The system SHALL connect to the EMQX broker using configuration (broker URL, client ID, optional credentials) from environment variables and SHALL support reconnection with backoff on connection loss.

#### Scenario: Successful connection

- **WHEN** the connector starts with valid EMQX configuration
- **THEN** it establishes an MQTT connection to the broker and is ready to subscribe

#### Scenario: Reconnection on disconnect

- **WHEN** the connection to EMQX is lost
- **THEN** the connector SHALL attempt to reconnect with exponential backoff and resume subscriptions after reconnection

### Requirement: Connector subscribes to tag topics from metadata

The system SHALL load active tag MQTT topics from Postgres (Tag.mqttTopic where isActive) and SHALL subscribe to those topics on the EMQX broker. The system SHALL support refresh of subscriptions when tag metadata changes (e.g. new tags or topic updates).

#### Scenario: Initial subscription from metadata

- **WHEN** the connector starts and Tag metadata is loaded from Postgres
- **THEN** it subscribes to all distinct mqttTopic values for active tags

#### Scenario: Subscription refresh

- **WHEN** an admin adds or updates tag MQTT topics or triggers a refresh
- **THEN** the connector SHALL update its subscriptions to match current metadata (subscribe to new topics, optionally unsubscribe from removed ones)

### Requirement: Incoming MQTT messages are parsed and forwarded

The system SHALL parse incoming MQTT messages (topic, payload), map topic to tagId via metadata, and SHALL forward decoded tag value (tagId, value, quality, timestamp) into the pipeline for writing to InfluxDB and broadcasting.

#### Scenario: Valid message produces pipeline event

- **WHEN** an MQTT message arrives on a subscribed topic with a valid payload (value, optional quality, optional timestamp)
- **THEN** the system SHALL emit a pipeline event with tagId (resolved from topic), value, quality (default GOOD), and timestamp

#### Scenario: Unknown topic is ignored or logged

- **WHEN** an MQTT message arrives on a topic that does not match any Tag.mqttTopic in metadata
- **THEN** the system SHALL not crash and MAY log or drop the message
