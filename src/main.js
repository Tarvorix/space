import * as THREE from 'three';
import { createScene } from './scene.js';
import { GameState } from './GameState.js';
import { loadShipModel, applyFactionMaterial } from './ShipLoader.js';
import { applyRTSPhysics } from './Physics.js';
import { resolveAllWeapons } from './Combat.js';
import { rollCatastrophicDamage, applyExplosionDamage, rollND6 } from './CriticalHits.js';
import { updateAI } from './AI.js';
import { createVelocityArrow, updateVelocityArrow } from './VelocityArrow.js';
import { createWeaponLine, createExplosion } from './Effects.js';
import { BlastMarkerManager } from './BlastMarkers.js';
import { TorpedoManager } from './Torpedoes.js';
import { createUI } from './UI.js';
import { InputManager } from './InputManager.js';

const TURN_DURATION = 10;
const FIRE_COOLDOWN = 10;

let game;
let sceneData;
let blastMarkers;
let torpedoes;
let playerVelArrow;
let aiVelArrow;
let playerPlanArrow;
let ui;
let inputManager;
let selectedShip = null;
let isPaused = false;

function createFactionRing(color, radius) {
  const geometry = new THREE.TorusGeometry(radius, Math.max(0.02, radius * 0.016), 12, 48);
  geometry.rotateX(Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.7,
  });
  return new THREE.Mesh(geometry, material);
}

function updateShipRing(ship) {
  if (!ship.ring) return;
  ship.ring.position.copy(ship.position);
  ship.ring.quaternion.copy(ship.quaternion);

  const isTarget = selectedShip && selectedShip.target === ship;
  const isSelected = ship.selected;
  const scale = isTarget ? 1.25 : isSelected ? 1.15 : 1;
  ship.ring.scale.setScalar(scale);
  ship.ring.material.opacity = isTarget || isSelected ? 1 : 0.6;
}

function syncShipVisuals(ship) {
  ship.syncMesh();
  updateShipRing(ship);
}

async function init() {
  sceneData = createScene(document.getElementById('game'));
  const { scene } = sceneData;
  sceneData.renderer.domElement.style.touchAction = 'none';

  game = new GameState();
  game.setup();

  blastMarkers = new BlastMarkerManager(scene);
  torpedoes = new TorpedoManager(scene);

  const playerModel = await loadShipModel(
    game.playerShip.stats.modelFile,
    game.playerShip.stats.modelScale
  );
  applyFactionMaterial(playerModel, 'imperial');
  game.playerShip.mesh = playerModel;
  scene.add(playerModel);
  game.playerShip.ring = createFactionRing(0x4488ff, game.playerShip.collisionRadius * 1.4);
  scene.add(game.playerShip.ring);
  syncShipVisuals(game.playerShip);

  const aiModel = await loadShipModel(
    game.aiShip.stats.modelFile,
    game.aiShip.stats.modelScale
  );
  applyFactionMaterial(aiModel, 'xenos');
  game.aiShip.mesh = aiModel;
  scene.add(aiModel);
  game.aiShip.ring = createFactionRing(0xff4444, game.aiShip.collisionRadius * 1.4);
  scene.add(game.aiShip.ring);
  syncShipVisuals(game.aiShip);

  attachShipHitboxes();
  positionCameraOnShip(game.playerShip);

  playerVelArrow = createVelocityArrow(0x4488ff);
  aiVelArrow = createVelocityArrow(0xff4444);
  playerPlanArrow = createVelocityArrow(0xffffff);
  scene.add(playerVelArrow);
  scene.add(aiVelArrow);
  scene.add(playerPlanArrow);

  // Initialize InputManager
  inputManager = new InputManager(
    sceneData,
    () => selectedShip,
    setSelectedShip,
    () => game.getAllShips()
  );

  ui = createUI({
    onManualFire: handleManualFire,
    onAutoFireToggle: (value) => {
      if (!selectedShip) return;
      selectedShip.autoFire = value;
    },
    onBraceToggle: (value) => {
      if (!selectedShip) return;
      selectedShip.brace = value;
    },
    onFaceModeToggle: (value) => {
      inputManager.setFaceMode(value);
    },
    onElevationChange: (value) => {
      inputManager.setElevation(value);
    },
    onCenterControls: () => {
      inputManager.centerControls();
    },
    onPauseToggle: (paused) => {
      isPaused = paused;
    },
  });

  setSelectedShip(game.playerShip);

  ui.updateStatus(game, selectedShip);
  animate(performance.now());
}

function attachShipHitboxes() {
  const ships = game.getAllShips();
  for (const ship of ships) {
    if (ship.mesh) {
      ship.mesh.traverse((child) => {
        if (child.isMesh) {
          child.userData.ship = ship;
        }
      });
    }
    if (ship.ring) {
      ship.ring.userData.ship = ship;
    }
  }
}

let lastTime = 0;
function animate(time) {
  requestAnimationFrame(animate);

  const dt = Math.min(0.1, (time - lastTime) / 1000 || 0);
  lastTime = time;

  // Process input every frame (even when paused, for camera control)
  inputManager.update();

  if (!game.gameOver && !isPaused) {
    updateRTS(dt);
  }

  updateVelocityArrow(playerVelArrow, game.playerShip);
  updateVelocityArrow(aiVelArrow, game.aiShip);
  updatePlannedArrow(playerPlanArrow, selectedShip);
  updateShipRing(game.playerShip);
  updateShipRing(game.aiShip);

  sceneData.controls.update();
  sceneData.renderer.render(sceneData.scene, sceneData.camera);
}

function updateRTS(dt) {
  game.time += dt;
  game.roundTimer += dt;

  updateAI(game.aiShip, game.playerShip);

  for (const ship of game.getAllShips()) {
    if (!ship.isHulk) {
      applyRTSPhysics(ship, dt, TURN_DURATION);
    }
    syncShipVisuals(ship);
  }

  blastMarkers.updateShipBlastMarkers(game.playerShip);
  blastMarkers.updateShipBlastMarkers(game.aiShip);

  const torpedoResults = torpedoes.advanceAndResolve(game.getAllShips(), dt, TURN_DURATION);
  for (const result of torpedoResults) {
    if (result.damage && result.damage.hullDamage > 0) {
      game.log(`Torpedoes hit ${result.ship} for ${result.damage.hullDamage} damage!`);
      for (const crit of result.damage.criticals || []) {
        game.log(`  CRITICAL: ${crit.name}!`);
      }
    }
  }

  updateCooldowns(dt);
  handleAutoFire();

  if (game.roundTimer >= TURN_DURATION) {
    while (game.roundTimer >= TURN_DURATION) {
      game.roundTimer -= TURN_DURATION;
      game.round += 1;
      resolveEndPhase();
    }
  }

  checkDestruction(game.playerShip);
  checkDestruction(game.aiShip);
  for (const ship of game.getAllShips()) {
    if (ship.target && ship.target.isDestroyed) {
      ship.target = null;
    }
  }

  game.checkVictory();
  if (game.gameOver) {
    setTimeout(() => {
      alert(`GAME OVER!\n\n${game.winner} VICTORY!`);
    }, 500);
  }

  ui.updateStatus(game, selectedShip);
}

function updateCooldowns(dt) {
  for (const ship of game.getAllShips()) {
    ship.fireCooldown = Math.max(0, ship.fireCooldown - dt);
  }
}

function handleAutoFire() {
  for (const ship of game.getAllShips()) {
    if (!ship.autoFire || ship.fireCooldown > 0) continue;
    if (!ship.target || ship.target.isDestroyed) continue;
    const fired = tryFire(ship, ship.target);
    if (fired) {
      ship.fireCooldown = FIRE_COOLDOWN;
    }
  }
}

function handleManualFire() {
  if (!selectedShip || selectedShip.fireCooldown > 0) return;
  if (!selectedShip.target || selectedShip.target.isDestroyed) return;
  const fired = tryFire(selectedShip, selectedShip.target);
  if (fired) {
    selectedShip.fireCooldown = FIRE_COOLDOWN;
  }
}

function tryFire(attacker, target) {
  if (!attacker || !target) return false;
  if (attacker.isDestroyed || target.isDestroyed) return false;

  target.resetPhaseState();

  const results = resolveAllWeapons(attacker, target, blastMarkers, torpedoes);
  if (results.length === 0) return false;

  const color = attacker.faction === 'imperial' ? 0x4488ff : 0xff4444;
  for (const result of results) {
    if (result.type === 'torpedo' && result.launched > 0) {
      game.log(`${attacker.stats.name} launches ${result.launched} torpedoes`);
      continue;
    }

    if (result.hits > 0) {
      createWeaponLine(sceneData.scene, attacker.position, target.position, color);
      game.log(`${attacker.stats.name} ${result.weapon}: ${result.rolls.join(',')} = ${result.hits} hits`);

      if (result.damage) {
        if (result.damage.shieldsAbsorbed > 0) {
          blastMarkers.addMarkersAtPosition(target.position, result.damage.shieldsAbsorbed);
        }
        if (result.damage.hullDamage > 0) {
          game.log(`  Hull damage: ${result.damage.hullDamage}`);
        }
        for (const crit of result.damage.criticals) {
          game.log(`  CRITICAL: ${crit.name}!`);
        }
      }
    }
  }

  checkDestruction(target);
  return true;
}

function setSelectedShip(ship) {
  if (selectedShip) {
    selectedShip.selected = false;
  }
  selectedShip = ship;
  if (selectedShip) {
    selectedShip.selected = true;
    ui.setSelectedShip(selectedShip);
  }
}


function positionCameraOnShip(ship) {
  const offset = new THREE.Vector3(0, 10, -22);
  sceneData.camera.position.copy(ship.position).add(offset);
  sceneData.controls.target.copy(ship.position);
  sceneData.controls.update();
}


function updatePlannedArrow(arrow, ship) {
  if (!arrow || !ship) return;
  if (ship.brace || ship.thrustPower <= 0.01 || ship.desiredThrustDir.lengthSq() < 0.0001) {
    arrow.visible = false;
    return;
  }

  const length = ship.getEffectiveThrust() * ship.thrustPower;
  if (length <= 0.05) {
    arrow.visible = false;
    return;
  }

  arrow.position.copy(ship.position);
  arrow.setDirection(ship.desiredThrustDir.clone().normalize());
  arrow.setLength(length, 0.5, 0.3);
  arrow.visible = true;
}

function resolveEndPhase() {
  for (const ship of game.getAllShips()) {
    if (ship.isHulk) {
      resolveHulkDrift(ship);
      continue;
    }

    if (ship.isDestroyed) continue;

    if (ship.criticals.fires > 0) {
      let repaired = 0;
      for (let i = 0; i < ship.criticals.fires; i++) {
        if (Math.random() >= 0.5) {
          repaired += 1;
        }
      }
      ship.criticals.fires -= repaired;

      if (ship.criticals.fires > 0) {
        ship.currentHits = Math.max(0, ship.currentHits - ship.criticals.fires);
        game.log(`${ship.stats.name} takes ${ship.criticals.fires} fire damage!`);
      }
    }

    const repairables = [
      'dorsal_damaged',
      'starboard_damaged',
      'port_damaged',
      'prow_damaged',
      'engines_damaged',
      'thrusters_damaged',
    ];

    for (const crit of repairables) {
      if (ship.criticals[crit] && Math.random() >= 0.5) {
        ship.criticals[crit] = false;
        game.log(`${ship.stats.name} repairs ${crit.replace('_', ' ')}!`);
      }
    }

    if (ship.currentHits <= 0 && !ship.catastrophicResolved) {
      checkDestruction(ship);
    }
  }

  blastMarkers.endPhaseRemoval(game.getAllShips());
}

function checkDestruction(ship) {
  if (ship.currentHits > 0 || ship.catastrophicResolved) return;

  ship.catastrophicResolved = true;
  const catResult = rollCatastrophicDamage(ship);
  game.log(`${ship.stats.name} DESTROYED! ${catResult.name} (rolled ${catResult.roll})`);

  blastMarkers.addMarkersAtPosition(ship.position, catResult.blastMarkers);

  if (catResult.effect === 'drifting_hulk' || catResult.effect === 'blazing_hulk') {
    ship.isHulk = true;
    ship.hulkType = catResult.effect;
    ship.velocity.set(0, 0, 0);
    return;
  }

  if (catResult.effect === 'plasma_explosion' || catResult.effect === 'warp_implosion') {
    createExplosion(sceneData.scene, ship.position, catResult.explosionRadius / 3);

    const explosionResults = applyExplosionDamage(
      ship,
      game.getAllShips(),
      catResult.explosionRadius,
      catResult.explosionStrength
    );

    for (const expRes of explosionResults) {
      if (expRes.hits > 0) {
        game.log(`  Explosion hits ${expRes.ship.stats.name} for ${expRes.hits} damage!`);
      }
    }

    for (const expRes of explosionResults) {
      checkDestruction(expRes.ship);
    }
  }

  if (ship.mesh) {
    sceneData.scene.remove(ship.mesh);
    ship.mesh = null;
  }
  if (ship.ring) {
    sceneData.scene.remove(ship.ring);
    ship.ring.geometry.dispose();
    ship.ring.material.dispose();
    ship.ring = null;
  }
  if (selectedShip === ship) {
    selectedShip = null;
  }
}

function resolveHulkDrift(ship) {
  const drift = rollND6(4);
  const forward = ship.getForward();
  ship.position.add(forward.multiplyScalar(drift));
  syncShipVisuals(ship);
  blastMarkers.addMarkersAtPosition(ship.position, 1);

  if (ship.hulkType === 'blazing_hulk') {
    const catResult = rollCatastrophicDamage(ship);
    game.log(`${ship.stats.name} hulk catastrophically shifts: ${catResult.name} (rolled ${catResult.roll})`);

    blastMarkers.addMarkersAtPosition(ship.position, catResult.blastMarkers);

    if (catResult.effect === 'drifting_hulk') {
      ship.hulkType = 'drifting_hulk';
      return;
    }

    if (catResult.effect === 'blazing_hulk') {
      ship.hulkType = 'blazing_hulk';
      return;
    }

    if (catResult.effect === 'plasma_explosion' || catResult.effect === 'warp_implosion') {
      createExplosion(sceneData.scene, ship.position, catResult.explosionRadius / 3);

      const explosionResults = applyExplosionDamage(
        ship,
        game.getAllShips(),
        catResult.explosionRadius,
        catResult.explosionStrength
      );

      for (const expRes of explosionResults) {
        if (expRes.hits > 0) {
          game.log(`  Explosion hits ${expRes.ship.stats.name} for ${expRes.hits} damage!`);
        }
      }

      for (const expRes of explosionResults) {
        checkDestruction(expRes.ship);
      }
    }

    ship.isHulk = false;
    ship.hulkType = null;
    if (ship.mesh) {
      sceneData.scene.remove(ship.mesh);
      ship.mesh = null;
    }
    if (ship.ring) {
      sceneData.scene.remove(ship.ring);
      ship.ring.geometry.dispose();
      ship.ring.material.dispose();
      ship.ring = null;
    }
  }
}

init();
