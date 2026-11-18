/**
 * The board's grants in both server shapes (server f09ad68): the list `{allowed, locked}` and the map
 * `{key: {locked, minPlan?}}`, on the board and on each card.
 */
import { describe, expect, it } from 'vitest';
import { normaliseBoardFeatures, normaliseCardGrant, withFeatureShapes, type SelfV3Response } from '../../../lib/selfV3Api';
import { cardAccess, cardFeatureUsable, featureOn, featureState } from './features';

const MAP = {
  'feature.face.short': { locked: false },
  'feature.card_chat': { locked: false },
  'feature.compact': { locked: true, minPlan: 'plus' },
  'card.love.marriage_pulse': { locked: true, minPlan: 'unlimited' },
  'card.love.dating_pulse': { locked: false },
};

const board = (features: unknown) => ({ features }) as Pick<SelfV3Response, 'features'>;

describe('the map shape', () => {
  it('a key not locked is on, a locked key carries its plan, an absent key is off', () => {
    expect(normaliseBoardFeatures(MAP)).toEqual({
      allowed: ['feature.face.short', 'feature.card_chat', 'card.love.dating_pulse'],
      locked: [
        { key: 'feature.compact', minPlan: 'plus' },
        { key: 'card.love.marriage_pulse', minPlan: 'unlimited' },
      ],
    });
    const b = board(MAP);
    expect(featureOn(b, 'feature.card_chat')).toBe(true);
    expect(featureState(b, 'feature.compact')).toEqual({ on: false, locked: true, minPlan: 'plus' });
    expect(featureOn(b, 'feature.voice')).toBe(false);
    expect(cardAccess(b, 'marriage_pulse', 'love')).toBe('locked');
    expect(cardAccess(b, 'dating_pulse', 'love')).toBe('on');
    expect(cardAccess(b, 'friends_core_allies', 'love')).toBe('off');
  });

  it('the list shape still reads as before', () => {
    const b = board({ allowed: ['feature.card_chat'], locked: [{ key: 'feature.compact', minPlan: 'plus' }] });
    expect(featureOn(b, 'feature.card_chat')).toBe(true);
    expect(featureState(b, 'feature.compact')).toEqual({ on: false, locked: true, minPlan: 'plus' });
    expect(normaliseBoardFeatures(null)).toBeNull();
  });

  it('a card grant in the map shape is usable when not locked; the old shape still reads', () => {
    expect(normaliseCardGrant({ locked: false })).toEqual({ usable: true, locked: false, minPlan: null });
    expect(normaliseCardGrant({ locked: true, minPlan: 'plus' })).toEqual({ usable: false, locked: true, minPlan: 'plus' });
    expect(normaliseCardGrant({ usable: false, locked: false, minPlan: null })).toEqual({ usable: false, locked: false, minPlan: null });
    expect(cardFeatureUsable({ features: { 'feature.card_chat': { locked: true } } }, 'feature.card_chat')).toBe(false);
    expect(cardFeatureUsable({ features: { 'feature.card_chat': { locked: false } } }, 'feature.card_chat')).toBe(true);
    expect(cardFeatureUsable({}, 'feature.card_chat')).toBe(true);
  });

  it('a board read from the server is reshaped once, its cards too', () => {
    const raw = { features: MAP, cards: [{ id: 'dating_pulse', features: { 'feature.card_chat': { locked: true, minPlan: 'plus' } } }] } as unknown as SelfV3Response;
    const b = withFeatureShapes(raw);
    expect(b.features).toEqual(normaliseBoardFeatures(MAP));
    expect(b.cards[0]!.features).toEqual({ 'feature.card_chat': { usable: false, locked: true, minPlan: 'plus' } });
  });
});
