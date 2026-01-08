// Ship and combat constants for BattleBarge

export const FIRE_ARCS = {
  PROW: 'prow',
  FORE: 'fore',  // Alias for prow
  PORT: 'port',
  STARBOARD: 'starboard',
  DORSAL: 'dorsal',
  AFT: 'aft',
  REAR: 'rear',  // Alias for aft
};

export const ARMOR_FACINGS = {
  FORE: 'fore',
  AFT: 'aft',
  PORT: 'port',
  STARBOARD: 'starboard',
};

export const WEAPON_TYPES = {
  BATTERY: 'battery',
  LANCE: 'lance',
  TORPEDO: 'torpedo',
};

export const SHIP_CLASSES = {
  CRUISER: 'cruiser',
  FRIGATE: 'frigate',
  FIGHTER: 'fighter',
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

// =============================================================================
// IMPERIAL SHIPS
// =============================================================================

export const IMPERIAL_CRUISER = {
  name: 'Imperial Cruiser',
  class: SHIP_CLASSES.CRUISER,
  modelFile: 'Imperial_Cruiser.glb',
  modelScale: 2.5,

  // Survivability
  structure: 8,
  armor: {
    fore: 6,
    aft: 4,
    port: 5,
    starboard: 5,
  },
  shields: 2,
  turrets: 3,

  // Mobility
  thrust: 3,
  rotate: 45,
  maxSpeed: 12,

  // Hangar
  hangarCapacity: 12,
  flightSize: 3,

  // Weapons - 7 systems, ~32 dice total
  weapons: [
    { name: 'Port Battery', type: WEAPON_TYPES.BATTERY, arc: FIRE_ARCS.PORT, firepower: 8, range: 30 },
    { name: 'Stbd Battery', type: WEAPON_TYPES.BATTERY, arc: FIRE_ARCS.STARBOARD, firepower: 8, range: 30 },
    { name: 'Port Lance', type: WEAPON_TYPES.LANCE, arc: FIRE_ARCS.PORT, strength: 2, range: 30 },
    { name: 'Stbd Lance', type: WEAPON_TYPES.LANCE, arc: FIRE_ARCS.STARBOARD, strength: 2, range: 30 },
    { name: 'Dorsal Battery', type: WEAPON_TYPES.BATTERY, arc: FIRE_ARCS.DORSAL, firepower: 4, range: 30 },
    { name: 'Prow Torpedoes', type: WEAPON_TYPES.TORPEDO, arc: FIRE_ARCS.FORE, strength: 6, speed: 15, range: 30 },
    { name: 'Prow Lance', type: WEAPON_TYPES.LANCE, arc: FIRE_ARCS.FORE, strength: 2, range: 30 },
  ],
};

export const IMPERIAL_FRIGATE = {
  name: 'Imperial Frigate',
  class: SHIP_CLASSES.FRIGATE,
  modelFile: 'Imperial_Frigate.glb',
  modelScale: 1.5,

  // Survivability - lighter
  structure: 4,
  armor: {
    fore: 5,
    aft: 3,
    port: 4,
    starboard: 4,
  },
  shields: 1,
  turrets: 2,

  // Mobility - faster, more agile
  thrust: 5,
  rotate: 60,
  maxSpeed: 18,

  // No hangar
  hangarCapacity: 0,
  flightSize: 0,

  // Weapons - 3 systems, ~10 dice total (3:1 ratio to cruiser)
  weapons: [
    { name: 'Prow Battery', type: WEAPON_TYPES.BATTERY, arc: FIRE_ARCS.FORE, firepower: 4, range: 25 },
    { name: 'Port Battery', type: WEAPON_TYPES.BATTERY, arc: FIRE_ARCS.PORT, firepower: 3, range: 25 },
    { name: 'Stbd Battery', type: WEAPON_TYPES.BATTERY, arc: FIRE_ARCS.STARBOARD, firepower: 3, range: 25 },
  ],
};

// =============================================================================
// XENOS SHIPS
// =============================================================================

export const XENOS_CRUISER = {
  name: 'Serpent Cruiser',
  class: SHIP_CLASSES.CRUISER,
  modelFile: 'Serpent_Cruiser.glb',
  modelScale: 2.5,

  // Survivability - slightly less tough
  structure: 7,
  armor: {
    fore: 5,
    aft: 4,
    port: 5,
    starboard: 5,
  },
  shields: 2,
  turrets: 2,

  // Mobility - faster
  thrust: 4,
  rotate: 50,
  maxSpeed: 14,

  // Hangar
  hangarCapacity: 12,
  flightSize: 3,

  // Weapons - longer range, different loadout
  weapons: [
    { name: 'Port Battery', type: WEAPON_TYPES.BATTERY, arc: FIRE_ARCS.PORT, firepower: 8, range: 45 },
    { name: 'Stbd Battery', type: WEAPON_TYPES.BATTERY, arc: FIRE_ARCS.STARBOARD, firepower: 8, range: 45 },
    { name: 'Prow Lance', type: WEAPON_TYPES.LANCE, arc: FIRE_ARCS.FORE, strength: 3, range: 60 },
    { name: 'Dorsal Lance', type: WEAPON_TYPES.LANCE, arc: FIRE_ARCS.DORSAL, strength: 2, range: 45 },
  ],
};

export const XENOS_FRIGATE = {
  name: 'Viper Frigate',
  class: SHIP_CLASSES.FRIGATE,
  modelFile: 'Serpent_Frigate.glb',
  modelScale: 1.5,

  // Survivability - glass cannon
  structure: 3,
  armor: {
    fore: 4,
    aft: 3,
    port: 3,
    starboard: 3,
  },
  shields: 1,
  turrets: 1,

  // Mobility - very fast
  thrust: 6,
  rotate: 70,
  maxSpeed: 20,

  // No hangar
  hangarCapacity: 0,
  flightSize: 0,

  // Weapons - forward-focused alpha strike
  weapons: [
    { name: 'Prow Lance', type: WEAPON_TYPES.LANCE, arc: FIRE_ARCS.FORE, strength: 2, range: 35 },
    { name: 'Prow Battery', type: WEAPON_TYPES.BATTERY, arc: FIRE_ARCS.FORE, firepower: 4, range: 30 },
  ],
};

// =============================================================================
// LEGACY EXPORTS (for backwards compatibility during transition)
// =============================================================================

export const PLAYER_CRUISER = IMPERIAL_CRUISER;
export const AI_CRUISER = XENOS_CRUISER;

// =============================================================================
// CRITICAL HITS & CATASTROPHIC DAMAGE
// =============================================================================

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

// =============================================================================
// SCENARIOS
// =============================================================================

export const SCENARIOS = {
  FIRST_CONTACT: {
    name: 'First Contact',
    description: 'Defend against waves of Xenos attackers',

    playerFleet: {
      faction: 'imperial',
      ships: [
        { stats: IMPERIAL_CRUISER, position: { x: 0, y: 0, z: -15 }, facing: 0 },
        { stats: IMPERIAL_FRIGATE, position: { x: -8, y: 0, z: -20 }, facing: 0 },
        { stats: IMPERIAL_FRIGATE, position: { x: 8, y: 0, z: -20 }, facing: 0 },
      ],
    },

    waves: [
      {
        id: 'wave1',
        trigger: 'start',
        delay: 0,
        ships: [
          { stats: XENOS_FRIGATE, position: { x: -15, y: 0, z: 40 }, facing: Math.PI },
          { stats: XENOS_FRIGATE, position: { x: 15, y: 0, z: 40 }, facing: Math.PI },
        ],
        behavior: 'aggressive',
      },
      {
        id: 'wave2',
        trigger: 'time',
        delay: 45,
        ships: [
          { stats: XENOS_CRUISER, position: { x: 0, y: 0, z: 50 }, facing: Math.PI },
        ],
        behavior: 'aggressive',
      },
      {
        id: 'wave3',
        trigger: 'wave_cleared',
        delay: 30,
        ships: [
          { stats: XENOS_CRUISER, position: { x: 0, y: 0, z: 55 }, facing: Math.PI },
          { stats: XENOS_FRIGATE, position: { x: -20, y: 0, z: 45 }, facing: Math.PI },
          { stats: XENOS_FRIGATE, position: { x: 20, y: 0, z: 45 }, facing: Math.PI },
        ],
        behavior: 'flanking',
      },
    ],

    victory: 'survive_all_waves',
    defeat: 'player_fleet_destroyed',
  },
};
