import * as THREE from 'three';
import { ORDER_TYPES } from './Ship.js';

// Tolerance for distance checks
const DISTANCE_TOLERANCE = 2;
const VELOCITY_TOLERANCE = 0.5;

/**
 * Execute the current order for a ship.
 * Sets desiredFacingDir and thrustPower based on order type.
 * Returns true if order is still active, false if completed.
 */
export function executeOrder(ship) {
  if (ship.isDestroyed || ship.isHulk) return false;

  const order = ship.currentOrder;

  switch (order.type) {
    case ORDER_TYPES.NONE:
      return false;

    case ORDER_TYPES.APPROACH:
      return executeApproach(ship, order);

    case ORDER_TYPES.ORBIT:
      return executeOrbit(ship, order);

    case ORDER_TYPES.KEEP_RANGE:
      return executeKeepRange(ship, order);

    case ORDER_TYPES.FLY_TO:
      return executeFlyTo(ship, order);

    case ORDER_TYPES.ALL_STOP:
      return executeAllStop(ship);

    default:
      return false;
  }
}

/**
 * Approach target - fly toward it until close
 */
function executeApproach(ship, order) {
  const target = order.target;
  if (!target || target.isDestroyed) {
    ship.clearOrder();
    return false;
  }

  const toTarget = target.position.clone().sub(ship.position);
  const distance = toTarget.length();

  // Close enough - stop approaching
  if (distance < DISTANCE_TOLERANCE * 2) {
    ship.clearOrder();
    ship.thrustPower = 0;
    return false;
  }

  toTarget.normalize();

  // Check if we need to slow down
  const closingSpeed = ship.velocity.dot(toTarget);
  const stoppingDistance = estimateStoppingDistance(ship, closingSpeed);

  if (stoppingDistance >= distance - DISTANCE_TOLERANCE) {
    // Need to brake - face retrograde
    const retrograde = ship.velocity.clone().normalize().negate();
    ship.desiredFacingDir = retrograde;
    ship.thrustPower = 0.8;
  } else {
    // Accelerate toward target
    ship.desiredFacingDir = toTarget;
    ship.thrustPower = Math.min(1, distance / 20); // Ease off as we get closer
  }

  return true;
}

/**
 * Orbit target at specified range - Newtonian approximation
 */
function executeOrbit(ship, order) {
  const target = order.target;
  if (!target || target.isDestroyed) {
    ship.clearOrder();
    return false;
  }

  const toTarget = target.position.clone().sub(ship.position);
  const distance = toTarget.length();
  const orbitRange = order.range;
  const direction = order.orbitDirection;

  // Calculate tangent direction for orbit (perpendicular to toTarget)
  const up = new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3().crossVectors(toTarget, up).normalize();
  tangent.multiplyScalar(direction); // Apply orbit direction

  // Calculate desired velocity for stable orbit
  const toTargetNorm = toTarget.clone().normalize();

  if (distance < orbitRange - DISTANCE_TOLERANCE) {
    // Too close - thrust away while maintaining tangent motion
    const awayDir = toTargetNorm.clone().negate();
    const blended = tangent.clone().add(awayDir.multiplyScalar(0.5)).normalize();
    ship.desiredFacingDir = blended;
    ship.thrustPower = 0.6;
  } else if (distance > orbitRange + DISTANCE_TOLERANCE) {
    // Too far - thrust toward while maintaining tangent motion
    const blended = tangent.clone().add(toTargetNorm.clone().multiplyScalar(0.5)).normalize();
    ship.desiredFacingDir = blended;
    ship.thrustPower = 0.6;
  } else {
    // Good distance - maintain tangent velocity
    // Check if we're moving too fast or slow for orbit
    const tangentSpeed = ship.velocity.dot(tangent);
    const idealSpeed = ship.stats.maxSpeed * 0.4; // Orbit at 40% max speed

    if (tangentSpeed < idealSpeed - VELOCITY_TOLERANCE) {
      // Speed up along tangent
      ship.desiredFacingDir = tangent;
      ship.thrustPower = 0.4;
    } else if (tangentSpeed > idealSpeed + VELOCITY_TOLERANCE) {
      // Slow down - thrust opposite to velocity component along tangent
      ship.desiredFacingDir = tangent.clone().negate();
      ship.thrustPower = 0.3;
    } else {
      // Good speed - face tangent, minimal thrust
      ship.desiredFacingDir = tangent;
      ship.thrustPower = 0.1;
    }

    // Correct radial drift
    const radialSpeed = ship.velocity.dot(toTargetNorm);
    if (Math.abs(radialSpeed) > VELOCITY_TOLERANCE) {
      // Drifting in/out - correct it
      const correction = radialSpeed > 0 ? toTargetNorm.negate() : toTargetNorm;
      ship.desiredFacingDir = ship.desiredFacingDir.clone().add(correction.multiplyScalar(0.3)).normalize();
      ship.thrustPower = Math.max(ship.thrustPower, 0.3);
    }
  }

  return true;
}

/**
 * Keep at range - maintain distance from target without orbiting
 */
function executeKeepRange(ship, order) {
  const target = order.target;
  if (!target || target.isDestroyed) {
    ship.clearOrder();
    return false;
  }

  const toTarget = target.position.clone().sub(ship.position);
  const distance = toTarget.length();
  const desiredRange = order.range;

  toTarget.normalize();

  if (distance < desiredRange - DISTANCE_TOLERANCE) {
    // Too close - back away
    ship.desiredFacingDir = toTarget.clone().negate();
    ship.thrustPower = 0.6;
  } else if (distance > desiredRange + DISTANCE_TOLERANCE) {
    // Too far - move closer
    ship.desiredFacingDir = toTarget;
    ship.thrustPower = 0.5;
  } else {
    // Good distance - kill relative velocity
    const relativeVel = ship.velocity.clone().sub(target.velocity);
    if (relativeVel.length() > VELOCITY_TOLERANCE) {
      ship.desiredFacingDir = relativeVel.clone().normalize().negate();
      ship.thrustPower = 0.3;
    } else {
      ship.thrustPower = 0;
    }
  }

  return true;
}

/**
 * Fly to position and stop there
 */
function executeFlyTo(ship, order) {
  const targetPos = order.position;
  if (!targetPos) {
    ship.clearOrder();
    return false;
  }

  const toTarget = targetPos.clone().sub(ship.position);
  const distance = toTarget.length();

  // Arrived
  if (distance < DISTANCE_TOLERANCE && ship.velocity.length() < VELOCITY_TOLERANCE) {
    ship.clearOrder();
    ship.thrustPower = 0;
    return false;
  }

  toTarget.normalize();

  const closingSpeed = ship.velocity.dot(toTarget);
  const stoppingDistance = estimateStoppingDistance(ship, closingSpeed);

  if (stoppingDistance >= distance - DISTANCE_TOLERANCE) {
    // Need to brake
    const retrograde = ship.velocity.clone().normalize().negate();
    ship.desiredFacingDir = retrograde;
    ship.thrustPower = 0.8;
  } else {
    // Accelerate toward target
    ship.desiredFacingDir = toTarget;
    ship.thrustPower = Math.min(1, distance / 15);
  }

  return true;
}

/**
 * All stop - kill all velocity
 */
function executeAllStop(ship) {
  const speed = ship.velocity.length();

  if (speed < VELOCITY_TOLERANCE) {
    // Stopped
    ship.clearOrder();
    ship.thrustPower = 0;
    ship.velocity.set(0, 0, 0);
    return false;
  }

  // Thrust retrograde to slow down
  const retrograde = ship.velocity.clone().normalize().negate();
  ship.desiredFacingDir = retrograde;
  ship.thrustPower = Math.min(1, speed / 5);

  return true;
}

/**
 * Estimate stopping distance based on current speed and thrust
 */
function estimateStoppingDistance(ship, speed) {
  if (speed <= 0) return 0;

  const thrust = ship.getEffectiveThrust();
  if (thrust <= 0) return Infinity;

  // Simple estimate: distance = v^2 / (2 * a)
  // This is approximate since we're not accounting for turn time
  const deceleration = thrust * 0.5; // Assume 50% efficiency due to turn time
  return (speed * speed) / (2 * deceleration);
}
