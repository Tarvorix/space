import * as THREE from 'three';

export function updateAI(aiShip, playerShip) {
  if (aiShip.isDestroyed) return;

  aiShip.autoFire = true;
  aiShip.target = playerShip;

  const toTarget = new THREE.Vector3().subVectors(playerShip.position, aiShip.position);
  const distance = toTarget.length();
  if (distance < 0.001) {
    aiShip.thrustPower = 0;
    return;
  }

  const toTargetNorm = toTarget.clone().normalize();

  // Calculate broadside direction (perpendicular to target, for weapon arcs)
  const planar = new THREE.Vector3(toTarget.x, 0, toTarget.z);
  let broadside = new THREE.Vector3(0, 0, 1);
  if (planar.lengthSq() > 0.001) {
    planar.normalize();
    broadside = new THREE.Vector3(-planar.z, 0, planar.x).normalize();
  }

  const desiredRangeMin = 12;
  const desiredRangeMax = 22;

  // Newtonian AI: must choose between maneuvering (thrust) and fighting (broadside)
  // Thrust always goes in facing direction, so facing = thrust direction

  if (distance > desiredRangeMax) {
    // Too far: face toward target, thrust to close distance
    aiShip.desiredFacingDir = toTargetNorm.clone();
    aiShip.thrustPower = 0.8;
  } else if (distance < desiredRangeMin) {
    // Too close: face away from target, thrust to increase distance
    aiShip.desiredFacingDir = toTargetNorm.clone().multiplyScalar(-1);
    aiShip.thrustPower = 0.7;
  } else {
    // Good range: face broadside for weapons, coast (minimal thrust)
    aiShip.desiredFacingDir = broadside;
    aiShip.thrustPower = 0.1; // Light thrust to maintain position
  }

  // Brace when crippled
  aiShip.brace = aiShip.currentHits <= Math.ceil(aiShip.stats.hits / 2);
}
