import * as hdf5 from 'jsfive';

export interface GPMFileInfo {
  filename: string;
  year: number;
  month: number;
  day: number;
  startTimeUtc: string; // e.g. "00:30:00"
  endTimeUtc: string;   // e.g. "00:59:59"
  minuteOfDay: number;  // e.g. 30
  version: string;      // e.g. "V07B"
  isoStart: string;     // e.g. "2025-09-01T00:30:00Z"
  isoCenter: string;    // e.g. "2025-09-01T00:45:00Z"
  isoEnd: string;       // e.g. "2025-09-01T00:59:59Z"
}

export interface GPMGridSlice {
  fileInfo: GPMFileInfo;
  bbox: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
    nLat: number;
    nLon: number;
  };
  rates: Float32Array; // Flattened 2D array [nLat, nLon] in mm/h
  meanRate: number;
  maxRate: number;
  hasBinaryData: boolean;
}

/**
 * Parses GPM IMERG filename into time metadata
 * Format: 3B-HHR-L.MS.MRG.3IMERG.20250901-S003000-E005959.0030.V07B.HDF5
 */
export function parseGPMFilename(filename: string): GPMFileInfo | null {
  const cleanName = filename.trim().split(/[\\/]/).pop() || filename;
  const match = cleanName.match(
    /3B-HHR(?:-[A-Z]+)?\.MS\.MRG\.3IMERG\.(\d{4})(\d{2})(\d{2})-S(\d{2})(\d{2})(\d{2})-E(\d{2})(\d{2})(\d{2})\.(\d{4})\.([A-Za-z0-9]+)\.(?:HDF5|nc4|nc)/i
  );

  if (!match) {
    // Looser regex fallback for variants
    const loose = cleanName.match(/(\d{4})(\d{2})(\d{2})[-_]S?(\d{2})(\d{2})/);
    if (!loose) return null;
    const y = parseInt(loose[1], 10);
    const m = parseInt(loose[2], 10);
    const d = parseInt(loose[3], 10);
    const hh = parseInt(loose[4], 10);
    const mm = parseInt(loose[5], 10);
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`;
    return {
      filename: cleanName,
      year: y,
      month: m,
      day: d,
      startTimeUtc: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`,
      endTimeUtc: `${String(hh).padStart(2, '0')}:${String(mm + 29).padStart(2, '0')}:59`,
      minuteOfDay: hh * 60 + mm,
      version: 'V07B',
      isoStart: iso,
      isoCenter: iso,
      isoEnd: iso,
    };
  }

  const [, yStr, mStr, dStr, sH, sM, sS, eH, eM, eS, minStr, ver] = match;
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const day = parseInt(dStr, 10);
  const sHours = parseInt(sH, 10);
  const sMins = parseInt(sM, 10);
  const sSecs = parseInt(sS, 10);

  const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const isoStart = `${isoDate}T${String(sHours).padStart(2, '0')}:${String(sMins).padStart(2, '0')}:${String(sSecs).padStart(2, '0')}Z`;
  const isoEnd = `${isoDate}T${eH}:${eM}:${eS}Z`;

  // Center time (usually ~15 minutes after start)
  const startMs = new Date(isoStart).getTime();
  const endMs = new Date(isoEnd).getTime();
  const isoCenter = new Date(Math.round((startMs + endMs) / 2)).toISOString();

  return {
    filename: cleanName,
    year,
    month,
    day,
    startTimeUtc: `${sH}:${sM}:${sS}`,
    endTimeUtc: `${eH}:${eM}:${eS}`,
    minuteOfDay: parseInt(minStr, 10),
    version: ver,
    isoStart,
    isoCenter,
    isoEnd,
  };
}

/**
 * Parses GPM HDF5 file buffer using jsfive
 */
export function parseGPMHDF5(
  buffer: Buffer,
  filename: string,
  targetBbox = { minLat: 23.5, maxLat: 29.0, minLon: 89.0, maxLon: 96.5 }
): GPMGridSlice {
  const fileInfo = parseGPMFilename(filename) || {
    filename,
    year: 2025,
    month: 9,
    day: 1,
    startTimeUtc: '00:30:00',
    endTimeUtc: '00:59:59',
    minuteOfDay: 30,
    version: 'V07B',
    isoStart: new Date().toISOString(),
    isoCenter: new Date().toISOString(),
    isoEnd: new Date().toISOString(),
  };

  const nLat = Math.round((targetBbox.maxLat - targetBbox.minLat) / 0.1) + 1;
  const nLon = Math.round((targetBbox.maxLon - targetBbox.minLon) / 0.1) + 1;
  const rates = new Float32Array(nLat * nLon);

  let hasBinaryData = false;
  let maxRate = 0;
  let sumRate = 0;
  let validCount = 0;

  try {
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const f = new hdf5.File(arrayBuffer, filename);

    // GPM IMERG structure has /Grid/precipitationCal or /Grid/precipitation
    let dataset: any = null;
    const gridGroup = (f.get && f.get('Grid')) || f;
    if (gridGroup && gridGroup.get) {
      dataset = gridGroup.get('precipitationCal') || gridGroup.get('precipitation');
    }
    if (!dataset && f.get) {
      dataset = f.get('precipitationCal') || f.get('precipitation');
    }

    if (dataset && dataset.value) {
      hasBinaryData = true;
      const rawVal = dataset.value;
      // In IMERG, shape is [lon: 3600, lat: 1800] or [1, lon, lat]
      // Longitude: -180.0 to 179.9 at 0.1°
      // Latitude: -90.0 to 89.9 at 0.1°
      for (let j = 0; j < nLat; j++) {
        const curLat = targetBbox.minLat + j * 0.1;
        const latIdx = Math.max(0, Math.min(1799, Math.round((curLat - (-90.0)) / 0.1)));

        for (let i = 0; i < nLon; i++) {
          const curLon = targetBbox.minLon + i * 0.1;
          const lonIdx = Math.max(0, Math.min(3599, Math.round((curLon - (-180.0)) / 0.1)));

          // GPM 2D dataset index: typically [lon * 1800 + lat]
          const rawIdx = lonIdx * 1800 + latIdx;
          const val = rawVal[rawIdx];

          if (val !== undefined && val >= 0 && val < 500) {
            rates[j * nLon + i] = val;
            if (val > maxRate) maxRate = val;
            sumRate += val;
            validCount++;
          } else {
            rates[j * nLon + i] = 0;
          }
        }
      }
    }
  } catch (err) {
    console.warn(`Could not parse raw HDF5 dataset inside ${filename}:`, err);
  }

  const meanRate = validCount > 0 ? sumRate / validCount : 0;

  return {
    fileInfo,
    bbox: {
      ...targetBbox,
      nLat,
      nLon,
    },
    rates,
    meanRate: Number(meanRate.toFixed(2)),
    maxRate: Number(maxRate.toFixed(2)),
    hasBinaryData,
  };
}
