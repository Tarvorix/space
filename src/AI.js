import * as THREE from 'three';

export function updateAI(aiShip, playerShip) {
  if (aiShip.isDestroyed) return;

  aiShip.autoFire = true;
  aiShip.target = playerShip;

  const toTarget = new THREE.Vector3().subVectors(playerShip.position, aiShip.position);
  const distance = toTarget.length();
  if (distance < 0.001) {
    aiShip.desiredThrustDir.set(0, 0, 0);
    aiShip.thrustPower = 0;
    return;
  }

  const planar = new THREE.Vector3(toTarget.x, 0, toTarget.z);
  if (planar.lengthSq() > 0.001) {
    planar.normalize();
    const broadside = new THREE.Vector3(-planar.z, 0, planar.x).normalize();
    aiShip.desiredFacingDir = broadside;
  } else {
    aiShip.desiredFacingDir = toTarget.clone().normalize();
  }

  const desiredRangeMin = 12;
  const desiredRangeMax = 22;
  const thrustDir = new THREE.Vector3();

  if (distance > desiredRangeMax) {
    thrustDir.copy(toTarget).normalize();
    aiShip.thrustPower = 0.8;
  } else if (distance < desiredRangeMin) {
    thrustDir.copy(toTarget).normalize().multiplyScalar(-1);
    aiShip.thrustPower = 0.7;
  } else {
    thrustDir.copy(aiShip.desiredFacingDir || toTarget).normalize();
    aiShip.thrustPower = 0.4;
  }

  aiShip.desiredThrustDir.copy(thrustDir);
  aiShip.brace = aiShip.currentHits <= Math.ceil(aiShip.stats.hits / 2);
}
