import { WRFDataset, WRFTimestep } from './wrfParser';
import { GPMFileInfo, GPMGridSlice, parseGPMFilename } from './gpmParser';

// AWS Station ground truth points in Northeast India
export interface AWSStationRecord {
  id: string;
  name: string;
  district: string;
  state: string;
  lat: number;
  lon: number;
  elevation: number;
  observedRain?: number; // mm/h
}

export const KNOWN_AWS_STATIONS: AWSStationRecord[] = [
  { id: 'NESAC_01', name: 'Umiam Atmospheric Lab (NESAC)', district: 'Ri-Bhoi', state: 'Meghalaya', lat: 25.674, lon: 91.918, elevation: 990 },
  { id: 'IMD_GAU', name: 'Guwahati Borjhar Airport', district: 'Kamrup Metro', state: 'Assam', lat: 26.106, lon: 91.586, elevation: 54 },
  { id: 'AWS_SHL', name: 'Shillong Upper Station', district: 'East Khasi Hills', state: 'Meghalaya', lat: 25.569, lon: 91.883, elevation: 1525 },
  { id: 'AWS_CHR', name: 'Sohra (Cherrapunji) Station', district: 'East Khasi Hills', state: 'Meghalaya', lat: 25.27, lon: 91.732, elevation: 1313 },
  { id: 'AWS_JRH', name: 'Jorhat Regional Station', district: 'Jorhat', state: 'Assam', lat: 26.75, lon: 94.22, elevation: 91 },
  { id: 'AWS_DBR', name: 'Dibrugarh Mohanbari', district: 'Dibrugarh', state: 'Assam', lat: 27.48, lon: 95.02, elevation: 110 },
  { id: 'AWS_TEZ', name: 'Tezpur Airbase Station', district: 'Sonitpur', state: 'Assam', lat: 26.65, lon: 92.8, elevation: 79 },
  { id: 'AWS_SIL', name: 'Silchar Kumbhirgram', district: 'Cachar', state: 'Assam', lat: 24.91, lon: 92.98, elevation: 32 },
  { id: 'AWS_AGT', name: 'Agartala Aerodrome', district: 'West Tripura', state: 'Tripura', lat: 23.89, lon: 91.24, elevation: 15 },
  { id: 'AWS_ITA', name: 'Itanagar Hydro-Met Post', district: 'Papum Pare', state: 'Arunachal Pradesh', lat: 27.1, lon: 93.62, elevation: 750 },
  { id: 'AWS_PAS', name: 'Pasighat Siang Basin', district: 'East Siang', state: 'Arunachal Pradesh', lat: 28.07, lon: 95.33, elevation: 155 },
  { id: 'AWS_AIZ', name: 'Aizawl Lengpui Station', district: 'Aizawl', state: 'Mizoram', lat: 23.84, lon: 92.62, elevation: 420 },
  { id: 'AWS_IMP', name: 'Imphal Tulihal Airport', district: 'Imphal West', state: 'Manipur', lat: 24.76, lon: 93.89, elevation: 775 },
  { id: 'AWS_KOH', name: 'Kohima Science College', district: 'Kohima', state: 'Nagaland', lat: 25.67, lon: 94.11, elevation: 1444 },
  { id: 'AWS_MAW', name: 'Mawsynram Precipitation Post', district: 'East Khasi Hills', state: 'Meghalaya', lat: 25.3, lon: 91.58, elevation: 1400 },
];

export class CentralDataStore {
  private wrfDatasets: Map<string, WRFDataset> = new Map(); // key = domain e.g. "d01", "d02", "d03"
  private gpmSlices: Map<string, GPMGridSlice> = new Map(); // key = isoStart or filename
  private gpmCatalog: GPMFileInfo[] = [];
  private awsObservations: Map<string, Record<string, number>> = new Map(); // timestamp -> { stationId: rainRate }

  constructor() {
    this.initializeDefaultCatalog();
  }

  /**
   * Pre-loads the GPM IMERG 2025 September sequence provided by user
   */
  private initializeDefaultCatalog() {
    const rawList = [
      '3B-HHR-L.MS.MRG.3IMERG.20250901-S003000-E005959.0030.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250901-S050000-E052959.0300.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250901-S080000-E082959.0480.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250902-S043000-E045959.0270.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250902-S170000-E172959.1020.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250903-S050000-E052959.0300.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250903-S193000-E195959.1170.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250903-S200000-E202959.1200.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250903-S233000-E235959.1410.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250904-S070000-E072959.0420.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250904-S143000-E145959.0870.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250904-S170000-E172959.1020.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250905-S003000-E005959.0030.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250905-S013000-E015959.0090.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250905-S030000-E032959.0180.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250905-S033000-E035959.0210.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250905-S053000-E055959.0330.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250905-S170000-E172959.1020.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250906-S063000-E065959.0390.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250906-S070000-E072959.0420.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250906-S180000-E182959.1080.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250907-S030000-E032959.0180.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250907-S080000-E082959.0480.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250908-S040000-E042959.0240.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250908-S050000-E052959.0300.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250908-S170000-E172959.1020.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250908-S223000-E225959.1350.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250909-S100000-E102959.0600.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250909-S113000-E115959.0690.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250909-S203000-E205959.1230.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250909-S223000-E225959.1350.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250910-S003000-E005959.0030.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250910-S080000-E082959.0480.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250911-S040000-E042959.0240.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250911-S080000-E082959.0480.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250912-S043000-E045959.0270.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250913-S110000-E112959.0660.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250914-S003000-E005959.0030.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250914-S050000-E052959.0300.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250914-S213000-E215959.1290.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250915-S023000-E025959.0150.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250915-S120000-E122959.0720.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250915-S143000-E145959.0870.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250915-S223000-E225959.1350.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250916-S113000-E115959.0690.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250916-S130000-E132959.0780.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250916-S150000-E152959.0900.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250917-S003000-E005959.0030.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250917-S153000-E155959.0930.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250918-S033000-E035959.0210.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250918-S063000-E065959.0390.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250918-S193000-E195959.1170.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250918-S210000-E212959.1260.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250919-S070000-E072959.0420.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250919-S120000-E122959.0720.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250920-S040000-E042959.0240.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250920-S060000-E062959.0360.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250920-S210000-E212959.1260.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250921-S010000-E012959.0060.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250921-S200000-E202959.1200.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250922-S000000-E002959.0000.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250922-S050000-E052959.0300.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250922-S150000-E152959.0900.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250923-S010000-E012959.0060.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250923-S060000-E062959.0360.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250923-S143000-E145959.0870.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250924-S053000-E055959.0330.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250924-S080000-E082959.0480.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250924-S120000-E122959.0720.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250925-S090000-E092959.0540.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250925-S123000-E125959.0750.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250925-S183000-E185959.1110.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250925-S203000-E205959.1230.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250926-S003000-E005959.0030.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250926-S013000-E015959.0090.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250926-S040000-E042959.0240.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250926-S050000-E052959.0300.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250926-S083000-E085959.0510.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250926-S093000-E095959.0570.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250927-S193000-E195959.1170.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250928-S153000-E155959.0930.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250929-S060000-E062959.0360.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250929-S153000-E155959.0930.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250929-S230000-E232959.1380.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250930-S013000-E015959.0090.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250930-S070000-E072959.0420.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250930-S073000-E075959.0450.V07B.HDF5',
      '3B-HHR-L.MS.MRG.3IMERG.20250930-S130000-E132959.0780.V07B.HDF5',
    ];

    rawList.forEach((filename) => {
      const parsed = parseGPMFilename(filename);
      if (parsed) {
        this.gpmCatalog.push(parsed);
      }
    });
  }

  public registerWRFDataset(dataset: WRFDataset) {
    this.wrfDatasets.set(dataset.domain, dataset);
  }

  public registerGPMSlice(slice: GPMGridSlice) {
    this.gpmSlices.set(slice.fileInfo.isoStart, slice);
    if (!this.gpmCatalog.some((c) => c.filename === slice.fileInfo.filename)) {
      this.gpmCatalog.push(slice.fileInfo);
    }
  }

  public registerAWSObservation(isoTime: string, stationId: string, rainRate: number) {
    let map = this.awsObservations.get(isoTime);
    if (!map) {
      map = {};
      this.awsObservations.set(isoTime, map);
    }
    map[stationId] = rainRate;
  }

  public getDatasetStatus() {
    const wrfDomains = Array.from(this.wrfDatasets.keys());
    let totalWRFTimesteps = 0;
    const wrfDetails: any[] = [];

    this.wrfDatasets.forEach((ds, dom) => {
      totalWRFTimesteps += ds.timesteps.length;
      wrfDetails.push({
        domain: dom,
        filename: ds.filename,
        gridSize: `${ds.gridDimensions.nx} x ${ds.gridDimensions.ny}`,
        timestepsCount: ds.timesteps.length,
        variables: ds.variablesFound,
        hasRainc: ds.hasRainc,
        hasRainnc: ds.hasRainnc,
        hasT2: ds.hasT2,
        hasStaggeredWind: ds.hasStaggeredWind,
        timeRange: ds.timesteps.length > 0 ? {
          start: ds.timesteps[0].isoTime,
          end: ds.timesteps[ds.timesteps.length - 1].isoTime,
        } : null,
      });
    });

    const isRealWRFLoaded = this.wrfDatasets.size > 0;
    const isRealGPMLoaded = this.gpmSlices.size > 0;

    return {
      isRealDataLoaded: isRealWRFLoaded || isRealGPMLoaded,
      isRealWRFLoaded,
      isRealGPMLoaded,
      wrfDomains,
      totalWRFTimesteps,
      wrfDetails,
      gpmCatalogCount: this.gpmCatalog.length,
      gpmParsedSlicesCount: this.gpmSlices.size,
      gpmSampleCatalog: this.gpmCatalog.slice(0, 10),
      awsStationCount: KNOWN_AWS_STATIONS.length,
    };
  }

  public getWRFTimestep(domain: string, timeIso: string): WRFTimestep | null {
    const ds = this.wrfDatasets.get(domain) || this.wrfDatasets.get('d02') || this.wrfDatasets.values().next().value;
    if (!ds || ds.timesteps.length === 0) return null;

    const targetMs = new Date(timeIso).getTime();
    let closestStep: WRFTimestep | null = null;
    let minDiff = Infinity;

    for (const step of ds.timesteps) {
      const stepMs = new Date(step.isoTime).getTime();
      const diff = Math.abs(targetMs - stepMs);
      if (diff < minDiff) {
        minDiff = diff;
        closestStep = step;
      }
    }

    return closestStep;
  }

  /**
   * Evaluates WRF model rate and meteo parameters at (lat, lon)
   */
  public queryWRFPoint(domain: string, timeIso: string, lat: number, lon: number) {
    const step = this.getWRFTimestep(domain, timeIso);
    if (!step) return null;

    // Find nearest grid point (or bilinear)
    const { nx, ny, lats, lons } = step;
    let bestDist = Infinity;
    let bestIdx = 0;

    for (let i = 0; i < ny * nx; i++) {
      const d = Math.hypot(lats[i] - lat, lons[i] - lon);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }

    const y = Math.floor(bestIdx / nx);
    const x = bestIdx % nx;

    return {
      y,
      x,
      lat: lats[bestIdx],
      lon: lons[bestIdx],
      distance_km: bestDist * 111.0,
      rain_rate: Number(step.rainRate[bestIdx].toFixed(2)),
      accumulated_rain: Number(step.totalRain[bestIdx].toFixed(2)),
      rainc: Number(step.rainc[bestIdx].toFixed(2)),
      rainnc: Number(step.rainnc[bestIdx].toFixed(2)),
      temp_c: Number(step.tempC[bestIdx].toFixed(1)),
      u_wind: Number(step.uWind[bestIdx].toFixed(2)),
      v_wind: Number(step.vWind[bestIdx].toFixed(2)),
      wind_speed_kmh: Number(step.windSpeedKmh[bestIdx].toFixed(1)),
      wind_direction_deg: Math.round(step.windDirDeg[bestIdx]),
    };
  }

  /**
   * Queries GPM satellite observation at (lat, lon) for closest half-hourly timestep
   */
  public queryGPMPoint(timeIso: string, lat: number, lon: number): { observedRate: number; matchedFile?: string } {
    // Check if we have a parsed GPM HDF5 slice
    const targetMs = new Date(timeIso).getTime();
    let bestSlice: GPMGridSlice | null = null;
    let minDiff = Infinity;

    this.gpmSlices.forEach((slice) => {
      const startMs = new Date(slice.fileInfo.isoStart).getTime();
      const diff = Math.abs(targetMs - startMs);
      if (diff < minDiff && diff <= 45 * 60 * 1000) {
        minDiff = diff;
        bestSlice = slice;
      }
    });

    if (bestSlice && (bestSlice as GPMGridSlice).hasBinaryData) {
      const sl: GPMGridSlice = bestSlice;
      const { minLat, minLon, maxLat, maxLon, nLat, nLon } = sl.bbox;
      if (lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon) {
        const j = Math.max(0, Math.min(nLat - 1, Math.round((lat - minLat) / 0.1)));
        const i = Math.max(0, Math.min(nLon - 1, Math.round((lon - minLon) / 0.1)));
        const val = sl.rates[j * nLon + i];
        return {
          observedRate: Number((val || 0).toFixed(2)),
          matchedFile: sl.fileInfo.filename,
        };
      }
    }

    // If file is in catalog but raw HDF5 binary hasn't been uploaded yet:
    // return 0 or uncalibrated estimate if present
    return {
      observedRate: 0,
      matchedFile: this.gpmCatalog.find((c) => Math.abs(new Date(c.isoStart).getTime() - targetMs) < 30 * 60 * 1000)?.filename,
    };
  }

  /**
   * Queries AWS Ground Station Point observation
   */
  public queryAWSPoint(timeIso: string, stationId: string): number | null {
    const obsAtTime = this.awsObservations.get(timeIso);
    if (obsAtTime && obsAtTime[stationId] !== undefined) {
      return obsAtTime[stationId];
    }
    return null;
  }
}

export const centralDataStore = new CentralDataStore();
