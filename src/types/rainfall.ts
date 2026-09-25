export type ModelType = 'WRF';
export type ObservationType = 'GPM' | 'AWS';
export type MapLayerMode = 'WRF_MODEL' | 'GPM_OBSERVED' | 'DIFFERENCE_BIAS';
export type DomainType = 'd01' | 'd02' | 'd03';
export type VariableType = 'rain' | 'rainc' | 'rainnc' | 'temp' | 'humidity' | 'wind_speed';

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  cache_size?: number;
  uptime_seconds?: number;
  active_models?: string[];
  observation_sources?: string[];
}

export interface SummaryResponse {
  title: string;
  version: string;
  models: ModelType[];
  observation_sources: {
    gridded: string;
    point: string;
  };
  domains: Record<ModelType, DomainType[]>;
  variables: string[];
  valid_time_range: {
    start: string;
    end: string;
    step_minutes: number;
  };
  grid_resolutions: {
    d01: string;
    d02: string;
    d03: string;
    gpm_imerg: string;
  };
  station_count: number;
  cache_status: {
    cached_slices: number;
    memory_usage_mb: number;
  };
}

export interface CellRequest {
  model: ModelType;
  time: string;
  y: number;
  x: number;
  variable: string;
  domain?: DomainType | null;
  max_difference?: number;
}

export interface CellResponse {
  model: ModelType;
  time: string;
  requested_time: string;
  y: number;
  x: number;
  variable: string;
  value: number; // WRF Model value (mm/h)
  gpm_observed_value: number; // GPM Satellite gridded value (mm/h)
  bias_difference: number; // WRF - GPM (mm/h)
  unit: string;
  domain?: string;
  lat?: number;
  lon?: number;
  nearest_aws?: {
    id: string;
    name: string;
    observed_value: number;
    distance_km: number;
  };
  resolved_difference_minutes?: number;
}

export interface LatLonRequest {
  model: ModelType;
  domain: DomainType;
  time: string;
  lat: number;
  lon: number;
  variable: string;
  max_difference?: number;
}

export interface LatLonResponse {
  model: ModelType;
  domain: DomainType;
  time: string;
  lat: number;
  lon: number;
  nearest_grid: {
    x: number;
    y: number;
    grid_lat: number;
    grid_lon: number;
    distance_km: number;
  };
  variable: string;
  value: number; // WRF Model value
  gpm_observed_value: number; // GPM Satellite value
  bias_difference: number; // WRF - GPM
  unit: string;
  resolved_difference_minutes?: number;
}

export interface StationRequest {
  model: ModelType;
  time: string;
  variable: string;
  station_id?: string | null;
  station_name?: string | null;
  domain?: DomainType | null;
  max_difference?: number;
}

export interface StationResponse {
  model: ModelType;
  time: string;
  station_id: string;
  station_name: string;
  lat: number;
  lon: number;
  elevation_m?: number;
  variable: string;
  value: number; // Collocated WRF Model value (mm/h)
  aws_observed_value: number; // In-situ AWS gauge observation (mm/h)
  gpm_satellite_value: number; // Collocated GPM satellite observation (mm/h)
  bias_wrf_aws: number; // WRF - AWS (mm/h)
  bias_wrf_gpm: number; // WRF - GPM (mm/h)
  accumulated_24h_aws: number;
  accumulated_24h_wrf: number;
  accumulated_24h_gpm: number;
  accumulated_24h?: number;
  unit: string;
  domain?: string;
  grid_collocation: {
    x: number;
    y: number;
    distance_km: number;
  };
  quality_flag?: string;
  resolved_difference_minutes?: number;
}

export interface TimeseriesRequest {
  model: ModelType;
  start_time: string;
  end_time: string;
  variable: string;
  y?: number | null;
  x?: number | null;
  station_id?: string | null;
  station_name?: string | null;
  domain?: DomainType | null;
  max_difference?: number;
}

export interface TimeseriesPoint {
  time: string;
  value: number; // WRF model rate
  wrf_model: number; // WRF model rate (mm/h)
  gpm_observed: number; // GPM satellite rate (mm/h)
  aws_observed?: number; // AWS gauge rate (mm/h if station)
  bias: number; // WRF - Observation (mm/h)
  cumulative_value: number; // WRF cumulative
  wrf_cumulative: number;
  gpm_cumulative: number;
  aws_cumulative?: number;
  model: ModelType;
}

export interface TimeseriesResponse {
  model: ModelType;
  variable: string;
  unit: string;
  start_time: string;
  end_time: string;
  location: {
    type: 'station' | 'grid' | 'latlon';
    id?: string;
    name?: string;
    lat?: number;
    lon?: number;
    x?: number;
    y?: number;
  };
  summary: {
    total_accumulation: number;
    wrf_total: number;
    gpm_total: number;
    aws_total?: number;
    max_rate: number;
    max_rate_time: string;
    mean_rate: number;
    mean_bias: number;
    hours_with_rain: number;
  };
  series: TimeseriesPoint[];
}

export interface VerificationMetrics {
  sample_count: number;
  valid_time: string;
  mean_wrf: number; // Mean WRF forecast rate
  mean_aws: number; // Mean AWS observed rate
  mean_gpm: number; // Mean GPM satellite rate
  mean_bias_aws: number; // WRF - AWS Mean Error
  mean_bias_gpm: number; // WRF - GPM Mean Error
  mae_aws: number; // Mean Absolute Error vs AWS
  mae_gpm: number; // Mean Absolute Error vs GPM
  rmse_aws: number; // Root Mean Square Error vs AWS
  rmse_gpm: number; // Root Mean Square Error vs GPM
  correlation_aws: number; // Pearson r (WRF vs AWS)
  correlation_gpm: number; // Pearson r (WRF vs GPM)
  contingency_table: {
    threshold_label: string;
    threshold_mm: number;
    hits: number;
    false_alarms: number;
    misses: number;
    correct_negatives: number;
    pod: number; // Probability of Detection (Hits / (Hits + Misses))
    far: number; // False Alarm Ratio (False Alarms / (Hits + False Alarms))
    csi: number; // Critical Success Index / Threat Score (Hits / (Hits + Misses + False Alarms))
    frequency_bias: number; // (Hits + False Alarms) / (Hits + Misses)
  }[];
}

export interface StationValidationRow {
  id: string;
  name: string;
  district: string;
  state: string;
  lat: number;
  lon: number;
  elevation: number;
  aws_observed: number; // mm/h
  wrf_model: number; // mm/h
  gpm_satellite: number; // mm/h
  bias_aws: number; // WRF - AWS
  bias_gpm: number; // WRF - GPM
  accumulated_24h_aws: number;
  accumulated_24h_wrf: number;
  performance: 'ACCURATE' | 'OVERESTIMATED' | 'UNDERESTIMATED';
  alert: AlertSeverity;
}

export interface MeteogramPoint {
  time: string;
  rain_total: number;         // mm/h total precipitation
  rain_convective: number;    // mm/h convective rain component (rainc)
  rain_stratiform: number;    // mm/h large-scale stratiform rain (rainnc)
  cumulative_rain: number;    // mm accumulated precipitation
  temperature_2m: number;     // °C air temperature at 2m
  dewpoint_2m: number;        // °C dew point temperature at 2m
  relative_humidity: number;  // % relative humidity
  pressure_msl: number;       // hPa mean sea level pressure
  wind_speed_10m: number;     // km/h wind speed at 10m
  wind_gust_10m: number;      // km/h peak wind gust
  wind_direction_deg: number; // 0-360 degrees
  wind_direction_cardinal: string; // N, NE, E, SE, S, SW, W, NW, etc.
  cape: number;               // J/kg Convective Available Potential Energy
  cloud_cover: number;        // % total cloud cover fraction
  weather_condition: string;  // descriptive synopsis
}

export interface MeteogramResponse {
  model: ModelType;
  location: {
    type: 'station' | 'grid' | 'latlon';
    id?: string;
    name: string;
    lat: number;
    lon: number;
    elevation: number;
    district?: string;
    state?: string;
    x?: number;
    y?: number;
  };
  start_time: string;
  end_time: string;
  summary: {
    total_precipitation: number;
    max_rain_rate: number;
    max_rain_rate_time: string;
    min_temp: number;
    max_temp: number;
    max_wind_gust: number;
    max_cape: number;
    predominant_wind_dir: string;
    min_pressure: number;
  };
  series: MeteogramPoint[];
}

export interface StationItem {
  id: string;
  name: string;
  district: string;
  state: string;
  lat: number;
  lon: number;
  elevation: number;
  x_grid: number;
  y_grid: number;
  isFloodProne?: boolean;
}

export interface ApiCallLog {
  id: string;
  timestamp: string;
  endpoint: string;
  method: 'GET';
  url: string;
  params: Record<string, string | number | undefined | null>;
  status: number;
  latencyMs: number;
  isMock: boolean;
  response: any;
  error?: string;
}

export type AlertSeverity = 'NONE' | 'LIGHT' | 'MODERATE' | 'HEAVY' | 'VERY_HEAVY' | 'EXTREMELY_HEAVY';

export interface AlertThreshold {
  level: AlertSeverity;
  label: string;
  min: number;
  max: number;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  description: string;
}
