/**
 * Socket.IO server for real-time tag value updates.
 * Runs on SOCKET_IO_PORT (default 3001). Clients subscribe to rooms tag:{tagId}.
 * Event emitted: "tag:value" with payload { tagId, value, quality, timestamp }.
 */

import { createServer } from 'http';
import { Server } from 'socket.io';

const DEFAULT_PORT = 3001;
const TAG_ROOM_PREFIX = 'tag:';
const RUN_ROOM_PREFIX = 'run:';

declare global {
  var __socketio: Server | undefined;
}

let io: Server | null = null;

/**
 * Get the Socket.IO server instance (if started). Used by pipeline to broadcast.
 */
export function getSocketIO(): Server | null {
  return globalThis.__socketio ?? io;
}

/**
 * Start Socket.IO server on SOCKET_IO_PORT (default 3001).
 * Subscription API: client emits "subscribe:tags" with { tagIds: string[] } to join rooms tag:{tagId}.
 */
export function startSocketIOServer(): void {
  const port = Number(process.env.SOCKET_IO_PORT || DEFAULT_PORT);
  const httpServer = createServer();

  io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production' ? false : '*',
    },
    path: '/socket.io/',
  });

  io.on('connection', (socket) => {
    socket.on('subscribe:tags', (data: { tagIds?: string[] }) => {
      const tagIds = Array.isArray(data?.tagIds) ? data.tagIds : [];
      for (const tagId of tagIds) {
        if (typeof tagId === 'string' && tagId) {
          socket.join(`${TAG_ROOM_PREFIX}${tagId}`);
        }
      }
    });

    socket.on('unsubscribe:tags', (data: { tagIds?: string[] }) => {
      const tagIds = Array.isArray(data?.tagIds) ? data.tagIds : [];
      for (const tagId of tagIds) {
        if (typeof tagId === 'string' && tagId) {
          socket.leave(`${TAG_ROOM_PREFIX}${tagId}`);
        }
      }
    });

    socket.on('subscribe:runs', () => {
      socket.join('runs');
    });

    socket.on('subscribe:run', (data: { runId?: string } | string) => {
      const runId = typeof data === 'string' ? data : data?.runId;
      if (typeof runId === 'string' && runId) {
        socket.join(`${RUN_ROOM_PREFIX}${runId}`);
      }
    });

    socket.on('unsubscribe:run', (data: { runId?: string } | string) => {
      const runId = typeof data === 'string' ? data : data?.runId;
      if (typeof runId === 'string' && runId) {
        socket.leave(`${RUN_ROOM_PREFIX}${runId}`);
      }
    });
  });

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`[Socket.IO] Server listening on port ${port}`);
  });

  globalThis.__socketio = io;
}
