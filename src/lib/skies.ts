/** The home page scenes, in the order they play. Art and labels only: nothing here reads a chart or today's sky. */

export interface SkySign {
  hi: string;
  en: string;
}

export interface SkyScene {
  id: string;
  name: string;
  nameHi: string;
  caption: string;
  /** the animal in Hindi; planets have none */
  captionHi?: string;
  /** the sign or signs a nakshatra falls in; planets have none */
  signs: SkySign[];
}

const MESHA: SkySign = { hi: 'मेष', en: 'Aries' };
const VRISHABHA: SkySign = { hi: 'वृषभ', en: 'Taurus' };
const MITHUNA: SkySign = { hi: 'मिथुन', en: 'Gemini' };
const KARKA: SkySign = { hi: 'कर्क', en: 'Cancer' };
const SIMHA: SkySign = { hi: 'सिंह', en: 'Leo' };
const KANYA: SkySign = { hi: 'कन्या', en: 'Virgo' };
const TULA: SkySign = { hi: 'तुला', en: 'Libra' };
const VRISHCHIKA: SkySign = { hi: 'वृश्चिक', en: 'Scorpio' };
const DHANU: SkySign = { hi: 'धनु', en: 'Sagittarius' };
const MAKARA: SkySign = { hi: 'मकर', en: 'Capricorn' };
const KUMBHA: SkySign = { hi: 'कुंभ', en: 'Aquarius' };
const MEENA: SkySign = { hi: 'मीन', en: 'Pisces' };

const nakshatra = (id: string, name: string, nameHi: string, caption: string, captionHi: string, ...signs: SkySign[]): SkyScene => ({ id, name, nameHi, caption, captionHi, signs });
const planet = (id: string, name: string, nameHi: string, caption: string): SkyScene => ({ id, name, nameHi, caption, signs: [] });

const NAKSHATRAS: SkyScene[] = [
  nakshatra('ashwini', 'Ashwini', 'अश्विनी', 'the horse', 'घोड़ा', MESHA),
  nakshatra('bharani', 'Bharani', 'भरणी', 'the elephant', 'हाथी', MESHA),
  nakshatra('krittika', 'Krittika', 'कृत्तिका', 'the ram', 'मेढ़ा', MESHA, VRISHABHA),
  nakshatra('rohini', 'Rohini', 'रोहिणी', 'the ox', 'बैल', VRISHABHA),
  nakshatra('mrigashira', 'Mrigashira', 'मृगशिरा', 'the deer', 'हिरण', VRISHABHA, MITHUNA),
  nakshatra('ardra', 'Ardra', 'आर्द्रा', 'the hound', 'श्वान', MITHUNA),
  nakshatra('punarvasu', 'Punarvasu', 'पुनर्वसु', 'the cat', 'बिल्ली', MITHUNA, KARKA),
  nakshatra('pushya', 'Pushya', 'पुष्य', 'the ram', 'मेढ़ा', KARKA),
  nakshatra('ashlesha', 'Ashlesha', 'आश्लेषा', 'the cat', 'बिल्ली', KARKA),
  nakshatra('magha', 'Magha', 'मघा', 'the rat', 'चूहा', SIMHA),
  nakshatra('purva-phalguni', 'Purva Phalguni', 'पूर्व फाल्गुनी', 'the rat', 'चूहा', SIMHA),
  nakshatra('uttara-phalguni', 'Uttara Phalguni', 'उत्तर फाल्गुनी', 'the bull', 'बैल', SIMHA, KANYA),
  nakshatra('hasta', 'Hasta', 'हस्त', 'the buffalo', 'भैंसा', KANYA),
  nakshatra('chitra', 'Chitra', 'चित्रा', 'the tigress', 'बाघिन', KANYA, TULA),
  nakshatra('swati', 'Swati', 'स्वाती', 'the buffalo', 'भैंसा', TULA),
  nakshatra('vishakha', 'Vishakha', 'विशाखा', 'the tiger', 'बाघ', TULA, VRISHCHIKA),
  nakshatra('anuradha', 'Anuradha', 'अनुराधा', 'the deer', 'हिरणी', VRISHCHIKA),
  nakshatra('jyeshtha', 'Jyeshtha', 'ज्येष्ठा', 'the stag', 'हिरण', VRISHCHIKA),
  nakshatra('mula', 'Mula', 'मूल', 'the hound', 'श्वान', DHANU),
  nakshatra('purva-ashadha', 'Purva Ashadha', 'पूर्वाषाढ़ा', 'the monkey', 'वानर', DHANU),
  nakshatra('uttara-ashadha', 'Uttara Ashadha', 'उत्तराषाढ़ा', 'the mongoose', 'नेवला', DHANU, MAKARA),
  nakshatra('shravana', 'Shravana', 'श्रवण', 'the monkey', 'वानर', MAKARA),
  nakshatra('dhanishta', 'Dhanishta', 'धनिष्ठा', 'the lioness', 'सिंहनी', MAKARA, KUMBHA),
  nakshatra('shatabhisha', 'Shatabhisha', 'शतभिषा', 'the mare', 'घोड़ी', KUMBHA),
  nakshatra('purva-bhadrapada', 'Purva Bhadrapada', 'पूर्व भाद्रपद', 'the lion', 'सिंह', KUMBHA, MEENA),
  nakshatra('uttara-bhadrapada', 'Uttara Bhadrapada', 'उत्तर भाद्रपद', 'the cow', 'गाय', MEENA),
  nakshatra('revati', 'Revati', 'रेवती', 'the elephant', 'हाथी', MEENA),
];

const PLANETS: SkyScene[] = [
  planet('surya', 'Surya', 'सूर्य', 'the Sun'),
  planet('chandra', 'Chandra', 'चंद्र', 'the Moon'),
  planet('mangala', 'Mangala', 'मंगल', 'Mars'),
  planet('budha', 'Budha', 'बुध', 'Mercury'),
  planet('guru', 'Guru', 'गुरु', 'Jupiter'),
  planet('shukra', 'Shukra', 'शुक्र', 'Venus'),
  planet('shani', 'Shani', 'शनि', 'Saturn'),
  planet('rahu', 'Rahu', 'राहु', 'the north node'),
  planet('ketu', 'Ketu', 'केतु', 'the south node'),
  planet('prajapati', 'Prajapati', 'प्रजापति', 'Uranus'),
  planet('varuna', 'Varuna', 'वरुण', 'Neptune'),
  planet('yama', 'Yama', 'यम', 'Pluto'),
];

/** A planet after every two nakshatras, so the two families interleave. Same order as scripts/skies/scenes.mjs. */
export const SKY_SCENES: SkyScene[] = (() => {
  const out: SkyScene[] = [];
  let next = 0;
  NAKSHATRAS.forEach((n, i) => {
    out.push(n);
    if ((i + 1) % 2 === 0 && next < PLANETS.length) out.push(PLANETS[next++]);
  });
  return out;
})();

export const skySrc = (id: string): string => `/skies/${id}.webp`;

/** Any scene, for the first one a visitor sees. `random` returns 0 to <1. */
export function randomScene(count: number = SKY_SCENES.length, random: () => number = Math.random): number {
  return Math.floor(random() * count) % count;
}

/**
 * Every scene once, in random order, for the next round. `last` is the scene on screen, which never plays first, so the
 * same scene cannot show twice in a row across rounds. `random` returns 0 to <1.
 */
export function shuffledRound(last: number, count: number = SKY_SCENES.length, random: () => number = Math.random): number[] {
  const round = Array.from({ length: count }, (_, i) => i);
  for (let i = round.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [round[i], round[j]] = [round[j], round[i]];
  }
  if (count > 1 && round[0] === last) [round[0], round[count - 1]] = [round[count - 1], round[0]];
  return round;
}

export interface SkyCorner {
  x: string;
  y: string;
  /** which way a scene drifts when it leaves toward this corner */
  dx: string;
  dy: string;
}

const CORNERS: SkyCorner[] = [
  { x: '0%', y: '0%', dx: '-4%', dy: '-4%' },
  { x: '100%', y: '0%', dx: '4%', dy: '-4%' },
  { x: '0%', y: '100%', dx: '-4%', dy: '4%' },
  { x: '100%', y: '100%', dx: '4%', dy: '4%' },
];

/** The corner the next scene blooms from, and a different one the old scene leaves toward. `random` returns 0 to <1. */
export function pickCorners(random: () => number = Math.random): { from: SkyCorner; to: SkyCorner } {
  const a = Math.floor(random() * CORNERS.length) % CORNERS.length;
  const b = (a + 1 + Math.floor(random() * (CORNERS.length - 1))) % CORNERS.length;
  return { from: CORNERS[a], to: CORNERS[b] };
}

/**
 * How long a scene holds before the next begins, in seconds: VITE_SKY_HOLD_SECONDS, default 120 (two minutes). It is read when
 * the page is built, so a new value needs a new build. Values under 10 are ignored. The 3 s transition is set in index.css.
 */
export const SKY_HOLD_DEFAULT_SECONDS = 120;
export function skyHoldMs(raw: string | undefined = import.meta.env.VITE_SKY_HOLD_SECONDS): number {
  const n = Number(raw);
  return (Number.isFinite(n) && n >= 10 ? n : SKY_HOLD_DEFAULT_SECONDS) * 1000;
}
