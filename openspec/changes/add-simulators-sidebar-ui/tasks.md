## 1. API and config

- [x] 1.1 Add GET /api/simulators route that reads simulator config from filesystem (default path simulators/simulators.json, override via SIMULATORS_CONFIG_PATH env)
- [x] 1.2 Normalize response via shared lib: for each simulator return id, name, type, port, enabled, description, status (from config), and connection object with local (e.g. localhost:port) and docker (e.g. service-name:port using simulator id as service name); use NEXT_PUBLIC_SIMULATORS_HOST for local host when set
- [x] 1.3 Use connection host for local from env NEXT_PUBLIC_SIMULATORS_HOST when set, else localhost; for Docker use simulator id as Compose service name (e.g. modbus-1:5020)

## 2. Dockerfiles and Compose

- [x] 2.1 Update Dockerfile.modbus to copy from simulators/modbus-service (replace mini-services/modbus-service); use build context from repo root for easy maintenance
- [x] 2.2 Update Dockerfile.opcua to copy from simulators/opcua-service; use Bun for consistency with other simulators (modular, same pattern)
- [x] 2.3 Update Dockerfile.energymeter to copy from simulators/energy-meter-service (replace mini-services/energy-meter-service)
- [x] 2.4 Add simulator services to main docker-compose.yml; use simulator id as service name; mount simulators.json; document running simulators (local vs Docker)

## 3. Sidebar and routing

- [x] 3.1 Add "Simulators" nav item in app-sidebar.tsx (icon Cpu or Server), href /#simulators, same pattern as Edge Connectors / Dashboard
- [x] 3.2 In page.tsx getModuleFromHash(), handle hash simulators and set currentModule to simulators
- [x] 3.3 In page.tsx renderContent(), when currentModule === 'simulators' render SimulatorsPanel

## 4. Simulators panel UI (modular, DRY, reuse components)

- [x] 4.1 Create SimulatorsPanel component reusing Card, CardHeader, CardTitle, CardContent, Badge, Table from existing UI; title and short intro
- [x] 4.2 Fetch simulator list from GET /api/simulators on mount; show loading and error states (reuse Skeleton or Loader2 pattern from dashboard/edge)
- [x] 4.3 Render list as table: name, type (Badge), port, status (Badge from config), connection local and docker (copyable or readable); reuse Table components from edge-panel
- [x] 4.4 Use platform styling (slate theme, emerald accents) to match Edge/SCADA panels

## 5. Verification

- [ ] 5.1 With simulators.json in place, GET /api/simulators returns list with connection.local and connection.docker for each entry
- [ ] 5.2 Visiting /#simulators shows Simulators panel and highlights Simulators in sidebar; clicking Simulators in sidebar switches to panel and updates hash
- [ ] 5.3 Simulators panel displays all configured simulators with correct type, port, and connection info; works when simulators run locally or in Docker
- [ ] 5.4 Docker build from repo root with context . and dockerfile docker/Dockerfile.* succeeds; simulator containers read config from mounted simulators.json
