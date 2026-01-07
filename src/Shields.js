export function getShieldCapacity(ship) {
  return ship.getShieldCapacity();
}

export function resetShieldPhase(ship) {
  ship.shieldHitsThisPhase = 0;
}
