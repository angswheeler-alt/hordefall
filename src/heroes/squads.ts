import type { HeroDef, Element } from '../data';
import type { HeroProfile } from '../profiles';
import { VS, ULT } from '../heroText';

/**
 * Squad Commons of four factions: Crabkin, Magmites, Mudmasks and Bonekin. Archers, fighters and spears are squads
 * of 3 small fighters in one slot (HeroDef.squad); each faction's giant is one big hero.
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
    basic: { name: 'Volley', text: 'Three archers shoot at the nearest enemy, each with a third of the ATK.' },
    ultimate: { name: 'Squad Barrage', text: ULT('A shower of arrows falls on') },
    trait: { name: 'Sky Watch', text: `Shots at flying enemies always crit. ${VS[f.element]}` },
    sp1: { name: 'Pierce Shot', text: 'Arrows pierce 1 more enemy.', effect: { kind: 'pierce', value: 1 } },
    sp2: o.sp2,
    aura: o.aura,
  };
}

/** A squad of fighters: quick blades, dodge and double gold. */
function fighters(f: Faction, id: string, label: string, o: { atk: number; hp: number; speed: number; sp2: HeroDef['sp2']; aura: HeroDef['aura'] }): HeroDef {
  return {
    ...base, id, name: `${f.name} ${label}`, element: f.element, type: 'Rogue', squad: SQUAD,
    baseAtk: o.atk, baseHp: o.hp, range: 24, attackCooldown: 0.55, moveSpeed: o.speed, goldMult: 2,
    bio: `A squad of three ${f.look}, with short blades. They fight as one hero.`,
    basic: { name: 'Blades', text: 'Three fighters slash at the closest enemy, each with a third of the ATK.' },
    ultimate: { name: 'Blade Rain', text: ULT('Giant blades rain down on') },
    trait: { name: 'Scrappers', text: `Dodge attacks and earn 2x gold from every kill. ${VS[f.element]}` },
    sp1: { name: 'Pack Flurry', text: 'Every 4th attack is a flurry (2.5x damage).', effect: { kind: 'everyNth', value: 2.5, every: 4 } },
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
    basic: { name: 'Spear Line', text: 'Three spears thrust at the nearest enemy ahead, each with a third of the ATK.' },
    ultimate: { name: 'Spear Toss', text: ULT('A wave of flying spears hits') },
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
  { ...archers(CRAB, 'crabarchers', { atk: 5, hp: 42, range: 175,
    sp2: { name: 'Tide Aim', text: '+10% critical hit chance.', effect: { kind: 'crit', value: 0.1 } },
    aura: { name: 'Shell Line', text: 'Water heroes get +20% Defense.', effect: { kind: 'def', value: 1.2, team: true, element: 'water' } } }), name: 'Shrimp Archers', bio: 'A squad of three little mantis shrimp with eyes on stalks, with bows. They fight as one hero.' },
  { ...fighters(CRAB, 'crabscrappers', 'Scrappers', { atk: 5.8, hp: 50, speed: 150,
    sp2: { name: 'Feeding Frenzy', text: 'Heals for 10% of the damage they deal.', effect: { kind: 'lifesteal', value: 0.1 } },
    aura: { name: 'Shoal Rush', text: 'Water heroes move 15% faster.', effect: { kind: 'moveSpeed', value: 1.15, team: true, element: 'water' } } }), name: 'Piranha Scrappers', bio: 'A squad of three toothy piranhas on stubby legs, with short knives. They fight as one hero.' },
  { ...spears(CRAB, 'crabspears', { atk: 5.8, hp: 55,
    sp2: { name: 'Claw Brace', text: 'Takes 15% less damage.', effect: { kind: 'damageTaken', value: 0.85 } },
    aura: { name: 'Shoal Spirit', text: 'Water heroes +10% HP.', effect: { kind: 'hp', value: 1.1, team: true, element: 'water' } } }), name: 'Lobster Spears', bio: 'A squad of three little lobster soldiers, with long spears. They fight as one hero.' },
  { ...giant(CRAB, 'crabbrute', { name: 'Crabkin Brute', atk: 6, hp: 72, basic: 'Club Hit',
    bio: 'One big hermit crab in a borrowed barrel shell, swinging a driftwood club.',
    sp1: { name: 'Shell Pummel', text: 'Every 4th attack is three quick blows (2.5x damage).', effect: { kind: 'everyNth', value: 2.5, every: 4 } },
    sp2: { name: 'Barrel Shell', text: '+40% Defense.', effect: { kind: 'def', value: 1.4 } },
    aura: { name: 'Big Brother', text: 'Water heroes +10% ATK.', effect: { kind: 'atk', value: 1.1, team: true, element: 'water' } } }), name: 'Hermit Brute', bio: 'One big hermit crab in a borrowed barrel shell, swinging a driftwood club.' },

  { ...archers(MAGMA, 'magmaarchers', { atk: 5.2, hp: 40, range: 170,
    sp2: { name: 'Hot Tips', text: '+20% damage to Burning enemies.', effect: { kind: 'vsBurning', value: 1.2 } },
    aura: { name: 'Ember Sight', text: 'Fire heroes +5% critical hit chance.', effect: { kind: 'crit', value: 0.05, team: true, element: 'fire' } } }), name: 'Imp Archers', bio: 'A squad of three little fire imps with glowing lava cracks, with bows. They fight as one hero.' },
  { ...fighters(MAGMA, 'magmascrappers', 'Scrappers', { atk: 6, hp: 48, speed: 150,
    sp2: { name: 'Hot Knives', text: '+10% critical hit chance.', effect: { kind: 'crit', value: 0.1 } },
    aura: { name: 'Lava Run', text: 'Fire heroes move 15% faster.', effect: { kind: 'moveSpeed', value: 1.15, team: true, element: 'fire' } } }), name: 'Fire Ant Scrappers', bio: 'A squad of three fire ants with glowing bellies, with tiny knives. They fight as one hero.' },
  { ...giant(MAGMA, 'magmabrute', { name: 'Magmite Brute', atk: 7, hp: 66, basic: 'Lava Mace',
    bio: 'One big lava imp, belly glowing like a forge, with a stone hammer.',
    sp1: { name: 'Multi Hammer', text: 'Every 4th attack is three quick blows (3x damage).', effect: { kind: 'everyNth', value: 3, every: 4 } },
    sp2: { name: 'Molten Hide', text: 'Reflects 10% of the damage it takes.', effect: { kind: 'reflect', value: 0.1 } },
    aura: { name: 'Forge Heat', text: 'Fire heroes +10% ATK.', effect: { kind: 'atk', value: 1.1, team: true, element: 'fire' } } }), name: 'Lava Ogre', bio: 'One big ogre with a belly glowing like a furnace and a stone hammer.' },

  archers(MUD, 'mudarchers', { atk: 5, hp: 46, range: 180,
    sp2: { name: 'Swamp Darts', text: 'Attacks 10% faster.', effect: { kind: 'attackSpeed', value: 0.9 } },
    aura: { name: 'Mask Ward', text: 'Earth heroes +10% Effect Resistance.', effect: { kind: 'effectRes', value: 0.1, team: true, element: 'earth' } } }),
  { ...fighters(MUD, 'muddaggers', 'Daggers', { atk: 6.4, hp: 45, speed: 170,
    sp2: { name: 'Mask Grin', text: '+20% critical damage.', effect: { kind: 'critDmg', value: 0.2 } },
    aura: { name: 'Jungle Step', text: 'Earth heroes dodge 5% more attacks.', effect: { kind: 'dodge', value: 0.05, team: true, element: 'earth' } } }), name: 'Kobold Daggers', bio: 'A squad of three scrappy little kobolds, with stone daggers. They fight as one hero.' },
  { ...spears(MUD, 'mudspears', { atk: 5.8, hp: 52,
    sp2: { name: 'Bog Grip', text: '+20% damage to bosses.', effect: { kind: 'bossDamage', value: 1.2 } },
    aura: { name: 'War Drums', text: 'Earth heroes +10% ATK.', effect: { kind: 'atk', value: 1.1, team: true, element: 'earth' } } }), name: 'Rootling Spears', bio: 'A squad of three little walking saplings, with sharpened stick spears. They fight as one hero.' },

  archers(BONE, 'bonearchers', { atk: 5.4, hp: 40, range: 185,
    sp2: { name: 'Hollow Eyes', text: '+30% critical damage.', effect: { kind: 'critDmg', value: 0.3 } },
    aura: { name: 'Grave Volley', text: 'Dark heroes +5% critical hit chance.', effect: { kind: 'crit', value: 0.05, team: true, element: 'dark' } } }),
  { ...fighters(BONE, 'boneswords', 'Swords', { atk: 5.8, hp: 56, speed: 160,
    sp2: { name: 'Rattle Back', text: 'Comes back 20% faster after falling.', effect: { kind: 'respawn', value: 0.8 } },
    aura: { name: 'Bone March', text: 'Dark heroes move 15% faster.', effect: { kind: 'moveSpeed', value: 1.15, team: true, element: 'dark' } } }), name: 'Plague Rat Swords', bio: 'A squad of three scrawny hooded rats, with rusty short swords. They fight as one hero.' },
  { ...giant(BONE, 'bonebrute', { name: 'Bonekin Brute', atk: 6.8, hp: 70, basic: 'Bone Club',
    bio: 'One big skeleton warrior with a rib-cage shield and a club made from a thigh bone.',
    sp1: { name: 'Bone Quake', text: 'Every 3rd attack stomps for 1.5x damage to every enemy near the target.', effect: { kind: 'slam', value: 1.5, every: 3 } },
    sp2: { name: 'Thick Bones', text: '+15% HP.', effect: { kind: 'hp', value: 1.15 } },
    aura: { name: 'Dread March', text: 'Dark heroes +10% HP.', effect: { kind: 'hp', value: 1.1, team: true, element: 'dark' } } }), name: 'Ghoul Brute', bio: 'One big hunched ghoul with a rib-cage shield and a bone club.' },
];

export const SQUAD_PROFILES: Record<string, HeroProfile> = {
  crabarchers: { crit: 0.1, effectRes: 0.1, specialty: 'Shrimp squad: three archers, 10% crit and 10% Effect Resistance' },
  crabscrappers: { dodge: 0.1, crit: 0.1, defMult: 1, specialty: 'Piranha squad: three fighters, 10% dodge, tougher shells than other Rogues' },
  crabspears: { stunChance: 0.3, crit: 0.1, critDmg: 1, specialty: 'Lobster squad: three spears, 30% chance to stun, softer crits (+100%)' },
  crabbrute: { crit: 0.2, critDmg: 1, effectRes: 0.06, specialty: 'Hermit giant: 20% crit, but softer crits (+100%) and only 6% Effect Resistance' },
  magmaarchers: { burnChance: 0.15, crit: 0.15, critDmg: 1.8, specialty: 'Imp squad: three archers, 15% chance to burn, softer crits (+180%)' },
  magmascrappers: { dodge: 0.1, crit: 0.15, effectRes: 0.06, specialty: 'Fire ant squad: three fighters, 10% dodge and 15% crit, only 6% Effect Resistance' },
  magmabrute: { crit: 0.15, frenzy: 0.08, atkMult: 1.05, hpMult: 0.95, specialty: 'Lava ogre: +5% ATK, a little less HP and less Frenzy (8%)' },
  mudarchers: { poisonChance: 0.15, crit: 0.15, critDmg: 1.7, specialty: 'Goblin squad: three archers, 15% chance to poison, softer crits (+170%)' },
  muddaggers: { poisonChance: 0.1, dodge: 0.1, crit: 0.35, hpMult: 0.9, specialty: 'Kobold squad: three daggers, 35% crit and 10% poison chance, less HP' },
  mudspears: { poisonChance: 0.1, stunChance: 0.3, crit: 0.15, specialty: 'Rootling squad: three spears, 30% stun and 10% poison chance' },
  bonearchers: { crit: 0.1, critDmg: 2.2, specialty: 'Skeleton squad: three archers, crits hit for +220% but land less often (10%)' },
  boneswords: { dodge: 0.1, crit: 0.1, hpMult: 1.05, specialty: 'Rat squad: three fighters, 10% dodge and +5% HP, only 10% crit' },
  bonebrute: { crit: 0.15, critDmg: 1.6, defMult: 2, specialty: 'Ghoul giant: 2x Defense for a Barbarian, softer crits (+160%)' },
};
