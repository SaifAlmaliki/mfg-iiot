## ADDED Requirements

### Requirement: Simulators list API

The system SHALL provide an API that returns the list of configured simulators. The API SHALL read from the simulator configuration file (default path `simulators/simulators.json`, overridable via environment). The response SHALL include for each simulator: id, name, type, port, enabled, description, and connection information for both local and Docker contexts (host and port or connection string).

#### Scenario: List simulators successfully

- **WHEN** client sends GET to the simulators list endpoint
- **THEN** the system returns a JSON array of simulator entries with id, name, type, port, enabled, description, and connection fields (local and docker)

#### Scenario: Config path override

- **WHEN** environment variable for config path is set and client requests the list
- **THEN** the system SHALL read the config from the path specified by the environment variable

### Requirement: Simulator connection information

The system SHALL derive and expose connection information for each simulator suitable for (1) local development (e.g. localhost and port) and (2) Docker deployment (e.g. service name and port or host-visible port). The API SHALL return both so the UI can display "Local" and "Docker" connection details.

#### Scenario: Connection info for local and Docker

- **WHEN** simulators list is returned
- **THEN** each simulator entry SHALL include connection data for local (host such as localhost, port) and for Docker (host such as service name, port) so users know how to connect in either mode

### Requirement: Optional liveness check

The system MAY support an optional liveness or status check that attempts to reach each simulator (e.g. TCP connect to host:port). When supported and requested, the API SHALL return a reachable/unreachable (or running/stopped) indication per simulator. The check SHALL use a short timeout to avoid blocking the list response.

#### Scenario: Liveness requested

- **WHEN** client requests simulator list with liveness check (e.g. query parameter or separate status endpoint)
- **THEN** the system attempts to reach each simulator's host:port and returns reachable/unreachable (or equivalent) per simulator within a bounded time

#### Scenario: Liveness not requested

- **WHEN** client requests simulator list without liveness
- **THEN** the system returns the list without performing TCP checks; status MAY reflect config-only value (e.g. from JSON)

### Requirement: Simulators sidebar entry

The application SHALL add a "Simulators" item in the left sidebar navigation, following the same pattern as existing items (Dashboard, SCADA, MES, Edge, etc.). The item SHALL link to the hash route used for the Simulators panel (e.g. `/#simulators`).

#### Scenario: Sidebar shows Simulators

- **WHEN** user views the main application layout
- **THEN** the sidebar SHALL display a "Simulators" navigation entry with an appropriate icon and link to the simulators route

### Requirement: Simulators panel

The application SHALL provide a Simulators panel that displays the list of simulators with status and connection information. The panel SHALL follow the platform's existing UI patterns (cards, badges, tables, slate theme). The panel SHALL show for each simulator: name, type, port, status (e.g. running/stopped/unreachable), and connection details (local and Docker) in a copyable or clearly readable form.

#### Scenario: Panel shows simulator list

- **WHEN** user navigates to the Simulators section (e.g. via sidebar or hash)
- **THEN** the Simulators panel SHALL display all simulators from the API with name, type, port, status, and connection info

#### Scenario: Panel matches platform style

- **WHEN** user views the Simulators panel
- **THEN** the panel SHALL use the same layout and styling patterns as other panels (e.g. Edge, SCADA): Card, Badge, Table or equivalent components and the platform color/theme

### Requirement: Hash routing for Simulators

The application SHALL support hash-based routing so that visiting the Simulators route (e.g. `/#simulators`) sets the active module to simulators and renders the Simulators panel. The routing logic SHALL be consistent with existing hash handling (e.g. in `page.tsx` and navigation store).

#### Scenario: Direct navigation to Simulators

- **WHEN** user opens the application with hash `#simulators` (or equivalent)
- **THEN** the Simulators panel SHALL be shown and the sidebar SHALL highlight the Simulators item

#### Scenario: Sidebar click updates URL

- **WHEN** user clicks the Simulators item in the sidebar
- **THEN** the URL hash SHALL update to the simulators route and the Simulators panel SHALL be displayed

### Requirement: Docker and local compatibility

Simulator connection information displayed in the UI SHALL be valid for both running simulators as local processes (e.g. on localhost) and as Docker services (e.g. via service name or host port). Dockerfiles and Compose configuration SHALL reference the canonical simulator code location (`simulators/`) so that the same codebase runs as local server and as Docker image.

#### Scenario: Docker build uses simulators path

- **WHEN** Docker images for simulators are built
- **THEN** the build context SHALL use the `simulators/` directory (e.g. `simulators/modbus-service`, `simulators/opcua-service`, `simulators/energy-meter-service`) so that local and Docker runs use the same config and code
