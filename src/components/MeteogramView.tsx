import React, { useState, useMemo } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  Cloud,
  CloudLightning,
  CloudRain,
  Compass,
  Download,
  Droplets,
  Gauge,
  Info,
  MapPin,
  Maximize2,
  Navigation,
  RefreshCw,
  Sun,
  Thermometer,
  Wind,
} from 'lucide-react';
import { MeteogramResponse, ModelType, StationItem } from '../types/rainfall';
import { AWS_STATIONS, getAlertForRainfall } from '../data/stations';

interface MeteogramViewProps {
  data: MeteogramResponse | null;
  isLoading: boolean;
  activeModel: ModelType;
  selectedStation: StationItem;
  onSelectStation: (st: StationItem) => void;
  selectedRangeHours: number;
  onRangeSelect: (hours: number) => void;
  validTime: string;
  onTimeSelect?: (timeIso: string) => void;
  onRefresh: () => void;
}

type WindUnit = 'kmh' | 'knots' | 'ms';

export const MeteogramView: React.FC<MeteogramViewProps> = ({
  data,
  isLoading,
  activeModel,
  selectedStation,
  onSelectStation,
  selectedRangeHours,
  onRangeSelect,
  validTime,
  onTimeSelect,
  onRefresh,
}) => {
  const [windUnit, setWindUnit] = useState<WindUnit>('kmh');
  const [activePanels, setActivePanels] = useState({
    precip: true,
    thermal: true,
    pressure: true,
    wind: true,
    cape: true,
  });

  const togglePanel = (panel: keyof typeof activePanels) => {
    setActivePanels((prev) => ({ ...prev, [panel]: !prev[panel] }));
  };

  // Convert wind speeds based on unit
  const convertWind = (kmh: number): number => {
    if (windUnit === 'knots') return Number((kmh * 0.539957).toFixed(1));
    if (windUnit === 'ms') return Number((kmh / 3.6).toFixed(1));
    return kmh;
  };

  const windUnitLabel = windUnit === 'knots' ? 'kt' : windUnit === 'ms' ? 'm/s' : 'km/h';

  // Format data for charts
  const chartData = useMemo(() => {
    if (!data || !data.series) return [];
    return data.series.map((p) => {
      const d = new Date(p.time);
      const shortTime = `${d.getUTCDate()} Aug ${d.getUTCHours().toString().padStart(2, '0')}:00Z`;
      const istHour = (d.getUTCHours() + 5.5) % 24;
      const istLabel = `${Math.floor(istHour).toString().padStart(2, '0')}:${istHour % 1 ? '30' : '00'} IST`;

      return {
        ...p,
        rawTime: p.time,
        displayTime: shortTime,
        istLabel,
        wind_speed_converted: convertWind(p.wind_speed_10m),
        wind_gust_converted: convertWind(p.wind_gust_10m),
        dewpointDepression: Number((p.temperature_2m - p.dewpoint_2m).toFixed(1)),
      };
    });
  }, [data, windUnit]);

  // Find instantaneous point matching the current scrubber validTime, or fallback to latest
  const currentPoint = useMemo(() => {
    if (!chartData.length) return null;
    const match = chartData.find((p) => p.rawTime === validTime);
    return match || chartData[chartData.length - 1];
  }, [chartData, validTime]);

  const peakRainAlert = useMemo(() => {
    return getAlertForRainfall(data?.summary.max_rain_rate || 0);
  }, [data]);

  // CSV Export handler
  const handleExportCsv = () => {
    if (!chartData.length) return;
    const headers = [
      'Timestamp_UTC',
      'IST_Hour',
      'Total_Rain_mm_h',
      'Convective_Rain_mm_h',
      'Stratiform_Rain_mm_h',
      'Cumulative_Rain_mm',
      'Temp_2m_C',
      'DewPoint_2m_C',
      'Relative_Humidity_Pct',
      'Pressure_MSLP_hPa',
      `Wind_Speed_${windUnitLabel}`,
      `Wind_Gust_${windUnitLabel}`,
      'Wind_Direction_Deg',
      'Wind_Direction_Cardinal',
      'CAPE_J_kg',
      'Cloud_Cover_Pct',
      'Weather_Condition',
    ];

    const rows = chartData.map((d) => [
      d.rawTime,
      d.istLabel,
      d.rain_total,
      d.rain_convective,
      d.rain_stratiform,
      d.cumulative_rain,
      d.temperature_2m,
      d.dewpoint_2m,
      d.relative_humidity,
      d.pressure_msl,
      d.wind_speed_converted,
      d.wind_gust_converted,
      d.wind_direction_deg,
      d.wind_direction_cardinal,
      d.cape,
      d.cloud_cover,
      `"${d.weather_condition}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `meteogram_${activeModel}_${data?.location.name || 'location'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading && !data) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center min-h-[420px] text-center">
        <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
        <p className="text-sm font-semibold text-white">Synthesizing High-Resolution Meteogram Profile...</p>
        <p className="text-xs text-slate-400 mt-1">
          Extracting thermodynamic, boundary layer, pressure, and convective rainfall series for {activeModel}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-5">
      {/* Top Header & Context Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              <span>Atmospheric Meteogram Profile</span>
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              Model: {activeModel}
            </span>
            <span className="text-xs px-2 py-0.5 rounded font-mono bg-slate-800 text-slate-300 border border-slate-700">
              Synchronized NWP Multi-Tier
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1 font-medium text-white">
              <MapPin className="w-3.5 h-3.5 text-rose-400" />
              {data?.location.name || selectedStation.name}
            </span>
            <span>•</span>
            <span>Elev: <strong className="text-slate-200">{data?.location.elevation || selectedStation.elevation} m ASL</strong></span>
            <span>•</span>
            <span>Coords: <strong className="text-slate-200">{(data?.location.lat || selectedStation.lat).toFixed(2)}°N, {(data?.location.lon || selectedStation.lon).toFixed(2)}°E</strong></span>
            {data?.location.district && (
              <>
                <span>•</span>
                <span>District: <strong className="text-slate-200">{data.location.district}</strong></span>
              </>
            )}
          </div>
        </div>

        {/* Action Controls & Range Presets */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Station Quick Select */}
          <select
            id="select-meteogram-station"
            value={selectedStation.id}
            onChange={(e) => {
              const st = AWS_STATIONS.find((s) => s.id === e.target.value);
              if (st) onSelectStation(st);
            }}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-500"
          >
            {AWS_STATIONS.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name} ({st.district})
              </option>
            ))}
          </select>

          {/* Time Range Chips */}
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5 text-xs">
            {[12, 24, 36, 48].map((hours) => (
              <button
                key={hours}
                id={`btn-range-${hours}h`}
                type="button"
                onClick={() => onRangeSelect(hours)}
                className={`px-2.5 py-1 rounded-md transition-all font-mono ${
                  selectedRangeHours === hours
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {hours}h
              </button>
            ))}
          </div>

          {/* Wind Unit Toggle */}
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5 text-xs">
            {(['kmh', 'knots', 'ms'] as WindUnit[]).map((u) => (
              <button
                key={u}
                id={`btn-unit-${u}`}
                type="button"
                onClick={() => setWindUnit(u)}
                className={`px-2 py-1 rounded-md transition-all uppercase text-[11px] font-mono ${
                  windUnit === u
                    ? 'bg-slate-700 text-cyan-300 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {u === 'kmh' ? 'km/h' : u === 'knots' ? 'kt' : 'm/s'}
              </button>
            ))}
          </div>

          {/* Export CSV */}
          <button
            id="btn-export-meteogram-csv"
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Download CSV of all meteorological parameters"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          {/* Refresh */}
          <button
            id="btn-refresh-meteogram"
            type="button"
            onClick={onRefresh}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Refresh meteogram data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Instantaneous Weather Telemetry Strip (At current time scrubber or peak) */}
      {currentPoint && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Tile 1: Precipitation */}
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/90 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
                <span>Rain Rate</span>
              </span>
              <span
                className="text-[10px] px-1.5 py-0.2 rounded font-semibold"
                style={{ backgroundColor: `${peakRainAlert.bgColor}`, color: peakRainAlert.color }}
              >
                {peakRainAlert.label}
              </span>
            </div>
            <div className="my-1">
              <span className="text-xl font-bold font-mono text-white">
                {currentPoint.rain_total.toFixed(1)}
              </span>
              <span className="text-xs text-slate-400 ml-1">mm/h</span>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center justify-between">
              <span>Accum:</span>
              <span className="font-mono text-cyan-300 font-semibold">{currentPoint.cumulative_rain} mm</span>
            </div>
          </div>

          {/* Tile 2: Temperature & Dew Point */}
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/90 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Thermometer className="w-3.5 h-3.5 text-rose-400" />
                <span>2m Air Temp</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">T / Td</span>
            </div>
            <div className="my-1 flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-mono text-rose-400">
                {currentPoint.temperature_2m}°
              </span>
              <span className="text-xs font-mono text-emerald-400">
                / {currentPoint.dewpoint_2m}°C
              </span>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center justify-between">
              <span>Depression:</span>
              <span className="font-mono text-slate-200">
                {(currentPoint.temperature_2m - currentPoint.dewpoint_2m).toFixed(1)}°C
              </span>
            </div>
          </div>

          {/* Tile 3: Relative Humidity */}
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/90 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Droplets className="w-3.5 h-3.5 text-sky-400" />
                <span>Rel Humidity</span>
              </span>
              <span className="text-[10px] text-cyan-400">2m AGL</span>
            </div>
            <div className="my-1">
              <span className="text-xl font-bold font-mono text-sky-300">
                {currentPoint.relative_humidity}%
              </span>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center justify-between">
              <span>Status:</span>
              <span className="font-medium text-slate-300">
                {currentPoint.relative_humidity > 90 ? 'Near Saturation' : 'Humid'}
              </span>
            </div>
          </div>

          {/* Tile 4: Mean Sea Level Pressure */}
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/90 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5 text-indigo-400" />
                <span>Pressure MSL</span>
              </span>
              <span className="text-[10px] text-indigo-400">Trough</span>
            </div>
            <div className="my-1">
              <span className="text-xl font-bold font-mono text-indigo-300">
                {currentPoint.pressure_msl}
              </span>
              <span className="text-xs text-slate-400 ml-1">hPa</span>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center justify-between">
              <span>Regional Avg:</span>
              <span className="font-mono text-slate-300">1003.0</span>
            </div>
          </div>

          {/* Tile 5: 10m Wind & Direction */}
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/90 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Wind className="w-3.5 h-3.5 text-teal-400" />
                <span>10m Wind</span>
              </span>
              <span className="text-[10px] font-mono text-teal-300 flex items-center gap-0.5">
                <Navigation
                  className="w-2.5 h-2.5 transition-transform"
                  style={{ transform: `rotate(${currentPoint.wind_direction_deg}deg)` }}
                />
                {currentPoint.wind_direction_cardinal}
              </span>
            </div>
            <div className="my-1">
              <span className="text-xl font-bold font-mono text-teal-300">
                {currentPoint.wind_speed_converted}
              </span>
              <span className="text-xs text-slate-400 ml-1">{windUnitLabel}</span>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center justify-between">
              <span>Gust:</span>
              <span className="font-mono text-amber-400 font-semibold">
                {currentPoint.wind_gust_converted} {windUnitLabel}
              </span>
            </div>
          </div>

          {/* Tile 6: Atmospheric Instability (CAPE) */}
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/90 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <CloudLightning className="w-3.5 h-3.5 text-purple-400" />
                <span>CAPE Index</span>
              </span>
              <span className="text-[10px] text-purple-400">Convective</span>
            </div>
            <div className="my-1">
              <span className="text-xl font-bold font-mono text-purple-300">
                {currentPoint.cape}
              </span>
              <span className="text-xs text-slate-400 ml-1">J/kg</span>
            </div>
            <div className="text-[10px] text-slate-400 truncate" title={currentPoint.weather_condition}>
              <span className="text-slate-300 font-medium">{currentPoint.weather_condition}</span>
            </div>
          </div>
        </div>
      )}

      {/* Panel Visibility Quick Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-400">
        <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
          <Info className="w-3.5 h-3.5 text-cyan-400" />
          <span>Synchronized Meteorological Layers (Click bar to scrub map time):</span>
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            id="toggle-panel-precip"
            type="button"
            onClick={() => togglePanel('precip')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
              activePanels.precip
                ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300'
                : 'bg-slate-800 border-slate-700 text-slate-500'
            }`}
          >
            Precipitation
          </button>
          <button
            id="toggle-panel-thermal"
            type="button"
            onClick={() => togglePanel('thermal')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
              activePanels.thermal
                ? 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                : 'bg-slate-800 border-slate-700 text-slate-500'
            }`}
          >
            Temp & Dew Point
          </button>
          <button
            id="toggle-panel-pressure"
            type="button"
            onClick={() => togglePanel('pressure')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
              activePanels.pressure
                ? 'bg-indigo-950/60 border-indigo-500/40 text-indigo-300'
                : 'bg-slate-800 border-slate-700 text-slate-500'
            }`}
          >
            Pressure (MSLP)
          </button>
          <button
            id="toggle-panel-wind"
            type="button"
            onClick={() => togglePanel('wind')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
              activePanels.wind
                ? 'bg-teal-950/60 border-teal-500/40 text-teal-300'
                : 'bg-slate-800 border-slate-700 text-slate-500'
            }`}
          >
            Wind & Direction
          </button>
          <button
            id="toggle-panel-cape"
            type="button"
            onClick={() => togglePanel('cape')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
              activePanels.cape
                ? 'bg-purple-950/60 border-purple-500/40 text-purple-300'
                : 'bg-slate-800 border-slate-700 text-slate-500'
            }`}
          >
            CAPE & Clouds
          </button>
        </div>
      </div>

      {/* --- Stacked Synchronized Meteogram Panels --- */}
      <div className="space-y-4">
        {/* PANEL 1: Precipitation (Convective vs Stratiform & Cumulative) */}
        {activePanels.precip && (
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CloudRain className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  1. Precipitation Breakdown (mm/h) & Inundation Accumulation (mm)
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1 text-amber-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                  <span>Convective Rain (rainc)</span>
                </span>
                <span className="flex items-center gap-1 text-sky-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-sky-500" />
                  <span>Stratiform Rain (rainnc)</span>
                </span>
                <span className="flex items-center gap-1 text-cyan-300">
                  <span className="w-2.5 h-0.5 bg-cyan-400" />
                  <span>Cumulative (mm)</span>
                </span>
              </div>
            </div>

            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  syncId="meteogramSync"
                  data={chartData}
                  onClick={(e: any) => {
                    if (e && e.activePayload && e.activePayload[0]) {
                      const payload = e.activePayload[0].payload;
                      if (payload.rawTime && onTimeSelect) onTimeSelect(payload.rawTime);
                    }
                  }}
                  margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#0891b2" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#334155" strokeDasharray="2 2" vertical={false} opacity={0.4} />
                  <XAxis dataKey="displayTime" stroke="#64748b" tick={{ fontSize: 10 }} hide />
                  <YAxis
                    yAxisId="rateAxis"
                    orientation="left"
                    stroke="#94a3b8"
                    tick={{ fontSize: 10 }}
                    label={{ value: 'mm/h', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 10 }}
                  />
                  <YAxis
                    yAxisId="cumAxis"
                    orientation="right"
                    stroke="#22d3ee"
                    tick={{ fontSize: 10 }}
                    label={{ value: 'Total mm', angle: 90, position: 'insideRight', fill: '#22d3ee', fontSize: 10 }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-900/95 border border-cyan-500/40 p-2.5 rounded-lg shadow-xl text-xs font-mono">
                          <p className="font-bold text-white mb-1">{d.displayTime} ({d.istLabel})</p>
                          <div className="text-amber-400">Convective: {d.rain_convective} mm/h</div>
                          <div className="text-sky-400">Stratiform: {d.rain_stratiform} mm/h</div>
                          <div className="text-white font-semibold">Total Rate: {d.rain_total} mm/h</div>
                          <div className="text-cyan-300 font-bold mt-1">Cumulative: {d.cumulative_rain} mm</div>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine
                    yAxisId="rateAxis"
                    y={35.5}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    label={{ value: 'IMD Heavy Rain (35.5)', fill: '#f59e0b', fontSize: 9, position: 'insideTopLeft' }}
                  />
                  {/* Convective & Stratiform Stacked Bars */}
                  <Bar
                    yAxisId="rateAxis"
                    dataKey="rain_convective"
                    stackId="rainStack"
                    name="Convective (rainc)"
                    fill="#f59e0b"
                    maxBarSize={24}
                  />
                  <Bar
                    yAxisId="rateAxis"
                    dataKey="rain_stratiform"
                    stackId="rainStack"
                    name="Stratiform (rainnc)"
                    fill="#38bdf8"
                    maxBarSize={24}
                  />
                  {/* Cumulative Rain Line */}
                  <Line
                    yAxisId="cumAxis"
                    type="monotone"
                    dataKey="cumulative_rain"
                    name="Cumulative"
                    stroke="#22d3ee"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* PANEL 2: Thermodynamic Profile (2m Air Temperature, Dew Point & Relative Humidity) */}
        {activePanels.thermal && (
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  2. 2m Temperature, Dew Point (°C) & Relative Humidity (%)
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1 text-rose-400">
                  <span className="w-2.5 h-0.5 bg-rose-500" />
                  <span>2m Air Temp (T2)</span>
                </span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2.5 h-0.5 bg-emerald-500" />
                  <span>Dew Point (Td)</span>
                </span>
                <span className="flex items-center gap-1 text-sky-300">
                  <span className="w-2.5 h-2 rounded-sm bg-sky-500/30 border border-sky-400/40" />
                  <span>RH (%)</span>
                </span>
              </div>
            </div>

            <div className="h-[170px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  syncId="meteogramSync"
                  data={chartData}
                  margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
                >
                  <CartesianGrid stroke="#334155" strokeDasharray="2 2" vertical={false} opacity={0.4} />
                  <XAxis dataKey="displayTime" stroke="#64748b" tick={{ fontSize: 10 }} hide />
                  <YAxis
                    yAxisId="tempAxis"
                    orientation="left"
                    stroke="#f87171"
                    tick={{ fontSize: 10 }}
                    domain={['dataMin - 2', 'dataMax + 2']}
                    label={{ value: '°C', angle: -90, position: 'insideLeft', fill: '#f87171', fontSize: 10 }}
                  />
                  <YAxis
                    yAxisId="rhAxis"
                    orientation="right"
                    stroke="#38bdf8"
                    tick={{ fontSize: 10 }}
                    domain={[40, 100]}
                    label={{ value: 'RH %', angle: 90, position: 'insideRight', fill: '#38bdf8', fontSize: 10 }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-900/95 border border-rose-500/40 p-2.5 rounded-lg shadow-xl text-xs font-mono">
                          <p className="font-bold text-white mb-1">{d.displayTime} ({d.istLabel})</p>
                          <div className="text-rose-400 font-semibold">2m Temp: {d.temperature_2m}°C</div>
                          <div className="text-emerald-400">Dew Point: {d.dewpoint_2m}°C</div>
                          <div className="text-slate-300">Spread (T - Td): {d.dewpointDepression}°C</div>
                          <div className="text-sky-300 font-bold mt-1">Relative Humidity: {d.relative_humidity}%</div>
                        </div>
                      );
                    }}
                  />
                  {/* RH shaded background */}
                  <Area
                    yAxisId="rhAxis"
                    type="monotone"
                    dataKey="relative_humidity"
                    fill="#38bdf8"
                    fillOpacity={0.15}
                    stroke="#38bdf8"
                    strokeWidth={1}
                  />
                  {/* Temperature curve */}
                  <Line
                    yAxisId="tempAxis"
                    type="monotone"
                    dataKey="temperature_2m"
                    stroke="#f87171"
                    strokeWidth={2.5}
                    dot={false}
                  />
                  {/* Dew Point curve */}
                  <Line
                    yAxisId="tempAxis"
                    type="monotone"
                    dataKey="dewpoint_2m"
                    stroke="#34d399"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* PANEL 3: Surface Pressure (Mean Sea Level Pressure MSLP) */}
        {activePanels.pressure && (
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  3. Mean Sea Level Pressure (MSLP, hPa) & Mesoscale Trough Depression
                </span>
              </div>
              <div className="text-[11px] text-indigo-300 font-mono">
                Min: {data?.summary.min_pressure} hPa (Trough axis)
              </div>
            </div>

            <div className="h-[140px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  syncId="meteogramSync"
                  data={chartData}
                  margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="pressGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818cf8" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#334155" strokeDasharray="2 2" vertical={false} opacity={0.4} />
                  <XAxis dataKey="displayTime" stroke="#64748b" tick={{ fontSize: 10 }} hide />
                  <YAxis
                    orientation="left"
                    stroke="#818cf8"
                    tick={{ fontSize: 10 }}
                    domain={['dataMin - 1', 'dataMax + 1']}
                    label={{ value: 'hPa', angle: -90, position: 'insideLeft', fill: '#818cf8', fontSize: 10 }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-900/95 border border-indigo-500/40 p-2.5 rounded-lg shadow-xl text-xs font-mono">
                          <p className="font-bold text-white mb-1">{d.displayTime} ({d.istLabel})</p>
                          <div className="text-indigo-300 font-bold text-sm">Pressure: {d.pressure_msl} hPa</div>
                          <div className="text-slate-400 mt-1">Solar tide & convective perturbation included</div>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="pressure_msl"
                    stroke="#818cf8"
                    strokeWidth={2}
                    fill="url(#pressGrad)"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* PANEL 4: 10m Wind Profile, Peak Gusts & Cardinal Direction Barbs */}
        {activePanels.wind && (
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Wind className="w-4 h-4 text-teal-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  4. 10m Wind Speed, Gusts ({windUnitLabel}) & Direction Streamlines
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1 text-teal-300">
                  <span className="w-2.5 h-0.5 bg-teal-400" />
                  <span>Sustained Wind</span>
                </span>
                <span className="flex items-center gap-1 text-amber-400">
                  <span className="w-2.5 h-0.5 bg-amber-400 border-b border-dashed" />
                  <span>Max Gust</span>
                </span>
                <span className="text-slate-400 font-mono">
                  Predominant: <strong className="text-teal-300">{data?.summary.predominant_wind_dir}</strong>
                </span>
              </div>
            </div>

            <div className="h-[170px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  syncId="meteogramSync"
                  data={chartData}
                  margin={{ top: 10, right: 30, left: 10, bottom: 25 }}
                >
                  <defs>
                    <linearGradient id="windGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#0f766e" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#334155" strokeDasharray="2 2" vertical={false} opacity={0.4} />
                  <XAxis
                    dataKey="displayTime"
                    stroke="#64748b"
                    tick={{ fontSize: 9 }}
                    interval="preserveStartEnd"
                    tickFormatter={(val, i) => {
                      const item = chartData[i];
                      return item ? `${item.wind_direction_cardinal}` : val;
                    }}
                  />
                  <YAxis
                    orientation="left"
                    stroke="#2dd4bf"
                    tick={{ fontSize: 10 }}
                    label={{ value: windUnitLabel, angle: -90, position: 'insideLeft', fill: '#2dd4bf', fontSize: 10 }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-900/95 border border-teal-500/40 p-2.5 rounded-lg shadow-xl text-xs font-mono">
                          <p className="font-bold text-white mb-1">{d.displayTime} ({d.istLabel})</p>
                          <div className="text-teal-300 font-semibold">
                            Sustained: {d.wind_speed_converted} {windUnitLabel}
                          </div>
                          <div className="text-amber-400 font-semibold">
                            Peak Gust: {d.wind_gust_converted} {windUnitLabel}
                          </div>
                          <div className="text-slate-300 mt-1 flex items-center gap-1">
                            <span>Direction:</span>
                            <span className="font-bold text-white">{d.wind_direction_cardinal} ({d.wind_direction_deg}°)</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="wind_speed_converted"
                    stroke="#14b8a6"
                    strokeWidth={2}
                    fill="url(#windGrad)"
                  />
                  <Line
                    type="monotone"
                    dataKey="wind_gust_converted"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="3 3"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Directional Indicator Ribbon */}
            <div className="mt-1 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 overflow-x-auto">
              <span className="font-semibold text-slate-300 shrink-0 mr-2 flex items-center gap-1">
                <Compass className="w-3 h-3 text-teal-400" />
                <span>Direction:</span>
              </span>
              <div className="flex items-center justify-between w-full font-mono gap-1">
                {chartData.filter((_, idx) => idx % 2 === 0).map((p, idx) => (
                  <div key={idx} className="flex flex-col items-center min-w-[28px]">
                    <Navigation
                      className="w-2.5 h-2.5 text-teal-400"
                      style={{ transform: `rotate(${p.wind_direction_deg}deg)` }}
                    />
                    <span className="text-[9px] text-slate-400">{p.wind_direction_cardinal}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PANEL 5: Instability (CAPE) & Total Cloud Cover */}
        {activePanels.cape && (
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CloudLightning className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  5. Convective Available Potential Energy (CAPE, J/kg) & Cloud Fraction (%)
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1 text-purple-400">
                  <span className="w-2.5 h-0.5 bg-purple-500" />
                  <span>CAPE (J/kg)</span>
                </span>
                <span className="flex items-center gap-1 text-slate-400">
                  <span className="w-2.5 h-0.5 bg-slate-400" />
                  <span>Cloud Cover (%)</span>
                </span>
                <span className="text-purple-300 font-mono">
                  Max CAPE: <strong className="text-white">{data?.summary.max_cape} J/kg</strong>
                </span>
              </div>
            </div>

            <div className="h-[170px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  syncId="meteogramSync"
                  data={chartData}
                  margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
                >
                  <defs>
                    <linearGradient id="capeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a855f7" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#7e22ce" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#334155" strokeDasharray="2 2" vertical={false} opacity={0.4} />
                  <XAxis dataKey="displayTime" stroke="#64748b" tick={{ fontSize: 9 }} />
                  <YAxis
                    yAxisId="capeAxis"
                    orientation="left"
                    stroke="#c084fc"
                    tick={{ fontSize: 10 }}
                    label={{ value: 'J/kg', angle: -90, position: 'insideLeft', fill: '#c084fc', fontSize: 10 }}
                  />
                  <YAxis
                    yAxisId="cloudAxis"
                    orientation="right"
                    stroke="#94a3b8"
                    tick={{ fontSize: 10 }}
                    domain={[0, 100]}
                    label={{ value: 'Clouds %', angle: 90, position: 'insideRight', fill: '#94a3b8', fontSize: 10 }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-900/95 border border-purple-500/40 p-2.5 rounded-lg shadow-xl text-xs font-mono">
                          <p className="font-bold text-white mb-1">{d.displayTime} ({d.istLabel})</p>
                          <div className="text-purple-300 font-bold">CAPE: {d.cape} J/kg</div>
                          <div className="text-slate-300">Cloud Cover: {d.cloud_cover}%</div>
                          <div className="text-emerald-400 font-semibold mt-1">Condition: {d.weather_condition}</div>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine
                    yAxisId="capeAxis"
                    y={1500}
                    stroke="#a855f7"
                    strokeDasharray="3 3"
                    label={{ value: 'Moderate Instability (1500)', fill: '#c084fc', fontSize: 9, position: 'insideTopLeft' }}
                  />
                  <ReferenceLine
                    yAxisId="capeAxis"
                    y={2500}
                    stroke="#ef4444"
                    strokeDasharray="3 3"
                    label={{ value: 'High Severe Storm Potential (2500)', fill: '#f87171', fontSize: 9, position: 'insideTopRight' }}
                  />
                  <Area
                    yAxisId="capeAxis"
                    type="monotone"
                    dataKey="cape"
                    stroke="#a855f7"
                    strokeWidth={2}
                    fill="url(#capeGrad)"
                  />
                  <Line
                    yAxisId="cloudAxis"
                    type="monotone"
                    dataKey="cloud_cover"
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Meteogram Operational Guide Footer */}
      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>
            <strong>NWP Interpretation:</strong> Rapid MSLP drops coinciding with high CAPE (&gt;1500 J/kg) and sudden wind shifts from SSW to ENE signal impending mesoscale convective downdrafts and severe localized flash-flood risk.
          </span>
        </div>
        <span className="font-mono text-cyan-400 shrink-0 text-right">
          Grid: d02 (High-Res 3km)
        </span>
      </div>
    </div>
  );
};
