import * as THREE from 'three';

// Order types for ship commands
export const ORDER_TYPES = {
  NONE: 'none',           // No order - manual control
  APPROACH: 'approach',   // Move toward target
  ORBIT: 'orbit',         // Orbit target at range
  KEEP_RANGE: 'keepRange', // Maintain distance from target
  FLY_TO: 'flyTo',        // Fly to position
  ALL_STOP: 'allStop',    // Kill all velocity
};

let shipIdCounter = 0;

export class Ship {
  constructor(stats, faction) {
    this.id = ++shipIdCounter;
    this.stats = stats;
    this.faction = faction;

    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();

    this.mesh = null;
    this.ring = null;

    // Use structure instead of hits (backwards compatible)
    this.currentStructure = stats.structure ?? stats.hits ?? 8;
    this.blastMarkersInContact = 0;
    this.shieldHitsThisPhase = 0;
    this.brace = false;
    this.autoFire = false;
    this.fireCooldown = 0;
    this.selected = false;
    this.target = null;
    this.desiredThrustDir = new THREE.Vector3(0, 0, 0);
    this.thrustPower = 0;
    this.desiredFacingDir = null;
    this.isThrusting = false;

    // Team assignment (for multi-team battles)
    this.teamId = null;

    // Order system
    this.currentOrder = {
      type: ORDER_TYPES.NONE,
      target: null,         // Ship or null
      position: null,       // Vector3 for flyTo
      range: 15,            // Distance for orbit/keepRange
      orbitDirection: 1,    // 1 = clockwise, -1 = counter-clockwise
    };

    this.criticals = {
      dorsal_damaged: false,
      starboard_damaged: false,
      port_damaged: false,
      prow_damaged: false,
      fore_damaged: false,  // Alias for prow
      engines_damaged: false,
      thrusters_damaged: false,
      bridge_smashed: false,
      shields_collapse: false,
      fires: 0,
    };

    this.catastrophicResolved = false;
    this.isHulk = false;
    this.hulkType = null;
    this.plannedQuat = null;
    this.plannedThrustVec = new THREE.Vector3();

    const scale = stats.modelScale || 2.5;
    this.collisionRadius = scale * 0.8;
  }

  // Backwards compatibility: currentHits maps to currentStructure
  get currentHits() {
    return this.currentStructure;
  }

  set currentHits(value) {
    this.currentStructure = value;
  }

  get speed() {
    return this.velocity.length();
  }

  get isDestroyed() {
    return this.currentStructure <= 0;
  }

  get isCrippled() {
    const maxStructure = this.stats.structure ?? this.stats.hits ?? 8;
    return this.currentStructure > 0 && this.currentStructure <= Math.ceil(maxStructure / 2);
  }

  get maxStructure() {
    return this.stats.structure ?? this.stats.hits ?? 8;
  }

  getForward() {
    return new THREE.Vector3(0, 0, 1).applyQuaternion(this.quaternion).normalize();
  }

  getUp() {
    return new THREE.Vector3(0, 1, 0).applyQuaternion(this.quaternion).normalize();
  }

  getRight() {
    return new THREE.Vector3(1, 0, 0).applyQuaternion(this.quaternion).normalize();
  }

  getShieldCapacity() {
    if (this.criticals.shields_collapse) return 0;

    let shields = this.stats.shields;
    if (this.isCrippled) {
      shields = Math.ceil(shields / 2);
    }

    shields = Math.max(0, shields - this.blastMarkersInContact);
    return shields;
  }

  getEffectiveTurrets() {
    let turrets = this.stats.turrets;
    if (this.isCrippled) {
      turrets = Math.ceil(turrets / 2);
    }
    return Math.max(0, turrets);
  }

  getEffectiveThrust() {
    let thrust = this.stats.thrust;
    if (this.criticals.thrusters_damaged) {
      thrust -= 1;
    }
    if (this.isCrippled) {
      thrust -= 1;
    }
    return Math.max(0, thrust);
  }

  getEffectiveRotate() {
    if (this.criticals.engines_damaged) {
      return 0;
    }
    return this.stats.rotate;
  }

  /**
   * Get armor value for a specific facing
   * @param {string} facing - 'fore', 'aft', 'port', or 'starboard'
   * @returns {number} Armor value for that facing
   */
  getArmorForFacing(facing) {
    // New armor object format
    if (this.stats.armor && typeof this.stats.armor === 'object') {
      return this.stats.armor[facing] ?? 5;
    }
    // Legacy format fallback
    if (facing === 'fore') {
      return this.stats.armorFront ?? 5;
    }
    return this.stats.armorOther ?? 5;
  }

  resetPhaseState() {
    this.shieldHitsThisPhase = 0;
  }

  syncMesh() {
    if (!this.mesh) return;
    this.mesh.position.copy(this.position);
    this.mesh.quaternion.copy(this.quaternion);
  }

  // Order helpers
  setOrder(type, options = {}) {
    this.currentOrder.type = type;
    this.currentOrder.target = options.target || null;
    this.currentOrder.position = options.position || null;
    this.currentOrder.range = options.range ?? 15;
    this.currentOrder.orbitDirection = options.orbitDirection ?? 1;
  }

  clearOrder() {
    this.currentOrder.type = ORDER_TYPES.NONE;
    this.currentOrder.target = null;
    this.currentOrder.position = null;
  }

  orbitTarget(target, range, direction = 1) {
    this.setOrder(ORDER_TYPES.ORBIT, { target, range, orbitDirection: direction });
  }

  approachTarget(target) {
    this.setOrder(ORDER_TYPES.APPROACH, { target });
  }

  keepRangeFrom(target, range) {
    this.setOrder(ORDER_TYPES.KEEP_RANGE, { target, range });
  }

  flyToPosition(position) {
    this.setOrder(ORDER_TYPES.FLY_TO, { position: position.clone() });
  }

  allStop() {
    this.setOrder(ORDER_TYPES.ALL_STOP);
  }

  hasActiveOrder() {
    return this.currentOrder.type !== ORDER_TYPES.NONE;
  }
}
