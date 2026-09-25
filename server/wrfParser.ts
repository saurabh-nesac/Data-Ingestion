import { NetCDFReader } from 'netcdfjs';
import fs from 'fs';

export interface WRFGridPoint {
  lat: number;
  lon: number;
  rainc: number; // convective precipitation (mm)
  rainnc: number; // non-convective precipitation (mm)
  accumulated_rain: number; // RAINC + RAINNC (mm)
  rain_rate: number; // mm/h
  temperature_c: number; // 2m temperature in Celsius (T2 - 273.15)
  u_wind: number; // destaggered west-east wind (m/s)
  v_wind: number; // destaggered south-north wind (m/s)
  wind_speed_ms: number; // sqrt(u^2 + v^2)
  wind_speed_kmh: number; // m/s * 3.6
  wind_direction_deg: number; // meteorological degrees 0-360
}

export interface WRFTimestep {
  timeIndex: number;
  timeStr: string;
  isoTime: string;
  ny: number;
  nx: number;
  data: Float32Array; // Flattened buffer: [y, x, variable] or point structures
  // Quick spatial lookup
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  lats: Float32Array; // 1D or 2D
  lons: Float32Array;
  rainc: Float32Array;
  rainnc: Float32Array;
  totalRain: Float32Array;
  rainRate: Float32Array;
  tempC: Float32Array;
  uWind: Float32Array; // destaggered
  vWind: Float32Array; // destaggered
  windSpeedKmh: Float32Array;
  windDirDeg: Float32Array;
}

export interface WRFDataset {
  filename: string;
  domain: 'd01' | 'd02' | 'd03';
  title?: string;
  gridDimensions: {
    ny: number;
    nx: number;
    nz?: number;
  };
  variablesFound: string[];
  hasRainc: boolean;
  hasRainnc: boolean;
  hasT2: boolean;
  hasStaggeredWind: boolean;
  timesteps: WRFTimestep[];
}

/**
 * Destaggers an Arakawa C-grid field to the mass grid center.
 * - For U: input has shape [ny, nx + 1]. Output has shape [ny, nx].
 *   U_mass(y, x) = 0.5 * (U(y, x) + U(y, x + 1))
 * - For V: input has shape [ny + 1, nx]. Output has shape [ny, nx].
 *   V_mass(y, x) = 0.5 * (V(y, x) + V(y + 1, x))
 */
export function destaggerU(rawU: Float32Array | number[], ny: number, nx: number): Float32Array {
  const result = new Float32Array(ny * nx);
  const uCols = nx + 1;
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      const idxStag1 = y * uCols + x;
      const idxStag2 = y * uCols + (x + 1);
      result[y * nx + x] = 0.5 * (rawU[idxStag1] + rawU[idxStag2]);
    }
  }
  return result;
}

export function destaggerV(rawV: Float32Array | number[], ny: number, nx: number): Float32Array {
  const result = new Float32Array(ny * nx);
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      const idxStag1 = y * nx + x;
      const idxStag2 = (y + 1) * nx + x;
      result[y * nx + x] = 0.5 * (rawV[idxStag1] + rawV[idxStag2]);
    }
  }
  return result;
}

/**
 * Parses WRF NetCDF binary file.
 */
export function parseWRFNetCDF(buffer: Buffer, filename: string): WRFDataset {
  const reader = new NetCDFReader(buffer);

  // Extract dimensions
  const dims: Record<string, number> = {};
  reader.dimensions.forEach((d) => {
    dims[d.name] = d.size;
  });

  const ny = dims['south_north'] || 100;
  const nx = dims['west_east'] || 100;
  const numTimes = dims['Time'] || 1;

  // Variables found
  const varNames = reader.variables.map((v) => v.name);
  const hasRainc = varNames.includes('RAINC');
  const hasRainnc = varNames.includes('RAINNC');
  const hasT2 = varNames.includes('T2');
  const hasU = varNames.includes('U');
  const hasV = varNames.includes('V');
  const hasU10 = varNames.includes('U10');
  const hasV10 = varNames.includes('V10');

  // Infer domain from filename (e.g. wrfout_d01_*, wrfout_d02_*, wrfout_d03_*)
  let domain: 'd01' | 'd02' | 'd03' = 'd02';
  if (filename.includes('d01')) domain = 'd01';
  else if (filename.includes('d03')) domain = 'd03';

  // Read Time Strings
  const timeStrings: string[] = [];
  if (varNames.includes('Times')) {
    try {
      const timesVar = reader.getDataVariable('Times') as any;
      const strLen = dims['DateStrLen'] || 19;
      for (let t = 0; t < numTimes; t++) {
        let str = '';
        for (let c = 0; c < strLen; c++) {
          const charCode = timesVar[t * strLen + c];
          if (charCode) str += String.fromCharCode(charCode);
        }
        timeStrings.push(str.trim());
      }
    } catch {
      // Fallback
    }
  }

  // Latitude / Longitude
  let lats = new Float32Array(ny * nx);
  let lons = new Float32Array(ny * nx);
  if (varNames.includes('XLAT')) {
    const rawLat = reader.getDataVariable('XLAT') as any;
    for (let i = 0; i < ny * nx; i++) {
      lats[i] = rawLat[i];
    }
  } else {
    // Default coordinate mesh if missing (NE India region: 24.2 - 28.2 N)
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        lats[y * nx + x] = 24.2 + (y / Math.max(1, ny - 1)) * 4.0;
      }
    }
  }

  if (varNames.includes('XLONG')) {
    const rawLon = reader.getDataVariable('XLONG') as any;
    for (let i = 0; i < ny * nx; i++) {
      lons[i] = rawLon[i];
    }
  } else {
    // Default coordinate mesh if missing (NE India region: 89.5 - 95.5 E)
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        lons[y * nx + x] = 89.5 + (x / Math.max(1, nx - 1)) * 6.0;
      }
    }
  }

  let minLat = 999;
  let maxLat = -999;
  let minLon = 999;
  let maxLon = -999;
  for (let i = 0; i < ny * nx; i++) {
    if (lats[i] < minLat) minLat = lats[i];
    if (lats[i] > maxLat) maxLat = lats[i];
    if (lons[i] < minLon) minLon = lons[i];
    if (lons[i] > maxLon) maxLon = lons[i];
  }

  // Process timesteps
  const timesteps: WRFTimestep[] = [];
  let prevTotalRain: Float32Array | null = null;
  let prevIsoTime: string | null = null;

  for (let t = 0; t < numTimes; t++) {
    const timeStr = timeStrings[t] || `2025-09-01_${String(t).padStart(2, '0')}:00:00`;
    // Format "YYYY-MM-DD_HH:mm:ss" to ISO "YYYY-MM-DDTHH:mm:ss.000Z"
    const isoTime = timeStr.includes('_')
      ? `${timeStr.replace('_', 'T')}Z`
      : new Date().toISOString();

    const rainc = new Float32Array(ny * nx);
    const rainnc = new Float32Array(ny * nx);
    const totalRain = new Float32Array(ny * nx);
    const rainRate = new Float32Array(ny * nx);
    const tempC = new Float32Array(ny * nx);
    const uWind = new Float32Array(ny * nx);
    const vWind = new Float32Array(ny * nx);
    const windSpeedKmh = new Float32Array(ny * nx);
    const windDirDeg = new Float32Array(ny * nx);

    // 1. Convective and Non-convective Rain calculation
    // User requirement: "rain is calculated using RAINC and RAINNC"
    if (hasRainc) {
      const rawRainc = reader.getDataVariable('RAINC') as any;
      const offset = t * ny * nx;
      for (let i = 0; i < ny * nx; i++) {
        rainc[i] = rawRainc[offset + i];
      }
    }
    if (hasRainnc) {
      const rawRainnc = reader.getDataVariable('RAINNC') as any;
      const offset = t * ny * nx;
      for (let i = 0; i < ny * nx; i++) {
        rainnc[i] = rawRainnc[offset + i];
      }
    }

    // Total accumulated rain = RAINC + RAINNC
    for (let i = 0; i < ny * nx; i++) {
      totalRain[i] = rainc[i] + rainnc[i];
    }

    // Incremental Rain Rate (mm/h) between timesteps
    let dtHours = 1.0;
    if (prevIsoTime) {
      const diffMs = Math.abs(new Date(isoTime).getTime() - new Date(prevIsoTime).getTime());
      if (diffMs > 0) {
        dtHours = diffMs / (1000 * 3600);
      }
    }

    for (let i = 0; i < ny * nx; i++) {
      if (prevTotalRain) {
        // Delta accumulation divided by time interval
        const deltaRain = totalRain[i] - prevTotalRain[i];
        rainRate[i] = Math.max(0, deltaRain / dtHours);
      } else {
        // First timestep rate
        rainRate[i] = totalRain[i] > 0 ? totalRain[i] / dtHours : 0;
      }
    }
    prevTotalRain = new Float32Array(totalRain);
    prevIsoTime = isoTime;

    // 2. Temperature calculation
    // User requirement: "and temp"
    if (hasT2) {
      const rawT2 = reader.getDataVariable('T2') as any;
      const offset = t * ny * nx;
      for (let i = 0; i < ny * nx; i++) {
        const kelvin = rawT2[offset + i];
        tempC[i] = kelvin > 100 ? kelvin - 273.15 : kelvin; // Kelvin to Celsius
      }
    } else {
      tempC.fill(27.5);
    }

    // 3. Wind calculation with staggered grid destaggering
    // User requirement: "and wind(u and v are staggered)"
    if (hasU && hasV) {
      // In WRF 3D U is [Time, bottom_top, south_north, west_east_stag]
      // or 2D U is [Time, south_north, west_east_stag]
      // Let's get bottom-level (k=0) or 2D slice
      const rawU = reader.getDataVariable('U') as any;
      const rawV = reader.getDataVariable('V') as any;

      const uStagCols = nx + 1;
      const uSlice = new Float32Array(ny * uStagCols);
      const uOffset = t * ny * uStagCols;
      for (let i = 0; i < ny * uStagCols; i++) {
        uSlice[i] = rawU[uOffset + i] || 0;
      }

      const vStagRows = ny + 1;
      const vSlice = new Float32Array(vStagRows * nx);
      const vOffset = t * vStagRows * nx;
      for (let i = 0; i < vStagRows * nx; i++) {
        vSlice[i] = rawV[vOffset + i] || 0;
      }

      const destagU = destaggerU(uSlice, ny, nx);
      const destagV = destaggerV(vSlice, ny, nx);

      for (let i = 0; i < ny * nx; i++) {
        uWind[i] = destagU[i];
        vWind[i] = destagV[i];
        const spdMs = Math.hypot(destagU[i], destagV[i]);
        windSpeedKmh[i] = spdMs * 3.6;
        // Meteorological wind direction: degrees where the wind is coming from
        // atan2(V, U) in radians -> convert to degrees from north
        const rad = Math.atan2(destagV[i], destagU[i]);
        let deg = (270 - (rad * 180) / Math.PI) % 360;
        if (deg < 0) deg += 360;
        windDirDeg[i] = deg;
      }
    } else if (hasU10 && hasV10) {
      // 10-meter wind on unstaggered mass grid
      const rawU10 = reader.getDataVariable('U10') as any;
      const rawV10 = reader.getDataVariable('V10') as any;
      const offset = t * ny * nx;
      for (let i = 0; i < ny * nx; i++) {
        const u = rawU10[offset + i] || 0;
        const v = rawV10[offset + i] || 0;
        uWind[i] = u;
        vWind[i] = v;
        const spdMs = Math.hypot(u, v);
        windSpeedKmh[i] = spdMs * 3.6;
        let deg = (270 - (Math.atan2(v, u) * 180) / Math.PI) % 360;
        if (deg < 0) deg += 360;
        windDirDeg[i] = deg;
      }
    } else {
      windSpeedKmh.fill(12.0);
      windDirDeg.fill(225.0);
    }

    timesteps.push({
      timeIndex: t,
      timeStr,
      isoTime,
      ny,
      nx,
      data: new Float32Array(0),
      minLat,
      maxLat,
      minLon,
      maxLon,
      lats,
      lons,
      rainc,
      rainnc,
      totalRain,
      rainRate,
      tempC,
      uWind,
      vWind,
      windSpeedKmh,
      windDirDeg,
    });
  }

  return {
    filename,
    domain,
    gridDimensions: { ny, nx },
    variablesFound: varNames,
    hasRainc,
    hasRainnc,
    hasT2,
    hasStaggeredWind: hasU && hasV,
    timesteps,
  };
}
