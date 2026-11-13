/**
 * The picture on every card (server docs/reading-engine/71 §4.1): each card id names its theme (the category's colour
 * and backdrop) and its glyph. Drawn in code (CardArt.tsx), never an image file or a model.
 */
import {
  Award,
  BookOpen,
  Brain,
  Briefcase,
  CalendarDays,
  CloudSun,
  Coins,
  Compass,
  Crown,
  Droplet,
  Dumbbell,
  Eye,
  Flame,
  Flower2,
  Focus,
  Gem,
  Gift,
  GraduationCap,
  Hammer,
  HandHeart,
  Heart,
  HeartCrack,
  HeartHandshake,
  Home,
  Hourglass,
  Infinity as InfinityIcon,
  Layers,
  Leaf,
  Library,
  MessageCircleHeart,
  Moon,
  Mountain,
  Orbit,
  Quote,
  Repeat,
  Rocket,
  Scale,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  Users,
  Wind,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export type ArtTheme = 'body' | 'mind' | 'character' | 'indian' | 'time' | 'bond' | 'meeting' | 'circle' | 'standing' | 'money' | 'growth';

export type BoardKind = 'self' | 'love' | 'work';

/** each picker group's theme and the one line under its name */
export const GROUP_ART: Record<string, { theme: ArtTheme; blurb: string; glyph: LucideIcon }> = {
  // Self
  body: {
    theme: 'body',
    blurb: 'Energy, rest and strength through your year',
    glyph: Zap,
  },
  mind: {
    theme: 'mind',
    blurb: 'How you think, what weighs on you, what restores you',
    glyph: Brain,
  },
  character: {
    theme: 'character',
    blurb: 'Who you are and how you meet the world',
    glyph: UserRound,
  },
  indian: {
    theme: 'indian',
    blurb: 'Your chart through the old Indian ideas of make-up, aims and practice',
    glyph: Flower2,
  },
  time: {
    theme: 'time',
    blurb: 'The chapter you are in and the year ahead',
    glyph: Orbit,
  },
  // Love
  bond: {
    theme: 'bond',
    blurb: 'How the two of you are, through the year',
    glyph: HeartHandshake,
  },
  meeting: {
    theme: 'meeting',
    blurb: 'Meeting someone, and the wait before it',
    glyph: MessageCircleHeart,
  },
  circle: {
    theme: 'circle',
    blurb: 'Family, in-laws and the friends who carry you',
    glyph: Home,
  },
  // Work
  standing: {
    theme: 'standing',
    blurb: 'Where you stand at work and what wears on you',
    glyph: Briefcase,
  },
  money: {
    theme: 'money',
    blurb: 'Income, the next move and finding work',
    glyph: Coins,
  },
  growth: {
    theme: 'growth',
    blurb: 'What to build and what you might start',
    glyph: TrendingUp,
  },
};

export const CARD_GLYPH: Record<string, LucideIcon> = {
  // Self: Body
  body: Zap,
  fitness: Dumbbell,
  sleep: Moon,
  blood: Droplet,
  // Self: Mind
  mind: Brain,
  sharpness: Focus,
  mood: CloudSun,
  stuck: Wind,
  restores: Leaf,
  play: Sparkles,
  // Self: Character
  diagnosis: Quote,
  lagna: UserRound,
  drive: Flame,
  presence: Eye,
  yogas: Gift,
  purpose: Compass,
  learning: GraduationCap,
  // Self: Indian lens
  constitution: Scale,
  layers: Layers,
  aims: Target,
  practice: Flower2,
  saturn: Orbit,
  helps: HandHeart,
  // Self: Time
  chapter: BookOpen,
  chapters: Library,
  year: CalendarDays,
  // Love
  love_where: Heart,
  love_between: HeartHandshake,
  love_strain: HeartCrack,
  love_commitment: InfinityIcon,
  love_reconcile: Repeat,
  love_meet: MessageCircleHeart,
  love_delay: Hourglass,
  love_partner: Gem,
  love_family: Home,
  love_friends: Users,
  // Work
  work_where: Briefcase,
  work_wears: Mountain,
  work_recognition: Award,
  work_leading: Crown,
  work_money: Coins,
  work_move: Rocket,
  work_finding: Search,
  work_build: Hammer,
  work_venture: TrendingUp,
};

/**
 * The Self board's card ids and the picker group each belongs to, so the board (which gets only card ids, not the
 * catalogue) draws a card in the same colours as its picker tile. Keep in step with the server's Self catalogue.
 */
export const SELF_CARD_GROUP: Record<string, string> = {
  // Body
  body: 'body',
  fitness: 'body',
  sleep: 'body',
  blood: 'body',
  // Mind
  mind: 'mind',
  stuck: 'mind',
  sharpness: 'mind',
  mood: 'mind',
  restores: 'mind',
  play: 'mind',
  // Character
  diagnosis: 'character',
  lagna: 'character',
  drive: 'character',
  presence: 'character',
  yogas: 'character',
  purpose: 'character',
  learning: 'character',
  // Indian lens
  constitution: 'indian',
  layers: 'indian',
  aims: 'indian',
  practice: 'indian',
  saturn: 'indian',
  helps: 'indian',
  // Time
  chapter: 'time',
  chapters: 'time',
  year: 'time',
};

/** the picker group of a Self card id, or null when the id is not a Self card */
export function selfGroupOf(id: string): string | null {
  return Object.prototype.hasOwnProperty.call(SELF_CARD_GROUP, id) ? SELF_CARD_GROUP[id]! : null;
}

export function themeOf(group: string): ArtTheme {
  return GROUP_ART[group]?.theme ?? 'character';
}

/** the card's glyph; an unknown id takes its group's */
export function glyphOf(id: string, group: string): LucideIcon {
  return CARD_GLYPH[id] ?? GROUP_ART[group]?.glyph ?? Sparkles;
}
