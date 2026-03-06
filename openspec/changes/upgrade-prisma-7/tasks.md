## 1. Setup

- [x] 1.1 Ensure Node ≥20.19.0 and TypeScript ≥5.4.0 (check or update engines / tsconfig)
- [x] 1.2 Install Prisma 7 and adapter: add `@prisma/client@7` and `@prisma/adapter-pg` to dependencies, `prisma@7` to devDependencies; run install
- [x] 1.3 Resolve ESM: add `"type": "module"` to package.json if acceptable, or document ESM boundary; align tsconfig (module, moduleResolution, target) if needed

## 2. Prisma config

- [x] 2.1 Add `prisma.config.ts` at project root with `defineConfig`, `schema`, `datasource.url` (via `env("DATABASE_URL")`), and `import "dotenv/config"`
- [x] 2.2 Configure `migrations.path` and `migrations.seed` in `prisma.config.ts` to match current prisma/migrations and seed script

## 3. Schema and generator

- [x] 3.1 Change generator from `prisma-client-js` to `prisma-client` and set `output` (e.g. `./generated/prisma/client`)
- [x] 3.2 Remove deprecated datasource fields from schema (e.g. `directUrl`); rely on prisma.config.ts for URL used by CLI
- [x] 3.3 Confirm `fullTextSearchPostgres` (or equivalent) is still supported in Prisma 7 generator; remove or replace if not

## 4. Generate and client usage

- [x] 4.1 Run `prisma generate` and verify client is emitted to the configured output path
- [x] 4.2 Find all files that import from `@prisma/client` and change imports to the generated path (e.g. `./generated/prisma/client` or relative equivalent)
- [x] 4.3 Create or update shared Prisma Client factory: instantiate with `new PrismaClient({ adapter })` using `@prisma/adapter-pg` and `DATABASE_URL`; add SSL/pool options if required
- [x] 4.4 Replace any direct `new PrismaClient({ datasources... })` usage with the adapter-based singleton or factory

## 5. Middleware and extensions

- [x] 5.1 Search codebase for `prisma.$use(`; if found, replace with `$extends`-based Client Extensions and use the extended client everywhere

## 6. Scripts and CI

- [x] 6.1 Ensure Dockerfile or build pipeline runs `prisma generate` explicitly before steps that need the client
- [x] 6.2 Keep `db:seed` as explicit (`prisma db seed` or `bunx prisma db seed`); remove any reliance on auto-seed after migrate
- [x] 6.3 Remove or update references to removed CLI flags (e.g. `--skip-generate`, `--skip-seed`) and removed env vars (e.g. `PRISMA_MIGRATE_SKIP_SEED`) in scripts or CI

## 7. Validation

- [x] 7.1 Run `prisma migrate dev` (or `prisma migrate deploy`) and confirm migrations apply without error
- [x] 7.2 Run `prisma db seed` and confirm seed completes successfully
- [x] 7.3 Start the application and run a smoke test (e.g. one API or page that uses Prisma)
- [x] 7.4 Rebuild the application Docker image and verify build completes without the Prisma 6→7 upgrade notice and that runtime works
