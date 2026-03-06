// Only load Node-only modules (Prisma, Socket.IO, MQTT) in Node runtime to avoid Edge bundle errors (Prisma 7 uses node:* APIs)
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const [{ startSocketIOServer }, { startMqttConnector }, { handleTagValue }] = await Promise.all([
    import('@/lib/socketio-server'),
    import('@/lib/mqtt-connector'),
    import('@/lib/realtime-pipeline'),
  ]);

  // Log environment variable status for debugging
  if (process.env.NODE_ENV === 'development') {
    console.log('DATABASE_URL set:', !!process.env.DATABASE_URL)
    if (process.env.DATABASE_URL) {
      console.log('DATABASE_URL first 30 chars:', process.env.DATABASE_URL.substring(0, 30))
      console.log('DATABASE_URL starts with postgresql://:', process.env.DATABASE_URL.startsWith('postgresql://'))
    }
  }

  // Real-time pipeline: Socket.IO server + optional MQTT connector
  startSocketIOServer();

  const enableMqtt = process.env.ENABLE_MQTT_CONNECTOR !== 'false';
  const hasBroker = !!(process.env.MQTT_BROKER_URL || process.env.EMQX_BROKER_URL);
  if (enableMqtt && hasBroker) {
    startMqttConnector(handleTagValue);
  }
}
