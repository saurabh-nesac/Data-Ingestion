import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  ExternalLink,
  Globe,
  Radio,
  RefreshCw,
  Server,
  Sliders,
  X,
} from 'lucide-react';
import { HealthResponse, SummaryResponse } from '../types/rainfall';
import { apiClient } from '../services/apiClient';

interface ConnectionSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
  onSaved?: () => void;
}

export const ConnectionSettingsModal: React.FC<ConnectionSettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onSaved,
}) => {
  const [baseUrlInput, setBaseUrlInput] = useState(apiClient.getBaseUrl());
  const [useSimulation, setUseSimulation] = useState(apiClient.isSimulationMode());
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    health?: HealthResponse;
    summary?: SummaryResponse;
    error?: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    // Save temporary state for testing
    apiClient.setBaseUrl(baseUrlInput);

    try {
      const health = await apiClient.getHealth();
      const summary = await apiClient.getSummary();
      setTestResult({
        success: true,
        health,
        summary,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err.message || 'Connection failed. Check host and CORS headers.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveAndApply = () => {
    apiClient.setBaseUrl(baseUrlInput);
    apiClient.setSimulationMode(useSimulation);
    if (onSave) onSave();
    if (onSaved) onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl text-white">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">WRF & Observation Service Connection</h3>
              <p className="text-xs text-slate-400">
                Configure REST streaming endpoints & data provider mode
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

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Mode Switcher */}
          <div>
            <label className="text-slate-300 font-semibold block mb-2">Streaming Provider Mode:</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setUseSimulation(true)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  useSimulation
                    ? 'bg-blue-950/70 border-cyan-400 ring-1 ring-cyan-400/50'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-white mb-1">
                  <Database className="w-4 h-4 text-cyan-400" />
                  Simulated WRFStream
                </div>
                <p className="text-[11px] text-slate-400">
                  Built-in NE India / Assam high-fidelity meteorological generator. Works offline with all endpoints.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setUseSimulation(false)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  !useSimulation
                    ? 'bg-emerald-950/70 border-emerald-400 ring-1 ring-emerald-400/50'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-white mb-1">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  Live REST API Endpoint
                </div>
                <p className="text-[11px] text-slate-400">
                  Direct HTTP requests to your running WRFStreamService backend server.
                </p>
              </button>
            </div>
          </div>

          {/* Endpoint Base URL input */}
          <div>
            <label className="text-slate-300 font-semibold block mb-1">
              API Base URL (e.g. http://localhost:8000 or custom host):
            </label>
            <div className="flex gap-2">
              <input
                id="input-api-base-url"
                type="text"
                value={baseUrlInput}
                onChange={(e) => setBaseUrlInput(e.target.value)}
                placeholder="http://localhost:8000"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
              />
              <button
                id="btn-test-api-connection"
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl font-medium text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isTesting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>Test /health</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Leave blank to use relative paths if running behind a reverse proxy or same-origin host.
            </p>
          </div>

          {/* Test connection result */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border font-mono text-xs ${
                testResult.success
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/40 border-red-500/40 text-red-300'
              }`}
            >
              <div className="flex items-center gap-2 font-bold mb-1 font-sans">
                {testResult.success ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Connection Succeeded! /health returned 200 OK</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <span>Connection Failed</span>
                  </>
                )}
              </div>
              {testResult.health && (
                <div className="text-[11px] space-y-0.5 opacity-90">
                  <div>Service: {testResult.health.service} v{testResult.health.version}</div>
                  <div>Active Models: {testResult.health.active_models?.join(', ')}</div>
                </div>
              )}
              {testResult.error && <div className="text-[11px] mt-1">{testResult.error}</div>}
            </div>
          )}

          {/* Endpoints specification review */}
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <span className="font-semibold text-white block mb-1 font-sans">Supported Endpoints:</span>
            <div className="grid grid-cols-2 gap-1 font-mono">
              <div>• GET /health</div>
              <div>• GET /v1/summary</div>
              <div>• GET /v1/cell</div>
              <div>• GET /v1/latlon</div>
              <div>• GET /v1/station</div>
              <div>• GET /v1/timeseries</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/70 border-t border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
          >
            Cancel
          </button>
          <button
            id="btn-save-connection-settings"
            type="button"
            onClick={handleSaveAndApply}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md transition-colors"
          >
            Apply & Save
          </button>
        </div>
      </div>
    </div>
  );
};
