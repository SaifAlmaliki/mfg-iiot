import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-config';
import { hasPermission } from '@/lib/auth-config';
import { PERMISSIONS } from '@/lib/permissions';
import {
  getIntegrationsConfigForApi,
  setIntegrationsConfig,
  type IntegrationsConfig,
} from '@/lib/platform-config';

/**
 * GET /api/settings/integrations
 * Returns MQTT and InfluxDB config for admins; for others returns only { configured } (for banner).
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await getIntegrationsConfigForApi();
    if (!hasPermission(session, PERMISSIONS.ADMIN_SETTINGS)) {
      return NextResponse.json({ configured: data.configured });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] GET /api/settings/integrations error:', error);
    return NextResponse.json({ error: 'Failed to load integrations config' }, { status: 500 });
  }
}

/**
 * PUT /api/settings/integrations
 * Save MQTT and InfluxDB config to SystemConfig, then trigger reconnect.
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasPermission(session, PERMISSIONS.ADMIN_SETTINGS)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const mqtt = body.mqtt ?? {};
    const influx = body.influx ?? {};
    const config: IntegrationsConfig = {
      mqtt: {
        url: typeof mqtt.url === 'string' ? mqtt.url.trim() : '',
        clientId: typeof mqtt.clientId === 'string' ? mqtt.clientId.trim() : undefined,
      },
      influx: {
        url: typeof influx.url === 'string' ? influx.url.trim() : '',
        token: typeof influx.token === 'string' ? influx.token : '',
        org: typeof influx.org === 'string' ? influx.org.trim() : '',
        bucket: typeof influx.bucket === 'string' ? influx.bucket.trim() : '',
      },
    };

    if (!config.mqtt.url) {
      return NextResponse.json({ error: 'MQTT broker URL is required' }, { status: 400 });
    }
    if (!config.influx.url || !config.influx.token || !config.influx.org || !config.influx.bucket) {
      return NextResponse.json(
        { error: 'InfluxDB URL, token, org, and bucket are required' },
        { status: 400 }
      );
    }

    await setIntegrationsConfig(config);

    // Reconnect app MQTT and refresh Influx cache (same process)
    try {
      const { reconnectMqttConnector } = await import('@/lib/mqtt-connector');
      const { getInfluxConfig } = await import('@/lib/platform-config');
      const { setInfluxConfigCache, flushInflux } = await import('@/lib/influxdb');
      reconnectMqttConnector();
      const influxCfg = await getInfluxConfig();
      setInfluxConfigCache(influxCfg);
      await flushInflux();
    } catch (e) {
      console.error('[API] Integrations reconnect after save:', e);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[API] PUT /api/settings/integrations error:', error);
    return NextResponse.json({ error: 'Failed to save integrations config' }, { status: 500 });
  }
}
