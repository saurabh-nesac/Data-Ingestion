import React, { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Filter,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import { ApiCallLog } from '../types/rainfall';
import { apiClient } from '../services/apiClient';

interface ApiInspectorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  logs: ApiCallLog[];
  onClearLogs: () => void;
}

export const ApiInspectorDrawer: React.FC<ApiInspectorDrawerProps> = ({
  isOpen,
  onClose,
  logs,
  onClearLogs,
}) => {
  const [filterEndpoint, setFilterEndpoint] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredLogs = logs.filter((l) => {
    if (filterEndpoint === 'all') return true;
    return l.endpoint.includes(filterEndpoint);
  });

  const handleCopyCurl = (log: ApiCallLog) => {
    const curl = `curl -X ${log.method} "${log.url}"`;
    navigator.clipboard.writeText(curl);
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col h-full text-white">
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>API Traffic & Inspector Console</span>
                <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300">
                  {logs.length} calls
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Live inspection of WRF & Observation REST endpoints
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-clear-api-logs"
              type="button"
              onClick={onClearLogs}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
              title="Clear log history"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              id="btn-close-api-drawer"
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Endpoint:</span>
            <select
              value={filterEndpoint}
              onChange={(e) => setFilterEndpoint(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-cyan-300 text-xs font-mono focus:outline-none"
            >
              <option value="all">All Endpoints</option>
              <option value="/timeseries">/v1/timeseries</option>
              <option value="/station">/v1/station</option>
              <option value="/latlon">/v1/latlon</option>
              <option value="/cell">/v1/cell</option>
              <option value="/summary">/v1/summary</option>
              <option value="/health">/health</option>
            </select>
          </div>

          <span className="text-[11px] font-mono text-slate-400">
            Target Host: {apiClient.getBaseUrl() || '(Embedded Service / Proxy)'}
          </span>
        </div>

        {/* Log Entries List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredLogs.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-slate-500 text-xs">
              <Terminal className="w-8 h-8 mb-2 opacity-40" />
              <span>No API requests recorded yet.</span>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const isSuccess = log.status >= 200 && log.status < 300;

              return (
                <div
                  key={log.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden transition-all text-xs"
                >
                  {/* Row Header */}
                  <div
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-900/60"
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                  >
                    <div className="flex items-center gap-2.5 font-mono">
                      <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold text-[10px]">
                        {log.method}
                      </span>
                      <span className="font-bold text-white tracking-tight">{log.endpoint}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          isSuccess
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                        }`}
                      >
                        {log.status || 'ERR'}
                      </span>
                      <span className="text-slate-400 text-[10px]">{log.latencyMs}ms</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyCurl(log);
                        }}
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                        title="Copy cURL"
                      >
                        {copiedId === log.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Request & Response Details */}
                  {isExpanded && (
                    <div className="p-3 bg-slate-900/80 border-t border-slate-800 space-y-2 font-mono text-[11px]">
                      <div>
                        <span className="text-slate-400 block mb-0.5 text-[10px] uppercase font-sans">
                          Full Request URL:
                        </span>
                        <div className="p-2 rounded bg-slate-950 text-cyan-300 break-all select-all">
                          {log.url}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-400 block mb-0.5 text-[10px] uppercase font-sans">
                          Query Parameters:
                        </span>
                        <pre className="p-2 rounded bg-slate-950 text-slate-300 overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(log.params, null, 2)}
                        </pre>
                      </div>

                      <div>
                        <span className="text-slate-400 block mb-0.5 text-[10px] uppercase font-sans">
                          Response Payload:
                        </span>
                        <pre className="p-2 rounded bg-slate-950 text-emerald-400 max-h-48 overflow-y-auto whitespace-pre-wrap">
                          {log.error ? log.error : JSON.stringify(log.response, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
