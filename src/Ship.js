import * as THREE from 'three';

export class Ship {
  constructor(stats, faction) {
    this.stats = stats;
    this.faction = faction;

    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();

    this.mesh = null;
    this.ring = null;

    this.currentHits = stats.hits;
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

    this.criticals = {
      dorsal_damaged: false,
      starboard_damaged: false,
      port_damaged: false,
      prow_damaged: false,
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

  get speed() {
    return this.velocity.length();
  }

  get isDestroyed() {
    return this.currentHits <= 0;
  }

  get isCrippled() {
    return this.currentHits > 0 && this.currentHits <= Math.ceil(this.stats.hits / 2);
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

  resetPhaseState() {
    this.shieldHitsThisPhase = 0;
  }

  syncMesh() {
    if (!this.mesh) return;
    this.mesh.position.copy(this.position);
    this.mesh.quaternion.copy(this.quaternion);
  }
}
