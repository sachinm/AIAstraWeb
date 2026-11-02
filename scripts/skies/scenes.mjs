/** The home page scenes and how each was asked for, so one can be redone in the same style. Prompts hold no user data. */

export const STYLE =
  'Cinematic, photoreal 3D matte painting in the finish of a big-budget film title sequence. Deep space setting: indigo and ' +
  'near-black sky, drifting nebula dust, volumetric god rays, real depth of field with sharp foreground and soft distance, ' +
  'subtle film grain. The subject is lit by its own coloured light and fills the frame, dramatic and dignified, emerging from ' +
  'cosmic dust as if formed of light and star matter. The image fills the whole frame edge to edge, no black bars or letterboxing. Low overall brightness with generous dark areas, so white text can sit ' +
  'on top. Not flat, not a cartoon, not a poster, not a diagram, no glossy plastic look. Nothing frightening: no dragons, snakes, reptiles or monsters. No text, letters, logos, frames or ' +
  'borders. Wide 16:9 composition with the subject centred.';

/** Silks for the star goddesses, in turn, so the scenes do not all look alike. */
const SILKS = ['deep crimson', 'saffron', 'emerald', 'royal blue', 'ivory and gold', 'violet', 'rose', 'teal', 'burnished copper'];
let silk = 0;

/** The stars of each nakshatra, for the sky behind the figures. */
const STARS = {
  ashwini: 'the three stars at the head of Aries',
  bharani: 'three small stars in a tight triangle',
  krittika: 'the Pleiades cluster',
  rohini: 'the V of the Hyades with the red star Aldebaran',
  mrigashira: 'the three small stars at the head of Orion',
  ardra: 'the single red star Betelgeuse',
  punarvasu: 'the twin stars Castor and Pollux',
  pushya: 'the soft Beehive cluster in Cancer',
  ashlesha: 'a small ring of six stars',
  magha: 'the sickle of Leo with the bright star Regulus',
  'purva-phalguni': 'two stars in the back of Leo',
  'uttara-phalguni': 'the bright star Denebola and its neighbour',
  hasta: 'the five stars of Corvus, shaped like an open hand',
  chitra: 'the single brilliant star Spica',
  swati: 'the single bright orange star Arcturus',
  vishakha: 'the four stars of Libra',
  anuradha: 'three stars in a shallow arc at the head of Scorpius',
  jyeshtha: 'the red star Antares between two fainter stars',
  mula: 'the curving tail of Scorpius',
  'purva-ashadha': 'the bow stars of Sagittarius',
  'uttara-ashadha': 'the handle stars of Sagittarius',
  shravana: 'three stars in a line with bright Altair at the centre',
  dhanishta: 'the small diamond of Delphinus',
  shatabhisha: 'a wide circle of many faint stars in Aquarius',
  'purva-bhadrapada': 'two bright stars on the side of the square of Pegasus',
  'uttara-bhadrapada': 'two bright stars on the far side of the square of Pegasus',
  revati: 'a long gentle curve of small stars in Pisces',
};

/** In the tradition the nakshatras are the twenty-seven star goddesses, the daughters of Daksha. Each rides her animal. */
const animal = (id, name, creature, detail) => ({
  id,
  kind: 'nakshatra',
  name,
  caption: `the ${creature}`,
  prompt:
    `Ancient Indian mythology. ${name}, a star goddess, one of the twenty-seven daughters of Daksha, clearly seated riding on the back of ${detail}. ` +
    `The ${creature} is a celestial spirit formed of translucent starlight, glowing dust and nebula, not realistic fur, at mythic scale, large enough to carry her, calm and majestic. She wears ${SILKS[silk++ % SILKS.length]} silks, fully and modestly draped, ` +
    `with classical ancient Indian gold jewellery and a crown, as in temple sculpture and old Indian miniatures rendered realistically. Her Indian face is serene and dignified, ` +
    `never glamorous, never caricature. Both the rider and the animal are clearly visible and fill the frame. ` +
    `Behind them, high in the night sky, are ${STARS[id]}, the bright stars joined by very fine, faint gold lines like an ancient Indian sky chart, subtle and elegant, in the background only, with no star names or labels written anywhere.`,
});

const deity = (id, name, caption, detail) => ({
  id,
  kind: 'planet',
  name,
  caption,
  prompt: `Indian classical iconography rendered realistically and respectfully. ${detail} Dignified face, serene and powerful, never caricature.`,
});

/** Yoni animals, in nakshatra order. */
export const NAKSHATRAS = [
  animal('ashwini', 'Ashwini', 'horse', 'a white stallion in a stream of golden stardust'),
  animal('bharani', 'Bharani', 'elephant', 'a great bull elephant walking out of crimson nebula'),
  animal('krittika', 'Krittika', 'ram', 'a horned ram on a ridge, flames of star fire behind it, the Pleiades above'),
  animal('rohini', 'Rohini', 'ox', 'a gentle white ox with soft eyes, calm and strong, walking under a single rose-red star'),
  animal('mrigashira', 'Mrigashira', 'deer', 'a graceful young deer with a raised head, silver starlight on its coat, the stars of Orion above it'),
  animal('ardra', 'Ardra', 'hound', 'a lean dark hound, calm, in soft blue lightning and tears of light'),
  animal('punarvasu', 'Punarvasu', 'cat', 'a sleek cat on a floating stone, a bright quiver of light behind it, soft blue glow'),
  animal('pushya', 'Pushya', 'ram', 'a gentle ram among golden lotus light, warm and nourishing'),
  animal('ashlesha', 'Ashlesha', 'cat', 'a great sleek black cat with calm emerald eyes, in soft violet starlight, peaceful and elegant'),
  animal('magha', 'Magha', 'rat', 'a great rat with a dignified bearing, ancestral golden light behind them'),
  animal('purva-phalguni', 'Purva Phalguni', 'rat', 'a great sleek rat with a dignified bearing, warm rose light and drifting stardust behind them'),
  animal('uttara-phalguni', 'Uttara Phalguni', 'bull', 'a great white bull at sunrise on the edge of a golden nebula'),
  animal('hasta', 'Hasta', 'buffalo', 'a powerful water buffalo in a shallow sea of reflected stars'),
  animal('chitra', 'Chitra', 'tigress', 'a tigress with amber and dark stripes of light, a single brilliant white star above them, no neon colours'),
  animal('swati', 'Swati', 'buffalo', 'a buffalo in a wind of coral light, young shoots of light bending around it'),
  animal('vishakha', 'Vishakha', 'tiger', 'a tiger between two arcs of soft fire under a violet sky'),
  animal('anuradha', 'Anuradha', 'deer', 'a graceful doe among glowing lotus flowers in a quiet indigo nebula'),
  animal('jyeshtha', 'Jyeshtha', 'stag', 'a regal stag with vast antlers, the red star Antares burning between them'),
  animal('mula', 'Mula', 'hound', 'a hound among great glowing roots at the dark centre of the galaxy'),
  animal('purva-ashadha', 'Purva Ashadha', 'monkey', 'a long-limbed langur on a rock above a cosmic waterfall of light'),
  animal('uttara-ashadha', 'Uttara Ashadha', 'mongoose', 'an alert mongoose standing tall, an elephant-tusk arc of pale light behind it'),
  animal('shravana', 'Shravana', 'monkey', 'a great grey langur, faint rings of light spreading through the dust around them'),
  animal('dhanishta', 'Dhanishta', 'lioness', 'a calm lioness, rings of light like a great drum pulsing behind them'),
  animal('shatabhisha', 'Shatabhisha', 'mare', 'a dark mare inside a vast circle of a hundred pale stars'),
  animal('purva-bhadrapada', 'Purva Bhadrapada', 'lion', 'a calm lion with a mane of soft fire in violet star matter'),
  animal('uttara-bhadrapada', 'Uttara Bhadrapada', 'cow', 'a calm white cow standing in a deep still sea of stars'),
  animal('revati', 'Revati', 'elephant', 'a young elephant walking on a calm ocean of light, silver fish of stars around it'),
];

export const PLANETS = [
  deity('surya', 'Surya', 'the Sun', 'Surya, the Sun god, radiant in gold armour, holding two lotuses, riding a one-wheeled chariot drawn by exactly seven horses, all seven clearly visible and countable, an immense blazing solar disc behind him. Colours gold, orange, ember.'),
  deity('chandra', 'Chandra', 'the Moon', 'Chandra, the Moon god, youthful and clean-shaven with a pearl crown carrying a small crescent, not Shiva: no matted hair, no serpent, no third eye, in a chariot drawn by white horses over a silver night sea, a huge moon behind him. Colours silver, pearl, pale blue.'),
  deity('mangala', 'Mangala', 'Mars', 'Mangala, Mars, a red four-armed warrior general with spear and mace, riding a ram, red dust of the planet swirling behind him. Colours vermilion and red.'),
  deity('budha', 'Budha', 'Mercury', 'Budha, Mercury, a young prince in green silks with sword, shield and book, on a winged lion. Colours emerald and green.'),
  deity('guru', 'Guru', 'Jupiter', 'Brihaspati, Jupiter, teacher of the gods, a wise elder in yellow robes with rosary and scriptures, on an elephant, banded Jupiter vast behind him. Colours saffron and gold.'),
  deity('shukra', 'Shukra', 'Venus', 'Shukra, Venus, a luminous teacher in white garments with staff and rosary, clearly seated riding on a white horse, a brilliant morning star behind him. Colours white and moonstone.'),
  deity('shani', 'Shani', 'Saturn', 'Shani, Saturn, a dark-skinned Indian king in indigo silks with a gold crown and a calm downcast face clearly visible, holding an iron bow, on a great crow, no hood, not a reaper, the great rings of Saturn arcing behind him. Colours indigo and iron.'),
  deity('rahu', 'Rahu', 'the north node', 'Rahu, a stern dark-skinned head with Indian features and an ornate gold Indian crown, no serpents or snakes anywhere, a calm and noble expression, the neck dissolving into soft smoke, above a chariot of eight black horses, no Greek or Medusa look, a total solar eclipse with a blazing corona behind him. Colours smoky blue and violet.'),
  deity('ketu', 'Ketu', 'the south node', 'Ketu, a robed ascetic figure seen from behind with a banner, on a great eagle, a long comet tail streaming across the sky. Colours ash grey and saffron flame.'),
  deity('prajapati', 'Prajapati', 'Uranus', 'Prajapati, lord of creation, for the planet Uranus: an Indian sage-king with a long white beard, bare-chested with a pale cyan dhoti and gold ornaments, face clearly visible, no hood, clearly seated riding on a great white hamsa swan, shaping a sphere of light with his hands, the tilted blue-green planet and its thin rings behind him. Colours ice cyan.'),
  deity('varuna', 'Varuna', 'Neptune', 'Varuna, lord of the cosmic waters, for the planet Neptune: a regal Indian figure with a calm face and a loop of light, seated on a great gentle whale gliding through waves of stars, no dragons, no reptiles, no teeth, deep blue Neptune behind him. Colours deep ocean blue.'),
  deity('yama', 'Yama', 'Pluto', 'Yama, lord of dharma, for the planet Pluto: a stern just Indian king with dark skin, a gold crown and dark silks, holding a plain danda staff, no skulls, on a great water buffalo, small icy Pluto far behind him in black space. Colours black, deep violet and cold silver.'),
];

/** A planet after every few nakshatras, so the two families interleave. */
export const SCENES = (() => {
  const out = [];
  const every = Math.floor(NAKSHATRAS.length / PLANETS.length);
  let planet = 0;
  NAKSHATRAS.forEach((n, i) => {
    out.push(n);
    if ((i + 1) % every === 0 && planet < PLANETS.length) out.push(PLANETS[planet++]);
  });
  while (planet < PLANETS.length) out.push(PLANETS[planet++]);
  return out;
})();
