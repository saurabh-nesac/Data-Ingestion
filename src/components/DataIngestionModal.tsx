import React, { useState, useEffect } from 'react';
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Satellite,
  Database,
  RefreshCw,
  FolderOpen,
  Info,
  X,
  Compass,
  Thermometer,
  CloudRain,
  Wind,
} from 'lucide-react';
import { apiClient } from '../services/apiClient';

interface DataIngestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataLoaded?: () => void;
}

export const DataIngestionModal: React.FC<DataIngestionModalProps> = ({
  isOpen,
  onClose,
  onDataLoaded,
}) => {
  const [datasetStatus, setDatasetStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [wrfFile, setWrfFile] = useState<File | null>(null);
  const [gpmFile, setGpmFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string; details?: any } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const status = await apiClient.getDatasetStatus();
      setDatasetStatus(status);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setUploadMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUploadWRF = async () => {
    if (!wrfFile) return;
    setIsUploading(true);
    setUploadMessage(null);
    try {
      const res = await apiClient.uploadWRF(wrfFile);
      setUploadMessage({
        type: 'success',
        text: res.message || 'WRF NetCDF uploaded and parsed successfully!',
        details: res,
      });
      setWrfFile(null);
      await fetchStatus();
      if (onDataLoaded) onDataLoaded();
    } catch (err: any) {
      setUploadMessage({
        type: 'error',
        text: err.message || 'Failed to upload WRF file',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadGPM = async () => {
    if (!gpmFile) return;
    setIsUploading(true);
    setUploadMessage(null);
    try {
      const res = await apiClient.uploadGPM(gpmFile);
      setUploadMessage({
        type: 'success',
        text: res.message || 'GPM IMERG HDF5 file uploaded and parsed successfully!',
        details: res,
      });
      setGpmFile(null);
      await fetchStatus();
      if (onDataLoaded) onDataLoaded();
    } catch (err: any) {
      setUploadMessage({
        type: 'error',
        text: err.message || 'Failed to upload GPM file',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleScanDirectory = async () => {
    setIsUploading(true);
    setUploadMessage(null);
    try {
      const res = await apiClient.scanUploadDirectory();
      setUploadMessage({
        type: 'success',
        text: res.message || 'Scanned directory and updated datasets.',
        details: res.status,
      });
      await fetchStatus();
      if (onDataLoaded) onDataLoaded();
    } catch (err: any) {
      setUploadMessage({
        type: 'error',
        text: err.message || 'Directory scan failed',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-white">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Real Dataset Ingestion Pipeline</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                  WRF NetCDF & NASA GPM IMERG HDF5
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Backend ingestion engine calculating rain (RAINC + RAINNC), temperature, and destaggered winds (U & V).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300">
          {/* Status Alert Banner */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Info className="w-4 h-4 text-cyan-400" />
                Current Dataset Ingestion Status
              </span>
              <button
                type="button"
                onClick={fetchStatus}
                disabled={isLoading}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh Status</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* WRF Status */}
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-blue-400" />
                    WRF NetCDF Output
                  </span>
                  {datasetStatus?.isRealWRFLoaded ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Ingested
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 font-semibold">
                      Awaiting Files
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 space-y-0.5">
                  <div>Active Domains: {datasetStatus?.wrfDomains?.join(', ') || 'None'}</div>
                  <div>Timesteps Loaded: {datasetStatus?.totalWRFTimesteps || 0}</div>
                </div>
              </div>

              {/* GPM Status */}
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Satellite className="w-3.5 h-3.5 text-cyan-400" />
                    GPM IMERG Half-Hourly
                  </span>
                  {datasetStatus?.gpmParsedSlicesCount > 0 ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5" /> {datasetStatus.gpmParsedSlicesCount} Loaded
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 font-semibold">
                      {datasetStatus?.gpmCatalogCount || 0} Files Cataloged
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 space-y-0.5">
                  <div>Indexed 3IMERG Files: {datasetStatus?.gpmCatalogCount || 0}</div>
                  <div>Resolution: 0.1° (~10 km) / 30-min</div>
                </div>
              </div>

              {/* AWS Status */}
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <CloudRain className="w-3.5 h-3.5 text-emerald-400" />
                    AWS Ground Truth
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-semibold">
                    {datasetStatus?.awsStationCount || 15} Stations
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 space-y-0.5">
                  <div>Collocated Stations: Assam, Meghalaya, etc.</div>
                  <div>Point Gauge Validation Active</div>
                </div>
              </div>
            </div>
          </div>

          {/* Mathematical & Meteorological Specifications */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <span className="font-bold text-white flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-cyan-400" />
              WRF Variable Calculation & Destaggering Architecture
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="font-semibold text-cyan-400 flex items-center gap-1 mb-1">
                  <CloudRain className="w-3.5 h-3.5" />
                  Precipitation (RAINC & RAINNC)
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Total accumulated rain is calculated as <strong className="text-slate-200">RAINC + RAINNC</strong> (convective + grid-scale stratiform). Rain rate is derived as the incremental step difference <strong className="text-slate-200">Δ(RAINC + RAINNC) / Δt</strong> (mm/h).
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="font-semibold text-amber-400 flex items-center gap-1 mb-1">
                  <Thermometer className="w-3.5 h-3.5" />
                  Temperature (T2 / Kelvin)
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Extracted from <strong className="text-slate-200">T2</strong> (2-meter diagnostic air temperature). Converted from Kelvin to degrees Celsius using <strong className="text-slate-200">T_celsius = T2 - 273.15</strong>.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="font-semibold text-blue-400 flex items-center gap-1 mb-1">
                  <Wind className="w-3.5 h-3.5" />
                  Destaggered Wind (U & V)
                </div>
                <p className="text-slate-400 leading-relaxed">
                  WRF staggered Arakawa C-grid components are destaggered to mass cell centers: <strong className="text-slate-200">U_mass = 0.5(U_i + U_{'{i+1}'})</strong>, <strong className="text-slate-200">V_mass = 0.5(V_j + V_{'{j+1}'})</strong>. Speed = √(U² + V²).
                </p>
              </div>
            </div>
          </div>

          {/* Feedback messages */}
          {uploadMessage && (
            <div
              className={`p-3 rounded-xl border text-xs ${
                uploadMessage.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/40 border-red-500/40 text-red-300'
              }`}
            >
              <div className="font-bold flex items-center gap-2 mb-1">
                {uploadMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
                {uploadMessage.text}
              </div>
              {uploadMessage.details && (
                <div className="text-[11px] opacity-80 font-mono mt-1 space-y-0.5">
                  {uploadMessage.details.domain && <div>Domain: {uploadMessage.details.domain}</div>}
                  {uploadMessage.details.timestepsLoaded !== undefined && <div>Timesteps: {uploadMessage.details.timestepsLoaded}</div>}
                  {uploadMessage.details.calculations && (
                    <div>Rain Formula: {uploadMessage.details.calculations.rain}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Ingestion Dropzones */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* WRF NetCDF Upload */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-white">
                  <FileCode className="w-4 h-4 text-blue-400" />
                  Upload WRF NetCDF File
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                  Up to {datasetStatus?.maxUploadSizeMb ? `${(datasetStatus.maxUploadSizeMb / 1024).toFixed(1)} GB` : '5 GB'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Upload raw WRF simulation outputs (e.g. <code className="text-cyan-400">wrfout_d01_*</code>, <code className="text-cyan-400">wrfout_d02_*</code>, or <code className="text-cyan-400">wrfout_d03_*</code>).
              </p>

              <div className="border border-dashed border-slate-700 rounded-xl p-4 text-center hover:border-cyan-400 transition-colors bg-slate-900/50">
                <input
                  type="file"
                  id="wrf-file-input"
                  accept=".nc,.nc4,.bin"
                  onChange={(e) => setWrfFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <label htmlFor="wrf-file-input" className="cursor-pointer block space-y-1">
                  <Upload className="w-6 h-6 mx-auto text-slate-400" />
                  <span className="text-xs text-cyan-400 font-semibold block">
                    {wrfFile ? wrfFile.name : 'Select or drop WRF NetCDF file'}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {wrfFile ? `${(wrfFile.size / (1024 * 1024)).toFixed(1)} MB` : 'Streamed directly to disk (supports large files up to 5 GB)'}
                  </span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleUploadWRF}
                disabled={!wrfFile || isUploading}
                className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow"
              >
                {isUploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                <span>Ingest WRF NetCDF</span>
              </button>
            </div>

            {/* GPM IMERG HDF5 Upload */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-white">
                  <Satellite className="w-4 h-4 text-cyan-400" />
                  Upload GPM IMERG HDF5
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                  Up to {datasetStatus?.maxUploadSizeMb ? `${(datasetStatus.maxUploadSizeMb / 1024).toFixed(1)} GB` : '5 GB'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Upload NASA GPM PPS IMERG files (e.g. <code className="text-cyan-400">3B-HHR-L.MS.MRG.3IMERG.*.HDF5</code>).
              </p>

              <div className="border border-dashed border-slate-700 rounded-xl p-4 text-center hover:border-cyan-400 transition-colors bg-slate-900/50">
                <input
                  type="file"
                  id="gpm-file-input"
                  accept=".HDF5,.hdf5,.nc,.nc4"
                  onChange={(e) => setGpmFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <label htmlFor="gpm-file-input" className="cursor-pointer block space-y-1">
                  <Upload className="w-6 h-6 mx-auto text-slate-400" />
                  <span className="text-xs text-cyan-400 font-semibold block">
                    {gpmFile ? gpmFile.name : 'Select or drop GPM IMERG HDF5 file'}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {gpmFile ? `${(gpmFile.size / (1024 * 1024)).toFixed(1)} MB` : 'Extracts calibrated precipitation rate grid (precipitationCal)'}
                  </span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleUploadGPM}
                disabled={!gpmFile || isUploading}
                className="w-full py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow"
              >
                {isUploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                <span>Ingest GPM HDF5</span>
              </button>
            </div>
          </div>

          {/* Quick scan local directory */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-white">Local Directory Direct Ingestion (Bypass Browser Upload)</h4>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">Recommended for huge WRF files</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                For large multi-gigabyte WRF simulation outputs, copy or symlink them directly into <code className="text-cyan-400 font-mono">./uploads/</code> on the server and click <strong>Scan Folder</strong> to ingest instantly without browser network overhead.
              </p>
            </div>
            <button
              type="button"
              onClick={handleScanDirectory}
              disabled={isUploading}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-white font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isUploading ? 'animate-spin' : ''}`} />
              <span>Scan Folder</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/70 border-t border-slate-800 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
