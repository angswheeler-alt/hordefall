import type { HeroDef } from '../data';

/**
 * Pasta (2026-11-11, Samuel): a one-of-a-kind hero, a Market Row kitchen boy born with no magic who fights with a
 * black greatsword forged from a cursed oven door. Original design. Boiling Over (combo into a mid-fight dark form) at 1★,
 * NOT YET! at 6★ (a lethal blow starts the form instead).
 */
export const PASTA: HeroDef = {
  id: 'pasta', rarity: 'epic', statRarity: 'legendary', name: 'Pasta', element: 'dark',
  noElement: true, type: 'Brawler', baseAtk: 6, baseHp: 95, range: 30, attackCooldown: 0.9, moveSpeed: 125, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
  signature: { kind: 'grit', perHit: 0.05, max: 1, idle: 5, formAt: 25, formSeconds: 6, formMult: 2 },
  sigPlus: 'NOT YET!: the first blow each life that would fell him leaves him standing and throws him straight into Boiling Over.',
  ult: { kind: 'boil', mult: 1.5, plusMult: 2, extend: 3, plusSeconds: 2 },
  bio: 'A kitchen boy from Market Row, born without a spark of magic, who swings a black greatsword forged from a cursed oven door. The first hero with no element: 2x damage to Water, Fire and Earth, normal to Light and Dark, and no weakness.',
  basic: { name: 'Greatsword Chop', text: 'Fast, heavy greatsword chops at the nearest enemy ahead.' },
  ultimate: { name: 'Boil Over', text: 'A heavy slash on the toughest enemy in reach, then he boils over into his dark form at once (already in it: +3 seconds). 5\u2605: a harder slash and the form lasts 2 seconds longer.' },
  trait: { name: 'Boiling Over', text: 'Every hit in a row, on any enemy, adds +5% ATK, up to +100% (five seconds without a hit halves it). At 25 hits he boils over into his dark form for 6 seconds: every hit counts double and he can\u2019t fall. Then the combo starts again from 0.' },
  sp1: { name: 'Rolling Pin', text: 'Every 4th attack is a double chop (2x damage).', effect: { kind: 'everyNth', value: 2, every: 4 } },
  sp2: { name: 'Thick Apron', text: 'Heals for 10% of the damage he deals.', effect: { kind: 'lifesteal', value: 0.1 } },
  aura: { name: 'Kitchen Pep Talk', text: 'While he is boiling over, the whole team deals +20% damage.', effect: { kind: 'boilRally', value: 1.2, team: true } },
};
