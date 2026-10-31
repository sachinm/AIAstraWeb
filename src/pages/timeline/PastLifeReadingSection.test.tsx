import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PastLifeReadingSection from './PastLifeReadingSection';
import * as pastReadingApi from '../../lib/pastReadingApi';

vi.mock('../../lib/pastReadingApi', async (orig) => ({
  ...(await orig<typeof import('../../lib/pastReadingApi')>()),
  fetchPastLifeReading: vi.fn(),
  generatePastLifeReading: vi.fn(),
  ratePastPrediction: vi.fn(),
}));

const sampleReport: pastReadingApi.PastLifeReadingReport = {
  kundliId: 'kundli-123',
  generatedAt: '2026-10-31T12:00:00Z',
  windowStart: '2008-10',
  windowEnd: '2026-10',
  charterOverview: {
    lagnaAndCondition: 'Virgo Lagna with exalted Mercury in 1st house; strong analytical resilience.',
    primaryConditionalDasha: 'Chara Dasha & Ashtottari active alongside Vimshottari.',
    mahadashaCharterSummary: 'Rahu Mahadasha (2008–2021) drove foreign relocation; Jupiter Mahadasha (2021–2026) stabilized career.',
    avasthaManifestationNote: 'Yuva & Jagrat avasthas on 10th lord deliver full tangible career fruit.',
  },
  epochs: [
    {
      id: 'epoch-1',
      label: 'Rahu Restructuring & Academic Leap',
      startYear: 2008,
      endYear: 2016,
      dominantDashaCharter: 'Rahu MD • Chara Aquarius-Capricorn',
      narrativeSummary: 'Intense relocation, engineering specialization, and sudden shifts in peer circles.',
      emotionalAndMentalTone: 'Restless ambition mixed with high mental pressure.',
    },
    {
      id: 'epoch-2',
      label: 'Jupiter Consolidation & Leadership',
      startYear: 2017,
      endYear: 2026,
      dominantDashaCharter: 'Jupiter MD • Chara Sagittarius',
      narrativeSummary: 'Founding of senior technical roles, wealth accumulation, and domestic anchoring.',
      emotionalAndMentalTone: 'Grounded purpose and strategic clarity.',
    },
  ],
  predictions: [
    {
      id: 'pred-career-2019',
      windowStart: '2019-04',
      windowEnd: '2019-09',
      domain: 'career_wealth',
      title: 'Major Role Promotion & Compensation Surge',
      prediction: 'A sudden elevation in engineering responsibility accompanied by a new compensation tier.',
      feelingAndPsychology: 'High urgency to prove yourself followed by relief and validation.',
      astrologicalBasis: {
        dashas: ['Vimshottari Rahu-Moon', 'Chara Sagittarius', 'Yogini Siddha'],
        annualChart: 'Varshaphal Muntha in 10th house with Rajayoga Saham activated.',
        transitsAndEclipses: ['Double Transit of Jupiter & Saturn aspecting 10th house', 'SAV 34 bindus in 11th'],
        vargasAndArudhas: ['D-10 lagna lord exalted', 'AL to A10 trine activation'],
        avasthaAndFruitTaste: 'Jagrat + Deepta avastha yielding sweet, immediate recognition.',
      },
      rating: 'unrated',
    },
    {
      id: 'pred-micro-2022',
      windowStart: '2022-07',
      windowEnd: '2022-11',
      domain: 'micro_signature',
      title: 'Footwear / Lower-Limb Strain & Sudden Vehicle Repair',
      prediction: 'Unusual spend on orthopedic shoes or ankle care alongside an unexpected vehicle repair.',
      feelingAndPsychology: 'Mild irritation at logistical friction during a busy travel month.',
      astrologicalBasis: {
        dashas: ['Vimshottari Jupiter-Saturn', 'Sudarshana Chakra 12th/4th axis'],
        annualChart: 'Tajaka 6th/12th Muntha axis with Mars Mudda Dasha.',
        transitsAndEclipses: ['Saturn transit over natal 12th house', 'Ketu eclipse on 4th axis'],
        vargasAndArudhas: ['D-16 (Shodashamsha) 8th house activation', 'D-30 Drekkana foot decanate'],
        avasthaAndFruitTaste: 'khala avastha producing brief mechanical/physical nuisance.',
      },
      rating: 'unrated',
    },
  ],
  scorecard: {
    total: 2,
    rated: 0,
    exactHits: 0,
    partialHits: 0,
    missed: 0,
    wrong: 0,
    accuracyScorePct: null,
  },
};

describe('PastLifeReadingSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the placeholder card when no reading exists and generates a report on click', async () => {
    const user = userEvent.setup();
    vi.mocked(pastReadingApi.fetchPastLifeReading).mockResolvedValueOnce(null);
    vi.mocked(pastReadingApi.generatePastLifeReading).mockResolvedValueOnce(sampleReport);

    render(<PastLifeReadingSection />);

    expect(await screen.findByRole('heading', { name: /Comprehensive 18-Year Past Life Reading/i })).toBeInTheDocument();
    expect(screen.getByText(/Coming soon — we're researching this/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Generate 18-Year Past Life Reading/i }));

    await waitFor(() => expect(pastReadingApi.generatePastLifeReading).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Virgo Lagna with exalted Mercury/i)).toBeInTheDocument();
    expect(screen.getByText(/Major Role Promotion & Compensation Surge/i)).toBeInTheDocument();
  });

  it('renders charter overview, scorecard, epochs, domain filter, and 3+ method astrological proof', async () => {
    const user = userEvent.setup();
    vi.mocked(pastReadingApi.fetchPastLifeReading).mockResolvedValueOnce(sampleReport);

    render(<PastLifeReadingSection />);

    expect(await screen.findByText(/Rahu Restructuring & Academic Leap/i)).toBeInTheDocument();
    expect(screen.getByText(/Jupiter Consolidation & Leadership/i)).toBeInTheDocument();

    // Expand 3+ method proof on first prediction
    const careerCard = screen.getByRole('article', { name: /Prediction: Major Role Promotion & Compensation Surge/i });
    const proofBtn = within(careerCard).getByRole('button', { name: /Show 3\+ Method Astrological Proof/i });
    await user.click(proofBtn);

    expect(within(careerCard).getByText(/Varshaphal Muntha in 10th house/i)).toBeInTheDocument();
    expect(within(careerCard).getByText(/Double Transit of Jupiter & Saturn/i)).toBeInTheDocument();

    // Filter by Micro Signatures
    await user.click(screen.getByRole('button', { name: /Micro Signatures \(Shoes, Friends, Accidents\)/i }));
    expect(screen.queryByText(/Major Role Promotion & Compensation Surge/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Footwear \/ Lower-Limb Strain & Sudden Vehicle Repair/i)).toBeInTheDocument();
  });

  it('saves prediction rating and reality/why audit notes via ratePastPrediction', async () => {
    const user = userEvent.setup();
    vi.mocked(pastReadingApi.fetchPastLifeReading).mockResolvedValueOnce(sampleReport);

    const updatedReport: pastReadingApi.PastLifeReadingReport = {
      ...sampleReport,
      predictions: [
        {
          ...sampleReport.predictions[0],
          rating: 'exact_hit',
          actualRealityNote: 'Promoted to Staff Engineer in June 2019',
          whyMissedOrWorkedNote: 'Triple dasha lock + Muntha in 10th nailed the month',
        },
        sampleReport.predictions[1],
      ],
      scorecard: {
        total: 2,
        rated: 1,
        exactHits: 1,
        partialHits: 0,
        missed: 0,
        wrong: 0,
        accuracyScorePct: 100,
      },
    };
    vi.mocked(pastReadingApi.ratePastPrediction).mockResolvedValueOnce(updatedReport);

    render(<PastLifeReadingSection />);

    const careerCard = await screen.findByRole('article', {
      name: /Prediction: Major Role Promotion & Compensation Surge/i,
    });

    const realityInput = within(careerCard).getByLabelText(/What happened in reality/i);
    const whyInput = within(careerCard).getByLabelText(/Why \/ what was missed/i);

    await user.type(realityInput, 'Promoted to Staff Engineer in June 2019');
    await user.type(whyInput, 'Triple dasha lock + Muntha in 10th nailed the month');
    await user.click(within(careerCard).getByRole('button', { name: 'Exact Hit' }));

    await waitFor(() =>
      expect(pastReadingApi.ratePastPrediction).toHaveBeenCalledWith({
        predictionId: 'pred-career-2019',
        rating: 'exact_hit',
        actualRealityNote: 'Promoted to Staff Engineer in June 2019',
        whyMissedOrWorkedNote: 'Triple dasha lock + Muntha in 10th nailed the month',
      })
    );

    expect(await screen.findByText(/Accuracy Score: 100%/i)).toBeInTheDocument();
  });
});
