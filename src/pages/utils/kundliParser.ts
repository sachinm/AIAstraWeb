export interface ParsedKundliData {
  metadata: {
    date: string;
    time: string;
    timeZone: string;
    place: string;
    coordinates: string;
    altitude: string;
    lunarYearMonth: string;
    tithi: string;
    vedicWeekday: string;
    nakshatra: string;
    yoga: string;
    karana: string;
    horaLord: string;
    mahakalaHora: string;
    kaalaLord: string;
    sunrise: string;
    sunset: string;
    janmaGhatis: string;
    ayanamsa: string;
    siderealTime: string;
  };
  planetaryPositions: Array<{
    body: string;
    longitude: string;
    nakshatra: string;
    pada: string;
    rasi: string;
    navamsa: string;
  }>;
  chartDrawing: string;
  vimshottariDasa: string[];
}

export function parseKundliText(rawText: string): ParsedKundliData {
  const lines = rawText.split('\n');
  const result: Partial<ParsedKundliData> = {
    metadata: {} as any,
    planetaryPositions: [],
    chartDrawing: '',
    vimshottariDasa: []
  };

  let currentSection: 'metadata' | 'planetary' | 'chart' | 'dasa' | null = 'metadata';

  for (const line of lines) {
    const trimmed = line.trim();
    
    if (!trimmed) continue;

    // Section detection
    if (trimmed === 'Natal Chart') continue;
    if (trimmed.includes('Body') && trimmed.includes('Longitude')) {
      currentSection = 'planetary';
      continue;
    }
    if (trimmed.includes('+-----------------------------------------------+')) {
      currentSection = 'chart';
      continue;
    }
    if (trimmed === 'Vimsottari Dasa ():') {
      currentSection = 'dasa';
      continue;
    }

    // Parse based on current section
    switch (currentSection) {
      case 'metadata':
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex > -1) {
          const key = trimmed.slice(0, colonIndex).trim();
          const value = trimmed.slice(colonIndex + 1).trim();
          (result.metadata as any)[key] = value;
        }
        break;

      case 'planetary':
        if (trimmed.length > 60) { // Ensure it's a data line
          result.planetaryPositions!.push({
            body: trimmed.slice(0, 24).trim(),
            longitude: trimmed.slice(24, 45).trim(),
            nakshatra: trimmed.slice(45, 55).trim(),
            pada: trimmed.slice(55, 60).trim(),
            rasi: trimmed.slice(60, 65).trim(),
            navamsa: trimmed.slice(65).trim()
          });
        }
        break;

      case 'chart':
        result.chartDrawing += trimmed + '\n';
        break;

      case 'dasa':
        if (trimmed.trim()) {
          result.vimshottariDasa!.push(trimmed);
        }
        break;
    }
  }

  return result as ParsedKundliData;
}