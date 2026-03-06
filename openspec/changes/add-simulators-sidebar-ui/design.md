## Context

The app is a Next.js manufacturing platform with a slate-themed sidebar (`app-sidebar.tsx`) and content panels (Dashboard, SCADA, MES, Edge, Admin, etc.). Simulators live under `simulators/` with one JSON config (`simulators/simulators.json`) defining Modbus, OPC UA, and Energy Meter instances (id, name, type, port, config, status). They can run as local processes (Bun/Node) or as Docker containers; Dockerfiles are in `docker/` and currently reference `mini-services/` paths. There is no existing API or UI for simulators; the frontend does not read simulator config today.

## Goals / Non-Goals

**Goals:**

- Add a "Simulators" section in the left sidebar and a dedicated panel showing list, status, and connection info for all configured simulators.
- Expose simulator config via an API so the UI can render it; optionally indicate liveness (running vs unreachable) for local or Docker runs.
- Display connection details that work for both local development (e.g. localhost:5020) and Docker (e.g. service name or host-visible port).
- Match existing platform patterns: same nav/sidebar style, same panel layout (cards, badges, tables), hash-based routing (`/#simulators`).

**Non-Goals:**

- Starting/stopping simulators from the UI (read-only status and connection info in this change).
- Editing simulator config from the UI (config remains file-based).
- Persisting simulator state in the database (config is file/env only for this change).

## Decisions

**1. API: single route reading from filesystem**

- Add `GET /api/simulators` that reads `simulators/simulators.json` from the project (path configurable via env e.g. `SIMULATORS_CONFIG_PATH`). Return the `simulators` array normalized for the UI (id, name, type, port, enabled, description, connection info). No DB or new data model.
- Rationale: Keeps implementation simple; config is already in one JSON file. Env override allows Docker or different mounts.

**2. Liveness: not in v1**

- Decision: Do not implement liveness in this change. Show config-based "status" from JSON only (e.g. "running" as static). Keeps implementation simple and modular; liveness can be added later if needed.
- Rationale: User chose to ship without liveness; avoids TCP checks and extra latency.

**3. Connection info: local vs Docker**

- Derive two display contexts: (1) **Local**: host = `localhost` (or `NEXT_PUBLIC_SIMULATORS_HOST`), port from config; (2) **Docker**: host = simulator **id** as Compose service name (e.g. `modbus-1`, `opcua-1`, `meter-1`). API returns for each simulator: `connection.local` and `connection.docker`. UI shows both.
- Rationale: Single source of truth; simulator id is the natural service name in Compose.

**4. Docker Compose and Dockerfile paths**

- Add simulator services to the **main** `docker-compose.yml` (user choice: option A). Dockerfiles use build context from **repo root** (easy maintainable): e.g. `context: .` and `dockerfile: docker/Dockerfile.modbus`; COPY from `simulators/modbus-service`, etc. All three Dockerfiles follow the same modular pattern; OPC UA uses Bun for consistency with modbus and energymeter.
- Rationale: One compose file; same codebase runs as local server and Docker image; consistent paths and runtime.

**5. Frontend: one panel, no sub-tabs for v1**

- Single Simulators panel: header, short intro, then a table or card list of simulators with columns/cards: name, type, port, status (badge), connection (copyable local + Docker). Optional: group by type (Modbus, OPC UA, Energy Meter) or filter. Follow Edge panel / SCADA panel structure (Card, CardHeader, CardTitle, CardContent, Badge, Table or grid).
- Rationale: Keeps scope small; grouping/filter can be added later.

## Risks / Trade-offs

- **Config path in production**: If the app runs in Docker, the config file must be mounted or baked into the image. Mitigation: Env var `SIMULATORS_CONFIG_PATH`; in compose, mount `simulators/simulators.json` or copy it in during build.
- **Liveness timeouts**: Checking many simulators sequentially can add latency. Mitigation: Run checks in parallel with a short timeout; or make liveness a separate request/button so the list loads fast and status refreshes on demand.
- **Dockerfile path change**: Switching from `mini-services/` to `simulators/` might break existing CI/builds that assume old paths. Mitigation: Update all Dockerfiles and any compose/build scripts in this change; document in tasks.

## Migration Plan

1. Add API route and shared simulator normalization lib; no DB migrations. No liveness in v1.
2. Add sidebar entry and Simulators panel; extend `getModuleFromHash` and `renderContent` in `page.tsx` for `simulators`. Reuse existing Card, Badge, Table, loading/error patterns.
3. Update Dockerfiles to use `simulators/` paths with build context from repo root; add simulator services to main `docker-compose.yml` with simulator id as service name; mount `simulators.json`.
4. Rollback: remove sidebar entry, panel, API route, and lib; revert Dockerfile and compose changes if needed.

## Open Questions

- None; env var names: `SIMULATORS_CONFIG_PATH`, `NEXT_PUBLIC_SIMULATORS_HOST` (for local connection display).
