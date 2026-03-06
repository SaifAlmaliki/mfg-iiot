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

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: ['socket.io', 'socket.io-client', 'mqtt', '@influxdata/influxdb-client', '@prisma/client', '@prisma/adapter-pg', 'prisma'],
  env: {
    DATABASE_URL: databaseUrl,
    NEXT_DATABASE_URL: databaseUrl, // Also expose with a different name
  },
};

export default nextConfig;
