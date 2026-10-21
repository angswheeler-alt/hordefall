import type { HeroDef } from '../data';
import { standardSteps, type AscendantDef } from '../ascendant';
import { VS, ULT } from '../heroText';

/**
 * Ascendant heroes (src/ascendant.ts). Not part of HEROES or RELEASED_HEROES yet, so nothing here reaches the
 * game. asc_test is a stand-in to build and test the framework with; the five real heroes come later under
 * codename ids, with names and art kept in their entries here.
 */
const ascTestBase: HeroDef = {
  id: 'asc_test', rarity: 'common', name: 'Testblade', element: 'dark', type: 'Samurai', baseAtk: 6, baseHp: 48, range: 28, attackCooldown: 0.8, moveSpeed: 140, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
  bio: 'A stand-in swordsman for testing ascension.',
  basic: { name: 'Quick Cut', text: 'Fast cuts at the nearest enemy ahead.' },
  ultimate: { name: 'Edge Burst', text: ULT('A burst of dark energy tears through') },
  trait: { name: 'Keen Edge', text: `Hits harder the longer he fights. ${VS.dark}` },
  sp1: { name: 'Follow Through', text: '20% chance for each attack to strike twice.', effect: { kind: 'doubleStrike', value: 0.2 } },
  sp2: { name: 'Steady Hand', text: '+10% critical hit chance.', effect: { kind: 'crit', value: 0.1 } },
  aura: { name: 'Dark Resolve', text: 'Dark heroes +20% ATK.', effect: { kind: 'atk', value: 1.2, team: true, element: 'dark' } },
};

export const ASCENDANT_HEROES: AscendantDef[] = [
  {
    base: ascTestBase,
    forms: [
      { formName: 'Form I' },
      { formName: 'Form II', art: 'asc_test_f2', baseAtk: 7.5, attackCooldown: 0.7, charge: { stacks: 8, boost: 'damage', value: 0.5 } },
      { formName: 'Form III', art: 'asc_test_f3', baseAtk: 9, baseHp: 56, attackCooldown: 0.6, sp2: { name: 'Hunter Focus', text: 'Deals 30% more damage to bosses.', effect: { kind: 'bossDamage', value: 1.3 } } },
      { formName: 'Form IV', art: 'asc_test_f4', baseAtk: 11, baseHp: 64, ult: { kind: 'strike', mult: 3, plusMult: 4 }, charge: { stacks: 6, boost: 'bossDamage', value: 1 } },
    ],
    // Dark counters the Light element boss (stage 1000).
    steps: standardSteps(1000),
  },
];

export function ascendantDef(id: string): AscendantDef | undefined {
  return ASCENDANT_HEROES.find((a) => a.base.id === id);
}

export function isAscendant(id: string): boolean {
  return ASCENDANT_HEROES.some((a) => a.base.id === id);
}
