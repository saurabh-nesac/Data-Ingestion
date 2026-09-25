import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Compass,
  Droplet,
  Filter,
  MapPin,
  Mountain,
  Radio,
  Satellite,
  Scale,
  Search,
  Waves,
} from 'lucide-react';
import { AWS_STATIONS, getAlertForRainfall } from '../data/stations';
import { StationItem } from '../types/rainfall';
import { calculateGpmObservedRainfall, calculateWrfRainfall } from '../utils/interpolation';

interface StationTelemetryPanelProps {
  selectedStation: StationItem | null;
  onSelectStation: (station: StationItem) => void;
  validTime: string;
  isLoading: boolean;
}

export const StationTelemetryPanel: React.FC<StationTelemetryPanelProps> = ({
  selectedStation,
  onSelectStation,
  validTime,
  isLoading,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'floodProne' | 'activeRain'>('all');

  const filteredStations = AWS_STATIONS.filter((st) => {
    const matchesSearch =
      st.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      st.district.toLowerCase().includes(searchTerm.toLowerCase()) ||
      st.state.toLowerCase().includes(searchTerm.toLowerCase()) ||
      st.id.toLowerCase().includes(searchTerm.toLowerCase());

    const wrf = calculateWrfRainfall(st.lon, st.lat, validTime);

    if (!matchesSearch) return false;
    if (filterMode === 'floodProne') return st.isFloodProne;
    if (filterMode === 'activeRain') return wrf > 0.1;
    return true;
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">AWS In-Situ Network & Model Collocation</h3>
              <span className="text-[11px] font-mono px-2 py-0.2 rounded-full bg-slate-800 text-emerald-300 border border-slate-700">
                /v1/station ({AWS_STATIONS.length} Gauges)
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Comparing AWS Point In-situ Ground Gauges with Collocated WRF Forecasts & NASA GPM Pixels
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-2.5 py-1 rounded-lg border transition-colors ${
              filterMode === 'all'
                ? 'bg-slate-800 border-blue-500 text-blue-300 font-semibold'
                : 'border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            All ({AWS_STATIONS.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('floodProne')}
            className={`px-2.5 py-1 rounded-lg border transition-colors ${
              filterMode === 'floodProne'
                ? 'bg-slate-800 border-amber-500 text-amber-300 font-semibold'
                : 'border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Flood-Prone
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('activeRain')}
            className={`px-2.5 py-1 rounded-lg border transition-colors ${
              filterMode === 'activeRain'
                ? 'bg-slate-800 border-blue-500 text-blue-300 font-semibold'
                : 'border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Active Rain
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="my-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search station by name, district, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Station Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto max-h-[460px] pr-1">
        {filteredStations.map((station) => {
          const isSelected = selectedStation?.id === station.id;

          // Model & Observation values
          const wrf = calculateWrfRainfall(station.lon, station.lat, validTime);
          const gpm = calculateGpmObservedRainfall(station.lon, station.lat, validTime);
          // Simulated gauge reading
          const d = new Date(validTime);
          const seed = Math.sin(station.lon * 23.4 + station.lat * 31.2 + d.getUTCHours() * 0.7);
          const aws = Number(Math.max(0, wrf * (0.88 + 0.22 * Math.sin(seed * 10)) + (wrf > 1 ? seed * 0.4 : 0)).toFixed(2));

          const biasAws = Number((wrf - aws).toFixed(2));
          const alert = getAlertForRainfall(Math.max(wrf, aws));

          return (
            <div
              key={station.id}
              onClick={() => onSelectStation(station)}
              className={`p-3 rounded-xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                isSelected
                  ? 'bg-slate-800/90 border-blue-500 shadow-md ring-1 ring-blue-500/50'
                  : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
              }`}
            >
              {/* Alert indicator bar */}
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ backgroundColor: alert.color }}
              />

              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    <span className="font-bold text-white text-xs line-clamp-1">{station.name}</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 flex-shrink-0">
                    {station.id}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                  <span>{station.district}, {station.state}</span>
                  <span>•</span>
                  <span className="flex items-center gap-0.5">
                    <Mountain className="w-2.5 h-2.5" /> {station.elevation}m
                  </span>
                </div>
              </div>

              {/* Collocated Measurements Strip */}
              <div className="mt-2.5 pt-2 border-t border-slate-800/80 grid grid-cols-3 gap-1.5 text-center">
                <div className="bg-slate-900/80 rounded p-1">
                  <div className="text-[9px] text-emerald-400 font-medium flex items-center justify-center gap-0.5">
                    <Radio className="w-2.5 h-2.5" /> AWS Obs
                  </div>
                  <div className="text-xs font-mono font-bold text-emerald-300 mt-0.5">
                    {aws.toFixed(1)}
                  </div>
                </div>

                <div className="bg-slate-900/80 rounded p-1">
                  <div className="text-[9px] text-blue-400 font-medium flex items-center justify-center gap-0.5">
                    <Droplet className="w-2.5 h-2.5" /> WRF
                  </div>
                  <div className="text-xs font-mono font-bold text-blue-300 mt-0.5">
                    {wrf.toFixed(1)}
                  </div>
                </div>

                <div className="bg-slate-900/80 rounded p-1">
                  <div className="text-[9px] text-slate-400 font-medium">
                    Bias Δ
                  </div>
                  <div
                    className="text-xs font-mono font-bold mt-0.5"
                    style={{ color: biasAws > 1.0 ? '#60a5fa' : biasAws < -1.0 ? '#f87171' : '#34d399' }}
                  >
                    {biasAws > 0 ? `+${biasAws.toFixed(1)}` : biasAws.toFixed(1)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
