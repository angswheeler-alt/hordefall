import type { HeroDef } from '../data';

/**
 * Pasta (2026-11-11, Samuel): a one-of-a-kind hero, a Market Row kitchen boy born with no magic who fights with a
 * giant cleaver forged from a cursed oven door. Original design. Combo Counter at 1★, Last One Standing at 6★.
 * HIDDEN while his kit is tested: in HEROES (so tests and the balance bench can field him) but not in RELEASED_HEROES.
 */
export const PASTA: HeroDef = {
  id: 'pasta', rarity: 'epic', name: 'Pasta', element: 'dark', type: 'Brawler', baseAtk: 6, baseHp: 95, range: 30, attackCooldown: 0.9, moveSpeed: 125, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
  signature: { kind: 'grit', perHit: 0.02, max: 1, idle: 5, standSeconds: 5 },
  sigPlus: 'Last One Standing: the first blow that would fell him leaves him standing (NOT YET!). He can\u2019t fall for 5 seconds, and for the rest of that life his combo never drops and each hit counts double.',
  ult: { kind: 'strike', mult: 2.5, plusMult: 3.5 },
  bio: 'A kitchen boy from Market Row, born without a spark of magic, who swings a cleaver forged from a cursed oven door.',
  basic: { name: 'Cleaver Chop', text: 'Fast, heavy cleaver chops at the nearest enemy ahead.' },
  ultimate: { name: 'Leftovers', text: 'One huge slash on the toughest enemy in reach.' },
  trait: { name: 'Combo Counter', text: 'Every hit in a row, on any enemy, adds +2% ATK, up to +100% at 50 hits. Five seconds without a hit halves it.' },
  sp1: { name: 'Rolling Pin', text: 'Every 4th attack is a double chop (2x damage).', effect: { kind: 'everyNth', value: 2, every: 4 } },
  sp2: { name: 'Thick Apron', text: 'Heals for 10% of the damage he deals.', effect: { kind: 'lifesteal', value: 0.1 } },
  aura: { name: 'Kitchen Pep Talk', text: 'Whole team +10% ATK.', effect: { kind: 'atk', value: 1.1, team: true } },
};
