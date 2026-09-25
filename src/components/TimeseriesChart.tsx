import React, { useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  BarChart2,
  Calendar,
  CloudRain,
  Copy,
  Download,
  Eye,
  Info,
  Layers,
  Radio,
  Satellite,
  Scale,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { ModelType, TimeseriesResponse } from '../types/rainfall';
import { getAlertForRainfall } from '../data/stations';

interface TimeseriesChartProps {
  data: TimeseriesResponse | null;
  isLoading: boolean;
  activeModel: ModelType;
  onRangeSelect: (hours: number) => void;
  selectedRangeHours: number;
  onOpenMeteogram?: () => void;
}

export const TimeseriesChart: React.FC<TimeseriesChartProps> = ({
  data,
  isLoading,
  activeModel,
  onRangeSelect,
  selectedRangeHours,
  onOpenMeteogram,
}) => {
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [chartMode, setChartMode] = useState<'rates' | 'cumulative' | 'bias'>('rates');

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 min-h-[420px] flex flex-col items-center justify-center text-slate-400">
        <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-400 rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-300">Fetching Timeseries from /v1/timeseries...</p>
        <p className="text-xs text-slate-500 mt-1">Collocating WRF forecast, NASA GPM satellite, and ground AWS gauge curves</p>
      </div>
    );
  }

  if (!data || !data.series || data.series.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 min-h-[420px] flex flex-col items-center justify-center text-slate-400">
        <CloudRain className="w-10 h-10 text-slate-600 mb-3" />
        <p className="text-sm text-slate-300">No timeseries data available for this selection.</p>
        <p className="text-xs text-slate-500 mt-1">Select a station or click a point on the map.</p>
      </div>
    );
  }

  const hasAws = data.series.some((s) => s.aws_observed !== undefined);

  // Format chart series data
  const formattedData = data.series.map((item) => {
    const d = new Date(item.time);
    const timeLabel = `${d.getUTCDate()} Aug ${d.getUTCHours().toString().padStart(2, '0')}:00Z`;
    return {
      rawTime: item.time,
      time: timeLabel,
      wrf_model: item.wrf_model ?? item.value,
      gpm_observed: item.gpm_observed ?? 0,
      aws_observed: item.aws_observed,
      bias: item.bias ?? Number(((item.wrf_model ?? item.value) - (item.gpm_observed ?? 0)).toFixed(2)),
      wrf_cumulative: item.wrf_cumulative ?? item.cumulative_value,
      gpm_cumulative: item.gpm_cumulative ?? 0,
      aws_cumulative: item.aws_cumulative,
    };
  });

  const peakAlert = getAlertForRainfall(data.summary.max_rate);

  // CSV Export handler
  const handleExportCSV = () => {
    const headers = [
      'Timestamp_UTC',
      'WRF_Model_Rate_mm_h',
      'GPM_Observed_Rate_mm_h',
      'AWS_Observed_Rate_mm_h',
      'Bias_Difference_mm_h',
      'WRF_Cumulative_mm',
      'GPM_Cumulative_mm',
      'AWS_Cumulative_mm',
    ];
    const rows = formattedData.map((d) => [
      d.rawTime,
      d.wrf_model,
      d.gpm_observed,
      d.aws_observed ?? '',
      d.bias,
      d.wrf_cumulative,
      d.gpm_cumulative,
      d.aws_cumulative ?? '',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `timeseries_WRF_vs_Observations_${data.location.id || 'point'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-lg flex flex-col">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <BarChart2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  Model vs Observation Hyetograph & Verification Series
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  WRF / GPM / AWS
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Location: <strong className="text-white">{data.location.name || data.location.id || 'Selected Spatial Cell'}</strong>
                {data.location.lat && ` (${data.location.lat}°N, ${data.location.lon}°E)`}
              </p>
            </div>
          </div>
        </div>

        {/* Range selectors, View mode, and Export buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Chart Display Mode Switcher */}
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setChartMode('rates')}
              className={`px-2.5 py-1 rounded transition-colors font-medium ${
                chartMode === 'rates'
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Rain Rates (mm/h)
            </button>
            <button
              type="button"
              onClick={() => setChartMode('cumulative')}
              className={`px-2.5 py-1 rounded transition-colors font-medium ${
                chartMode === 'cumulative'
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Accumulation (mm)
            </button>
            <button
              type="button"
              onClick={() => setChartMode('bias')}
              className={`px-2.5 py-1 rounded transition-colors font-medium ${
                chartMode === 'bias'
                  ? 'bg-amber-600 text-white font-bold shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Error Bias (Δ)
            </button>
          </div>

          {/* Time Range Presets */}
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5 text-xs">
            {[6, 12, 24, 36].map((hours) => (
              <button
                key={hours}
                id={`btn-range-${hours}h`}
                type="button"
                onClick={() => onRangeSelect(hours)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  selectedRangeHours === hours
                    ? 'bg-slate-700 text-blue-300 font-bold shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {hours}h
              </button>
            ))}
          </div>

          {/* Export options */}
          <div className="flex items-center gap-1">
            <button
              id="btn-export-csv"
              type="button"
              onClick={handleExportCSV}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
              title="Export as CSV"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              id="btn-copy-json"
              type="button"
              onClick={handleCopyJson}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors relative"
              title="Copy raw JSON payload"
            >
              <Copy className="w-3.5 h-3.5" />
              {copiedNotification && (
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-blue-600 text-white text-[10px] rounded shadow-md whitespace-nowrap">
                  Copied!
                </span>
              )}
            </button>

            {onOpenMeteogram && (
              <button
                id="btn-open-meteogram"
                type="button"
                onClick={onOpenMeteogram}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-blue-950 hover:bg-blue-900 text-blue-300 border border-blue-800 transition-colors font-medium ml-1"
                title="Open comprehensive atmospheric meteogram profile"
              >
                <Activity className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Meteogram</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Stats Comparison Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
        {/* WRF Model Total */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
          <div className="flex items-center justify-between text-[11px] text-blue-400 font-medium">
            <span>WRF Model Total</span>
            <span className="w-2 h-2 rounded-full bg-blue-500" />
          </div>
          <div className="text-xl font-bold text-blue-300 font-mono mt-0.5">
            {data.summary.wrf_total ?? data.summary.total_accumulation}{' '}
            <span className="text-xs font-normal text-slate-400">mm</span>
          </div>
          <span className="text-[10px] text-slate-500">Peak: {data.summary.max_rate} mm/h</span>
        </div>

        {/* Observed Total (AWS or GPM) */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
          <div className="flex items-center justify-between text-[11px] text-cyan-400 font-medium">
            <span>{hasAws ? 'AWS Gauge Observed' : 'GPM Satellite Total'}</span>
            <span className={`w-2 h-2 rounded-full ${hasAws ? 'bg-emerald-500' : 'bg-cyan-500'}`} />
          </div>
          <div className="text-xl font-bold text-cyan-300 font-mono mt-0.5">
            {hasAws ? data.summary.aws_total : data.summary.gpm_total}{' '}
            <span className="text-xs font-normal text-slate-400">mm</span>
          </div>
          <span className="text-[10px] text-slate-500">Ground truth benchmark</span>
        </div>

        {/* Mean Error / Bias */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span>Mean Bias (WRF − Obs)</span>
            <Scale className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div
            className="text-xl font-bold font-mono mt-0.5"
            style={{ color: (data.summary.mean_bias ?? 0) > 0 ? '#60a5fa' : '#f87171' }}
          >
            {(data.summary.mean_bias ?? 0) > 0 ? `+${data.summary.mean_bias}` : data.summary.mean_bias}{' '}
            <span className="text-xs font-normal text-slate-400">mm/h</span>
          </div>
          <span className="text-[10px] text-slate-500">
            {(data.summary.mean_bias ?? 0) > 0 ? 'Model Overestimation' : 'Model Underestimation'}
          </span>
        </div>

        {/* IMD Flood Advisory Level */}
        <div
          className="rounded-xl p-3 border flex flex-col justify-between"
          style={{
            backgroundColor: `${peakAlert.color}15`,
            borderColor: `${peakAlert.color}40`,
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium" style={{ color: peakAlert.color }}>
              IMD Advisory Level
            </span>
            <AlertTriangle className="w-3.5 h-3.5" style={{ color: peakAlert.color }} />
          </div>
          <div className="text-lg font-bold font-mono" style={{ color: peakAlert.color }}>
            {peakAlert.label}
          </div>
          <span className="text-[10px] text-slate-400 line-clamp-1">{peakAlert.description}</span>
        </div>
      </div>

      {/* Main Hyetograph Recharts Canvas */}
      <div className="h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={formattedData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="time"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              interval="preserveStartEnd"
            />

            {chartMode === 'rates' && (
              <>
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  label={{ value: 'Rate (mm/h)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)',
                  }}
                  itemStyle={{ fontSize: '12px' }}
                  labelStyle={{ color: '#94a3b8', fontSize: '11px', marginBottom: '4px' }}
                />
                <Legend
                  verticalAlign="top"
                  height={30}
                  wrapperStyle={{ fontSize: '12px', color: '#cbd5e1' }}
                />
                {/* WRF Model Forecast */}
                <Bar
                  dataKey="wrf_model"
                  name="WRF Model Forecast (mm/h)"
                  fill="#3b82f6"
                  opacity={0.8}
                  radius={[3, 3, 0, 0]}
                />
                {/* GPM Satellite Gridded Observation */}
                <Line
                  type="monotone"
                  dataKey="gpm_observed"
                  name="NASA GPM Satellite Observed (mm/h)"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#06b6d4' }}
                />
                {/* AWS In-Situ Ground Gauge Observation */}
                {hasAws && (
                  <Line
                    type="monotone"
                    dataKey="aws_observed"
                    name="IMD AWS In-Situ Gauge (mm/h)"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    strokeDasharray="4 3"
                    dot={{ r: 4, fill: '#10b981' }}
                  />
                )}
              </>
            )}

            {chartMode === 'cumulative' && (
              <>
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  label={{ value: 'Total Rain (mm)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                  }}
                />
                <Legend
                  verticalAlign="top"
                  height={30}
                  wrapperStyle={{ fontSize: '12px', color: '#cbd5e1' }}
                />
                <Area
                  type="monotone"
                  dataKey="wrf_cumulative"
                  name="WRF Model Accumulation (mm)"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="gpm_cumulative"
                  name="GPM Satellite Accumulation (mm)"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  dot={{ r: 2.5 }}
                />
                {hasAws && (
                  <Line
                    type="monotone"
                    dataKey="aws_cumulative"
                    name="AWS Gauge Accumulation (mm)"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    strokeDasharray="4 3"
                    dot={{ r: 3.5 }}
                  />
                )}
              </>
            )}

            {chartMode === 'bias' && (
              <>
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  label={{ value: 'Bias Δ (mm/h)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
                />
                <ReferenceLine y={0} stroke="#64748b" strokeDasharray="3 3" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                  }}
                />
                <Legend
                  verticalAlign="top"
                  height={30}
                  wrapperStyle={{ fontSize: '12px', color: '#cbd5e1' }}
                />
                <Bar
                  dataKey="bias"
                  name="Error Bias: WRF − Obs (mm/h)"
                  fill="#f59e0b"
                  radius={[2, 2, 0, 0]}
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
