import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Clock,
  FastForward,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
} from 'lucide-react';

interface TemporalControlBarProps {
  validTime: string;
  onTimeChange: (newTime: string) => void;
  startTime: string;
  endTime: string;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playSpeed: number;
  onChangeSpeed: (speed: number) => void;
  autoRefreshInterval: number; // 0 = off, 15, 30, 60
  onAutoRefreshIntervalChange: (interval: number) => void;
}

export const TemporalControlBar: React.FC<TemporalControlBarProps> = ({
  validTime,
  onTimeChange,
  startTime,
  endTime,
  isPlaying,
  onTogglePlay,
  playSpeed,
  onChangeSpeed,
  autoRefreshInterval,
  onAutoRefreshIntervalChange,
}) => {
  const startMs = new Date(startTime).getTime();
  const endMs = new Date(endTime).getTime();
  const currentMs = new Date(validTime).getTime();
  const stepMs = 3600 * 1000; // 1 hour steps

  // Total steps
  const totalSteps = Math.max(1, Math.round((endMs - startMs) / stepMs));
  const currentStep = Math.max(0, Math.min(totalSteps, Math.round((currentMs - startMs) / stepMs)));

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const step = parseInt(e.target.value, 10);
    const newMs = startMs + step * stepMs;
    onTimeChange(new Date(newMs).toISOString());
  };

  const handleStep = (direction: -1 | 1) => {
    const nextMs = currentMs + direction * stepMs;
    if (nextMs >= startMs && nextMs <= endMs) {
      onTimeChange(new Date(nextMs).toISOString());
    } else if (direction === 1 && nextMs > endMs) {
      // Loop around
      onTimeChange(new Date(startMs).toISOString());
    }
  };

  const handleResetToStart = () => {
    onTimeChange(new Date(startMs).toISOString());
  };

  const handleJumpToNow = () => {
    // Jump to middle or current
    const mid = startMs + Math.floor((endMs - startMs) / 2);
    onTimeChange(new Date(mid).toISOString());
  };

  // Format display strings
  const currentIso = new Date(validTime).toISOString();
  const datePart = currentIso.substring(0, 10);
  const timePart = currentIso.substring(11, 16) + ' UTC';

  return (
    <div className="bg-slate-900/90 border-b border-slate-800 backdrop-blur-sm px-4 sm:px-6 py-2.5 text-white">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          <button
            id="btn-timeline-reset"
            type="button"
            onClick={handleResetToStart}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            title="Reset to forecast start (T+00h)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            id="btn-timeline-step-back"
            type="button"
            onClick={() => handleStep(-1)}
            disabled={currentStep <= 0}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors disabled:opacity-40"
            title="Previous Hour (-1h)"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          <button
            id="btn-timeline-play-toggle"
            type="button"
            onClick={onTogglePlay}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
            }`}
            title={isPlaying ? 'Pause streaming playback' : 'Play hourly rain animation'}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Animate Rain</span>
              </>
            )}
          </button>

          <button
            id="btn-timeline-step-fwd"
            type="button"
            onClick={() => handleStep(1)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            title="Next Hour (+1h)"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          {/* Speed Selector */}
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5 ml-1">
            {[1, 2, 4].map((spd) => (
              <button
                key={spd}
                id={`btn-speed-${spd}x`}
                type="button"
                onClick={() => onChangeSpeed(spd)}
                className={`px-2 py-0.5 text-[11px] font-mono rounded transition-colors ${
                  playSpeed === spd
                    ? 'bg-slate-700 text-cyan-300 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-400 font-mono hidden sm:inline ml-2">
            T+{(currentStep).toString().padStart(2, '0')}h
          </span>
        </div>

        {/* Timeline Slider */}
        <div className="flex-1 mx-0 md:mx-6 flex items-center gap-3">
          <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap hidden lg:inline">
            {new Date(startTime).getUTCDate()} Aug 00Z
          </span>
          <div className="relative flex-1 flex items-center">
            <input
              id="input-timeline-slider"
              type="range"
              min={0}
              max={totalSteps}
              value={currentStep}
              onChange={handleSliderChange}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
              title={`Forecast valid time: ${validTime}`}
            />
          </div>
          <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap hidden lg:inline">
            {new Date(endTime).getUTCDate()} Aug 12Z
          </span>
        </div>

        {/* Quick Jumps & Auto-polling */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-cyan-300">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold">{datePart}</span>
            <span className="text-white font-bold">{timePart}</span>
          </div>

          {/* Polling dropdown */}
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-300 text-xs">
            <span className="text-slate-400 mr-1.5">Live Sync:</span>
            <select
              id="select-autorefresh-interval"
              value={autoRefreshInterval}
              onChange={(e) => onAutoRefreshIntervalChange(Number(e.target.value))}
              className="bg-transparent text-cyan-300 font-medium focus:outline-none cursor-pointer text-xs"
            >
              <option value={0} className="bg-slate-900 text-white">Off</option>
              <option value={15} className="bg-slate-900 text-white">Every 15s</option>
              <option value={30} className="bg-slate-900 text-white">Every 30s</option>
              <option value={60} className="bg-slate-900 text-white">Every 60s</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
