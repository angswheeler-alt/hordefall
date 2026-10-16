import type { HeroDef, Element } from '../data';
import type { HeroProfile } from '../profiles';
import { VS, ULT } from '../heroText';

/**
 * Crush's troop Commons (design/crush-full-roster.md): Bugonaut, Vulcan, Voodoo and Skeleton troops become our
 * Crabkin, Magmites, Mudmasks and Bonekin. Archers, fighters and spears are squads of 3 small fighters in one slot
 * (HeroDef.squad); each faction's giant is one big hero. Crush lists no SP4 for these, so the auras are our own.
 */
const SQUAD = 3;
const base = { rarity: 'common' as const, unlockCost: 50, upgradeBaseCost: 15 };

type Faction = { name: string; element: Element; kin: string; look: string };
const CRAB: Faction = { name: 'Crabkin', element: 'water', kin: 'crab', look: 'little blue crab soldiers in shell helmets' };
const MAGMA: Faction = { name: 'Magmite', element: 'fire', kin: 'imp', look: 'little lava imps with glowing cracks' };
const MUD: Faction = { name: 'Mudmask', element: 'earth', kin: 'goblin', look: 'little mud goblins in carved wooden masks' };
const BONE: Faction = { name: 'Bonekin', element: 'dark', kin: 'skeleton', look: 'little skeletons in dented helmets' };

/** A squad of archers: always crit flyers, and every arrow volley pierces. */
function archers(f: Faction, id: string, o: { atk: number; hp: number; range: number; sp2: HeroDef['sp2']; aura: HeroDef['aura'] }): HeroDef {
  return {
    ...base, id, name: `${f.name} Archers`, element: f.element, type: 'Ranger', squad: SQUAD, signature: { kind: 'skyCrit' },
    baseAtk: o.atk, baseHp: o.hp, range: o.range, attackCooldown: 1.0, moveSpeed: 115, goldMult: 1,
    bio: `A squad of three ${f.look}, with bows. They fight as one hero.`,
    basic: { name: 'Arrows', text: 'Three archers shoot at the nearest enemy, each with a third of the ATK.' },
    ultimate: { name: 'Arrow Shower', text: ULT('A shower of arrows falls on') },
    trait: { name: 'Sky Watch', text: `Shots at flying enemies always crit. ${VS[f.element]}` },
    sp1: { name: 'Multi Fire', text: 'Arrows pierce 1 more enemy.', effect: { kind: 'pierce', value: 1 } },
    sp2: o.sp2,
    aura: o.aura,
  };
}

/** A squad of fighters: quick blades, dodge and double gold. */
function fighters(f: Faction, id: string, label: string, o: { atk: number; hp: number; speed: number; sp2: HeroDef['sp2']; aura: HeroDef['aura'] }): HeroDef {
  return {
    ...base, id, name: `${f.name} ${label}`, element: f.element, type: 'Rogue', squad: SQUAD,
    baseAtk: o.atk, baseHp: o.hp, range: 24, attackCooldown: 0.65, moveSpeed: o.speed, goldMult: 2,
    bio: `A squad of three ${f.look}, with short blades. They fight as one hero.`,
    basic: { name: 'Blades', text: 'Three fighters slash at the closest enemy, each with a third of the ATK.' },
    ultimate: { name: 'Blade Rain', text: ULT('Giant blades rain down on') },
    trait: { name: 'Scrappers', text: `Dodge attacks and earn 2x gold from every kill. ${VS[f.element]}` },
    sp1: { name: 'Multi Hit', text: 'Every 4th attack is a flurry (2.5x damage).', effect: { kind: 'everyNth', value: 2.5, every: 4 } },
    sp2: o.sp2,
    aura: o.aura,
  };
}

/** A squad of spears: reach, stuns, and thrusts through the line. */
function spears(f: Faction, id: string, o: { atk: number; hp: number; sp2: HeroDef['sp2']; aura: HeroDef['aura'] }): HeroDef {
  return {
    ...base, id, name: `${f.name} Spears`, element: f.element, type: 'Lancer', squad: SQUAD,
    baseAtk: o.atk, baseHp: o.hp, range: 36, attackCooldown: 1.0, moveSpeed: 110, goldMult: 1,
    bio: `A squad of three ${f.look}, with long spears. They fight as one hero.`,
    basic: { name: 'Spear Hit', text: 'Three spears thrust at the nearest enemy ahead, each with a third of the ATK.' },
    ultimate: { name: 'Spear Wave', text: ULT('A wave of flying spears hits') },
    trait: { name: 'Spear Wall', text: `Their thrusts can stun. ${VS[f.element]}` },
    sp1: { name: 'Piercing Thrust', text: 'Each thrust also hits the next 2 enemies just behind the target.', effect: { kind: 'pierce', value: 2 } },
    sp2: o.sp2,
    aura: o.aura,
  };
}

/** A faction's giant: one big hero, never stunned by bosses. */
function giant(f: Faction, id: string, o: { name: string; atk: number; hp: number; bio: string; basic: string; sp1: HeroDef['sp1']; sp2: HeroDef['sp2']; aura: HeroDef['aura'] }): HeroDef {
  return {
    ...base, id, name: o.name, element: f.element, type: 'Barbarian', steadfast: true,
    baseAtk: o.atk, baseHp: o.hp, range: 30, attackCooldown: 1.6, moveSpeed: 100, goldMult: 1,
    bio: o.bio,
    basic: { name: o.basic, text: 'Slow, crushing swings at the nearest enemy ahead.' },
    ultimate: { name: 'Giant Smash', text: ULT('A huge weapon slams down on') },
    trait: { name: 'Big and Steady', text: `Boss blows never stun it. ${VS[f.element]}` },
    sp1: o.sp1,
    sp2: o.sp2,
    aura: o.aura,
  };
}

export const SQUAD_HEROES: HeroDef[] = [
  // Crabkin (Bugonaut)
  archers(CRAB, 'crabarchers', { atk: 5, hp: 42, range: 175,
    sp2: { name: 'Tide Aim', text: '+10% critical hit chance.', effect: { kind: 'crit', value: 0.1 } },
    aura: { name: 'Shell Line', text: 'Water heroes get +20% Defense.', effect: { kind: 'def', value: 1.2, team: true, element: 'water' } } }),
  fighters(CRAB, 'crabscrappers', 'Scrappers', { atk: 4.6, hp: 50, speed: 150,
    sp2: { name: 'Pincer Grip', text: 'Heals for 10% of the damage they deal.', effect: { kind: 'lifesteal', value: 0.1 } },
    aura: { name: 'Crab Rush', text: 'Water heroes move 15% faster.', effect: { kind: 'moveSpeed', value: 1.15, team: true, element: 'water' } } }),
  spears(CRAB, 'crabspears', { atk: 5.8, hp: 55,
    sp2: { name: 'Claw Brace', text: 'Takes 15% less damage.', effect: { kind: 'damageTaken', value: 0.85 } },
    aura: { name: 'Shoal Spirit', text: 'Water heroes +10% HP.', effect: { kind: 'hp', value: 1.1, team: true, element: 'water' } } }),
  giant(CRAB, 'crabbrute', { name: 'Crabkin Brute', atk: 6, hp: 72, basic: 'Club Hit',
    bio: 'One big hermit crab in a borrowed barrel shell, swinging a driftwood club.',
    sp1: { name: 'Multi Hit', text: 'Every 4th attack is three quick blows (2.5x damage).', effect: { kind: 'everyNth', value: 2.5, every: 4 } },
    sp2: { name: 'Barrel Shell', text: '+40% Defense.', effect: { kind: 'def', value: 1.4 } },
    aura: { name: 'Big Brother', text: 'Water heroes +10% ATK.', effect: { kind: 'atk', value: 1.1, team: true, element: 'water' } } }),

  // Magmites (Vulcan)
  archers(MAGMA, 'magmaarchers', { atk: 5.2, hp: 40, range: 170,
    sp2: { name: 'Hot Tips', text: '+20% damage to Burning enemies.', effect: { kind: 'vsBurning', value: 1.2 } },
    aura: { name: 'Ember Sight', text: 'Fire heroes +5% critical hit chance.', effect: { kind: 'crit', value: 0.05, team: true, element: 'fire' } } }),
  fighters(MAGMA, 'magmascrappers', 'Scrappers', { atk: 4.8, hp: 48, speed: 150,
    sp2: { name: 'Hot Knives', text: '+10% critical hit chance.', effect: { kind: 'crit', value: 0.1 } },
    aura: { name: 'Lava Run', text: 'Fire heroes move 15% faster.', effect: { kind: 'moveSpeed', value: 1.15, team: true, element: 'fire' } } }),
  giant(MAGMA, 'magmabrute', { name: 'Magmite Brute', atk: 7, hp: 66, basic: 'Mace Hit',
    bio: 'One big lava imp, belly glowing like a forge, with a stone hammer.',
    sp1: { name: 'Multi Hammer', text: 'Every 4th attack is three quick blows (3x damage).', effect: { kind: 'everyNth', value: 3, every: 4 } },
    sp2: { name: 'Molten Hide', text: 'Reflects 10% of the damage it takes.', effect: { kind: 'reflect', value: 0.1 } },
    aura: { name: 'Forge Heat', text: 'Fire heroes +10% ATK.', effect: { kind: 'atk', value: 1.1, team: true, element: 'fire' } } }),

  // Mudmasks (Voodoo)
  archers(MUD, 'mudarchers', { atk: 5, hp: 46, range: 180,
    sp2: { name: 'Swamp Darts', text: 'Attacks 10% faster.', effect: { kind: 'attackSpeed', value: 0.9 } },
    aura: { name: 'Mask Ward', text: 'Earth heroes +10% Effect Resistance.', effect: { kind: 'effectRes', value: 0.1, team: true, element: 'earth' } } }),
  fighters(MUD, 'muddaggers', 'Daggers', { atk: 5.2, hp: 45, speed: 170,
    sp2: { name: 'Mask Grin', text: '+20% critical damage.', effect: { kind: 'critDmg', value: 0.2 } },
    aura: { name: 'Jungle Step', text: 'Earth heroes dodge 5% more attacks.', effect: { kind: 'dodge', value: 0.05, team: true, element: 'earth' } } }),
  spears(MUD, 'mudspears', { atk: 5.8, hp: 52,
    sp2: { name: 'Bog Grip', text: '+20% damage to bosses.', effect: { kind: 'bossDamage', value: 1.2 } },
    aura: { name: 'War Drums', text: 'Earth heroes +10% ATK.', effect: { kind: 'atk', value: 1.1, team: true, element: 'earth' } } }),

  // Bonekin (Skeleton)
  archers(BONE, 'bonearchers', { atk: 5.4, hp: 40, range: 185,
    sp2: { name: 'Hollow Eyes', text: '+30% critical damage.', effect: { kind: 'critDmg', value: 0.3 } },
    aura: { name: 'Grave Volley', text: 'Dark heroes +5% critical hit chance.', effect: { kind: 'crit', value: 0.05, team: true, element: 'dark' } } }),
  fighters(BONE, 'boneswords', 'Swords', { atk: 4.6, hp: 56, speed: 160,
    sp2: { name: 'Rattle Back', text: 'Comes back 20% faster after falling.', effect: { kind: 'respawn', value: 0.8 } },
    aura: { name: 'Bone March', text: 'Dark heroes move 15% faster.', effect: { kind: 'moveSpeed', value: 1.15, team: true, element: 'dark' } } }),
  giant(BONE, 'bonebrute', { name: 'Bonekin Brute', atk: 6.8, hp: 70, basic: 'Bone Club',
    bio: 'One big skeleton warrior with a rib-cage shield and a club made from a thigh bone.',
    sp1: { name: 'Shockwave Stomp', text: 'Every 3rd attack stomps for 1.5x damage to every enemy near the target.', effect: { kind: 'slam', value: 1.5, every: 3 } },
    sp2: { name: 'Thick Bones', text: '+15% HP.', effect: { kind: 'hp', value: 1.15 } },
    aura: { name: 'Dread March', text: 'Dark heroes +10% HP.', effect: { kind: 'hp', value: 1.1, team: true, element: 'dark' } } }),
];

export const SQUAD_PROFILES: Record<string, HeroProfile> = {
  crabarchers: { crit: 0.1, effectRes: 0.1, specialty: 'Crab squad: three archers, 10% crit and 10% Effect Resistance' },
  crabscrappers: { dodge: 0.1, crit: 0.1, defMult: 1, specialty: 'Crab squad: three fighters, 10% dodge, tougher shells than other Rogues' },
  crabspears: { stunChance: 0.3, crit: 0.1, critDmg: 1, specialty: 'Crab squad: three spears, 30% chance to stun, softer crits (+100%)' },
  crabbrute: { crit: 0.2, critDmg: 1, effectRes: 0.06, specialty: 'Hermit giant: 20% crit, but softer crits (+100%) and only 6% Effect Resistance' },
  magmaarchers: { burnChance: 0.15, crit: 0.15, critDmg: 1.8, specialty: 'Imp squad: three archers, 15% chance to burn, softer crits (+180%)' },
  magmascrappers: { dodge: 0.1, crit: 0.15, effectRes: 0.06, specialty: 'Imp squad: three fighters, 10% dodge and 15% crit, only 6% Effect Resistance' },
  magmabrute: { crit: 0.15, frenzy: 0.08, atkMult: 1.05, hpMult: 0.95, specialty: 'Lava giant: +5% ATK, a little less HP and less Frenzy (8%)' },
  mudarchers: { poisonChance: 0.15, crit: 0.15, critDmg: 1.7, specialty: 'Goblin squad: three archers, 15% chance to poison, softer crits (+170%)' },
  muddaggers: { poisonChance: 0.1, dodge: 0.1, crit: 0.35, hpMult: 0.9, specialty: 'Goblin squad: three daggers, 35% crit and 10% poison chance, less HP' },
  mudspears: { poisonChance: 0.1, stunChance: 0.3, crit: 0.15, specialty: 'Goblin squad: three spears, 30% stun and 10% poison chance' },
  bonearchers: { crit: 0.1, critDmg: 2.2, specialty: 'Skeleton squad: three archers, crits hit for +220% but land less often (10%)' },
  boneswords: { dodge: 0.1, crit: 0.1, hpMult: 1.05, specialty: 'Skeleton squad: three fighters, 10% dodge and +5% HP, only 10% crit' },
  bonebrute: { crit: 0.15, critDmg: 1.6, defMult: 2, specialty: 'Bone giant: 2x Defense for a Barbarian, softer crits (+160%)' },
};
