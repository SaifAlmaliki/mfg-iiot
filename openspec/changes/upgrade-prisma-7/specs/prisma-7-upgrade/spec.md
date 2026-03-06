# Prisma 7 Upgrade

## ADDED Requirements

### Requirement: Prisma 7 packages and generator

The project SHALL use Prisma ORM 7.x for the CLI and client, and SHALL use the `prisma-client` generator with an explicit `output` path. The schema SHALL NOT use the deprecated `prisma-client-js` provider for new usage.

#### Scenario: Generate uses Prisma 7 and custom output

- **WHEN** `prisma generate` is run from the project root
- **THEN** the Prisma CLI is version 7.x and the client is generated to the configured output path (e.g. `./generated/prisma/client`), and no client is written to `node_modules/@prisma/client`

#### Scenario: Docker build runs generate successfully

- **WHEN** the application Docker image is built and the build step runs `prisma generate`
- **THEN** the command completes without error and the upgrade notice (6.x → 7.x) is no longer displayed

---

### Requirement: Prisma config for CLI

The project SHALL provide a root-level `prisma.config.ts` that configures schema path, datasource URL (from environment), and optionally migrations path and seed script, so that Prisma CLI commands use a single config source.

#### Scenario: Migrate dev uses config

- **WHEN** `prisma migrate dev` is run
- **THEN** the CLI reads schema and datasource URL from `prisma.config.ts` and migrations run without requiring `--schema` or inline URL

#### Scenario: Seed uses config

- **WHEN** `prisma db seed` is run
- **THEN** the CLI runs the seed script defined in `prisma.config.ts` (e.g. `migrations.seed`) and the seed completes successfully

---

### Requirement: PostgreSQL driver adapter

The application SHALL instantiate Prisma Client using the official PostgreSQL driver adapter (e.g. `@prisma/adapter-pg`) and SHALL NOT use the legacy constructor that takes `datasources.db.url` or `datasourceUrl` for the main runtime client.

#### Scenario: Client created with adapter

- **WHEN** the application creates a Prisma Client instance
- **THEN** it uses `new PrismaClient({ adapter })` where `adapter` is created from `@prisma/adapter-pg` (or the current Prisma 7–recommended Postgres adapter) with the connection string from environment

#### Scenario: Client connects and runs a query

- **WHEN** the application performs any Prisma query (e.g. findFirst, create)
- **THEN** the query runs without connection or adapter errors and returns expected data

---

### Requirement: Import path and no deprecated APIs

All Prisma Client imports SHALL use the generated output path (e.g. `./generated/prisma/client` or the project-chosen path). The codebase SHALL NOT use removed APIs (e.g. `prisma.$use` middleware); any such usage SHALL be replaced with Prisma 7–supported alternatives (e.g. Client Extensions).

#### Scenario: No import from node_modules Prisma client

- **WHEN** the codebase is searched for imports of `@prisma/client` for the project’s own Prisma Client
- **THEN** runtime Prisma Client usage imports from the configured generated path instead

#### Scenario: No deprecated middleware

- **WHEN** the codebase is searched for `$use(`
- **THEN** no usage of the removed middleware API remains, or it has been replaced with `$extends`-based extensions

---

### Requirement: Explicit generate and seed in workflows

Scripts and CI SHALL run `prisma generate` explicitly where a generated client is required. Seed SHALL be run explicitly (e.g. `prisma db seed`) and SHALL NOT rely on automatic post-migrate seeding by the CLI.

#### Scenario: Build or deploy runs generate

- **WHEN** a build or deployment pipeline needs the Prisma Client
- **THEN** the pipeline runs `prisma generate` (or equivalent) explicitly before steps that depend on the client

#### Scenario: Seed is explicit

- **WHEN** the database must be seeded (e.g. after migrate or reset)
- **THEN** the workflow runs `prisma db seed` (or the script defined in config) explicitly; it does not depend on Prisma 6–style auto-seed after migrate
