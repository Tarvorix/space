// Ship and combat constants for BattleBarge

export const FIRE_ARCS = {
  PROW: 'prow',
  PORT: 'port',
  STARBOARD: 'starboard',
  DORSAL: 'dorsal',
  REAR: 'rear',
};

export const WEAPON_TYPES = {
  BATTERY: 'battery',
  LANCE: 'lance',
  TORPEDO: 'torpedo',
};

export const ORDERS = {
  THRUST: 'thrust',
  BRAKE: 'brake',
  COAST: 'coast',
  BRACE: 'brace',
};

export const RANGES = {
  CLOSE: 6,
  MEDIUM: 18,
  LONG: 30,
  MAX: 60,
};

export const PLAYER_CRUISER = {
  name: 'Imperial Cruiser',
  modelFile: 'Imperial_Cruiser.glb',
  modelScale: 2.5,

  hits: 8,
  armorFront: 6,
  armorOther: 5,
  shields: 2,
  turrets: 2,

  thrust: 3,
  rotate: 45,
  maxSpeed: 12,

  weapons: [
    { name: 'Port Weapons Battery', type: WEAPON_TYPES.BATTERY, range: 30, firepower: 6, arc: FIRE_ARCS.PORT },
    { name: 'Stbd Weapons Battery', type: WEAPON_TYPES.BATTERY, range: 30, firepower: 6, arc: FIRE_ARCS.STARBOARD },
    { name: 'Port Lance', type: WEAPON_TYPES.LANCE, range: 30, strength: 2, arc: FIRE_ARCS.PORT },
    { name: 'Stbd Lance', type: WEAPON_TYPES.LANCE, range: 30, strength: 2, arc: FIRE_ARCS.STARBOARD },
    { name: 'Prow Torpedoes', type: WEAPON_TYPES.TORPEDO, range: 30, speed: 15, strength: 6, arc: FIRE_ARCS.PROW },
  ],
};

export const AI_CRUISER = {
  name: 'Serpent Class Cruiser',
  modelFile: 'Serpent_Cruiser.glb',
  modelScale: 2.5,

  hits: 8,
  armorFront: 5,
  armorOther: 5,
  shields: 2,
  turrets: 2,

  thrust: 4,
  rotate: 45,
  maxSpeed: 14,

  weapons: [
    { name: 'Port Weapons Battery', type: WEAPON_TYPES.BATTERY, range: 45, firepower: 10, arc: FIRE_ARCS.PORT },
    { name: 'Stbd Weapons Battery', type: WEAPON_TYPES.BATTERY, range: 45, firepower: 10, arc: FIRE_ARCS.STARBOARD },
    { name: 'Prow Lance', type: WEAPON_TYPES.LANCE, range: 60, strength: 2, arc: FIRE_ARCS.PROW },
  ],
};

export const CRITICAL_HITS = [
  { roll: 2, name: 'Dorsal Armament Damaged', extraDamage: 0, effect: 'dorsal_damaged', repairable: true },
  { roll: 3, name: 'Starboard Armament Damaged', extraDamage: 0, effect: 'starboard_damaged', repairable: true },
  { roll: 4, name: 'Port Armament Damaged', extraDamage: 0, effect: 'port_damaged', repairable: true },
  { roll: 5, name: 'Prow Armament Damaged', extraDamage: 0, effect: 'prow_damaged', repairable: true },
  { roll: 6, name: 'Engine Room Damaged', extraDamage: 1, effect: 'engines_damaged', repairable: true },
  { roll: 7, name: 'Fire!', extraDamage: 0, effect: 'fire', repairable: true },
  { roll: 8, name: 'Thrusters Damaged', extraDamage: 1, effect: 'thrusters_damaged', repairable: true },
  { roll: 9, name: 'Bridge Smashed', extraDamage: 0, effect: 'bridge_smashed', repairable: false },
  { roll: 10, name: 'Shields Collapse', extraDamage: 0, effect: 'shields_collapse', repairable: false },
  { roll: 11, name: 'Hull Breach', extraDamage: 'D3', effect: 'hull_breach', repairable: false },
  { roll: 12, name: 'Bulkhead Collapse', extraDamage: 'D6', effect: 'bulkhead_collapse', repairable: false },
];

export const CATASTROPHIC_DAMAGE = [
  { rollMin: 2, rollMax: 6, name: 'Drifting Hulk', blastMarkers: 1, effect: 'drifting_hulk' },
  { rollMin: 7, rollMax: 8, name: 'Blazing Hulk', blastMarkers: 1, effect: 'blazing_hulk' },
  { rollMin: 9, rollMax: 11, name: 'Plasma Drive Overload', blastMarkers: 'half', effect: 'plasma_explosion' },
  { rollMin: 12, rollMax: 12, name: 'Warp Drive Implosion', blastMarkers: 'full', effect: 'warp_implosion' },
];
