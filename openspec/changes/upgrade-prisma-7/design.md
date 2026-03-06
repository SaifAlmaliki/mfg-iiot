## Context

The UNS Platform uses Prisma 6.19.2 with PostgreSQL. The schema uses `prisma-client-js`, `directUrl`, and preview feature `fullTextSearchPostgres`. The app runs with Next.js and Bun; Docker builds run `prisma generate` during the image build, which currently prints an upgrade notice to 7.4.2. There is no global `"type": "module"` in `package.json`. Prisma 7 is ESM-only, uses a new Rust-free client with required driver adapters, and moves URL/migrations/seed configuration into `prisma.config.ts`.

## Goals / Non-Goals

**Goals:**

- Upgrade to Prisma 7.x (e.g. 7.4.2) with all breaking changes addressed.
- Keep `prisma generate`, migrations, seed, and Docker build working.
- Use the new `prisma-client` provider and driver adapter for PostgreSQL.
- Centralize Prisma CLI config in `prisma.config.ts` (schema path, datasource URL, migrations path, seed).
- Ensure all PrismaClient usage uses the new adapter-based instantiation and generated output path.

**Non-Goals:**

- Migrating to Prisma Accelerate or other hosted options.
- Changing database provider or schema design beyond what Prisma 7 requires.
- Adding new Prisma features (e.g. metrics, new preview features) unless needed for compatibility.

## Decisions

1. **ESM and package.json**  
   Prisma 7 ships as ESM. Add `"type": "module"` to `package.json` only if the rest of the project can run as ESM (Next.js and Bun typically support it). If the app is still CJS or hybrid, evaluate using dynamic `import()` or a minimal ESM boundary for Prisma; otherwise set `"type": "module"` and align `tsconfig` (e.g. `module: "ESNext"`, `moduleResolution: "bundler"`, `target: "ES2023"`) so generated client and config are consumable.

2. **Generator and output path**  
   Use the new `prisma-client` provider and set a fixed `output` (e.g. `./generated/prisma/client`) so the client is no longer in `node_modules`. All imports will change from `@prisma/client` to the chosen path (e.g. `./generated/prisma/client` or a path relative to the consuming file).

3. **Driver adapter**  
   Use `@prisma/adapter-pg` for PostgreSQL. Instantiate with `new PrismaClient({ adapter })` where `adapter` is created from the Postgres connection string (and optional pool/SSL settings). Do not use the legacy `datasources.db.url` constructor form for the main app client.

4. **prisma.config.ts**  
   Add a root-level `prisma.config.ts` that uses `defineConfig` and `env()` from `prisma/config`, and configures: `schema`, `datasource.url` (and optional `shadowDatabaseUrl` if using shadow DB for migrations), `migrations.path`, and `migrations.seed`. Load env (e.g. `import "dotenv/config"`) at the top so CLI commands see `DATABASE_URL`. For Docker/CI, ensure `.env` or env vars are present when running Prisma CLI.

5. **Seeding and generate**  
   Prisma 7 does not auto-run seed after `migrate dev` / `migrate reset`, and no longer auto-runs `generate` in those commands. Keep `db:seed` as an explicit script (`bunx prisma db seed`). In Docker and CI, explicitly run `prisma generate` (and optionally `prisma migrate deploy` and `prisma db seed`) in the order required by the deployment.

6. **Client middleware**  
   If the codebase uses `prisma.$use(...)`, replace with Client Extensions (`$extends`) as per Prisma 7 docs. If there is no middleware, no change.

7. **fullTextSearchPostgres**  
   Confirm in Prisma 7 docs whether this preview feature is still supported or renamed; keep it in the generator block if supported, or adjust queries if the API changed.

## Risks / Trade-offs

- **[Risk] ESM vs CJS** → Ensure the app and Next.js build work with `"type": "module"` (or the chosen ESM strategy). If not, consider delaying the upgrade or isolating Prisma in an ESM layer.  
- **[Risk] Connection pool / timeouts** → v7 uses the driver’s pool (e.g. `pg`). If timeouts or connection issues appear, tune the adapter (e.g. connection timeout) to match previous behavior.  
- **[Risk] SSL certificate validation** → v7 may reject invalid certs. For local or internal DBs with self-signed certs, use adapter options (e.g. `ssl: { rejectUnauthorized: false }`) or proper CA configuration.  
- **[Risk] Removed env vars** → Scripts or CI that rely on removed vars (e.g. `PRISMA_MIGRATE_SKIP_SEED`) must be updated to use explicit commands instead.

## Migration Plan

1. **Prep**: Branch, install Prisma 7 and adapter: `npm i @prisma/client@7 @prisma/adapter-pg` and `npm i -D prisma@7`. Ensure Node ≥20.19.0 and TypeScript ≥5.4.0.
2. **Config**: Add `prisma.config.ts` at repo root; move `DATABASE_URL` (and optional shadow/seed) usage into it; ensure dotenv loads for CLI.
3. **Schema**: Switch generator to `prisma-client`, set `output`, remove deprecated datasource fields (e.g. `directUrl` from schema; set in config if needed). Verify preview features.
4. **Generate**: Run `prisma generate`, then replace every `@prisma/client` import with the new output path and switch to adapter-based `new PrismaClient({ adapter })`.
5. **Middleware**: Replace any `$use` with `$extends`-based extensions.
6. **Scripts/CI**: Update scripts so `generate` is explicit where needed; keep `db:seed` explicit; remove references to removed CLI flags or env vars.
7. **Validation**: Run migrations (e.g. `prisma migrate dev` or `prisma migrate deploy`), run seed, start app and run smoke tests. Rebuild Docker image and run the same checks.
8. **Rollback**: Keep the branch; rollback is reverting the PR and redeploying. Database schema is unchanged by the client upgrade, so no DB rollback needed.

## Open Questions

- Confirm whether the repo already uses `"type": "module"` or CJS in a way that would conflict with Prisma 7 ESM.
- Confirm if any `prisma.$use` middleware exists and document the exact extension replacement.
- Decide final generated client path (e.g. `./generated/prisma/client`) and stick to it in all imports.
