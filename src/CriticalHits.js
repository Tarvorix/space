import { CRITICAL_HITS, CATASTROPHIC_DAMAGE } from './ShipData.js';

function rollDie(sides = 6) {
  return Math.floor(Math.random() * sides) + 1;
}

export function rollD6() {
  return rollDie(6);
}

export function rollND6(count) {
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += rollD6();
  }
  return total;
}

export function roll2D6() {
  return rollD6() + rollD6();
}

export function rollD3() {
  return Math.ceil(rollD6() / 2);
}

export function rollCriticalHit() {
  const roll = roll2D6();
  const entry = CRITICAL_HITS.find((crit) => crit.roll === roll);
  return { ...entry, roll };
}

export function applyCriticalEffect(ship, critical) {
  switch (critical.effect) {
    case 'dorsal_damaged':
    case 'starboard_damaged':
    case 'port_damaged':
    case 'prow_damaged':
    case 'engines_damaged':
    case 'thrusters_damaged':
    case 'bridge_smashed':
    case 'shields_collapse':
      ship.criticals[critical.effect] = true;
      break;
    case 'fire':
      ship.criticals.fires += 1;
      break;
    default:
      break;
  }
}

export function resolveExtraDamage(extraDamage) {
  if (extraDamage === 'D3') {
    return rollD3();
  }
  if (extraDamage === 'D6') {
    return rollD6();
  }
  return extraDamage || 0;
}

export function rollCatastrophicDamage(ship) {
  const roll = roll2D6();
  const entry = CATASTROPHIC_DAMAGE.find(
    (result) => roll >= result.rollMin && roll <= result.rollMax
  );

  const result = { ...entry, roll };

  if (result.effect === 'plasma_explosion') {
    result.explosionRadius = rollND6(3);
    result.explosionStrength = Math.ceil(ship.stats.hits / 2);
    result.blastMarkers = Math.ceil(ship.stats.hits / 2);
  }

  if (result.effect === 'warp_implosion') {
    result.explosionRadius = rollND6(3);
    result.explosionStrength = ship.stats.hits;
    result.blastMarkers = ship.stats.hits;
  }

  if (result.effect === 'drifting_hulk' || result.effect === 'blazing_hulk') {
    result.blastMarkers = 1;
  }

  return result;
}

export function applyExplosionDamage(destroyedShip, ships, radius, strength) {
  const results = [];
  for (const ship of ships) {
    if (ship === destroyedShip || ship.isDestroyed) continue;
    const dist = ship.position.distanceTo(destroyedShip.position);
    if (dist > radius) continue;

    const damage = applyExplosionHits(ship, strength);
    results.push({ ship, hits: damage.hullDamage, damage });
  }
  return results;
}

function applyExplosionHits(ship, hits) {
  const availableShields = Math.max(0, ship.getShieldCapacity() - ship.shieldHitsThisPhase);
  const shieldsAbsorbed = Math.min(hits, availableShields);
  ship.shieldHitsThisPhase += shieldsAbsorbed;

  const remaining = hits - shieldsAbsorbed;
  if (remaining <= 0) {
    return { shieldsAbsorbed, hullDamage: 0, criticals: [] };
  }

  const { hullDamage, criticals, savedByBrace } = applyHullDamageFromHits(ship, remaining);
  return { shieldsAbsorbed, hullDamage, criticals, savedByBrace };
}

function applyHullDamageFromHits(ship, hits) {
  let savedByBrace = 0;
  if (ship.brace) {
    for (let i = 0; i < hits; i++) {
      if (rollD6() >= 4) savedByBrace += 1;
    }
  }

  const remaining = Math.max(0, hits - savedByBrace);
  let totalDamage = 0;
  const criticals = [];

  for (let i = 0; i < remaining; i++) {
    if (rollD6() === 6) {
      const crit = rollCriticalHit();
      const extra = resolveExtraDamage(crit.extraDamage);
      totalDamage += 1 + extra;
      applyCriticalEffect(ship, crit);
      criticals.push({ ...crit, extraDamageValue: extra });
    } else {
      totalDamage += 1;
    }
  }

  ship.currentHits = Math.max(0, ship.currentHits - totalDamage);

  return { hullDamage: totalDamage, criticals, savedByBrace };
}
