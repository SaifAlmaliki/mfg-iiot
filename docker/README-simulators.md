# Simulators – Docker build and run

Build and run the Modbus, OPC UA, and Energy Meter simulators with Docker. Run these commands from the **repository root** (parent of `docker/`).

## Build images

From repo root:

```bash
# Build all three simulator images (context = repo root)
docker build -f docker/Dockerfile.modbus -t uns-modbus-simulator .
docker build -f docker/Dockerfile.opcua -t uns-opcua-simulator .
docker build -f docker/Dockerfile.energymeter -t uns-energymeter-simulator .
```

Or build only one:

```bash
docker build -f docker/Dockerfile.modbus -t uns-modbus-simulator .
```

## Run with Docker Compose (recommended)

From repo root, start the simulator services defined in the main compose file:

```bash
docker compose -f docker/docker-compose.yml up -d modbus-simulator opcua-simulator energymeter-simulator
```

To build and start in one step:

```bash
docker compose -f docker/docker-compose.yml up -d --build modbus-simulator opcua-simulator energymeter-simulator
```

To start the full platform (including simulators):

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

## Run a single container (standalone)

Ensure `simulators/simulators.json` is available to the container. Example for Modbus:

```bash
# From repo root
docker run -d --name modbus-sim \
  -p 5020:5020 -p 5030:5030 -p 5040:5040 \
  -v "$(pwd)/simulators/simulators.json:/app/config/simulators.json:ro" \
  uns-modbus-simulator
```

OPC UA:

```bash
docker run -d --name opcua-sim \
  -p 4840:4840 -p 4850:4850 \
  -v "$(pwd)/simulators/simulators.json:/app/config/simulators.json:ro" \
  uns-opcua-simulator
```

Energy Meter:

```bash
docker run -d --name energymeter-sim \
  -p 5010:5010 -p 5011:5011 -p 5012:5012 \
  -v "$(pwd)/simulators/simulators.json:/app/config/simulators.json:ro" \
  uns-energymeter-simulator
```

## Endpoint URLs

- **Modbus / OPC UA:** Use endpoint format `opc.tcp://localhost:<port>` (e.g. `opc.tcp://localhost:5040` for Modbus, `opc.tcp://localhost:4840` for OPC UA). In Docker network use `opc.tcp://modbus-simulator:5020`, `opc.tcp://opcua-simulator:4840`, etc.
- **Energy Meter:** Use `tcp://localhost:5010` or `localhost:5010` depending on your client.

The Simulators UI shows these endpoint URLs with a copy button.

## Stop and remove

```bash
docker compose -f docker/docker-compose.yml stop modbus-simulator opcua-simulator energymeter-simulator
```

Or to remove containers:

```bash
docker compose -f docker/docker-compose.yml down
```
