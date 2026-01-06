import * as THREE from 'three';
import { ORDERS } from './ShipData.js';

export function getFacingToward(from, to, up) {
  const matrix = new THREE.Matrix4();
  matrix.lookAt(from, to, up);
  const quat = new THREE.Quaternion();
  quat.setFromRotationMatrix(matrix);
  return quat;
}

function limitRotation(currentQuat, targetQuat, maxAngleRad) {
  const angle = currentQuat.angleTo(targetQuat);
  if (angle <= maxAngleRad) {
    return targetQuat.clone();
  }
  const t = maxAngleRad / angle;
  const result = new THREE.Quaternion();
  result.slerpQuaternions(currentQuat, targetQuat, t);
  return result;
}

function getMaxRotationAngle(ship) {
  let maxAngle = THREE.MathUtils.degToRad(ship.getEffectiveRotate());
  if (ship.brace) {
    maxAngle *= 0.5;
  }
  return maxAngle;
}

function applyRotationInput(ship, rotationInput, maxAngle) {
  const pitch = THREE.MathUtils.clamp(rotationInput.pitch ?? 0, -1, 1) * maxAngle;
  const yaw = THREE.MathUtils.clamp(rotationInput.yaw ?? 0, -1, 1) * maxAngle;
  const roll = THREE.MathUtils.clamp(rotationInput.roll ?? 0, -1, 1) * maxAngle;

  const deltaEuler = new THREE.Euler(pitch, yaw, roll, 'XYZ');
  const deltaQuat = new THREE.Quaternion().setFromEuler(deltaEuler);

  return ship.quaternion.clone().multiply(deltaQuat);
}

export function planTurn(ship, options = {}) {
  if (ship.isDestroyed) return;

  const { targetQuat = null, rotationInput = null, thrustInput = null } = options;
  let desiredQuat = ship.quaternion.clone();

  const maxAngle = getMaxRotationAngle(ship);

  if (ship.order === ORDERS.BRAKE) {
    if (ship.speed > 0.01) {
      const retro = ship.velocity.clone().normalize().multiplyScalar(-1);
      desiredQuat = getFacingToward(ship.position, ship.position.clone().add(retro), ship.getUp());
    }
  } else if (rotationInput) {
    desiredQuat = applyRotationInput(ship, rotationInput, maxAngle);
  } else if (targetQuat) {
    desiredQuat = targetQuat.clone();
  }

  if (rotationInput) {
    ship.plannedQuat = desiredQuat;
  } else {
    ship.plannedQuat = limitRotation(ship.quaternion, desiredQuat, maxAngle);
  }

  ship.plannedThrustVec = new THREE.Vector3();
  const thrust = ship.getEffectiveThrust();
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(ship.plannedQuat).normalize();

  if (ship.order === ORDERS.THRUST) {
    if (thrustInput) {
      const local = new THREE.Vector3(thrustInput.x, thrustInput.y, thrustInput.z);
      if (local.lengthSq() < 0.0001) {
        local.set(0, 0, 1);
      } else if (local.lengthSq() > 1) {
        local.normalize();
      }
      ship.plannedThrustVec.copy(local.multiplyScalar(thrust)).applyQuaternion(ship.plannedQuat);
    } else {
      ship.plannedThrustVec.copy(forward).multiplyScalar(thrust);
    }
  } else if (ship.order === ORDERS.BRAKE) {
    if (ship.speed > 0.01) {
      ship.plannedThrustVec.copy(forward).multiplyScalar(thrust);
    }
  }
}

export function applyPhysics(ship) {
  if (ship.isDestroyed) return;

  if (ship.plannedQuat) {
    ship.quaternion.copy(ship.plannedQuat);
  }

  if (ship.plannedThrustVec) {
    ship.velocity.add(ship.plannedThrustVec);
  }

  const speed = ship.velocity.length();
  if (speed > ship.stats.maxSpeed) {
    ship.velocity.setLength(ship.stats.maxSpeed);
  }

  ship.position.add(ship.velocity);
}

export function applyRTSPhysics(ship, dt, turnDuration) {
  if (ship.isDestroyed) return;

  // Rotate ship toward desired facing direction
  if (ship.desiredFacingDir && ship.desiredFacingDir.lengthSq() > 0.0001) {
    const targetQuat = getFacingToward(
      ship.position,
      ship.position.clone().add(ship.desiredFacingDir),
      ship.getUp()
    );
    const maxAngle = getMaxRotationAngle(ship) * (dt / turnDuration);
    ship.quaternion.copy(limitRotation(ship.quaternion, targetQuat, maxAngle));
  }

  // Thrust is always in ship's forward direction (main engines at rear)
  if (ship.brace) {
    ship.isThrusting = false;
  } else {
    ship.isThrusting = ship.thrustPower > 0.01;
    if (ship.isThrusting) {
      const forward = ship.getForward();
      const accel = forward.multiplyScalar(
        ship.getEffectiveThrust() * ship.thrustPower * (dt / turnDuration)
      );
      ship.velocity.add(accel);
    }
  }

  const speed = ship.velocity.length();
  if (speed > ship.stats.maxSpeed) {
    ship.velocity.setLength(ship.stats.maxSpeed);
  }

  const step = dt / turnDuration;
  ship.position.add(ship.velocity.clone().multiplyScalar(step));
}
