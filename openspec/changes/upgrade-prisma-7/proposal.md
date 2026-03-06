## Why

The build currently uses Prisma 6.19.2; the CLI reports an available major update to 7.4.2. Upgrading keeps the stack on a supported major version, brings performance and DX improvements, and removes the upgrade notice from Docker/build output. Doing it now avoids drifting further from the current major and simplifies future upgrades.

## What Changes

- Upgrade `prisma` (CLI) and `@prisma/client` from 6.x to 7.x (latest stable, e.g. 7.4.2).
- Follow the [Prisma major upgrade guide](https://pris.ly/d/major-version-upgrade): run upgrade steps, adjust any breaking API or config changes, and re-validate migrations and generated client.
- **BREAKING**: Any code or config that relies on Prisma 6–specific behavior must be updated for Prisma 7 compatibility.
- Ensure `prisma generate` and migrations work in local and Docker builds; remove or silence the in-build upgrade notice once on 7.x.

## Capabilities

### New Capabilities

- `prisma-7-upgrade`: Dependency upgrade to Prisma 7 with schema/client compatibility, migration and generate green in CI/Docker, and no reliance on deprecated or removed Prisma 6 APIs.

### Modified Capabilities

- None (no existing specs in this change define Prisma-specific requirements).

## Impact

- **Dependencies**: `package.json` — `prisma` and `@prisma/client` version bumps.
- **Code**: All Prisma usage (e.g. `prisma/schema.prisma`, `prisma/seed.ts`, API routes and services using `PrismaClient`) may need updates for 7.x breaking changes.
- **Build**: Docker image build (e.g. `docker compose build app`) and any CI that runs `prisma generate` or migrations.
- **Docs**: Optional note in README or dev docs about required Node/Prisma version after upgrade.
