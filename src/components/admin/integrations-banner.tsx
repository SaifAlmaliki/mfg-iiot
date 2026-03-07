'use client';

import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ExternalLink } from 'lucide-react';

/**
 * Shows a banner when MQTT/InfluxDB are not configured. Links to Administration > Integrations.
 */
export function IntegrationsBanner() {
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/settings/integrations')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.configured === 'boolean') {
          setConfigured(data.configured);
        }
      })
      .catch(() => {
        if (!cancelled) setConfigured(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (configured !== false) return null;

  return (
    <Alert variant="destructive" className="rounded-lg mx-4 mt-2 mb-2">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Integrations not configured</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-2">
        <span>Please configure the MQTT broker and InfluxDB in Administration &gt; Integrations so real-time data and time-series storage work.</span>
        <Button
          variant="outline"
          size="sm"
          className="border-current text-inherit hover:bg-white/10"
          onClick={() => {
            window.location.hash = 'admin/integrations';
            window.dispatchEvent(new HashChangeEvent('hashchange'));
          }}
        >
          <ExternalLink className="w-3 h-3 mr-1" />
          Open Integrations
        </Button>
      </AlertDescription>
    </Alert>
  );
}
