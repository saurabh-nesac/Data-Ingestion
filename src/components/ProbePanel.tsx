import React, { useState } from 'react';
import {
  Check,
  Clock,
  Code,
  Copy,
  Crosshair,
  Database,
  MapPin,
  Play,
  Radio,
  Send,
  Sliders,
  Terminal,
} from 'lucide-react';
import { DomainType, ModelType, StationItem } from '../types/rainfall';
import { AWS_STATIONS } from '../data/stations';
import { apiClient } from '../services/apiClient';

interface ProbePanelProps {
  model: ModelType;
  domain: DomainType;
  validTime: string;
  selectedStation: StationItem | null;
  onSelectStation: (st: StationItem) => void;
}

export const ProbePanel: React.FC<ProbePanelProps> = ({
  model,
  domain,
  validTime,
  selectedStation,
  onSelectStation,
}) => {
  const [activeTab, setActiveTab] = useState<'latlon' | 'cell' | 'station' | 'timeseries'>('latlon');

  // Input states
  const [lat, setLat] = useState<number>(26.1445);
  const [lon, setLon] = useState<number>(91.7362);
  const [gridX, setGridX] = useState<number>(187);
  const [gridY, setGridY] = useState<number>(142);
  const [stationId, setStationId] = useState<string>(selectedStation?.id || 'AWS_GUW_01');
  const [maxDiff, setMaxDiff] = useState<number>(30.0);

  // Execution states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [responseJson, setResponseJson] = useState<any>(null);
  const [statusInfo, setStatusInfo] = useState<{ status: number; latencyMs: number; endpoint: string } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Sync stationId if selectedStation changes
  React.useEffect(() => {
    if (selectedStation) {
      setStationId(selectedStation.id);
      setLat(selectedStation.lat);
      setLon(selectedStation.lon);
      setGridX(selectedStation.x_grid);
      setGridY(selectedStation.y_grid);
    }
  }, [selectedStation]);

  const handleExecuteProbe = async () => {
    setIsLoading(true);
    setResponseJson(null);
    const start = performance.now();

    try {
      if (activeTab === 'latlon') {
        const res = await apiClient.getLatLon({
          model,
          domain,
          time: validTime,
          lat,
          lon,
          variable: 'rain',
          max_difference: maxDiff,
        });
        const latency = Math.round(performance.now() - start);
        setResponseJson(res);
        setStatusInfo({ status: 200, latencyMs: latency, endpoint: `/v1/latlon` });
      } else if (activeTab === 'cell') {
        const res = await apiClient.getCell({
          model,
          domain,
          time: validTime,
          x: gridX,
          y: gridY,
          variable: 'rain',
          max_difference: maxDiff,
        });
        const latency = Math.round(performance.now() - start);
        setResponseJson(res);
        setStatusInfo({ status: 200, latencyMs: latency, endpoint: `/v1/cell` });
      } else if (activeTab === 'station') {
        const res = await apiClient.getStation({
          model,
          domain,
          time: validTime,
          station_id: stationId,
          variable: 'rain',
          max_difference: maxDiff,
        });
        const latency = Math.round(performance.now() - start);
        setResponseJson(res);
        setStatusInfo({ status: 200, latencyMs: latency, endpoint: `/v1/station` });
      } else if (activeTab === 'timeseries') {
        const endTime = new Date(new Date(validTime).getTime() + 12 * 3600 * 1000).toISOString();
        const res = await apiClient.getTimeseries({
          model,
          domain,
          start_time: validTime,
          end_time: endTime,
          station_id: stationId,
          variable: 'rain',
          max_difference: maxDiff,
        });
        const latency = Math.round(performance.now() - start);
        setResponseJson(res);
        setStatusInfo({ status: 200, latencyMs: latency, endpoint: `/v1/timeseries` });
      }
    } catch (err: any) {
      const latency = Math.round(performance.now() - start);
      setResponseJson({ error: err.message || 'Request failed' });
      setStatusInfo({ status: 500, latencyMs: latency, endpoint: `/v1/${activeTab}` });
    } finally {
      setIsLoading(false);
    }
  };

  const getCurlSnippet = () => {
    const base = apiClient.getBaseUrl() || 'http://localhost:8000';
    if (activeTab === 'latlon') {
      return `curl -X GET "${base}/v1/latlon?model=${model}&domain=${domain}&time=${encodeURIComponent(
        validTime
      )}&lat=${lat}&lon=${lon}&variable=rain&max_difference=${maxDiff}"`;
    }
    if (activeTab === 'cell') {
      return `curl -X GET "${base}/v1/cell?model=${model}&domain=${domain}&time=${encodeURIComponent(
        validTime
      )}&x=${gridX}&y=${gridY}&variable=rain&max_difference=${maxDiff}"`;
    }
    if (activeTab === 'station') {
      return `curl -X GET "${base}/v1/station?model=${model}&domain=${domain}&time=${encodeURIComponent(
        validTime
      )}&station_id=${stationId}&variable=rain&max_difference=${maxDiff}"`;
    }
    const endTime = new Date(new Date(validTime).getTime() + 12 * 3600 * 1000).toISOString();
    return `curl -X GET "${base}/v1/timeseries?model=${model}&start_time=${encodeURIComponent(
      validTime
    )}&end_time=${encodeURIComponent(endTime)}&station_id=${stationId}&variable=rain&domain=${domain}"`;
  };

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(getCurlSnippet());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Endpoint Precision Probe</h3>
            <p className="text-[11px] text-slate-400">
              Direct parameterized testing for WRF Model and Observation Validation REST endpoints
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('latlon')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'latlon'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            /v1/latlon
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cell')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'cell'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            /v1/cell
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('station')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'station'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            /v1/station
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('timeseries')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'timeseries'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            /v1/timeseries
          </button>
        </div>
      </div>

      {/* Query Form & Parameters */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 my-4">
        <div className="lg:col-span-5 space-y-3">
          {/* Active endpoint parameters */}
          {activeTab === 'latlon' && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 font-mono text-[11px]">
                  lat (decimal deg):
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="-90"
                  max="90"
                  value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1 font-mono text-[11px]">
                  lon (decimal deg):
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="-180"
                  max="180"
                  value={lon}
                  onChange={(e) => setLon(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          )}

          {activeTab === 'cell' && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 font-mono text-[11px]">
                  x (grid column):
                </label>
                <input
                  type="number"
                  min="0"
                  value={gridX}
                  onChange={(e) => setGridX(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1 font-mono text-[11px]">
                  y (grid row):
                </label>
                <input
                  type="number"
                  min="0"
                  value={gridY}
                  onChange={(e) => setGridY(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          )}

          {(activeTab === 'station' || activeTab === 'timeseries') && (
            <div className="text-xs">
              <label className="text-slate-400 block mb-1 font-mono text-[11px]">
                station_id (AWS Registry):
              </label>
              <select
                value={stationId}
                onChange={(e) => {
                  setStationId(e.target.value);
                  const st = AWS_STATIONS.find((s) => s.id === e.target.value);
                  if (st) onSelectStation(st);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
              >
                {AWS_STATIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} — {s.name} ({s.district})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Model & Domain Context display */}
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>model:</span>
              <span className="text-cyan-300 font-bold">{model}</span>
            </div>
            <div className="flex justify-between">
              <span>domain:</span>
              <span className="text-amber-300 font-bold">{domain}</span>
            </div>
            <div className="flex justify-between">
              <span>variable:</span>
              <span className="text-white font-bold">rain</span>
            </div>
            <div className="flex justify-between">
              <span>time:</span>
              <span className="text-slate-300 truncate max-w-[180px]">{validTime}</span>
            </div>
          </div>

          {/* Execute Button */}
          <div className="flex items-center gap-2 pt-1">
            <button
              id="btn-execute-probe"
              type="button"
              onClick={handleExecuteProbe}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Querying Endpoint...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Request to /v1/{activeTab}</span>
                </>
              )}
            </button>

            <button
              id="btn-copy-probe-curl"
              type="button"
              onClick={handleCopyCurl}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs transition-colors"
              title="Copy cURL command"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Live Response Payload Inspector */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="flex items-center justify-between pb-1.5 text-xs">
            <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              JSON Response
            </span>
            {statusInfo && (
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  HTTP {statusInfo.status}
                </span>
                <span className="text-slate-400">{statusInfo.latencyMs} ms</span>
              </div>
            )}
          </div>

          <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 overflow-auto max-h-[220px] font-mono text-[11px] text-cyan-300">
            {responseJson ? (
              <pre className="whitespace-pre-wrap">{JSON.stringify(responseJson, null, 2)}</pre>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500">
                <Code className="w-6 h-6 mb-1 opacity-50" />
                <span>Click "Send Request" to probe the endpoint</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
