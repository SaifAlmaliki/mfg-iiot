import type { NextConfig } from "next";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Read DATABASE_URL directly from .env file to override system env
let databaseUrl = process.env.DATABASE_URL;
const envPath = resolve(process.cwd(), '.env');

if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('DATABASE_URL=')) {
      databaseUrl = trimmed.substring('DATABASE_URL='.length);
      break;
    }
  }
}

// Use jose browser build to avoid Node ESM resolution issues (missing runtime/asn1.js with Bun/Turbopack).
// Turbopack on Windows does not support absolute paths in resolveAlias; use relative path.
const joseBrowserPath = resolve(process.cwd(), 'node_modules/jose/dist/browser/index.js');

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: ['socket.io', 'socket.io-client', 'mqtt', '@influxdata/influxdb-client', '@prisma/client', '@prisma/adapter-pg', 'prisma'],
  turbopack: {
    resolveAlias: {
      // Relative path required: Turbopack reports "windows imports are not implemented yet" for absolute paths.
      jose: './node_modules/jose/dist/browser/index.js',
    },
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = { ...config.resolve.alias, jose: joseBrowserPath };
    return config;
  },
  env: {
    DATABASE_URL: databaseUrl,
    NEXT_DATABASE_URL: databaseUrl, // Also expose with a different name
  },
};

export default nextConfig;
