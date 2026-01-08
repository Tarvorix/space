import * as THREE from 'three';
import { FIRE_ARCS, WEAPON_TYPES, RANGES } from './ShipData.js';
import { rollCriticalHit, applyCriticalEffect, resolveExtraDamage, rollD6 } from './CriticalHits.js';

function rollDice(count) {
  const rolls = [];
  for (let i = 0; i < count; i++) {
    rolls.push(rollD6());
  }
  return rolls;
}

function isWeaponDisabled(ship, weapon) {
  const arc = weapon.arc;
  // Handle both 'prow' and 'fore' arc names
  if ((arc === FIRE_ARCS.PROW || arc === FIRE_ARCS.FORE) &&
      (ship.criticals.prow_damaged || ship.criticals.fore_damaged)) return true;
  if (arc === FIRE_ARCS.DORSAL && ship.criticals.dorsal_damaged) return true;
  if (arc === FIRE_ARCS.PORT && ship.criticals.port_damaged) return true;
  if (arc === FIRE_ARCS.STARBOARD && ship.criticals.starboard_damaged) return true;
  return false;
}

function getWeaponDiceCount(ship, weapon) {
  let value = weapon.firepower ?? weapon.strength ?? 0;

  if (ship.isThrusting) {
    value = Math.max(1, value - 1);
  }

  if (ship.brace) {
    value = Math.ceil(value / 2);
  }

  if (ship.isCrippled) {
    value = Math.ceil(value / 2);
  }

  return Math.max(1, value);
}

function isInArc(attacker, target, arc) {
  const dir = target.position.clone().sub(attacker.position).normalize();
  const localDir = dir.clone().applyQuaternion(attacker.quaternion.clone().invert());

  const forward = new THREE.Vector3(0, 0, 1);
  const left = new THREE.Vector3(-1, 0, 0);
  const right = new THREE.Vector3(1, 0, 0);
  const rear = new THREE.Vector3(0, 0, -1);

  const halfAngle = Math.cos(Math.PI / 4);

  // Handle both 'prow' and 'fore' as forward arc
  if (arc === FIRE_ARCS.PROW || arc === FIRE_ARCS.FORE) {
    return localDir.dot(forward) >= halfAngle;
  }

  switch (arc) {
    case FIRE_ARCS.PORT:
      return localDir.dot(left) >= halfAngle;
    case FIRE_ARCS.STARBOARD:
      return localDir.dot(right) >= halfAngle;
    case FIRE_ARCS.REAR:
    case FIRE_ARCS.AFT:
      return localDir.dot(rear) >= halfAngle;
    case FIRE_ARCS.DORSAL: {
      if (localDir.y < 0) return false;
      return localDir.dot(rear) < halfAngle;
    }
    default:
      return false;
  }
}

/**
 * Determine which armor facing the attacker is hitting
 * @param {Ship} target - The ship being attacked
 * @param {Ship} attacker - The attacking ship
 * @returns {string} - 'fore', 'aft', 'port', or 'starboard'
 */
function getArmorFacing(target, attacker) {
  const dirToAttacker = attacker.position.clone().sub(target.position).normalize();
  const localDir = dirToAttacker.clone().applyQuaternion(target.quaternion.clone().invert());

  const forward = new THREE.Vector3(0, 0, 1);
  const rear = new THREE.Vector3(0, 0, -1);
  const left = new THREE.Vector3(-1, 0, 0);
  const right = new THREE.Vector3(1, 0, 0);

  // Determine which facing the attack is coming from
  const dotForward = localDir.dot(forward);
  const dotRear = localDir.dot(rear);
  const dotLeft = localDir.dot(left);
  const dotRight = localDir.dot(right);

  // Find the maximum dot product to determine facing
  const dots = [
    { facing: 'fore', value: dotForward },
    { facing: 'aft', value: dotRear },
    { facing: 'port', value: dotLeft },
    { facing: 'starboard', value: dotRight },
  ];

  dots.sort((a, b) => b.value - a.value);
  return dots[0].facing;
}

/**
 * Get armor value for the facing being attacked
 */
function getArmorValue(target, attacker) {
  const facing = getArmorFacing(target, attacker);
  return target.getArmorForFacing(facing);
}

function getBatteryToHitModifier(attacker, target, weapon, blastMarkers) {
  const distance = attacker.position.distanceTo(target.position);
  let mod = 0;

  if (distance <= RANGES.CLOSE) {
    mod += 1;
  } else if (distance > RANGES.MEDIUM) {
    mod -= 1;
  }

  if (blastMarkers && blastMarkers.isLineObstructed(attacker.position, target.position)) {
    mod -= 1;
  }

  return mod;
}

function isInRange(attacker, target, weapon) {
  const distance = attacker.position.distanceTo(target.position);
  const range = weapon.range ?? RANGES.MAX;
  return distance <= range;
}

export function resolveAllWeapons(attacker, target, blastMarkers, torpedoManager) {
  const results = [];
  if (attacker.isDestroyed || target.isDestroyed) return results;

  for (const weapon of attacker.stats.weapons) {
    if (isWeaponDisabled(attacker, weapon)) continue;
    if (!isInRange(attacker, target, weapon)) continue;
    if (!isInArc(attacker, target, weapon.arc)) continue;

    if (weapon.type === WEAPON_TYPES.TORPEDO) {
      const salvoSize = getWeaponDiceCount(attacker, weapon);
      if (salvoSize > 0 && torpedoManager) {
        torpedoManager.launch(attacker, weapon, salvoSize);
      }
      results.push({ weapon: weapon.name, type: weapon.type, hits: 0, rolls: [], launched: salvoSize });
      continue;
    }

    const dice = getWeaponDiceCount(attacker, weapon);
    const rolls = rollDice(dice);
    let hits = 0;

    if (weapon.type === WEAPON_TYPES.BATTERY) {
      const armor = getArmorValue(target, attacker);
      const mod = getBatteryToHitModifier(attacker, target, weapon, blastMarkers);
      for (const roll of rolls) {
        if (roll + mod >= armor) hits += 1;
      }
    } else if (weapon.type === WEAPON_TYPES.LANCE) {
      for (const roll of rolls) {
        if (roll >= 4) hits += 1;
      }
    }

    let damage = null;
    if (hits > 0) {
      damage = applyHitsToTarget(target, hits);
    }

    results.push({
      weapon: weapon.name,
      type: weapon.type,
      rolls,
      hits,
      damage,
      armorFacing: getArmorFacing(target, attacker),
    });
  }

  return results;
}

export function applyHitsToTarget(target, hits) {
  const availableShields = Math.max(0, target.getShieldCapacity() - target.shieldHitsThisPhase);
  const shieldsAbsorbed = Math.min(hits, availableShields);
  target.shieldHitsThisPhase += shieldsAbsorbed;

  const remaining = hits - shieldsAbsorbed;
  if (remaining <= 0) {
    return { shieldsAbsorbed, hullDamage: 0, criticals: [], savedByBrace: 0 };
  }

  const damageResult = applyHullDamage(target, remaining);
  return { shieldsAbsorbed, ...damageResult };
}

export function applyHullDamage(target, hits) {
  let savedByBrace = 0;
  let remaining = hits;

  if (target.brace) {
    for (let i = 0; i < hits; i++) {
      if (rollD6() >= 4) savedByBrace += 1;
    }
    remaining = hits - savedByBrace;
  }

  if (remaining <= 0) {
    return { hullDamage: 0, criticals: [], savedByBrace };
  }

  let totalDamage = 0;
  const criticals = [];

  for (let i = 0; i < remaining; i++) {
    if (rollD6() === 6) {
      const crit = rollCriticalHit();
      const extra = resolveExtraDamage(crit.extraDamage);
      totalDamage += 1 + extra;
      applyCriticalEffect(target, crit);
      criticals.push({ ...crit, extraDamageValue: extra });
    } else {
      totalDamage += 1;
    }
  }

  target.currentStructure = Math.max(0, target.currentStructure - totalDamage);

  return { hullDamage: totalDamage, criticals, savedByBrace };
}

export function applyTorpedoHits(target, hits) {
  return applyHullDamage(target, hits);
}

// Export for use elsewhere
export { getArmorFacing, getArmorValue };
