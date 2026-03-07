// Only load Node-only modules (Prisma, Socket.IO, MQTT) in Node runtime to avoid Edge bundle errors (Prisma 7 uses node:* APIs)
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const [
    { startSocketIOServer },
    { startMqttConnector },
    { handleTagValue },
    { getInfluxConfig },
    { setInfluxConfigCache },
  ] = await Promise.all([
    import('@/lib/socketio-server'),
    import('@/lib/mqtt-connector'),
    import('@/lib/realtime-pipeline'),
    import('@/lib/platform-config'),
    import('@/lib/influxdb'),
  ]);

  // Real-time pipeline: Socket.IO server + MQTT/Influx from DB (Settings > Integrations)
  startSocketIOServer();

  const influxCfg = await getInfluxConfig();
  setInfluxConfigCache(influxCfg);

  if (process.env.ENABLE_MQTT_CONNECTOR !== 'false') {
    startMqttConnector(handleTagValue);
  }
}
