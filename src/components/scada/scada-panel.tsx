'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Gauge,
  Thermometer,
  Droplets,
  Zap,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useRealtimeStore, useRealtimeConnection, useAlarms } from '@/hooks/use-realtime';
import { useNavigationStore } from '@/lib/store';
import { usePermission } from '@/lib/hooks/use-auth';
import { HmiGraphicsList } from './hmi-graphics-list';
import { HmiGraphicRuntime } from './hmi-graphic-runtime';
import { HmiGraphicEditor } from './hmi-graphic-editor';

// Simulated trend data
const generateTrendData = (baseValue: number, variance: number, points: number = 50) => {
  return Array.from({ length: points }, (_, i) => ({
    time: new Date(Date.now() - (points - i) * 60000).toLocaleTimeString(),
    value: baseValue + (Math.random() - 0.5) * variance,
  }));
};

type HmiViewMode = 'list' | 'runtime' | 'editor';

type ScadaTab = 'tags' | 'alarms' | 'trends' | 'hmi';

function tabFromModule(currentModule: string): ScadaTab {
  if (currentModule === 'scada-tags') return 'tags';
  if (currentModule === 'scada-alarms') return 'alarms';
  if (currentModule === 'scada-trends') return 'trends';
  if (currentModule === 'scada-hmi') return 'hmi';
  return 'tags';
}

export function ScadaPanel({ currentModule: currentModuleProp = 'scada' }: { currentModule?: string }) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [setpointValue, setSetpointValue] = useState<string>('');
  const [setpointDialogOpen, setSetpointDialogOpen] = useState(false);
  const [_isMobile, setIsMobile] = useState(false);
  const [hmiViewMode, setHmiViewMode] = useState<HmiViewMode>('list');
  const [selectedGraphicId, setSelectedGraphicId] = useState<string | null>(null);

  const { setCurrentModule } = useNavigationStore();
  const canEditScada = usePermission('scada.edit');
  const tags = useRealtimeStore((state) => state.tags);
  const alarms = useAlarms(false);
  const { writeTag, ackAlarm } = useRealtimeConnection();
  const _connected = useRealtimeStore((state) => state.connected);

  const activeTab = tabFromModule(currentModuleProp);
  const setActiveTab = (value: string) => {
    const tab = value as ScadaTab;
    setCurrentModule('scada-' + tab);
    window.history.replaceState(null, '', `/#scada/${tab}`);
  };

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const tagArray = Array.from(tags.values());

  const handleSetpoint = () => {
    if (selectedTag && setpointValue) {
      writeTag(selectedTag, parseFloat(setpointValue));
      setSetpointDialogOpen(false);
      setSetpointValue('');
    }
  };

  const activeAlarms = alarms.filter((a) => a.state === 'ACTIVE');
  const acknowledgedAlarms = alarms.filter((a) => a.state === 'ACKNOWLEDGED');

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 text-emerald-500" />
            SCADA / HMI
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">Real-time monitoring and control</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] md:text-xs">
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-emerald-400 animate-pulse" />
            Demo Mode
          </Badge>
          <Button variant="outline" size="sm" className="h-8 md:h-9">
            <RefreshCw className="w-3.5 h-3.5 md:w-4 md:h-4 md:mr-2" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3 md:space-y-4">
        <ScrollArea className="w-full">
          <TabsList className="w-full sm:w-auto flex gap-1">
            <TabsTrigger value="tags" className="text-xs md:text-sm px-3 md:px-4">Live Tags</TabsTrigger>
            <TabsTrigger value="alarms" className="gap-1 text-xs md:text-sm px-3 md:px-4">
              Alarms
              {activeAlarms.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-4 md:h-5 text-[10px] md:text-xs px-1 md:px-1.5">{activeAlarms.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="trends" className="text-xs md:text-sm px-3 md:px-4">Trends</TabsTrigger>
            <TabsTrigger value="hmi" className="text-xs md:text-sm px-3 md:px-4">HMI View</TabsTrigger>
          </TabsList>
        </ScrollArea>

        {/* Live Tags Tab */}
        <TabsContent value="tags" className="space-y-3 md:space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
            {/* Tag Grid */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="p-3 md:p-6">
                  <CardTitle className="text-base md:text-lg">Process Variables</CardTitle>
                  <CardDescription className="text-xs md:text-sm">Real-time sensor readings from PLCs</CardDescription>
                </CardHeader>
                <CardContent className="p-3 md:p-6 pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 md:gap-4">
                    {tagArray.map((tag) => {
                      const isTemp = tag.id.startsWith('TIC');
                      const isPressure = tag.id.startsWith('PIC');
                      const isFlow = tag.id.startsWith('FIC');
                      const _isLevel = tag.id.startsWith('LIC');
                      const _isMotor = tag.id.startsWith('MOT');
                      const isVibration = tag.id.startsWith('VIB');
                      const isPower = tag.id.startsWith('PWR');

                      let Icon = Gauge;
                      if (isTemp) Icon = Thermometer;
                      else if (isPressure) Icon = Droplets;
                      else if (isFlow) Icon = Activity;
                      else if (isPower) Icon = Zap;
                      else if (isVibration) Icon = TrendingUp;

                      let color = 'text-slate-500';
                      if (tag.quality === 'GOOD') color = 'text-green-500';
                      else if (tag.quality === 'BAD') color = 'text-red-500';
                      else color = 'text-yellow-500';

                      return (
                        <Card
                          key={tag.id}
                          className="cursor-pointer hover:shadow-md active:scale-[0.98] transition-all"
                          onClick={() => {
                            setSelectedTag(tag.id);
                            setSetpointDialogOpen(true);
                          }}
                        >
                          <CardContent className="p-2 md:p-4">
                            <div className="flex items-center justify-between mb-1 md:mb-2">
                              <Icon className={`w-4 h-4 md:w-5 md:h-5 ${color}`} />
                              <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${color.replace('text-', 'bg-')}`} />
                            </div>
                            <div className="text-[10px] md:text-xs text-muted-foreground mb-0.5 md:mb-1 truncate">{tag.id}</div>
                            <div className="text-base md:text-2xl font-bold">{tag.value.toFixed(1)}</div>
                            <div className="text-[10px] md:text-xs text-muted-foreground capitalize">
                              {tag.quality.toLowerCase()}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tag Details */}
            <div>
              <Card className="h-full">
                <CardHeader className="p-3 md:p-6">
                  <CardTitle className="text-base md:text-lg">Tag Details</CardTitle>
                </CardHeader>
                <CardContent className="p-3 md:p-6 pt-0">
                  <ScrollArea className="h-[300px] md:h-auto">
                    <Table>
                      <TableBody>
                        {tagArray.slice(0, 8).map((tag) => (
                          <TableRow key={tag.id}>
                            <TableCell className="font-medium text-xs md:text-sm py-2">{tag.id}</TableCell>
                            <TableCell className="text-right text-xs md:text-sm">{tag.value.toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge
                                variant={tag.quality === 'GOOD' ? 'default' : 'destructive'}
                                className="text-[10px] md:text-xs"
                              >
                                {tag.quality}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Alarms Tab */}
        <TabsContent value="alarms" className="space-y-3 md:space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
            {/* Active Alarms */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="p-3 md:p-6">
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-red-500" />
                    Active Alarms ({activeAlarms.length})
                  </CardTitle>
                  <CardDescription className="text-xs md:text-sm">Alarms requiring attention</CardDescription>
                </CardHeader>
                <CardContent className="p-3 md:p-6 pt-0">
                  <ScrollArea className="h-[300px] md:h-[400px]">
                    {activeAlarms.length === 0 ? (
                      <div className="text-center py-6 md:py-8 text-muted-foreground">
                        <CheckCircle className="w-8 h-8 md:w-12 md:h-12 mx-auto mb-2 md:mb-4 text-green-500" />
                        <p className="text-sm md:text-base">No active alarms</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {activeAlarms.map((alarm) => (
                          <div
                            key={alarm.id}
                            className="p-3 md:p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-red-500" />
                                <span className="font-semibold text-sm md:text-base">{alarm.id}</span>
                              </div>
                              <Badge
                                variant="destructive"
                                className="cursor-pointer text-[10px] md:text-xs w-fit"
                                onClick={() => ackAlarm(alarm.id)}
                              >
                                Acknowledge
                              </Badge>
                            </div>
                            <p className="text-xs md:text-sm">{alarm.message}</p>
                            <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-2 text-[10px] md:text-xs text-muted-foreground">
                              <span>Tag: {alarm.tagId}</span>
                              <span>Value: {alarm.value.toFixed(1)}</span>
                              <span>
                                <Clock className="w-2.5 h-2.5 md:w-3 md:h-3 inline mr-1" />
                                {new Date(alarm.activatedAt).toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Alarm Summary */}
            <div>
              <Card>
                <CardHeader className="p-3 md:p-6">
                  <CardTitle className="text-base md:text-lg">Alarm Summary</CardTitle>
                </CardHeader>
                <CardContent className="p-3 md:p-6 pt-0 space-y-3 md:space-y-4">
                  <div className="p-3 md:p-4 rounded-lg bg-red-50 dark:bg-red-900/20">
                    <div className="text-2xl md:text-3xl font-bold text-red-500">{activeAlarms.length}</div>
                    <div className="text-xs md:text-sm text-muted-foreground">Active</div>
                  </div>
                  <div className="p-3 md:p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                    <div className="text-2xl md:text-3xl font-bold text-yellow-500">{acknowledgedAlarms.length}</div>
                    <div className="text-xs md:text-sm text-muted-foreground">Acknowledged</div>
                  </div>
                  <div className="p-3 md:p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                    <div className="text-2xl md:text-3xl font-bold text-green-500">
                      {alarms.filter((a) => a.state === 'CLEARED').length}
                    </div>
                    <div className="text-xs md:text-sm text-muted-foreground">Cleared</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-3 md:space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
            {[
              { tagId: 'TIC-101', fallbackBase: 65 },
              { tagId: 'PIC-101', fallbackBase: 3.5 },
              { tagId: 'FIC-101', fallbackBase: 250 },
              { tagId: 'LIC-101', fallbackBase: 75 },
            ].map(({ tagId, fallbackBase }) => {
              const tag = tags.get(tagId);
              const baseValue = tag ? tag.value : fallbackBase;
              const isDemo = !tag;

              return (
                <Card key={tagId}>
                  <CardHeader className="p-3 md:p-6">
                    <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                      <TrendingUp className="w-4 h-4 md:w-5 md:h-5" />
                      {tagId} Trend
                    </CardTitle>
                    <CardDescription className="text-xs md:text-sm">
                      Last 50 minutes
                      {isDemo && (
                        <span className="ml-2 text-muted-foreground">(Demo data — no live tag)</span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-3 md:p-6 pt-0">
                    <div className="h-[150px] md:h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={generateTrendData(baseValue, 5)}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="time" className="text-[10px] md:text-xs" />
                          <YAxis className="text-[10px] md:text-xs" />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#10b981"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* HMI View Tab: list of graphics, or runtime/editor view */}
        <TabsContent value="hmi" className="space-y-3 md:space-y-4">
          {hmiViewMode === 'list' && (
            <HmiGraphicsList
              canEdit={canEditScada}
              onView={(id) => {
                setSelectedGraphicId(id);
                setHmiViewMode('runtime');
              }}
              onEdit={(id) => {
                setSelectedGraphicId(id);
                setHmiViewMode('editor');
              }}
            />
          )}
          {hmiViewMode === 'runtime' && selectedGraphicId && (
            <HmiGraphicRuntime
              graphicId={selectedGraphicId}
              onBack={() => {
                setHmiViewMode('list');
                setSelectedGraphicId(null);
              }}
            />
          )}
          {hmiViewMode === 'editor' && (
            <HmiGraphicEditor
              graphicId={selectedGraphicId}
              onBack={() => {
                setHmiViewMode('list');
                setSelectedGraphicId(null);
              }}
              onSaved={() => {}}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Setpoint Dialog */}
      <Dialog open={setpointDialogOpen} onOpenChange={setSetpointDialogOpen}>
        <DialogContent className="max-w-[90vw] md:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg">Set Setpoint</DialogTitle>
            <DialogDescription className="text-xs md:text-sm">
              Enter new value for {selectedTag}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="value" className="text-right text-xs md:text-sm">
                Value
              </Label>
              <Input
                id="value"
                type="number"
                value={setpointValue}
                onChange={(e) => setSetpointValue(e.target.value)}
                className="col-span-3 text-sm md:text-base"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setSetpointDialogOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleSetpoint} className="w-full sm:w-auto">Write</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
