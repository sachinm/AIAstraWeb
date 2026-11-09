/**
 * The lines the loading veil rotates (server docs/loading-overlay/02-quips.md). The assistant's own voice: warm,
 * rooted in classical Vedic astrology, never a prediction, never a step, a count, a time or the engine's name.
 * `pickQuipStart` gives each veil a random starting line so two veils on one screen do not speak in unison.
 */
export const LOADING_QUIPS: readonly string[] = [
  'Unrolling your sky the way it stood when you first breathed.',
  'Counting the nakshatras one by one. Ashwini is always the first to answer.',
  'Asking the Moon which of the twenty-seven mansions she was resting in.',
  'Finding your lagna: the sign that rose in the east at your first breath.',
  'Laying out twelve houses, each with a room of your life inside.',
  'Letting the Lahiri ayanamsa set the stars where the old texts kept them.',
  'Drawing the rashi chakra, square by square, the way the South draws it.',
  'Drawing the diamond of the North, with the lagna at the top.',
  'The navamsa is being folded nine times, the way marriage and dharma are read.',
  'Looking for the lord of your lagna and asking where he has gone to sit.',
  'Mercury has been asked to speak plainly. He is considering it.',
  'Saturn is taking his time. He always does, and he is always right to.',
  'Jupiter is being generous with the ninth house. We are letting him.',
  'Venus would like a word about the seventh house. We are listening.',
  'Mars is pacing the third house. Courage usually lives there.',
  'The Sun is finding his place of dignity. Leo, if he can manage it.',
  'Rahu and Ketu are being seated exactly opposite each other, as always.',
  'Measuring the Moon by the Sun: your tithi, the day the almanac names you by.',
  'Weighing the planets the old way: shadbala, six strengths at once.',
  'Checking who is exalted, who is at home, and who is only visiting.',
  'Asking which dasha you are walking through, and whose turn comes next.',
  'Counting the Vimshottari years from the Moon’s nakshatra. One hundred and twenty in all.',
  'Reading the Moon’s sign: the chandra lagna, your mind’s own first house.',
  'Setting the arudha padas, where the world sees you rather than where you are.',
  'Letting the planets cast their glances. The seventh glance is always full.',
  'Looking for yogas, the combinations the sages named one by one.',
  'Drawing the dashamsa, the tenth division, where work shows its face.',
  'Drawing the saptamsa, the seventh division, where the family tree is kept.',
  'The panchanga is being opened: tithi, vara, nakshatra, yoga, karana.',
  'Asking the hora lord whose hour it is right now.',
  'Walking the twelve bhavas like a house, room by room, with a lamp.',
  'Finding the atmakaraka, the planet that walked furthest in its sign.',
  'Sorting friends from enemies among the grahas. They keep old grudges.',
  'The Moon is phrasing something gently. She usually gets it right.',
  'Arranging the grahas beside the board, like pieces waiting for the game.',
  'Brihat Parashara is being consulted. He is thorough, and so are we.',
  'Checking the sandhi, the thin seams between one sign and the next.',
  'Looking at the Moon’s distance from the Sun. Paksha bala, the fortnight’s strength.',
  'The ascendant is being set to its exact degree. It matters.',
  'The chart is being read back to itself, the way a scribe checks a copy.',
];

/** A random starting index, so each veil begins on a different line. */
export function pickQuipStart(random: () => number = Math.random): number {
  return Math.floor(random() * LOADING_QUIPS.length) % LOADING_QUIPS.length;
}
