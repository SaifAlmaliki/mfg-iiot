# Real-time tag updates (Socket.IO)

The platform pushes live tag values to the frontend over Socket.IO.

## Endpoint

- **URL**: `http://<host>:3001` (or `SOCKET_IO_PORT` if set). In Docker, the app container exposes port 3001.
- **Path**: `/socket.io/`

## Client connection

Use `socket.io-client` (already in the project). Connect to the same host as the app, port 3001:

```ts
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001', { path: '/socket.io/' });
```

For same-origin (e.g. app at localhost:3000, Socket.IO at localhost:3001), use:

```ts
const socket = io(window.location.hostname + ':3001', { path: '/socket.io/' });
```

## Subscription

- **Subscribe to tags**: emit `subscribe:tags` with `{ tagIds: string[] }`. The server joins the client to rooms `tag:{tagId}` for each id.
- **Unsubscribe**: emit `unsubscribe:tags` with `{ tagIds: string[] }`.

Example:

```ts
socket.emit('subscribe:tags', { tagIds: ['tag-id-1', 'tag-id-2'] });
```

## Event and payload

- **Event name**: `tag:value`
- **Payload** (one object per update):

```ts
{
  tagId: string;   // Postgres Tag id
  value: string;   // current value
  quality: string; // GOOD | BAD | UNCERTAIN | INIT
  timestamp: string; // ISO8601
}
```

Example listener:

```ts
socket.on('tag:value', (data: { tagId: string; value: string; quality: string; timestamp: string }) => {
  console.log('Tag update', data.tagId, data.value);
});
```

## Disabling

- **MQTT connector**: set `ENABLE_MQTT_CONNECTOR=false`. No new tag values will be ingested; Socket.IO still runs and can serve last-known or empty state.
- **Socket.IO**: stop the app or do not connect on the client; the pipeline will still write to InfluxDB.
