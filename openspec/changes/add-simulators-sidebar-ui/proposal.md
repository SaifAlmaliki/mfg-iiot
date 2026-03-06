## Why

The platform has three simulator types (Modbus TCP, OPC UA, Energy Meter) defined in `simulators/simulators.json`, runnable as local Node/Bun services or as Docker images. Operators and developers need a single place in the app to see which simulators are configured, their status (running/stopped/unreachable), and how to connect (host, port, protocol, connection strings). Today there is no UI for this; config lives only in JSON and Docker Compose, and connection details are not discoverable from the platform.

## What Changes

- **New sidebar section**: Add a "Simulators" item in the left navigation (same pattern as Dashboard, SCADA, MES, Edge, etc.) with a dedicated route/hash (e.g. `/#simulators`).
- **Simulators panel**: A dedicated panel (same layout pattern as Edge Connectors, SCADA, etc.) that lists all simulators from config, shows status (running / stopped / unreachable), and shows connection information (host, port, protocol, example connection strings or client settings). UI follows existing platform style (cards, badges, tables, dark sidebar theme).
- **API for simulator config**: The frontend needs to read the simulator list and, where possible, status. Serve `simulators.json` (or a normalized subset) via an API route so the app can display it; optionally support simple liveness checks (e.g. TCP connect or HTTP health) so status reflects "running" vs "unreachable" when running locally or in Docker.
- **Local vs Docker**: Document or derive connection host/port so it works when simulators run on localhost (dev) or in Docker (e.g. service names or host.docker.internal). The UI shows connection details that work in both contexts (e.g. "Local: localhost:5020" and "Docker: modbus-1:5020" or a single configurable base URL).

## Capabilities

### New Capabilities

- `simulators-dashboard`: Backend API and frontend panel for simulator list, status, and connection info. Includes: API route(s) to expose simulator config (from `simulators/simulators.json`) and optional liveness; sidebar nav item and Simulators panel with status indicators and connection details (host, port, protocol, copyable connection strings); support for both local-server and Docker deployment contexts in displayed connection info.

### Modified Capabilities

- None.

## Impact

- **Frontend**: New sidebar entry in `app-sidebar.tsx`; new `SimulatorsPanel` (or equivalent) component; `page.tsx` routing/hash for `simulators`; reuse existing UI primitives (Card, Badge, Table, Tabs, etc.) and styling (slate theme, emerald accents).
- **Backend**: New API route(s) under e.g. `app/api/simulators/` to read and optionally validate/liveness-check simulator config; config may be read from filesystem (`simulators/simulators.json`) or env (path override).
- **Config / Docker**: No change to `simulators.json` schema for this change. Docker Compose (in `docker/`) may be extended to include simulator services so "Docker" mode is a one-command stack; Dockerfiles currently reference `mini-services/` paths—consider aligning with `simulators/` if that is the canonical location.
- **Dependencies**: None beyond existing stack (Next.js, React, Prisma if needed for future persistence; for this change config is file-based).
