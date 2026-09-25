import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Building,
  Check,
  Compass,
  Crosshair,
  Database,
  Droplet,
  Eye,
  EyeOff,
  GitCompare,
  Globe,
  Info,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  Navigation,
  Radio,
  Satellite,
  Scale,
  Shield,
  Sliders,
  Sparkles,
  Waves,
  Wind,
  X,
} from 'lucide-react';
import { AWS_STATIONS, IMD_RAINFALL_THRESHOLDS, getAlertForRainfall } from '../data/stations';
import { DomainType, LatLonResponse, MapLayerMode, ModelType, StationItem } from '../types/rainfall';
import { apiClient } from '../services/apiClient';
import {
  DISTRICT_DIVISIONS,
  INTERNATIONAL_BOUNDARIES,
  POLITICAL_CITIES,
  SOI_GRATICULE_LINES,
  SOI_METADATA,
  SOI_RIVER_NETWORK,
  STATE_POLYGONS,
  coordsToSvgPath,
  geoToCanvas,
} from '../data/politicalBasemap';
import {
  BIAS_THRESHOLDS,
  BOUNDS,
  calculateContinuousRainfall,
  calculateDifferenceBias,
  calculateGpmObservedRainfall,
  calculateWrfRainfall,
  renderPrecipitationField,
} from '../utils/interpolation';

interface RainfallMapGridProps {
  model: ModelType;
  domain: DomainType;
  validTime: string;
  selectedStation: StationItem | null;
  onSelectStation: (station: StationItem) => void;
  onProbeLocation: (lat: number, lon: number, x: number, y: number, name?: string) => void;
}

export const RainfallMapGrid: React.FC<RainfallMapGridProps> = ({
  model,
  domain,
  validTime,
  selectedStation,
  onSelectStation,
  onProbeLocation,
}) => {
  // Layer Mode: WRF Forecast vs GPM Satellite Observed vs Difference / Bias
  const [layerMode, setLayerMode] = useState<MapLayerMode>('WRF_MODEL');

  // Raster rendering mode: continuous spatial interpolation vs discrete numerical model cells
  const [rasterMode, setRasterMode] = useState<'interpolated' | 'discrete'>('interpolated');

  // Basemap mode: Survey of India (SOI) Political, SOI Topo-Political, or SOI Dark Operations
  const [basemapMode, setBasemapMode] = useState<'soi-political' | 'soi-topo' | 'soi-dark'>('soi-political');

  // Layer Visibility Toggles
  const [showPoliticalBorders, setShowPoliticalBorders] = useState<boolean>(true);
  const [showDistrictBorders, setShowDistrictBorders] = useState<boolean>(true);
  const [showCityLabels, setShowCityLabels] = useState<boolean>(true);
  const [showRiverNetwork, setShowRiverNetwork] = useState<boolean>(true);
  const [showAwsStations, setShowAwsStations] = useState<boolean>(true);
  const [showIsohyets, setShowIsohyets] = useState<boolean>(true);
  const [showGraticule, setShowGraticule] = useState<boolean>(true);
  const [showScaleBar, setShowScaleBar] = useState<boolean>(true);
  const [showSoiBadge, setShowSoiBadge] = useState<boolean>(true);
  const [radarOpacity, setRadarOpacity] = useState<number>(0.85);

  // Popups & Drawers
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState<boolean>(false);
  const [isLegendOpen, setIsLegendOpen] = useState<boolean>(false);

  // Hover and probe coordinates
  const [hoverCoord, setHoverCoord] = useState<{
    lat: number;
    lon: number;
    x: number;
    y: number;
    wrfRate?: number;
    gpmRate?: number;
    biasRate?: number;
    activeRate?: number;
    adminArea?: string;
  } | null>(null);

  const [pinnedProbe, setPinnedProbe] = useState<{
    lat: number;
    lon: number;
    x: number;
    y: number;
    wrfValue?: number;
    gpmValue?: number;
    biasValue?: number;
    activeValue?: number;
    adminArea?: string;
    nearestGrid?: any;
    nearestAws?: {
      id: string;
      name: string;
      observed_value: number;
      distance_km: number;
    };
  } | null>(null);

  const [isLoadingProbe, setIsLoadingProbe] = useState(false);

  // Station readings cache
  const [stationData, setStationData] = useState<{
    aws: Record<string, number>;
    wrf: Record<string, number>;
    gpm: Record<string, number>;
    bias: Record<string, number>;
  }>({ aws: {}, wrf: {}, gpm: {}, bias: {} });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Geographic bounds
  const { MIN_LON, MAX_LON, MIN_LAT, MAX_LAT } = BOUNDS;

  // Resolve nearest administrative region/city
  const resolveAdminArea = (lat: number, lon: number): string => {
    let nearestCity = POLITICAL_CITIES[0];
    let minD = 99999;
    for (const city of POLITICAL_CITIES) {
      const d = Math.hypot(city.lon - lon, city.lat - lat);
      if (d < minD) {
        minD = d;
        nearestCity = city;
      }
    }
    if (minD < 0.38) {
      return `${nearestCity.name} (${nearestCity.district || nearestCity.state})`;
    }
    if (lat < 25.8 && lon > 90.0 && lon < 92.8) {
      return 'Meghalaya Plateau (SOI)';
    }
    if (lat > 27.1 && lon > 91.8) {
      return 'Arunachal Pradesh Sub-Himalayan Sector (SOI)';
    }
    if (lat > 25.8 && lat < 27.5 && lon > 90.0 && lon < 95.5) {
      return 'Assam - Brahmaputra Valley (SOI)';
    }
    if (lat <= 25.2 && lon < 92.5) {
      return 'Indo-Bangladesh Border Sector';
    }
    return 'North East India (SOI Standard)';
  };

  const toGeoCoords = (x: number, y: number, width: number, height: number) => {
    const lon = MIN_LON + (x / width) * (MAX_LON - MIN_LON);
    const lat = MIN_LAT + (1 - y / height) * (MAX_LAT - MIN_LAT);

    const wrfRate = calculateWrfRainfall(lon, lat, validTime);
    const gpmRate = calculateGpmObservedRainfall(lon, lat, validTime);
    const biasRate = calculateDifferenceBias(lon, lat, validTime);

    let activeRate = wrfRate;
    if (layerMode === 'GPM_OBSERVED') activeRate = gpmRate;
    else if (layerMode === 'DIFFERENCE_BIAS') activeRate = biasRate;

    const adminArea = resolveAdminArea(lat, lon);

    return {
      lat: Number(lat.toFixed(4)),
      lon: Number(lon.toFixed(4)),
      gridX: Math.max(0, Math.min(300, Math.round(((lon - MIN_LON) / (MAX_LON - MIN_LON)) * 300))),
      gridY: Math.max(0, Math.min(250, Math.round(((lat - MIN_LAT) / (MAX_LAT - MIN_LAT)) * 250))),
      wrfRate,
      gpmRate,
      biasRate,
      activeRate,
      adminArea,
    };
  };

  // Fetch station readings whenever validTime changes
  useEffect(() => {
    let isCancelled = false;

    const fetchAllStations = async () => {
      const aws: Record<string, number> = {};
      const wrf: Record<string, number> = {};
      const gpm: Record<string, number> = {};
      const bias: Record<string, number> = {};

      for (const st of AWS_STATIONS) {
        try {
          const res = await apiClient.getStation({
            model: 'WRF',
            time: validTime,
            variable: 'rain',
            station_id: st.id,
            domain,
          });
          if (!isCancelled) {
            aws[st.id] = res.aws_observed_value ?? res.value;
            wrf[st.id] = res.value;
            gpm[st.id] = res.gpm_satellite_value ?? 0;
            bias[st.id] = res.bias_wrf_aws ?? 0;
          }
        } catch {
          // ignore
        }
      }
      if (!isCancelled) {
        setStationData({ aws, wrf, gpm, bias });
      }
    };

    fetchAllStations();

    return () => {
      isCancelled = true;
    };
  }, [domain, validTime]);

  // Update canvas rainfall field whenever inputs or rasterMode/layerMode changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderPrecipitationField(
      ctx,
      800,
      450,
      validTime,
      layerMode,
      rasterMode,
      radarOpacity
    );
  }, [validTime, layerMode, rasterMode, radarOpacity]);

  // Handle probe click on the basemap
  const handleMapClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const { lat, lon, wrfRate, gpmRate, biasRate, adminArea } = toGeoCoords(
      clickX,
      clickY,
      rect.width,
      rect.height
    );

    setIsLoadingProbe(true);
    try {
      const res = await apiClient.getCell({
        model: 'WRF',
        domain,
        time: validTime,
        x: Math.max(0, Math.min(300, Math.round(((lon - MIN_LON) / (MAX_LON - MIN_LON)) * 300))),
        y: Math.max(0, Math.min(250, Math.round(((lat - MIN_LAT) / (MAX_LAT - MIN_LAT)) * 250))),
        variable: 'rain',
        max_difference: 30.0,
      });

      setPinnedProbe({
        lat,
        lon,
        x: res.x,
        y: res.y,
        wrfValue: res.value,
        gpmValue: res.gpm_observed_value,
        biasValue: res.bias_difference,
        activeValue:
          layerMode === 'GPM_OBSERVED'
            ? res.gpm_observed_value
            : layerMode === 'DIFFERENCE_BIAS'
            ? res.bias_difference
            : res.value,
        adminArea,
        nearestGrid: { x: res.x, y: res.y },
        nearestAws: res.nearest_aws,
      });

      onProbeLocation(
        lat,
        lon,
        res.x,
        res.y,
        `${adminArea} (${lat}°N, ${lon}°E)`
      );
    } catch (err) {
      console.error('Probe failed', err);
    } finally {
      setIsLoadingProbe(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const coords = toGeoCoords(x, y, rect.width, rect.height);
    setHoverCoord(coords);
  };

  const handleMouseLeave = () => {
    setHoverCoord(null);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
      {/* Map Header & Toolbar */}
      <div className="px-4 py-3 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-900/95">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Survey of India (SOI) Political Basemap</span>
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 font-semibold">
                SOI Open Series
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                <span>{rasterMode === 'interpolated' ? 'Continuous Interpolation' : 'Discrete Mesh'}</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              WRF Numerical Model Output compared with NASA GPM Satellite (0.1°) and Ground AWS Gauges
            </p>
          </div>
        </div>

        {/* Action Controls: Layer Mode Switcher, Interpolation, Basemap Style, Layer Toggles */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* PRIMARY COMPARISON LAYER SELECTOR (WRF Model vs GPM Observed vs Bias) */}
          <div className="flex items-center bg-slate-950 border border-slate-700/80 rounded-lg p-0.5 shadow-inner">
            <button
              id="btn-layer-wrf-model"
              type="button"
              onClick={() => setLayerMode('WRF_MODEL')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all ${
                layerMode === 'WRF_MODEL'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="WRF Numerical Weather Prediction Model Forecast"
            >
              <Droplet className="w-3.5 h-3.5 text-blue-300" />
              <span>WRF Model</span>
            </button>

            <button
              id="btn-layer-gpm-observed"
              type="button"
              onClick={() => setLayerMode('GPM_OBSERVED')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all ${
                layerMode === 'GPM_OBSERVED'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="NASA GPM IMERG 0.1° Gridded Satellite Precipitation Observation"
            >
              <Satellite className="w-3.5 h-3.5 text-cyan-300" />
              <span>GPM Observed</span>
            </button>

            <button
              id="btn-layer-difference-bias"
              type="button"
              onClick={() => setLayerMode('DIFFERENCE_BIAS')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all ${
                layerMode === 'DIFFERENCE_BIAS'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="Difference / Error Bias: WRF Model minus GPM Observed (Blue: Wet Bias / Overestimate, Red: Dry Bias / Underestimate)"
            >
              <Scale className="w-3.5 h-3.5 text-amber-300" />
              <span>Bias (WRF − GPM)</span>
            </button>
          </div>

          {/* Interpolation Toggle */}
          <div className="flex items-center bg-slate-800/90 border border-slate-700 rounded-lg p-0.5">
            <button
              id="btn-mode-interpolated"
              type="button"
              onClick={() => setRasterMode('interpolated')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all font-medium ${
                rasterMode === 'interpolated'
                  ? 'bg-indigo-600 text-white font-bold shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Smooth continuous spatial interpolation"
            >
              <Sparkles className="w-3 h-3" />
              <span>Interpolated</span>
            </button>
            <button
              id="btn-mode-discrete"
              type="button"
              onClick={() => setRasterMode('discrete')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all font-medium ${
                rasterMode === 'discrete'
                  ? 'bg-indigo-600 text-white font-bold shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Discrete numerical model grid resolution"
            >
              <Layers className="w-3 h-3" />
              <span>Discrete</span>
            </button>
          </div>

          {/* Survey of India Basemap Style Switcher */}
          <div className="flex items-center bg-slate-800/90 border border-slate-700 rounded-lg p-0.5">
            <button
              id="btn-basemap-soi-political"
              type="button"
              onClick={() => setBasemapMode('soi-political')}
              className={`px-2 py-1 rounded transition-colors font-medium ${
                basemapMode === 'soi-political'
                  ? 'bg-slate-700 text-amber-300 font-bold shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Official Survey of India political boundaries & administrative centers"
            >
              SOI Political
            </button>
            <button
              id="btn-basemap-soi-topo"
              type="button"
              onClick={() => setBasemapMode('soi-topo')}
              className={`px-2 py-1 rounded transition-colors font-medium ${
                basemapMode === 'soi-topo'
                  ? 'bg-slate-700 text-amber-300 font-bold shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Topographic relief shading + SOI political boundaries"
            >
              SOI Topo
            </button>
            <button
              id="btn-basemap-soi-dark"
              type="button"
              onClick={() => setBasemapMode('soi-dark')}
              className={`px-2 py-1 rounded transition-colors font-medium ${
                basemapMode === 'soi-dark'
                  ? 'bg-slate-700 text-amber-300 font-bold shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Tactical dark operational mode"
            >
              SOI Dark
            </button>
          </div>

          {/* SOI Symbology Legend Toggle */}
          <button
            id="btn-toggle-soi-legend"
            type="button"
            onClick={() => setIsLegendOpen(!isLegendOpen)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
              isLegendOpen
                ? 'bg-amber-950 text-amber-300 border-amber-600'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Survey of India Cartographic Symbology Legend"
          >
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>SOI Legend</span>
          </button>

          {/* Layers Visibility Dropdown Popover */}
          <div className="relative">
            <button
              id="btn-layer-settings"
              type="button"
              onClick={() => setIsLayerMenuOpen(!isLayerMenuOpen)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                isLayerMenuOpen
                  ? 'bg-slate-700 text-white border-blue-500/60'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-blue-400" />
              <span>Layers</span>
            </button>

            {isLayerMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-2xl z-40 space-y-3">
                <div className="text-[11px] font-bold text-slate-300 border-b border-slate-800 pb-1.5 flex items-center justify-between">
                  <span>SOI Basemap & Overlays</span>
                  <span className="text-[10px] text-blue-400 font-mono">National Standards</span>
                </div>

                <div className="space-y-2 text-xs">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-slate-300">SOI State & Sovereign Borders</span>
                    <input
                      type="checkbox"
                      checked={showPoliticalBorders}
                      onChange={(e) => setShowPoliticalBorders(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-0"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-slate-300">SOI District Boundaries</span>
                    <input
                      type="checkbox"
                      checked={showDistrictBorders}
                      onChange={(e) => setShowDistrictBorders(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-0"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-slate-300">SOI 1° Coordinate Graticule</span>
                    <input
                      type="checkbox"
                      checked={showGraticule}
                      onChange={(e) => setShowGraticule(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-0"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-slate-300">SOI Hydrographic River System</span>
                    <input
                      type="checkbox"
                      checked={showRiverNetwork}
                      onChange={(e) => setShowRiverNetwork(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-0"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-slate-300">SOI Cities & Capitals</span>
                    <input
                      type="checkbox"
                      checked={showCityLabels}
                      onChange={(e) => setShowCityLabels(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-0"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-slate-300">AWS In-Situ Gauges Layer</span>
                    <input
                      type="checkbox"
                      checked={showAwsStations}
                      onChange={(e) => setShowAwsStations(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0"
                    />
                  </label>
                </div>

                <div className="border-t border-slate-800 pt-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>Precipitation Layer Opacity</span>
                    <span className="font-mono">{Math.round(radarOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="1.0"
                    step="0.05"
                    value={radarOpacity}
                    onChange={(e) => setRadarOpacity(parseFloat(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Map Canvas and SVG Overlay Container */}
      <div
        className="relative w-full aspect-[16/9] bg-slate-950 overflow-hidden cursor-crosshair select-none"
        onClick={handleMapClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Survey of India Vector Cartography (SVG Base) */}
        <div className="absolute inset-0 pointer-events-none">
          <svg
            viewBox="0 0 800 450"
            className="w-full h-full"
            preserveAspectRatio="none"
          >
            {/* 1. Base Landfill & Relief Polygons */}
            <rect
              width="800"
              height="450"
              fill={
                basemapMode === 'soi-dark'
                  ? '#090d16'
                  : basemapMode === 'soi-topo'
                  ? '#131d2e'
                  : '#0f172a'
              }
            />

            {/* Topographic Shading Simulation for Sub-Himalayan & Meghalaya Scarp */}
            {basemapMode === 'soi-topo' && (
              <g opacity="0.28">
                {/* Himalayan Foothills Relief */}
                <path
                  d="M 120,40 Q 300,55 500,45 T 780,30 L 780,110 Q 550,135 280,120 T 120,95 Z"
                  fill="#78716c"
                />
                {/* Meghalaya Plateau Escarpment */}
                <path
                  d="M 80,310 Q 240,285 450,295 T 580,330 L 560,390 Q 380,370 120,385 Z"
                  fill="#78716c"
                />
              </g>
            )}

            {/* 2. State Polygons (Survey of India Authorized Borders) */}
            <g id="soi-state-polygons">
              {STATE_POLYGONS.map((state) => (
                <path
                  key={state.id}
                  d={coordsToSvgPath(state.coords, 800, 450)}
                  fill={
                    basemapMode === 'soi-dark'
                      ? `${state.stroke}10`
                      : basemapMode === 'soi-topo'
                      ? `${state.stroke}18`
                      : `${state.stroke}24`
                  }
                  stroke={
                    basemapMode === 'soi-dark'
                      ? `${state.stroke}50`
                      : `${state.stroke}90`
                  }
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              ))}
            </g>

            {/* 3. District Divisions (SOI Internal Administrative Boundaries) */}
            {showDistrictBorders && (
              <g id="soi-district-divisions">
                {DISTRICT_DIVISIONS.map((district) => (
                  <path
                    key={district.id}
                    d={coordsToSvgPath(district.coords, 800, 450)}
                    fill="none"
                    stroke="#475569"
                    strokeWidth="0.8"
                    strokeDasharray="2 3"
                    strokeOpacity="0.65"
                  />
                ))}
              </g>
            )}

            {/* 4. SOI River Network (Brahmaputra, Barak, Subansiri, etc.) */}
            {showRiverNetwork && (
              <g id="soi-river-network">
                {SOI_RIVER_NETWORK.map((river) => (
                  <g key={river.name}>
                    <path
                      d={coordsToSvgPath(river.coords, 800, 450)}
                      fill="none"
                      stroke={river.category === 'major' ? '#38bdf8' : '#0ea5e9'}
                      strokeWidth={river.width}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeOpacity="0.85"
                    />
                    {river.name.includes('Brahmaputra') && (
                      <text
                        x="380"
                        y="225"
                        fill="#38bdf8"
                        fontSize="11"
                        fontStyle="italic"
                        fontWeight="bold"
                        letterSpacing="3"
                        opacity="0.85"
                      >
                        BRAHMAPUTRA RIVER
                      </text>
                    )}
                  </g>
                ))}
              </g>
            )}

            {/* 5. International Boundaries (SOI Official Alignment) */}
            {showPoliticalBorders && (
              <g id="soi-international-boundaries">
                {INTERNATIONAL_BOUNDARIES.map((ib) => (
                  <path
                    key={ib.id}
                    d={coordsToSvgPath(ib.coords, 800, 450)}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth={2.0}
                    strokeDasharray="8 3 2 3"
                    strokeLinecap="square"
                  />
                ))}
              </g>
            )}

            {/* 6. Survey of India 1° Coordinate Graticule */}
            {showGraticule && (
              <g id="soi-graticule" opacity="0.35">
                {SOI_GRATICULE_LINES.latitudes.map((lat) => {
                  const pos = geoToCanvas(BOUNDS.MIN_LON, lat, 800, 450);
                  return (
                    <line
                      key={`lat-${lat}`}
                      x1={0}
                      y1={pos.y}
                      x2={800}
                      y2={pos.y}
                      stroke="#64748b"
                      strokeWidth="0.75"
                      strokeDasharray="3 4"
                    />
                  );
                })}
                {SOI_GRATICULE_LINES.longitudes.map((lon) => {
                  const pos = geoToCanvas(lon, BOUNDS.MIN_LAT, 800, 450);
                  return (
                    <line
                      key={`lon-${lon}`}
                      x1={pos.x}
                      y1={0}
                      x2={pos.x}
                      y2={450}
                      stroke="#64748b"
                      strokeWidth="0.75"
                      strokeDasharray="3 4"
                    />
                  );
                })}
              </g>
            )}

            {/* 7. Survey of India Political Settlements & Capitals */}
            {showCityLabels && (
              <g id="soi-cities">
                {POLITICAL_CITIES.map((city) => {
                  const pos = geoToCanvas(city.lon, city.lat, 800, 450);
                  const isCapital = city.isCapital;

                  return (
                    <g key={city.name} className="cursor-pointer">
                      {isCapital ? (
                        <>
                          <circle cx={pos.x} cy={pos.y} r="5.5" fill="#eab308" stroke="#0f172a" strokeWidth="1.5" />
                          <circle cx={pos.x} cy={pos.y} r="2.2" fill="#ffffff" />
                        </>
                      ) : (
                        <>
                          <circle cx={pos.x} cy={pos.y} r="3.5" fill="none" stroke="#cbd5e1" strokeWidth="1.2" />
                          <circle cx={pos.x} cy={pos.y} r="1.5" fill="#cbd5e1" />
                        </>
                      )}

                      <text
                        x={pos.x + (isCapital ? 7 : 5)}
                        y={pos.y + 3}
                        fill={isCapital ? '#fde047' : '#cbd5e1'}
                        fontSize={isCapital ? '10.5' : '9'}
                        fontWeight={isCapital ? 'bold' : '500'}
                        fontFamily="sans-serif"
                      >
                        {city.name}
                        {isCapital && ' ★'}
                      </text>
                    </g>
                  );
                })}
              </g>
            )}
          </svg>
        </div>

        {/* Raster Rainfall Heatmap Canvas */}
        <canvas
          ref={canvasRef}
          width={800}
          height={450}
          className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-300"
          style={{ opacity: radarOpacity }}
        />

        {/* AWS Station Markers Layer (In-Situ Ground Observations) */}
        {showAwsStations && (
          <div className="absolute inset-0 pointer-events-none">
            {AWS_STATIONS.map((station) => {
              const isSelected = selectedStation?.id === station.id;
              const awsVal = stationData.aws[station.id] ?? 0;
              const wrfVal = stationData.wrf[station.id] ?? 0;
              const gpmVal = stationData.gpm[station.id] ?? 0;
              const biasVal = stationData.bias[station.id] ?? Number((wrfVal - awsVal).toFixed(1));

              // Value to display based on layerMode
              let displayVal = awsVal;
              let badgeColor = '#10b981'; // emerald for AWS observation
              if (layerMode === 'WRF_MODEL') {
                displayVal = wrfVal;
                badgeColor = '#3b82f6';
              } else if (layerMode === 'GPM_OBSERVED') {
                displayVal = gpmVal;
                badgeColor = '#06b6d4';
              } else if (layerMode === 'DIFFERENCE_BIAS') {
                displayVal = biasVal;
                badgeColor = biasVal > 1.5 ? '#3b82f6' : biasVal < -1.5 ? '#ef4444' : '#64748b';
              }

              const alert = getAlertForRainfall(Math.max(awsVal, wrfVal));

              const normX = ((station.lon - MIN_LON) / (MAX_LON - MIN_LON)) * 100;
              const normY = (1 - (station.lat - MIN_LAT) / (MAX_LAT - MIN_LAT)) * 100;

              return (
                <div
                  key={station.id}
                  style={{ left: `${normX}%`, top: `${normY}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto z-20 group"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectStation(station);
                    onProbeLocation(station.lat, station.lon, station.x_grid, station.y_grid, station.name);
                  }}
                >
                  {/* Station Marker */}
                  <div className="relative flex items-center justify-center cursor-pointer">
                    {awsVal > 7.5 && (
                      <span
                        className="absolute w-7 h-7 rounded-full animate-ping opacity-60"
                        style={{ backgroundColor: alert.color }}
                      />
                    )}
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all ${
                        isSelected
                          ? 'border-white ring-2 ring-cyan-400 scale-125'
                          : 'border-slate-900 shadow-md group-hover:scale-110'
                      }`}
                      style={{ backgroundColor: badgeColor }}
                    >
                      <Radio className="w-3 h-3 text-white" />
                    </div>

                    {/* Quick Reading Pill */}
                    <div
                      className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-slate-950/95 border px-1.5 py-0.2 rounded text-[9px] font-mono text-white whitespace-nowrap shadow-sm"
                      style={{ borderColor: `${badgeColor}80` }}
                    >
                      {layerMode === 'DIFFERENCE_BIAS' && displayVal > 0 ? `+${displayVal.toFixed(1)}` : displayVal.toFixed(1)}
                    </div>
                  </div>

                  {/* Comprehensive Collocation Tooltip Card */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-56 p-2.5 rounded-xl bg-slate-900/98 border border-slate-700 text-xs shadow-2xl pointer-events-none z-30 backdrop-blur-md">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                      <p className="font-bold text-white text-xs">{station.name}</p>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                        AWS In-Situ
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{station.district}, {station.state}</p>

                    <div className="mt-1.5 space-y-1 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-400 font-medium flex items-center gap-1">
                          <Radio className="w-2.5 h-2.5" /> AWS Observed:
                        </span>
                        <span className="font-bold font-mono text-emerald-300">{awsVal.toFixed(2)} mm/h</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-blue-400 font-medium flex items-center gap-1">
                          <Droplet className="w-2.5 h-2.5" /> WRF Forecast:
                        </span>
                        <span className="font-bold font-mono text-blue-300">{wrfVal.toFixed(2)} mm/h</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-cyan-400 font-medium flex items-center gap-1">
                          <Satellite className="w-2.5 h-2.5" /> GPM Satellite:
                        </span>
                        <span className="font-bold font-mono text-cyan-300">{gpmVal.toFixed(2)} mm/h</span>
                      </div>
                      <div className="pt-1 mt-1 border-t border-slate-800 flex items-center justify-between font-bold">
                        <span className="text-slate-400">Error (WRF − AWS):</span>
                        <span
                          className="font-mono text-xs"
                          style={{ color: biasVal > 1.5 ? '#60a5fa' : biasVal < -1.5 ? '#f87171' : '#94a3b8' }}
                        >
                          {biasVal > 0 ? `+${biasVal.toFixed(2)}` : biasVal.toFixed(2)} mm/h
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Survey of India Cartographic Scale & North Arrow */}
        {showScaleBar && (
          <div className="absolute top-3 right-3 bg-slate-950/90 backdrop-blur-md border border-slate-800 p-2.5 rounded-xl shadow-xl pointer-events-auto flex items-center gap-4 z-20">
            <div className="flex flex-col items-center">
              <div className="relative w-7 h-7 flex items-center justify-center">
                <svg viewBox="0 0 40 40" className="w-7 h-7">
                  <circle cx="20" cy="20" r="17" fill="none" stroke="#64748b" strokeWidth="0.8" strokeDasharray="1 2" />
                  <polygon points="20,4 25,20 20,16 15,20" fill="#f59e0b" stroke="#0f172a" strokeWidth="0.5" />
                  <polygon points="20,36 25,20 20,24 15,20" fill="#475569" stroke="#0f172a" strokeWidth="0.5" />
                  <circle cx="20" cy="20" r="1.8" fill="#ffffff" />
                </svg>
              </div>
              <span className="text-[9px] font-bold text-amber-400 font-mono mt-0.5">N</span>
            </div>

            <div className="border-l border-slate-800 pl-3">
              <div className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">
                KILOMETRES (SOI Standard)
              </div>
              <div className="flex items-center w-36 h-2 border border-slate-700">
                <div className="w-1/4 h-full bg-slate-100 border-r border-slate-900" />
                <div className="w-1/4 h-full bg-slate-900 border-r border-slate-900" />
                <div className="w-1/2 h-full bg-slate-100" />
              </div>
              <div className="flex justify-between text-[8.5px] font-mono text-slate-400 mt-0.5">
                <span>0</span>
                <span>50</span>
                <span>100</span>
                <span>200 km</span>
              </div>
            </div>
          </div>
        )}

        {/* Survey of India Accreditation Badge */}
        {showSoiBadge && (
          <div className="absolute bottom-3 left-3 bg-slate-950/92 backdrop-blur-md border border-slate-800/90 px-3 py-2 rounded-xl text-xs text-slate-300 shadow-xl pointer-events-auto flex items-center gap-2.5 z-20 max-w-sm">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white text-[11px] tracking-wide">
                  Survey of India (SOI) Basemap
                </span>
                <span className="text-[9px] px-1 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono">
                  Official
                </span>
              </div>
              <p className="text-[10px] text-slate-400 line-clamp-1 leading-tight mt-0.5">
                {SOI_METADATA.disclaimer}
              </p>
            </div>
          </div>
        )}

        {/* Live Hover Coordinate Tracker */}
        <div className="absolute top-3 left-3 bg-slate-900/92 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300 pointer-events-none flex items-center gap-2 shadow-lg z-20">
          <Navigation className="w-3.5 h-3.5 text-blue-400" />
          {hoverCoord ? (
            <div className="flex items-center gap-2">
              <span className="text-amber-300 font-sans font-medium">{hoverCoord.adminArea}</span>
              <span>•</span>
              <span>{hoverCoord.lat}°N, {hoverCoord.lon}°E</span>
              <span>•</span>
              {layerMode === 'WRF_MODEL' && (
                <span className="text-blue-300 font-bold">WRF: {hoverCoord.wrfRate?.toFixed(1)} mm/h</span>
              )}
              {layerMode === 'GPM_OBSERVED' && (
                <span className="text-cyan-300 font-bold">GPM: {hoverCoord.gpmRate?.toFixed(1)} mm/h</span>
              )}
              {layerMode === 'DIFFERENCE_BIAS' && (
                <span
                  className="font-bold"
                  style={{ color: (hoverCoord.biasRate ?? 0) > 0 ? '#60a5fa' : '#f87171' }}
                >
                  Bias: {(hoverCoord.biasRate ?? 0) > 0 ? `+${hoverCoord.biasRate?.toFixed(1)}` : hoverCoord.biasRate?.toFixed(1)} mm/h
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 font-sans text-[11px]">
              Click on the basemap to probe WRF Model vs GPM vs AWS observations
            </span>
          )}
        </div>

        {/* Pinned Probe Inspection Tooltip */}
        {pinnedProbe && (
          <div
            className="absolute z-30 pointer-events-auto"
            style={{
              left: `${((pinnedProbe.lon - MIN_LON) / (MAX_LON - MIN_LON)) * 100}%`,
              top: `${(1 - (pinnedProbe.lat - MIN_LAT) / (MAX_LAT - MIN_LAT)) * 100}%`,
            }}
          >
            <div className="absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-cyan-400 bg-cyan-500/40 animate-pulse pointer-events-none" />
            <div className="absolute left-3 top-3 w-72 bg-slate-900/98 border border-cyan-500/50 rounded-xl p-3 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Model vs Observation Probe</span>
                </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setPinnedProbe(null);
                  }}
                  className="text-slate-500 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="space-y-1 text-slate-300 font-mono text-[11px]">
                {pinnedProbe.adminArea && (
                  <div className="text-amber-300 font-sans font-semibold text-[11px] pb-0.5">
                    {pinnedProbe.adminArea}
                  </div>
                )}
                <div>
                  Coord: <span className="text-white font-bold">{pinnedProbe.lat}°N, {pinnedProbe.lon}°E</span>
                </div>
                <div>
                  WRF Grid: <span className="text-blue-300 font-bold">x={pinnedProbe.x}, y={pinnedProbe.y}</span>
                </div>

                <div className="pt-2 mt-1 border-t border-slate-800 space-y-1 font-sans">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-400 flex items-center gap-1 font-medium">
                      <Droplet className="w-3 h-3" /> WRF Model Forecast:
                    </span>
                    <span className="font-bold font-mono text-blue-300">
                      {pinnedProbe.wrfValue?.toFixed(2)} mm/h
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-cyan-400 flex items-center gap-1 font-medium">
                      <Satellite className="w-3 h-3" /> GPM Satellite Observed:
                    </span>
                    <span className="font-bold font-mono text-cyan-300">
                      {pinnedProbe.gpmValue?.toFixed(2)} mm/h
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-bold pt-1 border-t border-slate-800/80">
                    <span className="text-slate-400">Difference (WRF − GPM):</span>
                    <span
                      className="font-mono"
                      style={{
                        color:
                          (pinnedProbe.biasValue ?? 0) > 1.0
                            ? '#60a5fa'
                            : (pinnedProbe.biasValue ?? 0) < -1.0
                            ? '#f87171'
                            : '#94a3b8',
                      }}
                    >
                      {(pinnedProbe.biasValue ?? 0) > 0 ? `+${pinnedProbe.biasValue?.toFixed(2)}` : pinnedProbe.biasValue?.toFixed(2)} mm/h
                    </span>
                  </div>

                  {pinnedProbe.nearestAws && (
                    <div className="pt-1.5 mt-1 border-t border-slate-800 text-[10px] text-slate-400">
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-400 font-medium">
                          Nearest AWS ({pinnedProbe.nearestAws.name}):
                        </span>
                        <span className="font-bold font-mono text-emerald-300">
                          {pinnedProbe.nearestAws.observed_value.toFixed(2)} mm/h
                        </span>
                      </div>
                      <div className="text-[9px] text-slate-500">
                        Distance: {pinnedProbe.nearestAws.distance_km} km
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Status watermark bottom-right */}
        <div className="absolute bottom-3 right-3 bg-slate-900/90 backdrop-blur-sm border border-slate-800 px-2.5 py-1 rounded-md text-[11px] font-mono text-slate-400 flex items-center gap-2 shadow-sm z-20">
          <span className="text-blue-400 font-semibold">
            {layerMode === 'WRF_MODEL' ? 'WRF NWP Model' : layerMode === 'GPM_OBSERVED' ? 'NASA GPM Satellite' : 'Error Bias (WRF − GPM)'}
          </span>
          <span>•</span>
          <span className="text-amber-400 font-semibold">{basemapMode.toUpperCase()}</span>
        </div>
      </div>

      {/* Survey of India Symbology Legend Modal */}
      {isLegendOpen && (
        <div className="p-4 bg-slate-950/95 border-t border-slate-800 flex flex-col gap-3 text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-white text-sm">
                Survey of India (SOI) Cartographic Symbology Standard
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsLegendOpen(false)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-slate-300">
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-8 h-2" viewBox="0 0 40 4">
                  <line x1="0" y1="2" x2="40" y2="2" stroke="#ef4444" strokeWidth="2.5" strokeDasharray="8 3 2 3" />
                </svg>
                <span className="font-bold text-white">International Boundary</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Official external boundary of India (SOI standard).
              </p>
            </div>

            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-8 h-2" viewBox="0 0 40 4">
                  <line x1="0" y1="2" x2="40" y2="2" stroke="#2563eb" strokeWidth="2.0" strokeDasharray="6 2 2 2" />
                </svg>
                <span className="font-bold text-white">Inter-State Boundary</span>
              </div>
              <p className="text-[10px] text-slate-400">
                State demarcation (Assam, Meghalaya, Arunachal, Nagaland).
              </p>
            </div>

            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-8 h-2" viewBox="0 0 40 4">
                  <line x1="0" y1="2" x2="40" y2="2" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="2 3" />
                </svg>
                <span className="font-bold text-white">District Sub-division</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Revenue & administrative district borders.
              </p>
            </div>

            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-8 h-2" viewBox="0 0 40 4">
                  <line x1="0" y1="2" x2="40" y2="2" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <span className="font-bold text-white">Major River Axis</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Brahmaputra braided mainstem, Barak, Subansiri rivers.
              </p>
            </div>

            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3.5 h-3.5 rounded-full border border-slate-900 bg-amber-400 flex items-center justify-center text-[8px] text-slate-950 font-bold">
                  ★
                </span>
                <span className="font-bold text-white">State Capital (SOI ✪)</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Dispur / Guwahati, Shillong, Itanagar, Kohima.
              </p>
            </div>

            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3 h-3 rounded-full border border-slate-300 flex items-center justify-center">
                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                </span>
                <span className="font-bold text-white">District HQ (SOI ⊙)</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Dibrugarh, Tezpur, Silchar, Jorhat, Dhubri, Tura, etc.
              </p>
            </div>

            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-[11px] text-slate-400 font-bold">1°×1°</span>
                <span className="font-bold text-white">Geographic Graticule</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Latitude & Longitude network with neatline ticks.
              </p>
            </div>

            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-2 mb-1">
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-bold text-white">AWS In-Situ Gauges</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Surface automatic weather station rain gauge network.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* DYNAMIC SCALE LEGEND (Switches automatically between Precipitation and Bias Error Scales) */}
      <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
        {layerMode === 'DIFFERENCE_BIAS' ? (
          <>
            <div className="flex items-center gap-2 text-slate-300">
              <Scale className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-bold text-amber-300">Model Error Bias Scale (WRF Forecast − GPM Observed):</span>
              <span className="text-[11px] text-slate-400">
                (Blue: Model Wet Overestimation | Red: Model Dry Underestimation)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
              {BIAS_THRESHOLDS.map((b) => (
                <div
                  key={b.label}
                  className="flex items-center gap-1 px-2 py-0.5 rounded border text-[11px]"
                  style={{
                    backgroundColor: `${b.color}20`,
                    borderColor: `${b.color}60`,
                    color: b.color,
                  }}
                  title={b.description}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                  <span className="font-bold">{b.label}</span>
                  <span className="opacity-80 font-mono text-[10px]">
                    ({b.min === -999 ? '<-15' : b.max === 999 ? '>+15' : `${b.min} to ${b.max}`} mm/h)
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-slate-400">
              <Droplet className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-semibold text-slate-200">
                {layerMode === 'WRF_MODEL' ? 'WRF Model Precipitation Scale:' : 'NASA GPM Satellite Precipitation Scale:'}
              </span>
              <span className="text-[11px] text-slate-500">
                (IMD Standard Rainfall Classification in mm/h)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
              {IMD_RAINFALL_THRESHOLDS.map((t) => (
                <div
                  key={t.level}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px]"
                  style={{
                    backgroundColor: `${t.color}15`,
                    borderColor: `${t.color}40`,
                    color: t.color,
                  }}
                  title={t.description}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                  <span className="font-medium">{t.label}</span>
                  <span className="opacity-70 font-mono text-[10px]">
                    ({t.min === 0 ? '0' : `>${t.min}`}{t.max < 900 ? `-${t.max}` : '+'} mm/h)
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
