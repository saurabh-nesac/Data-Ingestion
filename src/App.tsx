import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CloudRain,
  Compass,
  Database,
  ExternalLink,
  Layers,
  MapPin,
  Radio,
  RefreshCw,
  Scale,
  Sliders,
  Terminal,
  Upload,
  Waves,
} from 'lucide-react';
import {
  ApiCallLog,
  DomainType,
  MeteogramResponse,
  ModelType,
  StationItem,
  TimeseriesResponse,
} from './types/rainfall';
import { AWS_STATIONS, getAlertForRainfall } from './data/stations';
import { apiClient } from './services/apiClient';
import { Header } from './components/Header';
import { TemporalControlBar } from './components/TemporalControlBar';
import { RainfallMapGrid } from './components/RainfallMapGrid';
import { TimeseriesChart } from './components/TimeseriesChart';
import { VerificationPanel } from './components/VerificationPanel';
import { MeteogramView } from './components/MeteogramView';
import { StationTelemetryPanel } from './components/StationTelemetryPanel';
import { ProbePanel } from './components/ProbePanel';
import { ApiInspectorDrawer } from './components/ApiInspectorDrawer';
import { ConnectionSettingsModal } from './components/ConnectionSettingsModal';
import { DataIngestionModal } from './components/DataIngestionModal';

const DEFAULT_START_TIME = '2026-08-12T00:00:00Z';
const DEFAULT_END_TIME = '2026-08-13T12:00:00Z';
const INITIAL_VALID_TIME = '2026-08-12T06:00:00Z';

export default function App() {
  // Global Model & Spatial Configuration: WRF Numerical Forecast as base model
  const [model, setModel] = useState<ModelType>('WRF');
  const [domain, setDomain] = useState<DomainType>('d03');
  const [validTime, setValidTime] = useState<string>(INITIAL_VALID_TIME);

  // Station and Timeseries State
  const [selectedStation, setSelectedStation] = useState<StationItem>(AWS_STATIONS[0]);
  const [probeCustomCoord, setProbeCustomCoord] = useState<{
    lat: number;
    lon: number;
    x: number;
    y: number;
    name?: string;
  } | null>(null);

  const [timeseriesData, setTimeseriesData] = useState<TimeseriesResponse | null>(null);
  const [isTimeseriesLoading, setIsTimeseriesLoading] = useState<boolean>(false);
  const [meteogramData, setMeteogramData] = useState<MeteogramResponse | null>(null);
  const [isMeteogramLoading, setIsMeteogramLoading] = useState<boolean>(false);
  const [selectedRangeHours, setSelectedRangeHours] = useState<number>(24);
  const [stationRates, setStationRates] = useState<Record<string, number>>({});

  // Timeline playback & auto-sync state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<number>(1);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0);
  const [isLiveLoading, setIsLiveLoading] = useState<boolean>(false);

  // Modals & Panels
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false);
  const [isIngestionOpen, setIsIngestionOpen] = useState<boolean>(false);
  const [datasetStatus, setDatasetStatus] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'hyetograph' | 'verification' | 'meteogram' | 'stations' | 'probe'>('hyetograph');

  // Logs state
  const [apiLogs, setApiLogs] = useState<ApiCallLog[]>([]);

  // Fetch dataset status
  const fetchDatasetStatus = useCallback(async () => {
    try {
      const status = await apiClient.getDatasetStatus();
      setDatasetStatus(status);
    } catch (err) {
      console.error('Failed to load dataset status:', err);
    }
  }, []);

  useEffect(() => {
    fetchDatasetStatus();
  }, [fetchDatasetStatus]);

  // Subscribe to API logs
  useEffect(() => {
    const unsubscribe = apiClient.subscribeLogs((logs) => {
      setApiLogs(logs);
    });
    return unsubscribe;
  }, []);

  // Fetch Timeseries for selected location
  const fetchTimeseries = useCallback(
    async (st: StationItem | null, customPoint: typeof probeCustomCoord, hours: number) => {
      setIsTimeseriesLoading(true);
      try {
        const start = new Date(validTime);
        const end = new Date(start.getTime() + hours * 3600 * 1000);

        const res = await apiClient.getTimeseries({
          model: 'WRF',
          domain,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          variable: 'rain',
          station_id: !customPoint && st ? st.id : undefined,
          station_name: !customPoint && st ? st.name : undefined,
          x: customPoint ? customPoint.x : undefined,
          y: customPoint ? customPoint.y : undefined,
        });

        // Set custom name if probed
        if (customPoint && customPoint.name) {
          res.location.name = customPoint.name;
        }

        setTimeseriesData(res);
      } catch (err) {
        console.error('Failed to load timeseries:', err);
      } finally {
        setIsTimeseriesLoading(false);
      }
    },
    [domain, validTime]
  );

  // Fetch Atmospheric Meteogram Profile
  const fetchMeteogram = useCallback(
    async (st: StationItem | null, customPoint: typeof probeCustomCoord, hours: number) => {
      setIsMeteogramLoading(true);
      try {
        const start = new Date(validTime);
        const end = new Date(start.getTime() + hours * 3600 * 1000);

        const res = await apiClient.getMeteogram({
          model: 'WRF',
          domain,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          station_id: !customPoint && st ? st.id : undefined,
          station_name: !customPoint && st ? st.name : undefined,
          x: customPoint ? customPoint.x : undefined,
          y: customPoint ? customPoint.y : undefined,
          lat: customPoint ? customPoint.lat : undefined,
          lon: customPoint ? customPoint.lon : undefined,
        });

        if (customPoint && customPoint.name) {
          res.location.name = customPoint.name;
        }

        setMeteogramData(res);
      } catch (err) {
        console.error('Failed to load meteogram:', err);
      } finally {
        setIsMeteogramLoading(false);
      }
    },
    [domain, validTime]
  );

  // Fetch station rates for current validTime
  const fetchStationRates = useCallback(async () => {
    setIsLiveLoading(true);
    const rates: Record<string, number> = {};
    for (const st of AWS_STATIONS) {
      try {
        const res = await apiClient.getStation({
          model: 'WRF',
          time: validTime,
          variable: 'rain',
          station_id: st.id,
          domain,
        });
        rates[st.id] = res.value;
      } catch {
        // continue
      }
    }
    setStationRates(rates);
    setIsLiveLoading(false);
  }, [domain, validTime]);

  // Initial load and validTime/model change effects
  useEffect(() => {
    fetchTimeseries(selectedStation, probeCustomCoord, selectedRangeHours);
    fetchMeteogram(selectedStation, probeCustomCoord, selectedRangeHours);
    fetchStationRates();
  }, [fetchTimeseries, fetchMeteogram, fetchStationRates, selectedStation, probeCustomCoord, selectedRangeHours]);

  // Temporal Playback Interval
  useEffect(() => {
    if (!isPlaying) return;

    const startMs = new Date(DEFAULT_START_TIME).getTime();
    const endMs = new Date(DEFAULT_END_TIME).getTime();
    const stepMs = 3600 * 1000;
    const intervalMs = 1600 / playSpeed;

    const timer = setInterval(() => {
      setValidTime((prev) => {
        const curMs = new Date(prev).getTime();
        const nextMs = curMs + stepMs;
        if (nextMs > endMs) {
          return new Date(startMs).toISOString();
        }
        return new Date(nextMs).toISOString();
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, playSpeed]);

  // Live Auto-refresh Polling Interval
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;

    const timer = setInterval(() => {
      fetchTimeseries(selectedStation, probeCustomCoord, selectedRangeHours);
      fetchMeteogram(selectedStation, probeCustomCoord, selectedRangeHours);
      fetchStationRates();
    }, autoRefreshInterval * 1000);

    return () => clearInterval(timer);
  }, [autoRefreshInterval, fetchTimeseries, fetchMeteogram, fetchStationRates, selectedStation, probeCustomCoord, selectedRangeHours]);

  // Handlers
  const handleSelectStation = (st: StationItem) => {
    setSelectedStation(st);
    setProbeCustomCoord(null);
  };

  const handleSelectStationById = (stationId: string) => {
    const st = AWS_STATIONS.find((s) => s.id === stationId);
    if (st) {
      setSelectedStation(st);
      setProbeCustomCoord(null);
    }
  };

  const handleProbeLocation = (lat: number, lon: number, x: number, y: number, name?: string) => {
    setProbeCustomCoord({ lat, lon, x, y, name });
  };

  const handleManualRefresh = () => {
    fetchTimeseries(selectedStation, probeCustomCoord, selectedRangeHours);
    fetchMeteogram(selectedStation, probeCustomCoord, selectedRangeHours);
    fetchStationRates();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col selection:bg-blue-500 selection:text-slate-950">
      {/* Top Header */}
      <Header
        model={model}
        onModelChange={setModel}
        domain={domain}
        onDomainChange={setDomain}
        validTime={validTime}
        isSimulated={apiClient.isSimulationMode()}
        isLiveLoading={isLiveLoading}
        isRealDataLoaded={datasetStatus?.isRealDataLoaded}
        onRefresh={handleManualRefresh}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenIngestion={() => setIsIngestionOpen(true)}
        onToggleApiInspector={() => setIsInspectorOpen(true)}
        apiLogCount={apiLogs.length}
      />

      {/* Temporal Scrubber & Playback Bar */}
      <TemporalControlBar
        validTime={validTime}
        onTimeChange={setValidTime}
        startTime={DEFAULT_START_TIME}
        endTime={DEFAULT_END_TIME}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        playSpeed={playSpeed}
        onChangeSpeed={setPlaySpeed}
        autoRefreshInterval={autoRefreshInterval}
        onAutoRefreshIntervalChange={setAutoRefreshInterval}
      />

      {/* Main Dashboard Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Real Dataset Ingestion Pipeline Notice */}
        <div className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-lg backdrop-blur">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">Full-Stack Data Ingestion Backend Active</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                  {datasetStatus?.isRealDataLoaded ? 'Real Datasets Ingested' : 'Awaiting Files'}
                </span>
              </div>
              <p className="text-slate-400 text-[11px] mt-0.5">
                Ingests WRF NetCDF outputs (calculating rain from RAINC + RAINNC, 2m temp T2, destaggered U & V winds) and half-hourly GPM IMERG HDF5 observations.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsIngestionOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shrink-0 transition-all shadow-md"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Data Ingestion Pipeline</span>
          </button>
        </div>

        {/* Top Region: Real-Time Hydro-Meteorological Spatial Map */}
        <section>
          <RainfallMapGrid
            model={model}
            domain={domain}
            validTime={validTime}
            selectedStation={selectedStation}
            onSelectStation={handleSelectStation}
            onProbeLocation={handleProbeLocation}
          />
        </section>

        {/* View Switcher Tabs for Sub-Panels */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
            <button
              id="tab-hyetograph"
              type="button"
              onClick={() => setActiveTab('hyetograph')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'hyetograph'
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Timeseries Hyetograph</span>
            </button>

            <button
              id="tab-verification"
              type="button"
              onClick={() => setActiveTab('verification')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'verification'
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Model Evaluation & Stats</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-950 text-blue-300 border border-blue-800 font-mono">
                Skill
              </span>
            </button>

            <button
              id="tab-meteogram"
              type="button"
              onClick={() => setActiveTab('meteogram')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'meteogram'
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Atmospheric Meteogram</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-950 text-blue-300 border border-blue-800 font-mono">
                NWP
              </span>
            </button>

            <button
              id="tab-stations"
              type="button"
              onClick={() => setActiveTab('stations')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'stations'
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>AWS Station Network</span>
              <span className="text-[10px] px-1.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {AWS_STATIONS.length}
              </span>
            </button>

            <button
              id="tab-probe"
              type="button"
              onClick={() => setActiveTab('probe')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'probe'
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Endpoint Console Probe</span>
            </button>
          </div>

          {/* Active Station / Location pill */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
            <MapPin className="w-3.5 h-3.5 text-blue-400" />
            <span>Target:</span>
            <span className="font-semibold text-white">
              {probeCustomCoord?.name || selectedStation.name}
            </span>
          </div>
        </div>

        {/* Tab Content Display */}
        {activeTab === 'hyetograph' && (
          <section className="space-y-6">
            <TimeseriesChart
              data={timeseriesData}
              isLoading={isTimeseriesLoading}
              activeModel={model}
              onRangeSelect={setSelectedRangeHours}
              selectedRangeHours={selectedRangeHours}
              onOpenMeteogram={() => setActiveTab('meteogram')}
            />

            {/* Quick Mini-Telemetry Strip below Timeseries */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {AWS_STATIONS.slice(0, 3).map((st) => {
                const rate = stationRates[st.id] ?? 0;
                const alert = getAlertForRainfall(rate);
                return (
                  <div
                    key={st.id}
                    onClick={() => handleSelectStation(st)}
                    className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-white">{st.name.split(' ')[0]} AWS</div>
                      <div className="text-[11px] text-slate-400">{st.district}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold font-mono" style={{ color: alert.color }}>
                        {rate.toFixed(1)} mm/h
                      </span>
                      <div className="text-[10px] text-slate-500">{alert.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === 'verification' && (
          <section>
            <VerificationPanel
              validTime={validTime}
              onSelectStationById={handleSelectStationById}
            />
          </section>
        )}

        {activeTab === 'meteogram' && (
          <section>
            <MeteogramView
              data={meteogramData}
              isLoading={isMeteogramLoading}
              activeModel={model}
              selectedStation={selectedStation}
              onSelectStation={handleSelectStation}
              selectedRangeHours={selectedRangeHours}
              onRangeSelect={setSelectedRangeHours}
              validTime={validTime}
              onTimeSelect={setValidTime}
              onRefresh={handleManualRefresh}
            />
          </section>
        )}

        {activeTab === 'stations' && (
          <section>
            <StationTelemetryPanel
              selectedStation={selectedStation}
              onSelectStation={handleSelectStation}
              validTime={validTime}
              isLoading={isLiveLoading}
            />
          </section>
        )}

        {activeTab === 'probe' && (
          <section>
            <ProbePanel
              model={model}
              domain={domain}
              validTime={validTime}
              selectedStation={selectedStation}
              onSelectStation={handleSelectStation}
            />
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950 py-4 px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">
              WRF Numerical Model vs Observation Validation Dashboard
            </span>
            <span>•</span>
            <span>Assam & North East India Hydro-Meteorological Monitoring (SOI Standard)</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span>GPM IMERG 0.1° Gridded</span>
            <span>•</span>
            <span>IMD AWS In-Situ Point</span>
            <span>•</span>
            <span>FastAPI OpenAPI 3.1.0</span>
          </div>
        </div>
      </footer>

      {/* Modals & Slide-out Drawers */}
      <ConnectionSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={handleManualRefresh}
      />

      <ApiInspectorDrawer
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        logs={apiLogs}
        onClearLogs={() => setApiLogs([])}
      />

      <DataIngestionModal
        isOpen={isIngestionOpen}
        onClose={() => setIsIngestionOpen(false)}
        onDataLoaded={() => {
          fetchDatasetStatus();
          handleManualRefresh();
        }}
      />
    </div>
  );
}
