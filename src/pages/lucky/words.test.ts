import { describe, expect, it } from 'vitest';
import { windowKeys, windowReasons } from '../../lib/luckyApi';
import { plainReasons, whyGroups, whyLines } from './words';

describe('Lucky times words for the five limbs', () => {
  it('splits reasons by scope and closes the general group with the day limbs', () => {
    const g = whyGroups(
      [
        { key: 'yoga:Siddhi', scope: 'general' },
        { key: 'hora:Mercury', scope: 'general' },
        { key: 'personal:hora_malefic', scope: 'personal' },
      ],
      { yoga: { name: 'Siddhi', endHour: 26.5 }, karana: { name: 'Bava', endHour: null } },
    );
    expect(g.general).toEqual(['Siddhi yoga, which the texts favour', 'Mercury hora, which suits this act', 'Yoga of the day: Siddhi, until 02:30', 'Karana of the day: Bava']);
    expect(g.personal).toEqual(['The hora lord is a functional malefic in your chart, so this hour counts a little less']);
  });
  it('has Why words for the gate reasons and plain board words with no traditional names', () => {
    expect(whyLines(['yoga_avoid:Vyatipata', 'karana_avoid:Vishti', 'tithi_avoid:rikta', 'weekday_avoid:Saturday'])).toEqual([
      'Vyatipata yoga, which the texts avoid for this act',
      'Vishti karana, which the texts avoid for this act',
      'Rikta tithi, which does not suit this act',
      'Saturday does not suit this act',
    ]);
    const board = plainReasons(['yoga:Siddhi', 'karana:Bava', 'personal:hora_benefic']).toLowerCase();
    for (const w of ['yoga', 'karana', 'siddhi', 'bava', 'benefic', 'hora']) expect(board).not.toContain(w);
  });
  it('reads both server shapes', () => {
    expect(windowReasons({ reasons: ['abhijit', 'personal:tara_good'] })).toEqual([{ key: 'abhijit', scope: 'general' }, { key: 'personal:tara_good', scope: 'personal' }]);
    expect(windowKeys({ reasons: [{ key: 'yoga:Siddhi', scope: 'general' }], reasonKeys: ['yoga:Siddhi'] })).toEqual(['yoga:Siddhi']);
    expect(windowKeys({ reasons: [], reasonKeys: ['brahma'] })).toEqual(['brahma']);
  });
});
