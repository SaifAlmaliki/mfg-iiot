'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Plug, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/auth-store';
import { PERMISSIONS } from '@/lib/permissions';

interface IntegrationsData {
  mqtt: { url: string; clientId: string };
  influx: { url: string; token: string; org: string; bucket: string };
  configured: boolean;
}

export function IntegrationsSettings() {
  const hasAdminSettings = useAuthStore((s) => s.hasPermission(PERMISSIONS.ADMIN_SETTINGS));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    mqttUrl: '',
    mqttClientId: '',
    influxUrl: '',
    influxToken: '',
    influxOrg: '',
    influxBucket: '',
  });

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/settings/integrations');
      if (!res.ok) throw new Error('Failed to load');
      const data: IntegrationsData = await res.json();
      if ('mqtt' in data && 'influx' in data) {
        setForm({
          mqttUrl: data.mqtt?.url ?? '',
          mqttClientId: data.mqtt?.clientId ?? '',
          influxUrl: data.influx?.url ?? '',
          influxToken: data.influx?.token ?? '',
          influxOrg: data.influx?.org ?? '',
          influxBucket: data.influx?.bucket ?? '',
        });
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load integrations config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    const mqttUrl = form.mqttUrl.trim();
    const influxUrl = form.influxUrl.trim();
    const influxToken = form.influxToken.trim();
    const influxOrg = form.influxOrg.trim();
    const influxBucket = form.influxBucket.trim();

    if (!mqttUrl) {
      toast.error('MQTT broker URL is required');
      return;
    }
    if (!influxUrl || !influxToken || !influxOrg || !influxBucket) {
      toast.error('All InfluxDB fields (URL, token, org, bucket) are required');
      return;
    }

    try {
      setSaving(true);
      const res = await fetch('/api/settings/integrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mqtt: { url: mqttUrl, clientId: form.mqttClientId.trim() || undefined },
          influx: { url: influxUrl, token: influxToken, org: influxOrg, bucket: influxBucket },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 403) {
          toast.error('You don’t have permission to save integrations. Only users with the Administrator role can save these settings.');
          return;
        }
        throw new Error(err.error || 'Save failed');
      }
      toast.success('Integrations saved. MQTT and InfluxDB reconnecting.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="w-5 h-5" />
            MQTT Broker
          </CardTitle>
          <CardDescription>
            Used by the app, connector gateway, and data persister. Configure once here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mqtt-url">Broker URL</Label>
            <Input
              id="mqtt-url"
              placeholder="mqtt://localhost:1883 or mqtt://emqx:1883"
              value={form.mqttUrl}
              onChange={(e) => setForm((p) => ({ ...p, mqttUrl: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Use full URL including scheme, e.g. <code className="rounded bg-muted px-1">mqtt://localhost:1883</code> for local EMQX.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mqtt-client-id">Client ID (optional)</Label>
            <Input
              id="mqtt-client-id"
              placeholder="uns-platform-app"
              value={form.mqttClientId}
              onChange={(e) => setForm((p) => ({ ...p, mqttClientId: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="w-5 h-5" />
            InfluxDB
          </CardTitle>
          <CardDescription>
            Time-series storage for tag values. URL, token, org, and bucket are required.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="influx-url">URL</Label>
            <Input
              id="influx-url"
              placeholder="http://localhost:8086"
              value={form.influxUrl}
              onChange={(e) => setForm((p) => ({ ...p, influxUrl: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="influx-token">Token</Label>
            <Input
              id="influx-token"
              type="password"
              placeholder="InfluxDB API token"
              value={form.influxToken}
              onChange={(e) => setForm((p) => ({ ...p, influxToken: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="influx-org">Organization</Label>
              <Input
                id="influx-org"
                placeholder="uns-platform"
                value={form.influxOrg}
                onChange={(e) => setForm((p) => ({ ...p, influxOrg: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="influx-bucket">Bucket</Label>
              <Input
                id="influx-bucket"
                placeholder="manufacturing"
                value={form.influxBucket}
                onChange={(e) => setForm((p) => ({ ...p, influxBucket: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 items-end">
        {!hasAdminSettings && (
          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500 w-full rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Only users with the <strong>Administrator</strong> role can save integration settings. Log in as an administrator to change MQTT and InfluxDB settings.</span>
          </div>
        )}
        <Button onClick={handleSave} disabled={saving || !hasAdminSettings}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save &amp; reconnect
        </Button>
      </div>
    </div>
  );
}
