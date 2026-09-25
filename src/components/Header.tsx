import React from 'react';
import {
  CloudRain,
  Database,
  RefreshCw,
  Server,
  Settings,
  Terminal,
  Upload,
} from 'lucide-react';
import { DomainType, ModelType } from '../types/rainfall';

interface HeaderProps {
  model: ModelType;
  onModelChange: (model: ModelType) => void;
  domain: DomainType;
  onDomainChange: (domain: DomainType) => void;
  validTime: string;
  isSimulated: boolean;
  isLiveLoading: boolean;
  isRealDataLoaded?: boolean;
  onRefresh: () => void;
  onOpenSettings: () => void;
  onOpenIngestion: () => void;
  onToggleApiInspector: () => void;
  apiLogCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  model,
  onModelChange,
  domain,
  onDomainChange,
  validTime,
  isSimulated,
  isLiveLoading,
  isRealDataLoaded,
  onRefresh,
  onOpenSettings,
  onOpenIngestion,
  onToggleApiInspector,
  apiLogCount,
}) => {
  // Format times in UTC and IST
  const dateObj = new Date(validTime);
  const utcFormatted = dateObj.toUTCString().replace('GMT', 'UTC');
  const istFormatted = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(dateObj);

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Logo & Identity */}
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-inner flex items-center justify-center">
              <CloudRain className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  <span>WRF Forecast vs Observation Validation</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Model & Observation System
                  </span>
                </h1>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>WRF Evaluation</span>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                WRF Model Evaluation against NASA GPM Gridded Satellite & AWS In-Situ Point Observations
              </p>
            </div>
          </div>

          {/* Model & Observation Controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Real Data Ingestion Pipeline Button */}
            <button
              id="btn-open-ingestion"
              type="button"
              onClick={onOpenIngestion}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                isRealDataLoaded
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/80 shadow-sm'
                  : 'bg-cyan-950/70 border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/80'
              }`}
              title="Upload WRF NetCDF outputs or GPM IMERG HDF5 observation files"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{isRealDataLoaded ? 'Real Datasets Loaded' : 'Data Ingestion (NetCDF/GPM)'}</span>
              {isRealDataLoaded && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
            </button>

            {/* Mode & Health Status */}
            <button
              id="btn-connection-settings"
              type="button"
              onClick={onOpenSettings}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                isSimulated
                  ? 'bg-indigo-950/60 border-indigo-700/50 text-indigo-300 hover:bg-indigo-900/60'
                  : 'bg-emerald-950/60 border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/60'
              }`}
              title="Click to configure API Base URL or toggle Simulated vs Live Service"
            >
              <Server className="w-3.5 h-3.5" />
              <span>{isSimulated ? 'Simulated Fallback' : 'Live Express Backend'}</span>
              <Settings className="w-3 h-3 ml-0.5 opacity-60" />
            </button>

            {/* Refresh button */}
            <button
              id="btn-header-refresh"
              type="button"
              onClick={onRefresh}
              disabled={isLiveLoading}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all disabled:opacity-50"
              title="Refresh All Telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${isLiveLoading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>

            {/* API Inspector toggle */}
            <button
              id="btn-api-inspector-toggle"
              type="button"
              onClick={onToggleApiInspector}
              className="relative p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all"
              title="Open REST API Inspector Drawer"
            >
              <Terminal className="w-4 h-4" />
              {apiLogCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-cyan-500 text-slate-900 text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {apiLogCount > 99 ? '99+' : apiLogCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Temporal Banner & Status */}
        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center space-x-3">
            <span className="flex items-center gap-1.5 font-mono text-cyan-300 font-semibold bg-cyan-950/40 px-2.5 py-0.5 rounded border border-cyan-800/50">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              VALID: {utcFormatted}
            </span>
            <span className="hidden sm:inline text-slate-400 font-mono">
              IST: {istFormatted}
            </span>
          </div>

          <div className="flex items-center space-x-3 text-[11px]">
            <span className="text-slate-400">
              Model: <span className="text-blue-300 font-semibold">WRF ({domain === 'd03' ? '1 km' : domain === 'd02' ? '3 km' : '9 km'})</span>
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">
              Observations: <span className="text-cyan-300 font-semibold">GPM IMERG (0.1°)</span> & <span className="text-emerald-300 font-semibold">AWS Telemetry</span>
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">
              Basemap: <span className="text-amber-300 font-semibold">Survey of India (SOI)</span>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
