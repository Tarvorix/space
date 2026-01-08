import * as THREE from 'three';

/**
 * Update AI behavior for a single AI-controlled ship
 * @param {Ship} aiShip - The AI ship to update
 * @param {GameState} game - The game state for finding targets
 */
export function updateAI(aiShip, game) {
  if (aiShip.isDestroyed) return;

  aiShip.autoFire = true;

  // Find or validate target
  if (!aiShip.target || aiShip.target.isDestroyed) {
    aiShip.target = selectTarget(aiShip, game);
  }

  if (!aiShip.target) {
    // No valid targets - coast
    aiShip.thrustPower = 0;
    return;
  }

  // Get behavior from wave definition or default to aggressive
  const behavior = aiShip.aiBehavior || 'aggressive';

  switch (behavior) {
    case 'aggressive':
      behaviorAggressive(aiShip, aiShip.target);
      break;
    case 'flanking':
      behaviorFlanking(aiShip, aiShip.target, game);
      break;
    case 'cautious':
      behaviorCautious(aiShip, aiShip.target);
      break;
    default:
      behaviorAggressive(aiShip, aiShip.target);
  }

  // Brace when crippled
  aiShip.brace = aiShip.isCrippled;
}

/**
 * Select the best target for an AI ship
 */
function selectTarget(aiShip, game) {
  const enemies = game.getEnemiesOf(aiShip);

  if (enemies.length === 0) return null;
  if (enemies.length === 1) return enemies[0];

  // Score each potential target
  let bestTarget = null;
  let bestScore = -Infinity;

  for (const enemy of enemies) {
    let score = 0;

    // Prefer closer targets
    const distance = aiShip.position.distanceTo(enemy.position);
    score -= distance * 0.5;

    // Prefer damaged targets (finish them off)
    const healthPercent = enemy.currentStructure / enemy.maxStructure;
    score += (1 - healthPercent) * 50;

    // Prefer smaller ships (easier to kill)
    if (enemy.stats.class === 'frigate') {
      score += 20;
    }

    // Slight randomness to prevent all AI focusing same target
    score += Math.random() * 10;

    if (score > bestScore) {
      bestScore = score;
      bestTarget = enemy;
    }
  }

  return bestTarget;
}

/**
 * Aggressive behavior - close to optimal range and fight
 */
function behaviorAggressive(aiShip, target) {
  const toTarget = new THREE.Vector3().subVectors(target.position, aiShip.position);
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
    aiShip.thrustPower = 0.1;
  }
}

/**
 * Flanking behavior - try to get behind or to the side of the target
 */
function behaviorFlanking(aiShip, target, game) {
  const toTarget = new THREE.Vector3().subVectors(target.position, aiShip.position);
  const distance = toTarget.length();

  if (distance < 0.001) {
    aiShip.thrustPower = 0;
    return;
  }

  const toTargetNorm = toTarget.clone().normalize();

  // Get target's facing direction
  const targetForward = target.getForward();

  // Try to approach from behind (opposite of target's forward)
  const behindTarget = targetForward.clone().multiplyScalar(-1);

  // Blend between approaching target and getting behind them
  const desiredRangeMin = 15;
  const desiredRangeMax = 30;

  if (distance > desiredRangeMax) {
    // Far away: head toward behind the target
    const approachDir = new THREE.Vector3()
      .addVectors(toTargetNorm.clone().multiplyScalar(0.7), behindTarget.clone().multiplyScalar(0.3))
      .normalize();
    aiShip.desiredFacingDir = approachDir;
    aiShip.thrustPower = 0.9;
  } else if (distance < desiredRangeMin) {
    // Too close: back off while trying to stay to the side
    aiShip.desiredFacingDir = toTargetNorm.clone().multiplyScalar(-1);
    aiShip.thrustPower = 0.6;
  } else {
    // Good range: orbit to get behind
    const planar = new THREE.Vector3(toTarget.x, 0, toTarget.z);
    if (planar.lengthSq() > 0.001) {
      planar.normalize();
      const orbitDir = new THREE.Vector3(-planar.z, 0, planar.x).normalize();
      aiShip.desiredFacingDir = orbitDir;
      aiShip.thrustPower = 0.4;
    }
  }
}

/**
 * Cautious behavior - keep distance, prioritize survival
 */
function behaviorCautious(aiShip, target) {
  const toTarget = new THREE.Vector3().subVectors(target.position, aiShip.position);
  const distance = toTarget.length();

  if (distance < 0.001) {
    aiShip.thrustPower = 0;
    return;
  }

  const toTargetNorm = toTarget.clone().normalize();

  // Calculate broadside direction
  const planar = new THREE.Vector3(toTarget.x, 0, toTarget.z);
  let broadside = new THREE.Vector3(0, 0, 1);
  if (planar.lengthSq() > 0.001) {
    planar.normalize();
    broadside = new THREE.Vector3(-planar.z, 0, planar.x).normalize();
  }

  const desiredRangeMin = 25;
  const desiredRangeMax = 40;

  if (distance > desiredRangeMax) {
    // Too far: approach cautiously
    aiShip.desiredFacingDir = toTargetNorm.clone();
    aiShip.thrustPower = 0.5;
  } else if (distance < desiredRangeMin) {
    // Too close: retreat!
    aiShip.desiredFacingDir = toTargetNorm.clone().multiplyScalar(-1);
    aiShip.thrustPower = 1.0;
  } else {
    // Good range: broadside and minimal movement
    aiShip.desiredFacingDir = broadside;
    aiShip.thrustPower = 0.05;
  }
}
