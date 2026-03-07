# AGENTS.md - UNS Platform Development Guide

## Project Overview

This is a Unified Namespace (UNS) Platform for manufacturing IIoT, built with Next.js 16, TypeScript, Prisma, and MQTT. It follows ISA-95 standards for manufacturing operations management.

## Build/Lint/Test Commands

```bash
# Install dependencies
bun install

# Development server (Next.js on port 3002)
bun run dev

# Production build
bun run build

# Production server
bun run start

# Lint code
bun run lint

# Type check (no explicit command - use tsc)
npx tsc --noEmit

# Database commands
bun run db:push      # Push schema changes without migrations
bun run db:generate  # Generate Prisma client
bun run db:migrate   # Run migrations
bun run db:seed      # Seed database
bun run db:studio    # Open Prisma Studio

# Docker commands
bun run docker:up    # Start all services
bun run docker:down  # Stop all services

# Simulator services (separate terminals)
bun run opc          # OPC-UA simulator
bun run modbus       # Modbus simulator
bun run energy       # Energy meter simulator
```

**Note:** No test framework is currently configured. No tests exist in the codebase.

## Project Structure

```
mfg/
├── src/
│   ├── app/              # Next.js App Router pages & API routes
│   │   ├── api/          # REST API endpoints
│   │   ├── login/        # Auth pages
│   │   └── layout.tsx    # Root layout
│   ├── components/       # React components
│   │   ├── ui/           # shadcn/ui components
│   │   ├── edge/         # Edge connector components
│   │   ├── mes/          # Manufacturing execution
│   │   ├── scada/        # SCADA/HMI components
│   │   └── ...
│   ├── hooks/            # Custom React hooks
│   └── lib/              # Utilities, DB, auth, stores
├── packages/             # Shared packages (monorepo workspaces)
│   ├── types/            # @uns/types - shared TypeScript types
│   ├── logger/           # @uns/logger
│   ├── mqtt-client/      # @uns/mqtt-client
│   └── message-schemas/  # @uns/message-schemas
├── mini-services/        # Standalone microservices
│   ├── api-gateway/      # Express API gateway
│   ├── data-persister/   # Data persistence service
│   ├── data-bridge/      # Data bridge service
│   └── edge-connectors/  # Protocol connectors (OPC-UA, Modbus, S7)
├── simulators/           # Equipment simulators
├── prisma/               # Database schema and migrations
└── generated/            # Generated Prisma client
```

## Code Style Guidelines

### Imports

```typescript
// 1. External packages first
import { NextRequest, NextResponse } from 'next/server';
import { useState, useEffect } from 'react';

// 2. Internal aliases (@/)
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';

// 3. Relative imports last
import { localHelper } from './utils';
```

### TypeScript

- **Strict mode enabled** but `noImplicitAny: false`
- Use `interface` for object types, `type` for unions/primitives
- Prefer explicit return types for exported functions
- Use `Record<string, unknown>` for flexible objects
- Avoid `any` - use `unknown` when type is truly unknown

```typescript
// Preferred
interface User {
  id: string;
  name: string;
  email: string;
}

type Status = 'ACTIVE' | 'INACTIVE' | 'PENDING';

// API response typing
export async function GET(request: NextRequest): Promise<NextResponse> {
  // ...
}
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Components | PascalCase | `EdgePanel`, `ScadaPanel` |
| Functions | camelCase | `getUserById`, `calculateOEE` |
| Constants | SCREAMING_SNAKE | `MAX_RETRIES`, `DEFAULT_TIMEOUT` |
| Types/Interfaces | PascalCase | `TagValue`, `ProductionOrder` |
| Enums | PascalCase | `AlarmState`, `OrderStatus` |
| Files | kebab-case | `edge-panel.tsx`, `use-toast.ts` |
| API routes | lowercase | `/api/connectors/route.ts` |

### React Components

- Use `'use client'` directive for client components
- Destructure props in function parameters
- Use arrow functions for components

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface EdgePanelProps {
  siteId: string;
  onRefresh?: () => void;
}

export function EdgePanel({ siteId, onRefresh }: EdgePanelProps) {
  const [connectors, setConnectors] = useState<Connector[]>([]);

  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

### Error Handling

- Use try-catch in async functions
- Return appropriate HTTP status codes
- Log errors with context using `console.error`

```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Validation
    if (!body.required) {
      return NextResponse.json({ error: 'Missing required field' }, { status: 400 });
    }
    // Success
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('[API] POST /api/resource error:', error);
    return NextResponse.json({ error: 'Failed to create resource' }, { status: 500 });
  }
}
```

### State Management

- Use **Zustand** for global state (see `src/lib/store.ts`)
- Use **React Query** for server state
- Use React state for local component state

```typescript
// Zustand store pattern
interface AuthState {
  user: User | null;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  login: (user, token) => set({ user, token }),
  logout: () => set({ user: null }),
}));
```

### Database (Prisma)

- Import `db` from `@/lib/db`
- Use Prisma's generated types
- Always filter by `isActive: true` for soft-delete pattern

```typescript
import { db } from '@/lib/db';

const connectors = await db.edgeConnector.findMany({
  where: {
    isActive: true,
    ...(siteId && { siteId }),
  },
  include: {
    site: { select: { id: true, name: true } },
  },
  orderBy: { name: 'asc' },
});
```

### UI Components (shadcn/ui)

- Import from `@/components/ui/`
- Use `cn()` utility for conditional classes
- Components use Radix UI primitives

```typescript
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

<Button variant="destructive" className={cn('w-full', isActive && 'bg-green-500')}>
  Delete
</Button>
```

### API Routes

- File location: `src/app/api/[resource]/route.ts`
- Export async functions: `GET`, `POST`, `PUT`, `DELETE`
- Always validate authentication when required

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth-config';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ...
}
```

## Environment Variables

See `.env.example` for a full template. Core variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (required) |
| `JWT_SECRET` | Secret for JWT auth cookies (required; set strong value in production) |
| `MQTT_BROKER_URL` | MQTT broker URL (connector gateway + app real-time) |
| `INFLUXDB_URL` | InfluxDB URL for time-series data |
| `INFLUXDB_TOKEN` | InfluxDB auth token |
| `INFLUXDB_ORG` | InfluxDB organization |
| `INFLUXDB_BUCKET` | InfluxDB bucket name |
| `NODE_ENV` | `development` or `production` (optional) |
| `ENABLE_MQTT_CONNECTOR` | Set to `false` to disable in-app MQTT connector (optional) |

## Monorepo Packages

Internal packages are published under `@uns/` scope:

```typescript
import { AlarmState, DataType } from '@uns/types';
import { createLogger } from '@uns/logger';
```

## Key Patterns

1. **Soft Deletes**: Entities have `isActive` boolean field
2. **Audit Trail**: Use `createdAt`/`updatedAt` timestamps (auto-managed by Prisma)
3. **Permissions**: Check via `hasPermission(session, PERMISSIONS.XXX)`
4. **Real-time**: WebSocket via Socket.io, MQTT for tag updates
5. **ISA-95**: Follow ISA-95 hierarchy: Enterprise > Site > Area > WorkCenter > WorkUnit
