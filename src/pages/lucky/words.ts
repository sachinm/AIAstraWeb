/**
 * Words for Lucky times (server docs/reading-engine/45 §3.3, 49). Plain words on the board; the traditional names appear
 * only in the Why sheet. The banned list is checked by the page test.
 */

/** Never on the board outside the Why sheet. */
export const BANNED_ON_BOARD = [
  'storm', 'hurricane', 'weather', 'hospital', 'emergency', 'urgent', 'resort', 'guaranteed', 'certain',
  'tithi', 'nakshatra', 'hora', 'choghadiya', 'muhurta', 'dasha', 'rahu', 'ketu', 'saturn', 'jupiter', 'venus',
  'mercury', 'mars', 'trine', 'transit', 'retrograde', 'america/', 'utc',
];

export const AVOID_PLAIN: Record<string, string> = {
  rahu_kalam: 'A hold band',
  yamagandam: 'A slow stretch',
  gulikai: 'A heavy stretch',
  durmuhurtam: 'A short hold',
  varjyam: 'A hold band',
};

export const AVOID_NAME: Record<string, string> = {
  rahu_kalam: 'Rahu kaal',
  yamagandam: 'Yamaganda',
  gulikai: 'Gulika kaal',
  durmuhurtam: 'Dur muhurta',
  varjyam: 'Varjyam',
};

export const GOOD_PLAIN: Record<string, string> = {
  abhijit: "The day's best minutes",
  amrita: 'A sweet stretch',
  brahma: 'Before dawn, for a first step',
};

export const GOOD_NAME: Record<string, string> = {
  abhijit: 'Abhijit muhurta',
  amrita: 'Amrita gadiya',
  brahma: 'Brahma muhurta',
};

const HOUR_PLAIN: Record<string, string> = {
  Jupiter: 'a growth hour',
  Mercury: 'a quick hour',
  Venus: 'a warm hour',
  Moon: 'a gentle hour',
  Sun: 'a bright hour',
  Mars: 'a sharp hour',
  Saturn: 'a slow hour',
};

const GROUP_PLAIN: Record<string, string> = {
  'tithi:nanda': 'a day of joy',
  'tithi:bhadra': 'a good day for starts',
  'tithi:jaya': 'a winning day',
  'tithi:purna': 'a day of completion',
  'star:fixed': 'a steady star for agreements',
  'star:moving': 'a moving star',
  'star:quick': 'a quick star',
  'star:soft': 'a soft star',
  'star_avoid:fierce': 'against a fierce star',
  'star_avoid:sharp': 'against a sharp star',
};

/** One plain line for a window's reasons (board). */
export function plainReasons(reasons: string[]): string {
  const parts: string[] = [];
  for (const r of reasons) {
    if (r === 'abhijit') parts.push("the day's best minutes");
    else if (r === 'amrita') parts.push('a sweet stretch');
    else if (r === 'brahma') parts.push('before dawn');
    else if (r === 'good_muhurta') parts.push('a good slot');
    else if (r.startsWith('hora:')) parts.push(HOUR_PLAIN[r.slice(5)] ?? 'a good hour');
    else if (r.startsWith('weekday:')) parts.push('a good weekday for it');
    else if (r === 'personal:tara_good' || r === 'personal:moon_good') parts.push('a good day for you');
    else if (GROUP_PLAIN[r]) parts.push(GROUP_PLAIN[r]);
  }
  const uniq = [...new Set(parts)].slice(0, 3);
  return uniq.length ? uniq.join(', ') : 'a clear stretch';
}

const HOUR_NAME: Record<string, string> = {
  Jupiter: 'Jupiter hora', Mercury: 'Mercury hora', Venus: 'Venus hora', Moon: 'Moon hora', Sun: 'Sun hora', Mars: 'Mars hora', Saturn: 'Saturn hora',
};
const GROUP_NAME: Record<string, string> = {
  'tithi:nanda': 'Nanda tithi', 'tithi:bhadra': 'Bhadra tithi', 'tithi:jaya': 'Jaya tithi', 'tithi:purna': 'Purna tithi',
  'star:fixed': 'Sthira (fixed) nakshatra', 'star:moving': 'Chara (moving) nakshatra', 'star:quick': 'Kshipra (quick) nakshatra',
  'star:soft': 'Mridu (soft) nakshatra', 'star_avoid:fierce': 'Ugra (fierce) nakshatra', 'star_avoid:sharp': 'Tikshna (sharp) nakshatra',
};

/** The Why sheet's lines: traditional names allowed here. */
export function whyLines(reasons: string[]): string[] {
  return reasons.map((r) => {
    if (r === 'abhijit') return 'Overlaps Abhijit muhurta';
    if (r === 'amrita') return 'Overlaps Amrita gadiya';
    if (r === 'brahma') return 'Brahma muhurta, for a first step';
    if (r === 'good_muhurta') return 'Inside a muhurta the texts call good';
    if (r.startsWith('hora:')) return `${HOUR_NAME[r.slice(5)] ?? 'Hora'}, which suits this act`;
    if (r.startsWith('hora_avoid:')) return `${HOUR_NAME[r.slice(11)] ?? 'Hora'}, which does not suit it`;
    if (r.startsWith('weekday:')) return `${r.slice(8)} suits this act`;
    if (r === 'personal:tara_good') return 'Your tara bala is good today';
    if (r === 'personal:tara_bad') return 'Your tara bala is weak today';
    if (r === 'personal:moon_good') return 'Your chandra bala is good today';
    if (r === 'personal:moon_bad') return 'Your chandra bala is weak today';
    return GROUP_NAME[r] ?? r;
  });
}

export const SOURCE_LINE = 'Muhurta Chintamani (tithi and nakshatra groups); B.V. Raman, Muhurta; Drik Panchang hora tutorial';

export const ASK: Record<string, { question: string; options: Array<{ key: string; label: string }> }> = {
  who: { question: 'Who is it with?', options: [{ key: 'boss', label: 'My boss' }, { key: 'peer', label: 'A peer' }, { key: 'client', label: 'A client' }, { key: 'panel', label: 'A panel' }] },
  job: { question: 'Do you have a job right now?', options: [{ key: 'yes', label: 'Yes' }, { key: 'between_jobs', label: 'Between jobs' }, { key: 'own_business', label: 'Own business' }] },
  relationship: { question: 'Right now are you…', options: [{ key: 'single', label: 'Single' }, { key: 'seeing_someone', label: 'Seeing someone' }, { key: 'committed', label: 'Committed' }] },
};

export const LAYER_COLOURS = ['#2dd4bf', '#f472b6', '#fbbf24', '#a78bfa', '#60a5fa', '#34d399', '#fb923c', '#e879f9'];

export const SHORT_DAY: Record<string, string> = { Monday: 'Mo', Tuesday: 'Tu', Wednesday: 'We', Thursday: 'Th', Friday: 'Fr', Saturday: 'Sa', Sunday: 'Su' };
