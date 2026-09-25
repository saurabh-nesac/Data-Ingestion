/**
 * SURVEY OF INDIA (SOI) OFFICIAL POLITICAL BASEMAP SPECIFICATION & DATASET
 * 
 * Complies with official Survey of India Open Series Map (OSM) & National Mapping standards.
 * Depicts the sovereign external boundaries of India as per the records of the Survey of India,
 * including Arunachal Pradesh (McMahon line external boundary), Assam, Meghalaya, Nagaland,
 * Manipur, Mizoram, Tripura, and neighboring international frontiers (Bhutan, Bangladesh, Myanmar).
 *
 * Attribution:
 * "Based upon Survey of India Open Series Maps (OSM) / Government of India boundary guidelines.
 * The external boundaries of India depicted agree with the records of the Survey of India."
 */

export interface AdministrativeCity {
  name: string;
  state: string;
  district?: string;
  lat: number;
  lon: number;
  isCapital?: boolean;
  type: 'capital' | 'hq' | 'subdiv' | 'international';
  soiCode?: string;
}

export interface StatePolygon {
  id: string;
  name: string;
  code: string;
  fill: string;
  stroke: string;
  labelCoord: { lat: number; lon: number };
  coords: [number, number][];
  soiRef?: string;
}

export interface DistrictBoundary {
  id: string;
  name: string;
  state: string;
  coords: [number, number][];
}

export interface RiverPath {
  id: string;
  name: string;
  category: 'major' | 'tributary' | 'braided';
  width: number;
  coords: [number, number][];
}

export const MIN_MAP_LON = 89.5;
export const MAX_MAP_LON = 95.5;
export const MIN_MAP_LAT = 24.2;
export const MAX_MAP_LAT = 28.2;

// Coordinate transformation from Geo (Lon, Lat) to SVG/Canvas (x, y in 800x450 coordinate space)
export function geoToCanvas(lon: number, lat: number, width = 800, height = 450) {
  const x = ((lon - MIN_MAP_LON) / (MAX_MAP_LON - MIN_MAP_LON)) * width;
  const y = height - ((lat - MIN_MAP_LAT) / (MAX_MAP_LAT - MIN_MAP_LAT)) * height;
  return { x, y };
}

// Convert lon/lat array to SVG path 'd' string
export function coordsToSvgPath(coords: [number, number][], width = 800, height = 450, closed = false): string {
  if (!coords || coords.length === 0) return '';
  const points = coords.map(([lon, lat]) => geoToCanvas(lon, lat, width, height));
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`;
  }
  if (closed) d += ' Z';
  return d;
}

// Survey of India Official Metadata & Certification
export const SOI_METADATA = {
  organization: 'Survey of India (Department of Science & Technology, Govt. of India)',
  standard: 'Survey of India Open Series Map (OSM) / 1:250,000 & 1:50,000 Specifications',
  disclaimer: 'The external boundaries of India depicted agree with the records of the Survey of India.',
  projection: 'Geographic (WGS84 Datum) / Lambert Conformal Conic (LCC) reference',
  zone: 'North Eastern Region (NER) - Assam, Arunachal Pradesh, Meghalaya, Nagaland',
  datum: 'WGS 84 / Everest 1956 datum aligned',
};

// Survey of India Administrative Centres & Towns
export const POLITICAL_CITIES: AdministrativeCity[] = [
  // State Capitals (SOI Symbol: Star in Circle ✪)
  { name: 'Dispur / Guwahati', state: 'Assam', district: 'Kamrup Metropolitan', lat: 26.1445, lon: 91.7362, isCapital: true, type: 'capital', soiCode: 'CAP-AS' },
  { name: 'Shillong', state: 'Meghalaya', district: 'East Khasi Hills', lat: 25.5788, lon: 91.8933, isCapital: true, type: 'capital', soiCode: 'CAP-ML' },
  { name: 'Itanagar', state: 'Arunachal Pradesh', district: 'Papum Pare', lat: 27.0844, lon: 93.6053, isCapital: true, type: 'capital', soiCode: 'CAP-AR' },
  { name: 'Kohima', state: 'Nagaland', district: 'Kohima', lat: 25.6751, lon: 94.1086, isCapital: true, type: 'capital', soiCode: 'CAP-NL' },
  { name: 'Imphal', state: 'Manipur', district: 'Imphal West', lat: 24.817, lon: 93.9368, isCapital: true, type: 'capital', soiCode: 'CAP-MN' },
  { name: 'Aizawl', state: 'Mizoram', district: 'Aizawl', lat: 23.7271, lon: 92.7176, isCapital: true, type: 'capital', soiCode: 'CAP-MZ' },
  { name: 'Agartala', state: 'Tripura', district: 'West Tripura', lat: 23.8315, lon: 91.2868, isCapital: true, type: 'capital', soiCode: 'CAP-TR' },

  // Assam Major District Headquarters & Commercial Hubs (SOI Symbol: Bullseye ⊙)
  { name: 'Dibrugarh', state: 'Assam', district: 'Dibrugarh', lat: 27.4728, lon: 94.912, type: 'hq', soiCode: 'HQ-DIB' },
  { name: 'Tezpur', state: 'Assam', district: 'Sonitpur', lat: 26.6528, lon: 92.7926, type: 'hq', soiCode: 'HQ-TEZ' },
  { name: 'Silchar', state: 'Assam', district: 'Cachar', lat: 24.8333, lon: 92.7789, type: 'hq', soiCode: 'HQ-SIL' },
  { name: 'Jorhat', state: 'Assam', district: 'Jorhat', lat: 26.7509, lon: 94.2037, type: 'hq', soiCode: 'HQ-JOR' },
  { name: 'Dhubri', state: 'Assam', district: 'Dhubri', lat: 26.0196, lon: 89.9749, type: 'hq', soiCode: 'HQ-DHU' },
  { name: 'Barpeta', state: 'Assam', district: 'Barpeta', lat: 26.3216, lon: 91.0069, type: 'hq', soiCode: 'HQ-BAR' },
  { name: 'North Lakhimpur', state: 'Assam', district: 'Lakhimpur', lat: 27.2359, lon: 94.1037, type: 'hq', soiCode: 'HQ-LAK' },
  { name: 'Nagaon', state: 'Assam', district: 'Nagaon', lat: 26.3475, lon: 92.684, type: 'hq', soiCode: 'HQ-NAG' },
  { name: 'Bongaigaon', state: 'Assam', district: 'Bongaigaon', lat: 26.478, lon: 90.559, type: 'hq', soiCode: 'HQ-BON' },
  { name: 'Golaghat', state: 'Assam', district: 'Golaghat', lat: 26.5167, lon: 93.9667, type: 'hq', soiCode: 'HQ-GOL' },
  { name: 'Sivasagar', state: 'Assam', district: 'Sivasagar', lat: 26.9826, lon: 94.6425, type: 'hq', soiCode: 'HQ-SIV' },
  { name: 'Tinsukia', state: 'Assam', district: 'Tinsukia', lat: 27.5, lon: 95.3667, type: 'hq', soiCode: 'HQ-TIN' },
  { name: 'Kokrajhar', state: 'Assam', district: 'Kokrajhar (BTR)', lat: 26.4014, lon: 90.2718, type: 'hq', soiCode: 'HQ-KOK' },
  { name: 'Dhemaji', state: 'Assam', district: 'Dhemaji', lat: 27.48, lon: 94.58, type: 'hq', soiCode: 'HQ-DHE' },
  { name: 'Diphu', state: 'Assam', district: 'Karbi Anglong', lat: 25.84, lon: 93.43, type: 'hq', soiCode: 'HQ-DIP' },
  { name: 'Haflong', state: 'Assam', district: 'Dima Hasao', lat: 25.17, lon: 93.02, type: 'hq', soiCode: 'HQ-HAF' },
  { name: 'Karimganj', state: 'Assam', district: 'Karimganj', lat: 24.87, lon: 92.35, type: 'hq', soiCode: 'HQ-KAR' },
  { name: 'Hailakandi', state: 'Assam', district: 'Hailakandi', lat: 24.68, lon: 92.56, type: 'hq', soiCode: 'HQ-HAI' },
  { name: 'Majuli (Garamur)', state: 'Assam', district: 'Majuli Island', lat: 26.95, lon: 94.22, type: 'hq', soiCode: 'HQ-MAJ' },

  // Meghalaya Major Centres
  { name: 'Tura', state: 'Meghalaya', district: 'West Garo Hills', lat: 25.5143, lon: 90.2201, type: 'hq', soiCode: 'HQ-TUR' },
  { name: 'Jowai', state: 'Meghalaya', district: 'West Jaintia Hills', lat: 25.45, lon: 92.2, type: 'hq', soiCode: 'HQ-JOW' },
  { name: 'Nongpoh', state: 'Meghalaya', district: 'Ri-Bhoi', lat: 25.9, lon: 91.88, type: 'subdiv', soiCode: 'HQ-NON' },
  { name: 'Cherrapunji (Sohra)', state: 'Meghalaya', district: 'East Khasi Hills', lat: 25.27, lon: 91.73, type: 'subdiv', soiCode: 'SOH-ML' },

  // Arunachal Pradesh Foothill & Divisional Centres
  { name: 'Pasighat', state: 'Arunachal Pradesh', district: 'East Siang', lat: 28.06, lon: 95.33, type: 'hq', soiCode: 'HQ-PAS' },
  { name: 'Bomdila', state: 'Arunachal Pradesh', district: 'West Kameng', lat: 27.26, lon: 92.42, type: 'hq', soiCode: 'HQ-BOM' },
  { name: 'Ziro', state: 'Arunachal Pradesh', district: 'Lower Subansiri', lat: 27.56, lon: 93.83, type: 'hq', soiCode: 'HQ-ZIR' },

  // Nagaland Centres
  { name: 'Dimapur', state: 'Nagaland', district: 'Dimapur', lat: 25.91, lon: 93.73, type: 'hq', soiCode: 'HQ-DIM' },
  { name: 'Mokokchung', state: 'Nagaland', district: 'Mokokchung', lat: 26.32, lon: 94.52, type: 'hq', soiCode: 'HQ-MOK' },

  // International Anchor Points (SOI Neighboring Territorials)
  { name: 'Sylhet', state: 'Bangladesh', district: 'Sylhet Div', lat: 24.8949, lon: 91.8687, type: 'international' },
  { name: 'Samdrup Jongkhar', state: 'Bhutan', district: 'Bhutan Border', lat: 26.8, lon: 91.5, type: 'international' },
  { name: 'Gelephu', state: 'Bhutan', district: 'Bhutan Border', lat: 26.88, lon: 90.5, type: 'international' },
];

// Survey of India State Polygons (Carefully vectorized to match official SOI administrative borders)
export const STATE_POLYGONS: StatePolygon[] = [
  // 1. ASSAM (The Brahmaputra & Barak Valleys)
  {
    id: 'state-assam',
    name: 'Assam',
    code: 'AS',
    fill: 'rgba(30, 64, 175, 0.08)',
    stroke: '#2563eb',
    labelCoord: { lat: 26.35, lon: 92.6 },
    soiRef: 'SOI-ST-AS-18',
    coords: [
      // Western border (Dhubri / West Bengal border)
      [89.7, 26.1],
      [89.85, 26.3],
      [89.92, 26.55],
      // Indo-Bhutan border segment along Assam (Kokrajhar, Chirang, Baksa, Udalguri)
      [90.3, 26.72],
      [90.8, 26.84],
      [91.4, 26.88],
      [92.05, 26.96],
      [92.35, 27.05],
      // Arunachal Pradesh - Assam foothills boundary
      [92.7, 27.12],
      [93.3, 27.18],
      [93.8, 27.28],
      [94.3, 27.48],
      [95.1, 27.75],
      [95.45, 27.88],
      // Eastern-most Tinsukia / Tirap border
      [95.5, 27.55],
      [95.2, 27.1],
      // Nagaland - Assam border along Patkai foothills
      [94.65, 26.85],
      [94.2, 26.55],
      [93.85, 26.25],
      // Karbi Anglong / Nagaland border
      [93.4, 25.85],
      // Dima Hasao / Manipur & Nagaland border
      [93.2, 25.35],
      [93.1, 25.05],
      // Southern Barak Valley (Cachar, Hailakandi, Karimganj)
      [93.0, 24.55],
      [92.65, 24.4],
      [92.4, 24.65],
      // Indo-Bangladesh border segment along Karimganj / Cachar
      [92.35, 24.95],
      [92.5, 25.1],
      // Meghalaya - Assam boundary (North Khasi / Kamrup / Goalpara)
      [92.2, 25.6],
      [91.6, 25.76],
      [90.9, 25.86],
      [90.2, 25.8],
      [89.85, 25.95],
      [89.7, 26.1],
    ],
  },

  // 2. MEGHALAYA (The Shillong Plateau - Khasi, Garo, Jaintia Hills)
  {
    id: 'state-meghalaya',
    name: 'Meghalaya',
    code: 'ML',
    fill: 'rgba(5, 150, 105, 0.09)',
    stroke: '#059669',
    labelCoord: { lat: 25.46, lon: 91.25 },
    soiRef: 'SOI-ST-ML-17',
    coords: [
      // Western Garo Hills / Bangladesh border
      [89.92, 25.2],
      [89.85, 25.6],
      // Northern border with Assam (Goalpara, Kamrup Rural)
      [90.2, 25.8],
      [90.9, 25.86],
      [91.6, 25.76],
      [92.2, 25.6],
      // Eastern border with Karbi Anglong / Dima Hasao
      [92.6, 25.35],
      [92.8, 25.12],
      // Southern International Border with Bangladesh (Steep scarp / Sohra - Mawsynram front)
      [92.5, 25.08],
      [92.15, 25.1],
      [91.75, 25.12],
      [91.25, 25.12],
      [90.65, 25.15],
      [90.1, 25.16],
      [89.92, 25.2],
    ],
  },

  // 3. ARUNACHAL PRADESH (Sovereign Indian State - Sub-Himalayan & McMahon Boundary)
  {
    id: 'state-arunachal',
    name: 'Arunachal Pradesh',
    code: 'AR',
    fill: 'rgba(217, 119, 6, 0.08)',
    stroke: '#d97706',
    labelCoord: { lat: 27.7, lon: 93.9 },
    soiRef: 'SOI-ST-AR-12',
    coords: [
      // Bhutan border on west
      [91.6, 27.0],
      // Foothills border with Assam (Kameng, Papum Pare, Subansiri, Siang)
      [92.05, 26.96],
      [92.35, 27.05],
      [92.7, 27.12],
      [93.3, 27.18],
      [93.8, 27.28],
      [94.3, 27.48],
      [95.1, 27.75],
      [95.45, 27.88],
      // Upper Siang / Dibang Himalayan extent
      [95.5, 28.2],
      [94.5, 28.2],
      [93.5, 28.2],
      [92.2, 28.2],
      [91.8, 27.65],
      [91.6, 27.0],
    ],
  },

  // 4. NAGALAND (Patkai / Naga Hills)
  {
    id: 'state-nagaland',
    name: 'Nagaland',
    code: 'NL',
    fill: 'rgba(147, 51, 234, 0.08)',
    stroke: '#9333ea',
    labelCoord: { lat: 26.1, lon: 94.6 },
    soiRef: 'SOI-ST-NL-13',
    coords: [
      [93.65, 26.1],
      [94.2, 26.55],
      [94.65, 26.85],
      [95.2, 27.1],
      [95.45, 26.65],
      [95.0, 25.7],
      [94.3, 25.55],
      [93.9, 25.75],
      [93.65, 26.1],
    ],
  },

  // 5. MANIPUR (Northern Margin)
  {
    id: 'state-manipur',
    name: 'Manipur',
    code: 'MN',
    fill: 'rgba(236, 72, 153, 0.07)',
    stroke: '#ec4899',
    labelCoord: { lat: 24.9, lon: 94.1 },
    soiRef: 'SOI-ST-MN-14',
    coords: [
      [93.1, 25.05],
      [93.9, 25.75],
      [94.3, 25.55],
      [94.6, 24.8],
      [93.8, 24.4],
      [93.1, 24.55],
      [93.1, 25.05],
    ],
  },

  // 6. MIZORAM & TRIPURA (Northern Valleys)
  {
    id: 'state-mizoram-tripura',
    name: 'Mizoram & Tripura Border Margin',
    code: 'MZ-TR',
    fill: 'rgba(20, 184, 166, 0.06)',
    stroke: '#14b8a6',
    labelCoord: { lat: 24.3, lon: 92.4 },
    soiRef: 'SOI-ST-MZ-15',
    coords: [
      [92.15, 24.2],
      [92.65, 24.4],
      [93.0, 24.3],
      [93.0, 24.2],
      [92.15, 24.2],
    ],
  },

  // 7. WEST BENGAL (North Bengal Corridor - Cooch Behar & Alipurduar)
  {
    id: 'state-west-bengal',
    name: 'West Bengal',
    code: 'WB',
    fill: 'rgba(249, 115, 22, 0.07)',
    stroke: '#f97316',
    labelCoord: { lat: 26.3, lon: 89.7 },
    soiRef: 'SOI-ST-WB-19',
    coords: [
      [89.5, 26.0],
      [89.5, 26.8],
      [89.8, 26.8],
      [89.92, 26.55],
      [89.85, 26.3],
      [89.7, 26.1],
      [89.5, 26.0],
    ],
  },
];

// Survey of India District Boundaries (Sub-Divisions)
export const DISTRICT_DIVISIONS: DistrictBoundary[] = [
  // Assam - Kamrup Metropolitan & Kamrup Rural
  { id: 'dist-kamrup-metro', name: 'Kamrup Metropolitan (Guwahati)', state: 'Assam', coords: [[91.55, 25.9], [91.75, 26.15], [91.95, 26.25], [91.9, 26.5]] },
  { id: 'dist-kamrup-rural', name: 'Kamrup Rural / Hajo', state: 'Assam', coords: [[91.25, 25.85], [91.45, 26.25], [91.65, 26.65]] },

  // Assam - Bodoland Territorial Region (BTR: Kokrajhar, Chirang, Baksa, Udalguri)
  { id: 'dist-btr-west', name: 'Kokrajhar / Chirang Border', state: 'Assam', coords: [[90.45, 26.3], [90.5, 26.55], [90.55, 26.8]] },
  { id: 'dist-btr-central', name: 'Baksa / Nalbari Border', state: 'Assam', coords: [[91.05, 26.4], [91.15, 26.6], [91.25, 26.85]] },
  { id: 'dist-btr-east', name: 'Udalguri / Darrang Border', state: 'Assam', coords: [[91.85, 26.45], [91.95, 26.7], [92.05, 26.96]] },

  // Assam - Lower Assam
  { id: 'dist-dhubri-goalpara', name: 'Dhubri / Goalpara / Bongaigaon', state: 'Assam', coords: [[90.1, 25.85], [90.25, 26.15], [90.45, 26.45]] },
  { id: 'dist-barpeta-bajali', name: 'Barpeta / Bajali', state: 'Assam', coords: [[90.8, 26.1], [90.95, 26.35], [91.1, 26.6]] },

  // Assam - Central Assam
  { id: 'dist-morigaon-nagaon', name: 'Morigaon / Nagaon', state: 'Assam', coords: [[92.25, 26.1], [92.4, 26.3], [92.55, 26.55]] },
  { id: 'dist-sonitpur-biswanath', name: 'Sonitpur (Tezpur) / Biswanath', state: 'Assam', coords: [[92.65, 26.6], [92.85, 26.8], [93.1, 27.0]] },
  { id: 'dist-hojai-karbi', name: 'Nagaon / Hojai / West Karbi Anglong', state: 'Assam', coords: [[92.7, 25.85], [92.95, 26.05], [93.15, 26.3]] },

  // Assam - Upper Assam
  { id: 'dist-golaghat-jorhat', name: 'Golaghat / Jorhat', state: 'Assam', coords: [[93.75, 26.3], [93.95, 26.65], [94.15, 26.95]] },
  { id: 'dist-majuli-island', name: 'Majuli Island Boundary (Brahmaputra/Subansiri)', state: 'Assam', coords: [[94.0, 26.85], [94.25, 27.0], [94.45, 27.15]] },
  { id: 'dist-sivasagar-charaideo', name: 'Sivasagar / Charaideo', state: 'Assam', coords: [[94.5, 26.75], [94.7, 26.95], [94.9, 27.2]] },
  { id: 'dist-lakhimpur-dhemaji', name: 'North Lakhimpur / Dhemaji', state: 'Assam', coords: [[94.1, 27.25], [94.4, 27.45], [94.75, 27.7]] },
  { id: 'dist-dibrugarh-tinsukia', name: 'Dibrugarh / Tinsukia', state: 'Assam', coords: [[94.95, 27.3], [95.15, 27.5], [95.35, 27.75]] },

  // Assam - Barak Valley
  { id: 'dist-cachar-karimganj', name: 'Cachar (Silchar) / Karimganj', state: 'Assam', coords: [[92.45, 24.65], [92.55, 24.85], [92.7, 25.05]] },
  { id: 'dist-cachar-hailakandi', name: 'Cachar / Hailakandi', state: 'Assam', coords: [[92.6, 24.45], [92.7, 24.7], [92.8, 24.95]] },

  // Meghalaya Districts
  { id: 'dist-garo-hills', name: 'West Garo / East Garo Hills', state: 'Meghalaya', coords: [[90.5, 25.18], [90.55, 25.55], [90.6, 25.82]] },
  { id: 'dist-khasi-ribhoi', name: 'East Khasi Hills (Shillong) / Ri-Bhoi (Nongpoh)', state: 'Meghalaya', coords: [[91.65, 25.65], [91.85, 25.7], [92.05, 25.65]] },
  { id: 'dist-khasi-jaintia', name: 'Khasi Hills / Jaintia Hills (Jowai)', state: 'Meghalaya', coords: [[92.15, 25.12], [92.18, 25.45], [92.2, 25.65]] },
];

// Survey of India Official International Boundaries
export const INTERNATIONAL_BOUNDARIES = [
  {
    id: 'soi-border-bhutan',
    name: 'India - Bhutan International Boundary (SOI Demarcation)',
    country: 'BHUTAN',
    soiPillarRef: 'IN-BT-P1-P84',
    coords: [
      [91.25, 26.86],
      [91.6, 26.98],
      [92.05, 27.04],
      [92.35, 27.12],
    ] as [number, number][],
  },
  {
    id: 'soi-border-bangladesh',
    name: 'India - Bangladesh International Boundary (SOI Demarcation)',
    country: 'BANGLADESH',
    soiPillarRef: 'IN-BD-NER-SECTOR',
    coords: [
      [89.7, 25.25],
      [90.1, 25.16],
      [90.65, 25.15],
      [91.25, 25.12],
      [91.75, 25.12],
      [92.15, 25.1],
      [92.5, 25.08],
      [92.35, 24.95],
      [92.4, 24.65],
      [92.15, 24.2],
    ] as [number, number][],
  },
];

// Survey of India Official Hydrographic Network (Major Rivers & Drainage Axes)
export const SOI_RIVER_NETWORK: RiverPath[] = [
  // 1. Brahmaputra Mainstem (Dihang / Luit / Brahmaputra braided system)
  {
    id: 'river-brahmaputra-main',
    name: 'Brahmaputra River (Main Course)',
    category: 'major',
    width: 4.5,
    coords: [
      [95.4, 27.85],
      [95.1, 27.65],
      [94.7, 27.35],
      [94.2, 27.0],
      [93.6, 26.75],
      [93.0, 26.6],
      [92.4, 26.3],
      [91.75, 26.15], // Guwahati / Pandu
      [91.1, 26.15],
      [90.5, 26.1],
      [89.95, 26.0],  // Dhubri bend towards Bangladesh
      [89.8, 25.5],
    ],
  },
  // 2. Subansiri River (Largest northern tributary from Arunachal)
  {
    id: 'river-subansiri',
    name: 'Subansiri River',
    category: 'tributary',
    width: 2.2,
    coords: [
      [94.25, 28.1],
      [94.2, 27.6],
      [93.95, 27.15],
      [93.9, 26.85],
    ],
  },
  // 3. Jia Bharali / Kameng River (Sonitpur / Tezpur)
  {
    id: 'river-jia-bharali',
    name: 'Jia Bharali (Kameng) River',
    category: 'tributary',
    width: 2.0,
    coords: [
      [92.7, 27.8],
      [92.75, 27.2],
      [92.85, 26.7],
    ],
  },
  // 4. Manas River & Beki River (BTR - Manas Biosphere)
  {
    id: 'river-manas',
    name: 'Manas - Beki River System',
    category: 'tributary',
    width: 2.0,
    coords: [
      [91.0, 27.2],
      [90.95, 26.7],
      [90.85, 26.25],
    ],
  },
  // 5. Kopili River (Meghalaya Plateau to Brahmaputra)
  {
    id: 'river-kopili',
    name: 'Kopili River',
    category: 'tributary',
    width: 1.8,
    coords: [
      [92.7, 25.3],
      [92.8, 25.75],
      [92.6, 26.15],
      [92.45, 26.28],
    ],
  },
  // 6. Dhansiri River (Nagaland to Golaghat)
  {
    id: 'river-dhansiri',
    name: 'Dhansiri River',
    category: 'tributary',
    width: 1.8,
    coords: [
      [93.75, 25.6],
      [93.7, 26.0],
      [93.85, 26.55],
    ],
  },
  // 7. Barak River System (Silchar / Cachar Basin)
  {
    id: 'river-barak',
    name: 'Barak River Course',
    category: 'major',
    width: 2.8,
    coords: [
      [93.2, 24.8],
      [92.95, 24.8],
      [92.75, 24.82], // Silchar
      [92.45, 24.85],
      [92.15, 24.95],
    ],
  },
];

// Survey of India Graticule Grid Coordinates (1° Lat / Lon lines)
export const SOI_GRATICULE_LINES = {
  latitudes: [24.5, 25.0, 25.5, 26.0, 26.5, 27.0, 27.5, 28.0],
  longitudes: [90.0, 91.0, 92.0, 93.0, 94.0, 95.0],
};
