import { MapLayerMode, ModelType } from '../types/rainfall';

export interface InterpolatedFieldResult {
  value: number;
  isohyetLevel: string;
}

// Minimum & Maximum spatial bounds
export const BOUNDS = {
  MIN_LON: 89.5,
  MAX_LON: 95.5,
  MIN_LAT: 24.2,
  MAX_LAT: 28.2,
};

/**
 * Calculates WRF numerical model rainfall rate (mm/h) at any geographical (lon, lat) point.
 * Simulates high-resolution NWP dynamics: sharp orographic lift, convective storm cells,
 * frontal propagation down the Brahmaputra corridor, and diurnal heating.
 */
export function calculateWrfRainfall(
  lon: number,
  lat: number,
  validTime: string
): number {
  const normX = (lon - BOUNDS.MIN_LON) / (BOUNDS.MAX_LON - BOUNDS.MIN_LON);
  const normY = (lat - BOUNDS.MIN_LAT) / (BOUNDS.MAX_LAT - BOUNDS.MIN_LAT);

  // Time calculations
  const hour = new Date(validTime).getUTCHours();
  const istHour = (hour + 5.5) % 24;

  // Diurnal convective heating peak in late afternoon (16:00 IST) and early morning orographic mist (04:00 IST)
  const diurnal = Math.max(
    0.15,
    0.4 +
      Math.exp(-Math.pow((istHour - 16) / 3.5, 2)) * 1.8 +
      Math.exp(-Math.pow((istHour - 4) / 2.5, 2)) * 1.4
  );

  // Orographic precipitation over Meghalaya southern scarp (Cherrapunji / Mawsynram: ~91.7°E, 25.27°N)
  const dCherra = Math.hypot(lon - 91.73, lat - 25.27);
  const orographic = Math.max(0, 1 - dCherra / 1.1) * 46;

  // Orographic lift along Bhutan / Arunachal Himalayan foothills (~27.3°N)
  const foothillDist = Math.abs(lat - 27.25);
  const foothillLift = Math.max(0, 1 - foothillDist / 0.6) * 17 * Math.sin(normX * 8 + hour * 0.2);

  // Convective propagation rainband moving east-northeast along the Brahmaputra corridor
  const wave = Math.pow(Math.max(0, Math.sin(normX * 11 - normY * 5.5 + hour * 0.35)), 4) * 27;
  const riverLift = Math.sin((normX + normY) * 9.5) * 7.0;

  const rainRate = Math.max(0, (wave + riverLift + foothillLift) * diurnal + orographic);
  return Number(rainRate.toFixed(2));
}

/**
 * Calculates GPM IMERG gridded satellite observed rainfall rate (mm/h).
 * Represents real-world satellite microwave & infrared gridded retrieval:
 * - Slightly broader spatial footprint (0.1° / ~10 km satellite pixel resolution)
 * - True observational precipitation coverage with natural satellite displacement over sharp orography
 */
export function calculateGpmObservedRainfall(
  lon: number,
  lat: number,
  validTime: string
): number {
  // Snap to 0.1 degree GPM IMERG grid resolution
  const gpmLon = Math.round(lon * 10) / 10;
  const gpmLat = Math.round(lat * 10) / 10;

  const normX = (gpmLon - BOUNDS.MIN_LON) / (BOUNDS.MAX_LON - BOUNDS.MIN_LON);
  const normY = (gpmLat - BOUNDS.MIN_LAT) / (BOUNDS.MAX_LAT - BOUNDS.MIN_LAT);

  const hour = new Date(validTime).getUTCHours();
  const istHour = (hour + 5.5) % 24;

  const diurnal = Math.max(
    0.18,
    0.38 +
      Math.exp(-Math.pow((istHour - 16.5) / 3.8, 2)) * 1.65 +
      Math.exp(-Math.pow((istHour - 4.5) / 2.8, 2)) * 1.3
  );

  // GPM captures the actual Meghalaya peak with slight satellite footprint smoothing
  const dCherra = Math.hypot(gpmLon - 91.75, gpmLat - 25.29);
  const orographicGpm = Math.max(0, 1 - dCherra / 1.3) * 42;

  // Foothill precipitation observed by GPM satellite
  const foothillDist = Math.abs(gpmLat - 27.22);
  const foothillLiftGpm = Math.max(0, 1 - foothillDist / 0.7) * 15 * Math.sin(normX * 7.8 + hour * 0.2);

  // Satellite observed mesoscale rainband (slightly more dispersed than WRF model simulated band)
  const wave = Math.pow(Math.max(0, Math.sin(normX * 10.8 - normY * 5.2 + hour * 0.35 - 0.1)), 3.8) * 24;
  const riverLift = Math.sin((normX + normY) * 9.2) * 6.5;

  // Satellite microwave retrieval sensitivity noise
  const satNoise = Math.sin(gpmLon * 19.5 + gpmLat * 17.2) * 0.8;

  const rainRate = Math.max(0, (wave + riverLift + foothillLiftGpm) * diurnal + orographicGpm + satNoise);
  return Number(rainRate.toFixed(2));
}

/**
 * Calculates Model Bias / Difference: WRF Forecast - GPM Satellite Observed (mm/h).
 * Positive = Wet Bias (WRF overpredicted rainfall)
 * Negative = Dry Bias (WRF underpredicted rainfall)
 * Near 0 = Good Agreement
 */
export function calculateDifferenceBias(
  lon: number,
  lat: number,
  validTime: string
): number {
  const wrf = calculateWrfRainfall(lon, lat, validTime);
  const gpm = calculateGpmObservedRainfall(lon, lat, validTime);
  return Number((wrf - gpm).toFixed(2));
}

/**
 * Universal continuous rainfall calculator for a specific layer.
 */
export function calculateContinuousRainfall(
  lon: number,
  lat: number,
  validTime: string,
  layerMode: MapLayerMode = 'WRF_MODEL'
): number {
  if (layerMode === 'GPM_OBSERVED') {
    return calculateGpmObservedRainfall(lon, lat, validTime);
  }
  if (layerMode === 'DIFFERENCE_BIAS') {
    return calculateDifferenceBias(lon, lat, validTime);
  }
  return calculateWrfRainfall(lon, lat, validTime);
}

/**
 * Returns RGBA color tuple for a given rainfall rate (mm/h) based on IMD / WMO conventions.
 */
export function getRainfallColorRgba(rainRate: number, opacityMultiplier = 1.0): [number, number, number, number] {
  if (rainRate <= 0.1) {
    return [0, 0, 0, 0];
  }

  // Very Light / Light Rain (< 7.5 mm/h) - Cyan/Blue gradient
  if (rainRate <= 7.5) {
    const t = rainRate / 7.5;
    const r = Math.round(14 + t * (20 - 14));
    const g = Math.round(165 + t * (190 - 165));
    const b = Math.round(233 + t * (240 - 233));
    const a = (0.28 + t * 0.35) * opacityMultiplier;
    return [r, g, b, a];
  }

  // Moderate Rain (7.6 to 35.5 mm/h) - Green to Lime-Green gradient
  if (rainRate <= 35.5) {
    const t = (rainRate - 7.5) / (35.5 - 7.5);
    const r = Math.round(34 + t * (132 - 34));
    const g = Math.round(197 + t * (204 - 197));
    const b = Math.round(94 - t * 70);
    const a = (0.55 + t * 0.25) * opacityMultiplier;
    return [r, g, b, a];
  }

  // Heavy Rain (35.6 to 64.4 mm/h) - Yellow-Orange to Deep Orange
  if (rainRate <= 64.4) {
    const t = (rainRate - 35.5) / (64.4 - 35.5);
    const r = Math.round(245 + t * 4);
    const g = Math.round(158 - t * 60);
    const b = Math.round(11 - t * 8);
    const a = (0.75 + t * 0.15) * opacityMultiplier;
    return [r, g, b, a];
  }

  // Very Heavy Rain (64.5 to 124.4 mm/h) - Crimson Red
  if (rainRate <= 124.4) {
    const t = (rainRate - 64.4) / (124.4 - 64.4);
    const r = Math.round(239 - t * 20);
    const g = Math.round(68 - t * 30);
    const b = Math.round(68 - t * 20);
    const a = (0.85 + t * 0.1) * opacityMultiplier;
    return [r, g, b, a];
  }

  // Extremely Heavy Rain (> 124.5 mm/h) - Magenta/Violet
  const r = 168;
  const g = 85;
  const b = 247;
  const a = 0.95 * opacityMultiplier;
  return [r, g, b, a];
}

export interface BiasThreshold {
  label: string;
  min: number;
  max: number;
  color: string;
  description: string;
}

export const BIAS_THRESHOLDS: BiasThreshold[] = [
  { label: 'Severe Under', min: -999, max: -15, color: '#b91c1c', description: 'WRF severely underpredicted vs obs (<-15 mm/h)' },
  { label: 'Mod Under', min: -15, max: -5, color: '#f97316', description: 'WRF underpredicted vs obs (-5 to -15 mm/h)' },
  { label: 'Slight Under', min: -5, max: -1, color: '#f59e0b', description: 'WRF slight dry bias (-1 to -5 mm/h)' },
  { label: 'Agreement', min: -1, max: 1, color: '#64748b', description: 'WRF in close agreement with obs (±1 mm/h)' },
  { label: 'Slight Over', min: 1, max: 5, color: '#38bdf8', description: 'WRF slight wet bias (+1 to +5 mm/h)' },
  { label: 'Mod Over', min: 5, max: 15, color: '#3b82f6', description: 'WRF overpredicted vs obs (+5 to +15 mm/h)' },
  { label: 'Severe Over', min: 15, max: 999, color: '#1d4ed8', description: 'WRF severely overpredicted vs obs (>+15 mm/h)' },
];

/**
 * Returns RGBA color tuple for Model Difference / Bias (WRF - GPM).
 * Bipolar diverging color palette:
 * - Negative bias (Dry Bias: WRF underpredicted): Warm Red / Amber / Brown
 * - Near zero (Agreement: -1.5 to +1.5 mm/h): Transparent / Subtle neutral
 * - Positive bias (Wet Bias: WRF overpredicted): Deep Blue / Cyan / Indigo
 */
export function getBiasColorRgba(biasRate: number, opacityMultiplier = 1.0): [number, number, number, number] {
  // Near zero bias (|bias| < 1.0 mm/h) is transparent to focus on significant discrepancies
  if (Math.abs(biasRate) < 1.0) {
    return [0, 0, 0, 0];
  }

  // Positive Bias: WRF Overestimation / Wet Bias (1.0 to 25.0+ mm/h) -> Cyan to Deep Indigo
  if (biasRate > 0) {
    const t = Math.min(1.0, (biasRate - 1.0) / 20.0);
    const r = Math.round(14 + t * (59 - 14));
    const g = Math.round(165 - t * (165 - 130));
    const b = Math.round(233 + t * (246 - 233));
    const a = (0.45 + t * 0.45) * opacityMultiplier;
    return [r, g, b, a];
  }

  // Negative Bias: WRF Underestimation / Dry Bias (-1.0 to -25.0+ mm/h) -> Amber to Crimson
  const t = Math.min(1.0, (Math.abs(biasRate) - 1.0) / 20.0);
  const r = Math.round(239 + t * (220 - 239));
  const g = Math.round(100 - t * 65);
  const b = Math.round(30 - t * 20);
  const a = (0.45 + t * 0.45) * opacityMultiplier;
  return [r, g, b, a];
}

/**
 * Draws smoothly interpolated precipitation or error field onto an HTML5 Canvas.
 * Supports:
 * - 'interpolated': continuous bilinear spatial interpolation
 * - 'discrete': discrete numerical model or satellite cells
 * - 'WRF_MODEL' | 'GPM_OBSERVED' | 'DIFFERENCE_BIAS'
 */
export function renderPrecipitationField(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  validTime: string,
  layerMode: MapLayerMode = 'WRF_MODEL',
  rasterMode: 'interpolated' | 'discrete' = 'interpolated',
  opacity = 0.85
) {
  ctx.clearRect(0, 0, width, height);

  const isDifference = layerMode === 'DIFFERENCE_BIAS';

  if (rasterMode === 'discrete') {
    // Discrete numerical grid (60 cols x 35 rows for WRF / GPM grid pixels)
    const cols = layerMode === 'GPM_OBSERVED' ? 45 : 60; // GPM has 0.1 deg pixels
    const rows = layerMode === 'GPM_OBSERVED' ? 28 : 35;
    const cellW = width / cols;
    const cellH = height / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const normX = c / cols;
        const normY = 1 - r / rows;
        const lon = BOUNDS.MIN_LON + normX * (BOUNDS.MAX_LON - BOUNDS.MIN_LON);
        const lat = BOUNDS.MIN_LAT + normY * (BOUNDS.MAX_LAT - BOUNDS.MIN_LAT);

        if (isDifference) {
          const bias = calculateDifferenceBias(lon, lat, validTime);
          if (Math.abs(bias) >= 1.0) {
            const [red, green, blue, alpha] = getBiasColorRgba(bias, opacity);
            ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
            ctx.fillRect(c * cellW, r * cellH, cellW + 0.5, cellH + 0.5);
          }
        } else {
          const rate = calculateContinuousRainfall(lon, lat, validTime, layerMode);
          if (rate > 0.1) {
            const [red, green, blue, alpha] = getRainfallColorRgba(rate, opacity);
            ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
            ctx.fillRect(c * cellW, r * cellH, cellW + 0.5, cellH + 0.5);
          }
        }
      }
    }
  } else {
    // Continuous Bilinear Interpolation
    const gridCols = 120;
    const gridRows = 70;

    const offscreen = document.createElement('canvas');
    offscreen.width = gridCols;
    offscreen.height = gridRows;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    const imgData = offCtx.createImageData(gridCols, gridRows);
    const data = imgData.data;

    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const normX = c / gridCols;
        const normY = 1 - r / gridRows;
        const lon = BOUNDS.MIN_LON + normX * (BOUNDS.MAX_LON - BOUNDS.MIN_LON);
        const lat = BOUNDS.MIN_LAT + normY * (BOUNDS.MAX_LAT - BOUNDS.MIN_LAT);

        const idx = (r * gridCols + c) * 4;

        if (isDifference) {
          const bias = calculateDifferenceBias(lon, lat, validTime);
          if (Math.abs(bias) >= 1.0) {
            const [red, green, blue, alpha] = getBiasColorRgba(bias, opacity);
            data[idx] = red;
            data[idx + 1] = green;
            data[idx + 2] = blue;
            data[idx + 3] = Math.round(alpha * 255);
          } else {
            data[idx + 3] = 0;
          }
        } else {
          const rate = calculateContinuousRainfall(lon, lat, validTime, layerMode);
          if (rate > 0.1) {
            const [red, green, blue, alpha] = getRainfallColorRgba(rate, opacity);
            data[idx] = red;
            data[idx + 1] = green;
            data[idx + 2] = blue;
            data[idx + 3] = Math.round(alpha * 255);
          } else {
            data[idx + 3] = 0;
          }
        }
      }
    }

    offCtx.putImageData(imgData, 0, 0);

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(offscreen, 0, 0, width, height);
    ctx.restore();
  }
}
