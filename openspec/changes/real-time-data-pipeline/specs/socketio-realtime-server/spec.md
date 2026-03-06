## ADDED Requirements

### Requirement: Socket.IO server is available for frontend connections

The system SHALL run a Socket.IO server that the existing frontend (socket.io-client) can connect to. The server SHALL be reachable on the same origin as the application (or CORS-configured if different).

#### Scenario: Client can connect

- **WHEN** the frontend connects to the Socket.IO server with valid origin
- **THEN** the connection SHALL be accepted and the client SHALL receive connection confirmation

#### Scenario: Server runs with application

- **WHEN** the application starts (e.g. Next.js custom server or dedicated process)
- **THEN** the Socket.IO server SHALL be attached and listening for connections

### Requirement: Clients subscribe to tags for live updates

The system SHALL allow clients to subscribe to one or more tags (by tagId). Subscriptions SHALL be represented as rooms (e.g. tag:{tagId}). When a tag value is emitted by the pipeline, the server SHALL broadcast to the corresponding room(s) so only subscribed clients receive it.

#### Scenario: Subscribe to tag

- **WHEN** a client sends a subscription request for a tagId (or list of tagIds)
- **THEN** the server SHALL join that client to the room(s) for those tags

#### Scenario: Receive update for subscribed tag

- **WHEN** a new value for a tag is emitted by the pipeline and the client is subscribed to that tag
- **THEN** the client SHALL receive an event with the tag value (tagId, value, quality, timestamp)

#### Scenario: No update for unsubscribed tag

- **WHEN** a new value is emitted for a tag the client has not subscribed to
- **THEN** the client SHALL NOT receive that event

### Requirement: Event payload is well-defined

The system SHALL emit tag value events with a consistent payload shape (e.g. tagId, value, quality, timestamp) so the frontend can update UI and state predictably.

#### Scenario: Payload shape

- **WHEN** the server broadcasts a tag value update
- **THEN** the event payload SHALL include at least tagId, value, quality, and timestamp in a defined format
