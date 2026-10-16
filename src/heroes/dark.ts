import type { HeroDef } from '../data';
import type { HeroProfile } from '../profiles';
import { VS, ULT } from '../heroText';

/** Dark heroes from the full Crush roster (design/crush-full-roster.md). */
export const DARK_HEROES: HeroDef[] = [
  // ---- Rares ----
  // Dark Wolf (Dark Wolf)
  { id: 'howl', rarity: 'rare', name: 'Howl', element: 'dark', type: 'Magician', baseAtk: 7.8, baseHp: 56, range: 150, attackCooldown: 1.7, moveSpeed: 100, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, splash: 36,
    bio: 'A shadow wolf shaman in a bone mask, who howls dark fire out of the moon.',
    basic: { name: 'Dark Ball', text: 'Ranged balls of dark energy that splash every enemy near the target.' },
    ultimate: { name: 'Meteor Rain', text: ULT('A rain of dark meteors hits') },
    trait: { name: 'Moon Howl', text: `His spells can stun (12%). ${VS.dark}` },
    sp1: { name: 'Dark Wrath', text: '25% chance for each attack to cast twice.', effect: { kind: 'doubleStrike', value: 0.25 } },
    sp2: { name: 'Pack Call', text: '+5% chance to stun.', effect: { kind: 'stunChance', value: 0.05 } },
    aura: { name: 'Night Chill', text: 'Enemies attack 12% slower.', effect: { kind: 'enemyHaste', value: 0.88, team: true } } },
  // Kage (Kage)
  { id: 'corvin', rarity: 'rare', name: 'Corvin', element: 'dark', type: 'Samurai', baseAtk: 6.2, baseHp: 50, range: 28, attackCooldown: 0.8, moveSpeed: 140, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    signature: { kind: 'knockback', push: 25 },
    bio: 'A crow samurai in black lacquered armor, with a katana as sharp as his beak.',
    basic: { name: 'Katana Cut', text: 'Fast katana cuts at the nearest enemy ahead.' },
    ultimate: { name: 'Dark Strike', text: ULT('A wave of dark energy tears through') },
    trait: { name: 'Black Wing', text: `His cuts push regular enemies back, and he dodges 12% of attacks. ${VS.dark}` },
    sp1: { name: 'Piercing Cut', text: 'Each cut also hits the next 2 enemies just behind the target.', effect: { kind: 'pierce', value: 2 } },
    sp2: { name: 'Crow Focus', text: '+15% critical hit chance.', effect: { kind: 'crit', value: 0.15 } },
    aura: { name: 'Ill Omen', text: 'Enemies take 12% more damage.', effect: { kind: 'enemyVuln', value: 1.12, team: true } } },
  // Monki Mortar (Monki Mortar)
  { id: 'vesper', rarity: 'rare', name: 'Vesper', element: 'dark', type: 'Gunner', baseAtk: 5.5, baseHp: 42, range: 165, attackCooldown: 1.2, moveSpeed: 150, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, splash: 30,
    bio: 'A masked raccoon hauling a dented mortar, who lobs bombs and keeps whatever falls out of the wreckage.',
    basic: { name: 'Bomb Lob', text: 'Long-range bombs that splash enemies near the target.' },
    ultimate: { name: 'Bomb Rain', text: ULT('A rain of shadow bombs hits') },
    trait: { name: 'Mortar Crew', text: `Explosive shots splash enemies near the target. ${VS.dark}` },
    sp1: { name: 'Big Bomb', text: 'Every 4th shot is a big bomb: 2x damage to every enemy near the target.', effect: { kind: 'slam', value: 2, every: 4 } },
    sp2: { name: 'Extra Powder', text: 'Splash radius +30%.', effect: { kind: 'splash', value: 1.3 } },
    aura: { name: 'Night Raid', text: 'Dark heroes +40% ATK.', effect: { kind: 'atk', value: 1.4, team: true, element: 'dark' } } },
  // Neko (Neko)
  { id: 'gloom', rarity: 'rare', name: 'Gloom', element: 'dark', type: 'Brawler', baseAtk: 5.5, baseHp: 85, range: 28, attackCooldown: 0.9, moveSpeed: 140, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    signature: { kind: 'combo', perHit: 0.08, max: 0.4 },
    ult: { kind: 'strike', mult: 2.5, plusMult: 3.5 },
    ultPlus: 'The blow hits for 140x ATK.',
    bio: 'A shadow gorilla with smoke for fur and fists like boulders. It gets angrier with every punch.',
    basic: { name: 'Shadow Fist', text: 'Heavy punches at the nearest enemy ahead.' },
    ultimate: { name: 'Wild Blow', text: 'One huge blow on the toughest enemy in reach for 100x ATK, with element bonuses.' },
    trait: { name: 'Rising Fury', text: `Each hit in a row on the same enemy deals +8% damage, up to +40%; the streak ends when it switches target. ${VS.dark}` },
    sp1: { name: 'Gorilla Combo', text: '25% chance for each attack to strike twice.', effect: { kind: 'doubleStrike', value: 0.25 } },
    sp2: { name: 'Thick Hide', text: '+20% HP.', effect: { kind: 'hp', value: 1.2 } },
    aura: { name: 'Shadow Stride', text: 'Dark heroes move 25% faster.', effect: { kind: 'moveSpeed', value: 1.25, team: true, element: 'dark' } } },
  // Sorrow (Sorrow)
  { id: 'mourn', rarity: 'rare', name: 'Mourn', element: 'dark', type: 'Gunner', flying: true, baseAtk: 6.5, baseHp: 48, range: 190, attackCooldown: 1.6, moveSpeed: 120, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    ult: { kind: 'strike', mult: 3, plusMult: 4 },
    ultPlus: 'The shot hits for 160x ATK.',
    bio: 'A weeping ghost drifting on grey mist, with a hand cannon far too heavy for something with no legs.',
    basic: { name: 'Grave Shot', text: 'Slow, heavy long-range shots at the nearest enemy.' },
    ultimate: { name: 'Sniper Shot', text: 'One fatal shot at the toughest enemy in reach for 120x ATK, with element bonuses.' },
    trait: { name: 'Tears of Lead', text: `Her shots can stun (15%). ${VS.dark}` },
    sp1: { name: 'Fatal Weakness', text: 'Shots pierce 2 more enemies.', effect: { kind: 'pierce', value: 2 } },
    sp2: { name: 'Crusher', text: 'Deals 30% more damage to bosses.', effect: { kind: 'bossDamage', value: 1.3 } },
    aura: { name: 'Lament', text: 'Whole team +15% ATK.', effect: { kind: 'atk', value: 1.15, team: true } } },

  // ---- Epics ----
  // Necromancer (Necromancer)
  { id: 'grimsby', rarity: 'epic', name: 'Grimsby', element: 'dark', type: 'Magician', baseAtk: 9.2, baseHp: 52, range: 160, attackCooldown: 1.5, moveSpeed: 100, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, splash: 40,
    ult: { kind: 'meteor', seconds: 6, groundDps: 1.5, second: 0.5 },
    ultPlus: 'A second gout of dark fire lands a moment later for half damage.',
    bio: 'A lich undertaker in a top hat and tattered coat, who digs graves for his enemies and raises what he finds in them.',
    basic: { name: 'Grave Bolt', text: 'Ranged bolts of dark energy that splash every enemy near the target.' },
    ultimate: { name: 'Dark Flames', text: `${ULT('A bone dragon breathes dark fire over')} Leaves burning ground for 6 seconds that burns anything walking through it.` },
    trait: { name: 'Undertaker', text: `Commands the dead from the back line. ${VS.dark}` },
    sp1: { name: 'Raise the Dead', text: 'Every 5th spell takes over a regular enemy for 5 s: it fights the other enemies.', effect: { kind: 'charm', value: 5, every: 5 } },
    sp2: { name: 'Grave Reach', text: '+15% splash damage.', effect: { kind: 'aoeDmg', value: 0.15 } },
    aura: { name: 'Bone Legion', text: 'Dark heroes +20% HP.', effect: { kind: 'hp', value: 1.2, team: true, element: 'dark' } } },
  // Onyx (Onyx)
  { id: 'weaver', rarity: 'epic', name: 'Weaver', element: 'dark', type: 'Lancer', baseAtk: 6.4, baseHp: 66, range: 38, attackCooldown: 1.1, moveSpeed: 120, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    ult: { kind: 'root', seconds: 3, bossSeconds: 1, shield: 0.15 },
    ultPlus: 'The web also shields every hero for 15% of their max HP.',
    bio: 'A giant black spider with a lance in two of her eight legs and a web for everything else.',
    basic: { name: 'Fang Lance', text: 'Spear thrusts with a little extra reach at the nearest enemy ahead.' },
    ultimate: { name: 'Fulgurating Lance', text: `${ULT('A giant lance of darkness crashes into')} Webs hold them in place for 3 seconds (bosses for 1).` },
    trait: { name: 'Venom Lance', text: `Her thrusts often stun (30%). ${VS.dark}` },
    sp1: { name: 'Smash Attack', text: 'Every 3rd attack smashes the ground for 1.8x damage to every enemy near the target.', effect: { kind: 'slam', value: 1.8, every: 3 } },
    sp2: { name: 'Chitin', text: '+40% Defense.', effect: { kind: 'def', value: 1.4 } },
    aura: { name: 'Black Widow', text: 'Whole team +20% ATK.', effect: { kind: 'atk', value: 1.2, team: true } } },
  // Trickster (Trickster)
  { id: 'hex', rarity: 'epic', name: 'Hex', element: 'dark', type: 'Magician', baseAtk: 9, baseHp: 55, range: 150, attackCooldown: 1.1, moveSpeed: 130, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, splash: 32,
    signature: { kind: 'slow', chance: 0.25, mult: 0.5, seconds: 3 },
    ult: { kind: 'mark', mult: 1.3, seconds: 5, plusMult: 1.5, plusSeconds: 8 },
    ultPlus: 'The cards stick for 8 seconds and add 50% instead of 30%.',
    bio: 'A grinning imp jester in a belled cap, who deals cursed cards from a deck that never runs out.',
    basic: { name: 'Magic Card', text: 'Ranged cursed cards that splash every enemy near the target.' },
    ultimate: { name: 'Cards Attack', text: `${ULT('A storm of cursed cards hits')} Marks them: they take 30% more damage from the whole team for 5 seconds.` },
    trait: { name: 'Bad Hand', text: `Cards have a 25% chance to slow enemies to half speed for 3 s, and can stun (8%). ${VS.dark}` },
    sp1: { name: 'Cards Cascade', text: 'Every 4th card fans out into the enemies just behind the target; everyone hit takes 25% more damage for 4 s.', effect: { kind: 'snowball', value: 1.25, every: 4 } },
    sp2: { name: 'Sleight of Hand', text: 'Attacks 15% faster.', effect: { kind: 'attackSpeed', value: 0.85 } },
    aura: { name: "Jester's Curse", text: 'Enemies take 6% more damage.', effect: { kind: 'enemyVuln', value: 1.06, team: true } } },

  // ---- Legendary ----
  // Ornok (Ornok)
  { id: 'malgrave', rarity: 'legendary', name: 'Malgrave', element: 'dark', type: 'Knight', baseAtk: 4, baseHp: 170, range: 30, attackCooldown: 1.0, moveSpeed: 110, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, steadfast: true,
    signature: { kind: 'knockback', push: 30 },
    ult: { kind: 'weaken', mult: 0.4, seconds: 6, plusSeconds: 10 },
    ultPlus: 'Enemies stay blinded for 10 s.',
    bio: 'A dark minotaur king in black iron and a broken crown, with a tower shield and a sword to match.',
    basic: { name: 'Kingsword', text: 'Heavy sword blows that shove enemies back a step.' },
    ultimate: { name: 'Blinding Explosion', text: 'A blast of black light hits every enemy ahead for 40x ATK; blinded, they deal 60% less damage for 6 s.' },
    trait: { name: 'Horned King', text: `His blows push regular enemies back, and boss blows never stun him. ${VS.dark}` },
    sp1: { name: 'Shield Force', text: 'Every 4th attack bursts a force field from his shield for 2.5x damage to every enemy near the target.', effect: { kind: 'slam', value: 2.5, every: 4 } },
    sp2: { name: 'Iron Crown', text: 'Takes 20% less damage.', effect: { kind: 'damageTaken', value: 0.8 } },
    aura: { name: 'Royal Guard', text: 'Whole team +25% HP.', effect: { kind: 'hp', value: 1.25, team: true } } },

  // ---- Commons ----
  // Bat (Bat)
  { id: 'flit', rarity: 'common', name: 'Flit', element: 'dark', type: 'Magician', flying: true, baseAtk: 7.2, baseHp: 38, range: 140, attackCooldown: 1.1, moveSpeed: 160, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, splash: 30,
    bio: 'A small, very loud bat who spits balls of darkness and never stays in one place.',
    basic: { name: 'Dark Spit', text: 'Ranged balls of dark energy that splash every enemy near the target.' },
    ultimate: { name: 'Dark Orb Rain', text: ULT('A rain of dark orbs hits') },
    trait: { name: 'Night Flier', text: `Quick on the wing: dodges 10% of attacks. ${VS.dark}` },
    sp1: { name: 'Rapid Darkness', text: '30% chance for each attack to cast twice.', effect: { kind: 'doubleStrike', value: 0.3 } },
    sp2: { name: 'Quick Wings', text: 'Attacks 15% faster.', effect: { kind: 'attackSpeed', value: 0.85 } },
    aura: { name: 'Echo Sense', text: 'Dark heroes dodge 5% more attacks.', effect: { kind: 'dodge', value: 0.05, team: true, element: 'dark' } } },
  // Dragon Bot (Dragon Bot)
  { id: 'drakebot', rarity: 'common', name: 'Drakebot', element: 'dark', type: 'Gunner', flying: true, baseAtk: 5.2, baseHp: 42, range: 165, attackCooldown: 1.0, moveSpeed: 130, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    bio: 'A clockwork flying dragon of black brass, ticking loudly and breathing dark orbs.',
    basic: { name: 'Dark Shot', text: 'Long-range dark orbs at the nearest enemy.' },
    ultimate: { name: 'Big Laser', text: ULT('Huge dark lasers sweep') },
    trait: { name: 'Clockwork Core', text: `Gears do not care much for curses: 30% Effect Resistance. ${VS.dark}` },
    sp1: { name: 'Dragon Breath', text: 'Each shot also hits the next 2 enemies just behind the target.', effect: { kind: 'pierce', value: 2 } },
    sp2: { name: 'Tuned Sights', text: '+10% critical hit chance.', effect: { kind: 'crit', value: 0.1 } },
    aura: { name: 'Brass Plating', text: 'Dark heroes +10% Effect Resistance.', effect: { kind: 'effectRes', value: 0.1, team: true, element: 'dark' } } },
];

export const DARK_PROFILES: Record<string, HeroProfile> = {
  howl: { stunChance: 0.12, effectRes: 0.3, crit: 0.05, specialty: 'Moon howl: 12% chance to stun and 30% Effect Resistance, rarely crits (5%)' },
  corvin: { crit: 0.25, dodge: 0.12, hpMult: 0.9, specialty: 'Crow wings: 25% crit and dodges 12% of attacks, a little less HP' },
  vesper: { aoeDmg: 0.15, critDmg: 1.8, specialty: 'Mortar crew: +15% splash damage, but softer crits (+180%)' },
  gloom: { crit: 0.2, frenzy: 0.15, defMult: 2, specialty: 'Silverback: 20% crit and 15% Frenzy, but less Defense (2x)' },
  mourn: { stunChance: 0.15, critDmg: 2.6, crit: 0.1, specialty: 'Grave sight: 15% chance to stun and crits hit for +260%, but crits land less often (10%)' },
  grimsby: { ultAtk: 0.2, effectRes: 0.35, crit: 0.05, specialty: 'Undertaker: +20% Ultimate damage and 35% Effect Resistance, rarely crits (5%)' },
  weaver: { stunChance: 0.3, crit: 0.08, specialty: 'Web lance: 30% chance to stun, but rarely crits (8%)' },
  hex: { stunChance: 0.08, effectTime: 0.25, crit: 0.12, hpMult: 0.9, specialty: 'Card tricks: 8% chance to stun, stuns last 25% longer and 12% crit, a little less HP' },
  malgrave: { defMult: 5.5, effectRes: 0.7, shield: 0.5, atkMult: 1.1, crit: 0.03, specialty: 'Minotaur king: 5.5x Defense, 70% Effect Resistance, +50% Knight Shield and +10% ATK, rarely crits (3%)' },
  flit: { dodge: 0.1, crit: 0.12, hpMult: 0.9, specialty: 'Echo wings: dodges 10% of attacks and 12% crit, a little less HP' },
  drakebot: { effectRes: 0.3, critDmg: 2, frenzy: 0.05, specialty: 'Clockwork core: 30% Effect Resistance, but softer crits (+200%) and less Frenzy (5%)' },
};
