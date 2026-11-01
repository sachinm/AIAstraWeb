/**
 * Comprehensive 18-Year Past Life Reading & Prediction Scorecard REST client.
 * Contract: server `/api/timeline/past-reading*`
 */
import { buildApiHeaders } from './apiHeaders';
import { LedgerApiError, ledgerApiUrl } from './ledgerApi';

export type PredictionRatingStatus = 'unrated' | 'exact_hit' | 'partial_hit' | 'missed' | 'wrong';

export type PredictionDomain =
  | 'career_wealth'
  | 'education_college'
  | 'relationships_family'
  | 'relocation_vehicles'
  | 'health_psychology'
  | 'micro_signature';

export interface BlindPredictionItem {
  id: string;
  windowStart: string;
  windowEnd: string;
  domain: PredictionDomain;
  title: string;
  prediction: string;
  feelingAndPsychology: string;
  astrologicalBasis: {
    dashas: string[];
    annualChart: string;
    transitsAndEclipses: string[];
    vargasAndArudhas: string[];
    avasthaAndFruitTaste: string;
  };
  rating?: PredictionRatingStatus;
  actualRealityNote?: string;
  whyMissedOrWorkedNote?: string;
}

export interface PastLifeEpoch {
  id: string;
  label: string;
  startYear: number;
  endYear: number;
  dominantDashaCharter: string;
  narrativeSummary: string;
  emotionalAndMentalTone: string;
}

export interface DisambiguatedCounterpartyTrack {
  trackId: string;
  label: string;
  ageAndArchetype: string;
  astrologicalCircuit: string;
  verificationGuidance: string;
}

export interface JupiterWindowItem {
  id: string;
  windowStart: string;
  windowEnd: string;
  windowType: 'jupiter_supported' | 'caution_hazard';
  title: string;
  dashasAndAnnualCharts: string;
  transitsAndVargas: string;
  actionDirective: string;
}

export interface PastLifeReadingReport {
  kundliId: string;
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  charterOverview: {
    lagnaAndCondition: string;
    primaryConditionalDasha: string;
    mahadashaCharterSummary: string;
    avasthaManifestationNote: string;
  };
  claimVerificationAudit?: {
    ruleDirective: string;
    disambiguatedEntities: DisambiguatedCounterpartyTrack[];
  };
  jupiterBehavioralPlaybook?: {
    structuralDiagnosis: string;
    vargaConfirmationSummary: string;
    tiers: {
      sattvicOptimal: string;
      rajasicHighLeverage: string;
      mediocrePassive: string;
      baselineLossPrevention: string;
    };
    windows2026To2029: JupiterWindowItem[];
  };
  venusBehavioralPlaybook?: {
    structuralDiagnosis: string;
    whyRaVe2025To2026WasPoorestAndEclipsed: string;
    fourFamilyChartsSavingGrace: string;
    remainingSubDashaPromise2026To2027: string;
    tiers: {
      sattvicOptimal: string;
      rajasicHighLeverage: string;
      mediocrePassive: string;
      baselineLossPrevention: string;
    };
  };
  marsSaturnBehavioralPlaybook?: {
    structuralDiagnosis: string;
    rajaGuruUnlockProtocol: string;
    familyAndSpouseProtectionRule: string;
    tiers: {
      sattvicOptimal: string;
      rajasicHighLeverage: string;
      mediocrePassive: string;
      baselineLossPrevention: string;
    };
    roadmap1MonthTo15Years: Array<{
      horizon: string;
      window: string;
      dashaAndTransitStack: string;
      strategicDirective: string;
    }>;
  };
  pendingKarmaBehavioralPlaybook?: {
    structuralDiagnosis: string;
    whyNotCompleteLossAndHowItImproves: string;
    antiCombustionAndHouseActivations: {
      house1SelfIdentity: string;
      house4HomeMotherVehicles: string;
      house7MarriageContracts: string;
      house9DharmaFatherElders: string;
    };
    subDashaUnlockSequence: string;
    tiers: {
      sattvicOptimal: string;
      rajasicHighLeverage: string;
      mediocrePassive: string;
      baselineLossPrevention: string;
    };
  };
  epochs: PastLifeEpoch[];
  predictions: BlindPredictionItem[];
  scorecard: {
    total: number;
    rated: number;
    exactHits: number;
    partialHits: number;
    missed: number;
    wrong: number;
    accuracyScorePct: number | null;
  };
}

export interface RatePredictionInput {
  kundliId?: string;
  predictionId: string;
  rating: PredictionRatingStatus;
  actualRealityNote?: string;
  whyMissedOrWorkedNote?: string;
}

function getToken(): string {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (!token) throw new LedgerApiError(401);
  return token;
}

function unwrapReport(raw: PastLifeReadingReport | { report?: PastLifeReadingReport | null } | null): PastLifeReadingReport | null {
  if (!raw) return null;
  if (typeof raw === 'object' && 'report' in raw) {
    return raw.report ?? null;
  }
  if (typeof raw === 'object' && 'kundliId' in raw && Array.isArray(raw.predictions)) {
    return raw;
  }
  return null;
}

async function request<T>(method: string, path: string, payload?: unknown): Promise<T> {
  const token = getToken();
  const body = payload === undefined ? undefined : JSON.stringify(payload);
  const headers = await buildApiHeaders({ token, body, method });
  const res = await fetch(ledgerApiUrl(path), {
    method,
    headers,
    ...(body !== undefined ? { body } : {}),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: unknown; field?: unknown };
    throw new LedgerApiError(
      res.status,
      typeof j.error === 'string' ? j.error : undefined,
      typeof j.field === 'string' ? j.field : undefined
    );
  }
  return (await res.json()) as T;
}

function withKundli(path: string, kundliId?: string): string {
  return kundliId ? `${path}?kundliId=${encodeURIComponent(kundliId)}` : path;
}

/**
 * Fetch the existing 18-year past life reading report, or `null` if not generated yet / feature off (404).
 */
export async function fetchPastLifeReading(kundliId?: string): Promise<PastLifeReadingReport | null> {
  try {
    const raw = await request<PastLifeReadingReport | { report?: PastLifeReadingReport | null }>(
      'GET',
      withKundli('/api/timeline/past-reading', kundliId)
    );
    return unwrapReport(raw);
  } catch (e) {
    if (e instanceof LedgerApiError && e.status === 404) return null;
    throw e;
  }
}

/**
 * Generate (or regenerate) the comprehensive 18-year past life reading report.
 */
export async function generatePastLifeReading(kundliId?: string): Promise<PastLifeReadingReport> {
  const raw = await request<PastLifeReadingReport | { report: PastLifeReadingReport }>(
    'POST',
    '/api/timeline/past-reading/generate',
    kundliId ? { kundliId } : {}
  );
  const report = unwrapReport(raw);
  if (!report) {
    throw new LedgerApiError(500, 'invalid_past_reading_response');
  }
  return report;
}

/**
 * Rate a specific blind prediction and record what actually happened in reality & why it worked or missed.
 */
export async function ratePastPrediction(input: RatePredictionInput): Promise<PastLifeReadingReport> {
  const raw = await request<PastLifeReadingReport | { report: PastLifeReadingReport }>(
    'POST',
    '/api/timeline/past-reading/rate',
    input
  );
  const report = unwrapReport(raw);
  if (!report) {
    throw new LedgerApiError(500, 'invalid_past_reading_response');
  }
  return report;
}
