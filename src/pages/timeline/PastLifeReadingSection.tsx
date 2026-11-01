import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchPastLifeReading,
  generatePastLifeReading,
  ratePastPrediction,
  type BlindPredictionItem,
  type PastLifeReadingReport,
  type PredictionDomain,
  type PredictionRatingStatus,
} from '../../lib/pastReadingApi';

const panelCls = 'rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md sm:p-6';

export const DOMAIN_FILTERS: Array<{ key: 'all' | PredictionDomain; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'career_wealth', label: 'Career & Wealth' },
  { key: 'education_college', label: 'Education & College' },
  { key: 'relationships_family', label: 'Relationships & Family' },
  { key: 'relocation_vehicles', label: 'Relocation & Vehicles' },
  { key: 'health_psychology', label: 'Health & Psychology' },
  { key: 'micro_signature', label: 'Micro Signatures (Shoes, Friends, Accidents)' },
];

const RATING_OPTIONS: Array<{
  value: Exclude<PredictionRatingStatus, 'unrated'>;
  label: string;
  activeCls: string;
}> = [
  {
    value: 'exact_hit',
    label: 'Exact Hit',
    activeCls: 'border-emerald-400 bg-emerald-500/25 text-emerald-100',
  },
  {
    value: 'partial_hit',
    label: 'Partial Hit',
    activeCls: 'border-amber-400 bg-amber-500/25 text-amber-100',
  },
  {
    value: 'missed',
    label: 'Missed',
    activeCls: 'border-orange-400 bg-orange-500/25 text-orange-100',
  },
  {
    value: 'wrong',
    label: 'Wrong',
    activeCls: 'border-rose-400 bg-rose-500/25 text-rose-100',
  },
];

function domainBadgeLabel(domain: PredictionDomain): string {
  return DOMAIN_FILTERS.find((d) => d.key === domain)?.label ?? domain;
}

interface PredictionCardProps {
  item: BlindPredictionItem;
  onRate: (
    predictionId: string,
    rating: PredictionRatingStatus,
    actualRealityNote?: string,
    whyMissedOrWorkedNote?: string
  ) => Promise<void>;
  savingId: string | null;
}

const PredictionCard: React.FC<PredictionCardProps> = ({ item, onRate, savingId }) => {
  const [proofOpen, setProofOpen] = useState(false);
  const [rating, setRating] = useState<PredictionRatingStatus>(item.rating ?? 'unrated');
  const [realityNote, setRealityNote] = useState(item.actualRealityNote ?? '');
  const [whyNote, setWhyNote] = useState(item.whyMissedOrWorkedNote ?? '');

  useEffect(() => {
    setRating(item.rating ?? 'unrated');
    setRealityNote(item.actualRealityNote ?? '');
    setWhyNote(item.whyMissedOrWorkedNote ?? '');
  }, [item.rating, item.actualRealityNote, item.whyMissedOrWorkedNote]);

  const isSaving = savingId === item.id;

  const triggerSave = async (nextRating: PredictionRatingStatus) => {
    setRating(nextRating);
    await onRate(
      item.id,
      nextRating,
      realityNote.trim() ? realityNote.trim() : undefined,
      whyNote.trim() ? whyNote.trim() : undefined
    );
  };

  return (
    <article
      className="rounded-xl border border-white/10 bg-black/25 p-4 space-y-4"
      aria-label={`Prediction: ${item.title}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-purple-400/30 bg-purple-500/15 px-3 py-0.5 text-xs font-medium text-purple-200">
            {item.windowStart} – {item.windowEnd}
          </span>
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-0.5 text-xs text-gray-200">
            {domainBadgeLabel(item.domain)}
          </span>
        </div>
        {rating !== 'unrated' && (
          <span className="text-xs font-semibold uppercase tracking-wide text-purple-200">
            Rated: {RATING_OPTIONS.find((r) => r.value === rating)?.label ?? rating}
          </span>
        )}
      </div>

      <div>
        <h5 className="text-base font-semibold text-white">{item.title}</h5>
        <p className="mt-1 text-sm text-gray-200 leading-relaxed">{item.prediction}</p>
      </div>

      <div className="rounded-lg border border-indigo-400/20 bg-indigo-500/10 px-3.5 py-2.5 text-sm">
        <span className="font-medium text-indigo-200">Inner state &amp; psychology: </span>
        <span className="text-gray-200">{item.feelingAndPsychology}</span>
      </div>

      <div>
        <button
          type="button"
          aria-expanded={proofOpen}
          onClick={() => setProofOpen((prev) => !prev)}
          className="text-xs font-semibold text-purple-300 hover:text-purple-200 underline"
        >
          {proofOpen ? 'Hide 3+ Method Astrological Proof' : 'Show 3+ Method Astrological Proof'}
        </button>

        {proofOpen && (
          <div className="mt-3 space-y-2 rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-gray-200">
            <div>
              <span className="font-semibold text-purple-200">Multi-Dasha Convergence: </span>
              <span>{item.astrologicalBasis.dashas.join(' • ')}</span>
            </div>
            <div>
              <span className="font-semibold text-purple-200">Tajaka Annual Chart (Muntha / Mudda / Sahams): </span>
              <span>{item.astrologicalBasis.annualChart}</span>
            </div>
            <div>
              <span className="font-semibold text-purple-200">Transits, Ashtakavarga &amp; Eclipses: </span>
              <span>{item.astrologicalBasis.transitsAndEclipses.join(' • ')}</span>
            </div>
            <div>
              <span className="font-semibold text-purple-200">Vargas &amp; Jaimini Arudhas: </span>
              <span>{item.astrologicalBasis.vargasAndArudhas.join(' • ')}</span>
            </div>
            <div>
              <span className="font-semibold text-purple-200">Avastha &amp; Fruit Taste: </span>
              <span>{item.astrologicalBasis.avasthaAndFruitTaste}</span>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-white/10 pt-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`Rate prediction ${item.title}`}>
          <span className="text-xs font-medium text-gray-300 mr-1">Rate accuracy:</span>
          {RATING_OPTIONS.map((opt) => {
            const active = rating === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={isSaving}
                aria-pressed={active}
                onClick={() => void triggerSave(opt.value)}
                className={`rounded-lg border px-3 py-1 text-xs font-medium transition ${
                  active
                    ? opt.activeCls
                    : 'border-white/15 bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor={`reality-${item.id}`}
              className="block text-xs font-medium text-gray-300 mb-1"
            >
              What happened in reality
            </label>
            <input
              id={`reality-${item.id}`}
              type="text"
              value={realityNote}
              onChange={(e) => setRealityNote(e.target.value)}
              placeholder="Actual date, event details, or context…"
              className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label
              htmlFor={`why-${item.id}`}
              className="block text-xs font-medium text-gray-300 mb-1"
            >
              Why / what was missed
            </label>
            <input
              id={`why-${item.id}`}
              type="text"
              value={whyNote}
              onChange={(e) => setWhyNote(e.target.value)}
              placeholder="Timing offset, dasha lock, or nuance…"
              className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void triggerSave(rating)}
            className="rounded-lg border border-purple-400/30 bg-purple-500/20 px-3 py-1 text-xs font-medium text-purple-100 hover:bg-purple-500/30"
          >
            {isSaving ? 'Saving…' : 'Save Audit Notes'}
          </button>
        </div>
      </div>
    </article>
  );
};

const PastLifeReadingSection: React.FC = () => {
  const [report, setReport] = useState<PastLifeReadingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [domainFilter, setDomainFilter] = useState<'all' | PredictionDomain>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const existing = await fetchPastLifeReading();
      setReport(existing);
    } catch {
      // Unauthenticated or not generated yet — leave report null so the generate card is shown.
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const generated = await generatePastLifeReading();
      setReport(generated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate past life reading.');
    } finally {
      setGenerating(false);
    }
  };

  const handleRate = async (
    predictionId: string,
    rating: PredictionRatingStatus,
    actualRealityNote?: string,
    whyMissedOrWorkedNote?: string
  ) => {
    setSavingId(predictionId);
    setError(null);
    try {
      const updated = await ratePastPrediction({
        predictionId,
        rating,
        actualRealityNote,
        whyMissedOrWorkedNote,
      });
      setReport(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save prediction rating.');
    } finally {
      setSavingId(null);
    }
  };

  const filteredPredictions = useMemo(() => {
    if (!report) return [];
    if (domainFilter === 'all') return report.predictions;
    return report.predictions.filter((p) => p.domain === domainFilter);
  }, [report, domainFilter]);

  if (!report) {
    return (
      <div className={panelCls} aria-label="Comprehensive 18-Year Past Life Reading">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-lg font-semibold text-white">Comprehensive 18-Year Past Life Reading</h4>
            <p className="text-sm text-gray-300">
              Blind retrodiction of your past 18 years across career, education, family, relocation, health, and micro-events — synthesized before looking at your ledger so you can audit every hit and miss.
            </p>
            <p className="text-xs text-gray-400">
              Coming soon — we&apos;re researching this{loading ? ' • Checking saved reading…' : ''}
            </p>
          </div>
          <button
            type="button"
            disabled={generating}
            onClick={() => void handleGenerate()}
            className="rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
          >
            {generating ? 'Generating Reading…' : 'Generate 18-Year Past Life Reading'}
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {error}
          </p>
        )}
      </div>
    );
  }

  const { scorecard, charterOverview, epochs } = report;

  return (
    <div className={`${panelCls} space-y-6`} aria-label="Comprehensive 18-Year Past Life Reading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h4 className="text-lg font-semibold text-white">Comprehensive 18-Year Past Life Reading</h4>
          <p className="mt-0.5 text-xs text-gray-300">
            Coverage window: {report.windowStart} to {report.windowEnd}
          </p>
        </div>
        <button
          type="button"
          disabled={generating}
          onClick={() => void handleGenerate()}
          className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-white/10 disabled:opacity-50"
        >
          {generating ? 'Regenerating…' : 'Regenerate 18-Year Past Life Reading'}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}

      {/* Multi-School Dasha Charter & Avastha Overview */}
      <section
        aria-label="Multi-School Dasha Charter & Avastha Overview"
        className="rounded-xl border border-purple-400/25 bg-purple-950/20 p-4 space-y-2"
      >
        <h5 className="text-sm font-semibold text-purple-200">
          Multi-School Dasha Charter &amp; Avastha Overview
        </h5>
        <div className="grid gap-3 text-xs text-gray-200 sm:grid-cols-2">
          <div>
            <span className="font-semibold text-purple-300">Lagna &amp; Natal Promise: </span>
            <span>{charterOverview.lagnaAndCondition}</span>
          </div>
          <div>
            <span className="font-semibold text-purple-300">Primary Conditional &amp; Rashi Dashas: </span>
            <span>{charterOverview.primaryConditionalDasha}</span>
          </div>
          <div>
            <span className="font-semibold text-purple-300">18-Year Mahadasha Charter: </span>
            <span>{charterOverview.mahadashaCharterSummary}</span>
          </div>
          <div>
            <span className="font-semibold text-purple-300">Avastha &amp; Fruit Manifestation: </span>
            <span>{charterOverview.avasthaManifestationNote}</span>
          </div>
        </div>
      </section>

      {/* Anti-Sycophancy Claim Verification & 4-Tier Planetary Playbooks */}
      {report.claimVerificationAudit && (
        <section
          aria-label="Chart-First Counterparty & Network Disambiguation"
          className="rounded-xl border border-amber-400/25 bg-amber-950/20 p-4 space-y-2"
        >
          <h5 className="text-sm font-semibold text-amber-200">
            Chart-First Counterparty &amp; Network Disambiguation (Rule 0)
          </h5>
          <p className="text-xs text-gray-200">{report.claimVerificationAudit.ruleDirective}</p>
          <div className="grid gap-2 sm:grid-cols-3 pt-1">
            {report.claimVerificationAudit.disambiguatedEntities.map((ent) => (
              <div key={ent.trackId} className="rounded-lg border border-white/10 bg-black/25 p-3 space-y-1 text-xs">
                <div className="font-semibold text-amber-200">{ent.label}</div>
                <div className="text-indigo-200">{ent.astrologicalCircuit}</div>
                <div className="text-gray-300">{ent.verificationGuidance}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {report.jupiterBehavioralPlaybook && (
        <section
          aria-label="Jupiter H7 Behavioral Playbook & 2026-2029 Windows"
          className="rounded-xl border border-emerald-400/25 bg-emerald-950/15 p-4 space-y-2"
        >
          <h5 className="text-sm font-semibold text-emerald-200">
            Jupiter (H7 Mrita vs. D1–D60 H1) 4-Tier Behavioral Playbook
          </h5>
          <p className="text-xs text-gray-200">{report.jupiterBehavioralPlaybook.structuralDiagnosis}</p>
          <p className="text-xs text-emerald-200/90">{report.jupiterBehavioralPlaybook.vargaConfirmationSummary}</p>
          <div className="grid gap-2 sm:grid-cols-2 text-xs text-gray-200 pt-1">
            <div className="rounded-lg border border-white/10 bg-black/25 p-2.5">{report.jupiterBehavioralPlaybook.tiers.sattvicOptimal}</div>
            <div className="rounded-lg border border-white/10 bg-black/25 p-2.5">{report.jupiterBehavioralPlaybook.tiers.rajasicHighLeverage}</div>
            <div className="rounded-lg border border-white/10 bg-black/25 p-2.5">{report.jupiterBehavioralPlaybook.tiers.mediocrePassive}</div>
            <div className="rounded-lg border border-white/10 bg-black/25 p-2.5">{report.jupiterBehavioralPlaybook.tiers.baselineLossPrevention}</div>
          </div>
        </section>
      )}

      {report.venusBehavioralPlaybook && (
        <section
          aria-label="Venus H6 & D9 H2 Anti-Combustion & Family Kavacha Playbook"
          className="rounded-xl border border-pink-400/25 bg-pink-950/15 p-4 space-y-2"
        >
          <h5 className="text-sm font-semibold text-pink-200">
            Venus (Hora/Indu Lagna vs. 2025–2026 Eclipses &amp; 4 Family Charts Shield) Playbook
          </h5>
          <p className="text-xs text-gray-200">{report.venusBehavioralPlaybook.structuralDiagnosis}</p>
          <p className="text-xs text-pink-200/90">{report.venusBehavioralPlaybook.whyRaVe2025To2026WasPoorestAndEclipsed}</p>
          <p className="text-xs text-indigo-200">{report.venusBehavioralPlaybook.fourFamilyChartsSavingGrace}</p>
          <p className="text-xs text-emerald-200">{report.venusBehavioralPlaybook.remainingSubDashaPromise2026To2027}</p>
        </section>
      )}

      {report.marsSaturnBehavioralPlaybook && (
        <section
          aria-label="Mars-Saturn 1°15' Lock Raja-Guru Unlock & 15-Year Roadmap"
          className="rounded-xl border border-sky-400/25 bg-sky-950/15 p-4 space-y-2"
        >
          <h5 className="text-sm font-semibold text-sky-200">
            Mars + Saturn (1°15&apos; Lock) Raja-Guru Unlock &amp; 1-Month to 15-Year Roadmap
          </h5>
          <p className="text-xs text-gray-200">{report.marsSaturnBehavioralPlaybook.structuralDiagnosis}</p>
          <p className="text-xs text-sky-200/90">{report.marsSaturnBehavioralPlaybook.rajaGuruUnlockProtocol}</p>
          <p className="text-xs text-amber-200">{report.marsSaturnBehavioralPlaybook.familyAndSpouseProtectionRule}</p>
        </section>
      )}

      {/* Prediction Completeness & Accuracy Scorecard */}
      <section
        aria-label="Prediction Completeness & Accuracy Scorecard"
        className="rounded-xl border border-white/10 bg-black/20 p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h5 className="text-sm font-semibold text-white">
            Prediction Completeness &amp; Accuracy Scorecard
          </h5>
          <span className="text-xs font-semibold text-emerald-300">
            Accuracy Score:{' '}
            {scorecard.accuracyScorePct !== null ? `${scorecard.accuracyScorePct}%` : 'Unrated'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-6">
          <div className="rounded-lg border border-white/10 bg-white/5 p-2">
            <div className="text-gray-400">Total</div>
            <div className="mt-0.5 text-base font-semibold text-white">{scorecard.total}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-2">
            <div className="text-gray-400">Rated</div>
            <div className="mt-0.5 text-base font-semibold text-white">{scorecard.rated}</div>
          </div>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2">
            <div className="text-emerald-300">Exact Hits</div>
            <div className="mt-0.5 text-base font-semibold text-emerald-200">{scorecard.exactHits}</div>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2">
            <div className="text-amber-300">Partial Hits</div>
            <div className="mt-0.5 text-base font-semibold text-amber-200">{scorecard.partialHits}</div>
          </div>
          <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-2">
            <div className="text-orange-300">Missed</div>
            <div className="mt-0.5 text-base font-semibold text-orange-200">{scorecard.missed}</div>
          </div>
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2">
            <div className="text-rose-300">Wrong</div>
            <div className="mt-0.5 text-base font-semibold text-rose-200">{scorecard.wrong}</div>
          </div>
        </div>
      </section>

      {/* 18-Year Life Epochs */}
      {epochs.length > 0 && (
        <section aria-label="18-Year Life Epochs" className="space-y-3">
          <h5 className="text-sm font-semibold text-white">18-Year Life Epochs</h5>
          <div className="grid gap-3 sm:grid-cols-2">
            {epochs.map((ep) => (
              <div
                key={ep.id}
                className="rounded-xl border border-white/10 bg-black/20 p-3.5 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-purple-200">{ep.label}</span>
                  <span className="text-xs text-gray-400">
                    {ep.startYear}–{ep.endYear}
                  </span>
                </div>
                <p className="text-xs font-medium text-indigo-300">{ep.dominantDashaCharter}</p>
                <p className="text-xs text-gray-200">{ep.narrativeSummary}</p>
                <p className="text-xs italic text-gray-300">{ep.emotionalAndMentalTone}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Domain Filter */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Domain filter">
        {DOMAIN_FILTERS.map((f) => {
          const active = domainFilter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={active}
              onClick={() => setDomainFilter(f.key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                active
                  ? 'border-purple-400 bg-purple-600/30 text-white'
                  : 'border-white/15 bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Blind Event Prediction Cards */}
      <section aria-label="Blind Event Predictions" className="space-y-4">
        <h5 className="text-sm font-semibold text-white">
          Blind Event Predictions ({filteredPredictions.length})
        </h5>
        {filteredPredictions.length === 0 ? (
          <p className="text-xs text-gray-400">No predictions in this domain filter.</p>
        ) : (
          <div className="space-y-4">
            {filteredPredictions.map((item) => (
              <PredictionCard
                key={item.id}
                item={item}
                onRate={handleRate}
                savingId={savingId}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default PastLifeReadingSection;
