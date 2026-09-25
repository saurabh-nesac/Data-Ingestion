import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  CheckCircle2,
  Database,
  Download,
  Filter,
  Layers,
  MapPin,
  Radio,
  RefreshCw,
  Satellite,
  Scale,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { StationValidationRow, VerificationMetrics } from '../types/rainfall';
import { apiClient } from '../services/apiClient';

interface VerificationPanelProps {
  validTime: string;
  onSelectStationById?: (stationId: string) => void;
}

export const VerificationPanel: React.FC<VerificationPanelProps> = ({
  validTime,
  onSelectStationById,
}) => {
  const [metrics, setMetrics] = useState<VerificationMetrics | null>(null);
  const [stationRows, setStationRows] = useState<StationValidationRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterPerformance, setFilterPerformance] = useState<'ALL' | 'ACCURATE' | 'OVERESTIMATED' | 'UNDERESTIMATED'>('ALL');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [m, rows] = await Promise.all([
        apiClient.getVerificationMetrics(validTime),
        apiClient.getStationValidationTable(validTime),
      ]);
      setMetrics(m);
      setStationRows(rows);
    } catch (err) {
      console.error('Failed to load verification metrics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [validTime]);

  const filteredRows = stationRows.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.district.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.state.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.id.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (filterPerformance !== 'ALL' && r.performance !== filterPerformance) return false;
    return true;
  });

  const exportCsv = () => {
    if (!stationRows.length) return;
    const headers = [
      'Station_ID',
      'Station_Name',
      'District',
      'State',
      'Elevation_m',
      'AWS_InSitu_Observed_mm_h',
      'WRF_Model_Forecast_mm_h',
      'GPM_Satellite_Observed_mm_h',
      'Bias_vs_AWS_mm_h',
      'Bias_vs_GPM_mm_h',
      'Performance_Tag',
    ];
    const rows = stationRows.map((r) => [
      r.id,
      `"${r.name}"`,
      `"${r.district}"`,
      `"${r.state}"`,
      r.elevation,
      r.aws_observed,
      r.wrf_model,
      r.gpm_satellite,
      r.bias_aws,
      r.bias_gpm,
      r.performance,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `WRF_Observation_Validation_${validTime.slice(0, 13)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading && !metrics) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 min-h-[420px] flex flex-col items-center justify-center text-slate-400">
        <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-200">Computing Verification Metrics against Observations...</p>
        <p className="text-xs text-slate-500 mt-1">Collocating WRF numerical forecasts with AWS gauges and NASA GPM satellite pixels</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">
                WRF Model vs Observation Statistical Verification
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Evaluation Engine
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Quantitative comparison of WRF Numerical Forecasts against IMD AWS Point Gauges & NASA GPM IMERG 0.1° Gridded Satellite
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
            <span>Recalculate</span>
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Verification CSV</span>
          </button>
        </div>
      </div>

      {/* Primary Verification Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Mean Bias vs AWS */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Mean Bias (vs AWS)</span>
              <Radio className="w-3 h-3 text-emerald-400" />
            </div>
            <div
              className="text-xl font-bold font-mono mt-1"
              style={{ color: metrics.mean_bias_aws > 0.5 ? '#60a5fa' : metrics.mean_bias_aws < -0.5 ? '#f87171' : '#34d399' }}
            >
              {metrics.mean_bias_aws > 0 ? `+${metrics.mean_bias_aws}` : metrics.mean_bias_aws}
              <span className="text-xs font-normal text-slate-400 ml-1">mm/h</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {metrics.mean_bias_aws > 0.5 ? 'Wet Overestimate' : metrics.mean_bias_aws < -0.5 ? 'Dry Underestimate' : 'Near Zero Bias'}
            </div>
          </div>

          {/* Mean Bias vs GPM */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Mean Bias (vs GPM)</span>
              <Satellite className="w-3 h-3 text-cyan-400" />
            </div>
            <div
              className="text-xl font-bold font-mono mt-1"
              style={{ color: metrics.mean_bias_gpm > 0.5 ? '#60a5fa' : metrics.mean_bias_gpm < -0.5 ? '#f87171' : '#34d399' }}
            >
              {metrics.mean_bias_gpm > 0 ? `+${metrics.mean_bias_gpm}` : metrics.mean_bias_gpm}
              <span className="text-xs font-normal text-slate-400 ml-1">mm/h</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {metrics.mean_bias_gpm > 0.5 ? 'Satellite Wet Bias' : metrics.mean_bias_gpm < -0.5 ? 'Satellite Dry Bias' : 'Well Calibrated'}
            </div>
          </div>

          {/* MAE vs AWS */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">MAE (Mean Abs Error)</div>
            <div className="text-xl font-bold font-mono text-slate-200 mt-1">
              {metrics.mae_aws}
              <span className="text-xs font-normal text-slate-400 ml-1">mm/h</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Average magnitude of error</div>
          </div>

          {/* RMSE vs AWS */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">RMSE (vs AWS)</div>
            <div className="text-xl font-bold font-mono text-amber-300 mt-1">
              {metrics.rmse_aws}
              <span className="text-xs font-normal text-slate-400 ml-1">mm/h</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Root Mean Square Error</div>
          </div>

          {/* Correlation vs AWS */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Correlation (r vs AWS)</div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
              {metrics.correlation_aws}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Pearson Correlation (Ground)</div>
          </div>

          {/* Correlation vs GPM */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Correlation (r vs GPM)</div>
            <div className="text-xl font-bold font-mono text-cyan-400 mt-1">
              {metrics.correlation_gpm}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Spatial Pattern Skill</div>
          </div>
        </div>
      )}

      {/* Contingency Table Verification across IMD Rainfall Thresholds */}
      {metrics && metrics.contingency_table && (
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Categorical Contingency Verification Table (IMD Intensity Thresholds)
              </h4>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Evaluated over N={metrics.sample_count} Collocated Surface Stations
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                  <th className="py-2 pr-3">Rainfall Threshold</th>
                  <th className="py-2 px-2 text-center">Hits</th>
                  <th className="py-2 px-2 text-center">False Alarms</th>
                  <th className="py-2 px-2 text-center">Misses</th>
                  <th className="py-2 px-2 text-center">Correct Neg.</th>
                  <th className="py-2 px-2 text-right">POD (Hit Rate)</th>
                  <th className="py-2 px-2 text-right">FAR (False Alarm)</th>
                  <th className="py-2 px-2 text-right font-bold text-cyan-300">CSI (Threat Score)</th>
                  <th className="py-2 pl-2 text-right">Frequency Bias</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {metrics.contingency_table.map((row) => (
                  <tr key={row.threshold_label} className="hover:bg-slate-800/30">
                    <td className="py-2 pr-3 font-sans font-medium text-slate-200">
                      {row.threshold_label}
                    </td>
                    <td className="py-2 px-2 text-center text-emerald-400 font-bold">{row.hits}</td>
                    <td className="py-2 px-2 text-center text-amber-400">{row.false_alarms}</td>
                    <td className="py-2 px-2 text-center text-rose-400">{row.misses}</td>
                    <td className="py-2 px-2 text-center text-slate-500">{row.correct_negatives}</td>
                    <td className="py-2 px-2 text-right text-emerald-300">{row.pod}</td>
                    <td className="py-2 px-2 text-right text-slate-400">{row.far}</td>
                    <td className="py-2 px-2 text-right font-bold text-cyan-300">{row.csi}</td>
                    <td className="py-2 pl-2 text-right text-slate-300">{row.frequency_bias}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Station-by-Station Validation Scorecard Table */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Surface Station Verification Scorecard ({filteredRows.length} Stations)
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search station or district..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-44 sm:w-56"
              />
            </div>

            {/* Performance Filter Pills */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[11px]">
              {(['ALL', 'ACCURATE', 'OVERESTIMATED', 'UNDERESTIMATED'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFilterPerformance(mode)}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    filterPerformance === mode
                      ? 'bg-slate-800 text-white font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {mode === 'ALL' ? 'All' : mode === 'ACCURATE' ? 'Accurate' : mode === 'OVERESTIMATED' ? 'Over' : 'Under'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/70">
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 sticky top-0 z-10 border-b border-slate-800">
                <tr className="text-[11px] text-slate-400">
                  <th className="py-2.5 px-3">Station & Location</th>
                  <th className="py-2.5 px-2 text-right">AWS In-Situ (Obs)</th>
                  <th className="py-2.5 px-2 text-right">WRF Forecast (Model)</th>
                  <th className="py-2.5 px-2 text-right">GPM Satellite (Obs)</th>
                  <th className="py-2.5 px-2 text-right">Bias (WRF − AWS)</th>
                  <th className="py-2.5 px-2 text-right">Bias (WRF − GPM)</th>
                  <th className="py-2.5 px-3 text-center">Performance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 font-mono text-[11px]">
                {filteredRows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => onSelectStationById?.(r.id)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-2 px-3 font-sans">
                      <div className="font-bold text-white text-xs flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                        <span>{r.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 pl-4.5">
                        {r.district}, {r.state} ({r.elevation}m)
                      </div>
                    </td>

                    <td className="py-2 px-2 text-right font-bold text-emerald-400">
                      {r.aws_observed.toFixed(2)} <span className="text-[10px] text-slate-500 font-normal">mm/h</span>
                    </td>

                    <td className="py-2 px-2 text-right font-bold text-blue-400">
                      {r.wrf_model.toFixed(2)} <span className="text-[10px] text-slate-500 font-normal">mm/h</span>
                    </td>

                    <td className="py-2 px-2 text-right font-bold text-cyan-400">
                      {r.gpm_satellite.toFixed(2)} <span className="text-[10px] text-slate-500 font-normal">mm/h</span>
                    </td>

                    <td className="py-2 px-2 text-right font-bold">
                      <span
                        style={{
                          color: r.bias_aws > 1.5 ? '#60a5fa' : r.bias_aws < -1.5 ? '#f87171' : '#34d399',
                        }}
                      >
                        {r.bias_aws > 0 ? `+${r.bias_aws.toFixed(2)}` : r.bias_aws.toFixed(2)}
                      </span>
                    </td>

                    <td className="py-2 px-2 text-right font-bold">
                      <span
                        style={{
                          color: r.bias_gpm > 1.5 ? '#60a5fa' : r.bias_gpm < -1.5 ? '#f87171' : '#34d399',
                        }}
                      >
                        {r.bias_gpm > 0 ? `+${r.bias_gpm.toFixed(2)}` : r.bias_gpm.toFixed(2)}
                      </span>
                    </td>

                    <td className="py-2 px-3 text-center font-sans">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.performance === 'ACCURATE'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : r.performance === 'OVERESTIMATED'
                            ? 'bg-blue-950 text-blue-300 border border-blue-800'
                            : 'bg-rose-950 text-rose-300 border border-rose-800'
                        }`}
                      >
                        {r.performance === 'ACCURATE'
                          ? 'HIGH ACCURACY'
                          : r.performance === 'OVERESTIMATED'
                          ? 'WET OVERESTIMATE'
                          : 'DRY UNDERESTIMATE'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
