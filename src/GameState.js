import * as THREE from 'three';
import { Ship } from './Ship.js';
import { SCENARIOS, IMPERIAL_CRUISER, IMPERIAL_FRIGATE, XENOS_CRUISER, XENOS_FRIGATE } from './ShipData.js';

export const PHASES = {
  PLANNING: 'planning',
  EXECUTION: 'execution',
  SHOOTING: 'shooting',
  ORDNANCE: 'ordnance',
  END: 'end',
};

export class GameState {
  constructor() {
    this.time = 0;
    this.round = 1;
    this.roundDuration = 10;
    this.roundTimer = 0;
    this.gameOver = false;
    this.winner = null;
    this.logLines = [];

    // Team-based fleet architecture
    this.teams = [
      {
        id: 'player',
        faction: 'imperial',
        isPlayerControlled: true,
        ships: [],
      },
      {
        id: 'enemy',
        faction: 'xenos',
        isPlayerControlled: false,
        ships: [],
      },
    ];

    // Wave management
    this.currentScenario = null;
    this.waveIndex = 0;
    this.wavesCompleted = [];
    this.waveTimer = 0;
    this.lastWaveClearedTime = null;

    // Legacy compatibility
    this.playerShip = null;
    this.aiShip = null;
  }

  /**
   * Load a scenario by name
   */
  loadScenario(scenarioName) {
    const scenario = SCENARIOS[scenarioName];
    if (!scenario) {
      console.error(`Scenario "${scenarioName}" not found`);
      return;
    }

    this.currentScenario = scenario;
    this.waveIndex = 0;
    this.wavesCompleted = [];
    this.waveTimer = 0;

    // Clear existing ships
    this.teams[0].ships = [];
    this.teams[1].ships = [];

    // Spawn player fleet
    const playerTeam = this.getPlayerTeam();
    playerTeam.faction = scenario.playerFleet.faction;

    for (const shipDef of scenario.playerFleet.ships) {
      const ship = this.spawnShip(shipDef.stats, playerTeam.id, shipDef.position, shipDef.facing);
      ship.autoFire = false;
    }

    // Spawn first wave(s) that trigger on 'start'
    this.checkWaveTriggers();

    // Legacy compatibility: set playerShip to first player ship
    if (playerTeam.ships.length > 0) {
      this.playerShip = playerTeam.ships[0];
    }
    if (this.teams[1].ships.length > 0) {
      this.aiShip = this.teams[1].ships[0];
    }
  }

  /**
   * Setup for legacy 1v1 mode (backwards compatibility)
   */
  setup() {
    // Clear teams
    this.teams[0].ships = [];
    this.teams[1].ships = [];

    // Spawn single cruiser for each side
    const playerShip = this.spawnShip(IMPERIAL_CRUISER, 'player', { x: 0, y: 0, z: -12 }, 0);
    const aiShip = this.spawnShip(XENOS_CRUISER, 'enemy', { x: 0, y: 0, z: 12 }, Math.PI);
    aiShip.autoFire = true;

    // Legacy compatibility
    this.playerShip = playerShip;
    this.aiShip = aiShip;
  }

  /**
   * Spawn a ship and add it to a team
   */
  spawnShip(stats, teamId, position, facing = 0) {
    const team = this.getTeamById(teamId);
    if (!team) {
      console.error(`Team "${teamId}" not found`);
      return null;
    }

    const ship = new Ship(stats, team.faction);
    ship.teamId = teamId;
    ship.position.set(position.x, position.y, position.z);
    ship.velocity.set(0, 0, 0);
    ship.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), facing);

    team.ships.push(ship);
    return ship;
  }

  /**
   * Remove a ship from its team
   */
  removeShip(ship) {
    for (const team of this.teams) {
      const index = team.ships.indexOf(ship);
      if (index !== -1) {
        team.ships.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  /**
   * Get team by ID
   */
  getTeamById(teamId) {
    return this.teams.find(t => t.id === teamId);
  }

  /**
   * Get the player-controlled team
   */
  getPlayerTeam() {
    return this.teams.find(t => t.isPlayerControlled);
  }

  /**
   * Get enemy teams (AI-controlled)
   */
  getEnemyTeams() {
    return this.teams.filter(t => !t.isPlayerControlled);
  }

  /**
   * Get all ships from all teams
   */
  getAllShips() {
    const ships = [];
    for (const team of this.teams) {
      ships.push(...team.ships);
    }
    return ships;
  }

  /**
   * Get all player-controlled ships
   */
  getPlayerShips() {
    const playerTeam = this.getPlayerTeam();
    return playerTeam ? playerTeam.ships : [];
  }

  /**
   * Get all AI-controlled ships
   */
  getAIShips() {
    const ships = [];
    for (const team of this.getEnemyTeams()) {
      ships.push(...team.ships);
    }
    return ships;
  }

  /**
   * Get enemies of a specific ship
   */
  getEnemiesOf(ship) {
    const enemies = [];
    for (const team of this.teams) {
      if (team.id !== ship.teamId) {
        enemies.push(...team.ships.filter(s => !s.isDestroyed));
      }
    }
    return enemies;
  }

  /**
   * Get allies of a specific ship (excluding itself)
   */
  getAlliesOf(ship) {
    const team = this.getTeamById(ship.teamId);
    if (!team) return [];
    return team.ships.filter(s => s !== ship && !s.isDestroyed);
  }

  /**
   * Check if two ships are enemies
   */
  areEnemies(shipA, shipB) {
    return shipA.teamId !== shipB.teamId;
  }

  /**
   * Update wave spawning logic
   */
  updateWaves(dt) {
    if (!this.currentScenario) return;

    this.waveTimer += dt;

    this.checkWaveTriggers();
  }

  /**
   * Check and spawn waves based on triggers
   */
  checkWaveTriggers() {
    if (!this.currentScenario) return;

    const waves = this.currentScenario.waves;

    for (let i = 0; i < waves.length; i++) {
      const wave = waves[i];

      // Skip already completed waves
      if (this.wavesCompleted.includes(wave.id)) continue;

      let shouldSpawn = false;

      switch (wave.trigger) {
        case 'start':
          shouldSpawn = true;
          break;

        case 'time':
          shouldSpawn = this.waveTimer >= wave.delay;
          break;

        case 'wave_cleared':
          // Check if all previous waves are cleared and delay has passed
          const previousWavesCleared = this.areAllEnemiesDestroyed();
          if (previousWavesCleared) {
            if (this.lastWaveClearedTime === null) {
              this.lastWaveClearedTime = this.waveTimer;
            }
            shouldSpawn = (this.waveTimer - this.lastWaveClearedTime) >= wave.delay;
          }
          break;
      }

      if (shouldSpawn) {
        this.spawnWave(wave);
        this.wavesCompleted.push(wave.id);
        this.lastWaveClearedTime = null; // Reset for next wave_cleared trigger
      }
    }
  }

  /**
   * Spawn a wave of enemy ships
   */
  spawnWave(wave) {
    this.log(`Wave incoming: ${wave.id}`);

    for (const shipDef of wave.ships) {
      const ship = this.spawnShip(shipDef.stats, 'enemy', shipDef.position, shipDef.facing);
      ship.autoFire = true;
      ship.aiBehavior = wave.behavior || 'aggressive';
    }

    // Update legacy aiShip reference
    const enemyTeam = this.getTeamById('enemy');
    if (enemyTeam && enemyTeam.ships.length > 0) {
      this.aiShip = enemyTeam.ships[0];
    }
  }

  /**
   * Check if all enemy ships are destroyed
   */
  areAllEnemiesDestroyed() {
    const aiShips = this.getAIShips();
    return aiShips.length === 0 || aiShips.every(s => s.isDestroyed);
  }

  /**
   * Check if all player ships are destroyed
   */
  areAllPlayersDestroyed() {
    const playerShips = this.getPlayerShips();
    return playerShips.length === 0 || playerShips.every(s => s.isDestroyed);
  }

  /**
   * Check if all waves have been spawned
   */
  allWavesSpawned() {
    if (!this.currentScenario) return true;
    return this.wavesCompleted.length >= this.currentScenario.waves.length;
  }

  log(message) {
    this.logLines.push(message);
    console.log(message);
  }

  checkVictory() {
    // Scenario-based victory conditions
    if (this.currentScenario) {
      // Defeat: all player ships destroyed
      if (this.areAllPlayersDestroyed()) {
        this.gameOver = true;
        this.winner = 'XENOS';
        return;
      }

      // Victory: all waves spawned and all enemies destroyed
      if (this.allWavesSpawned() && this.areAllEnemiesDestroyed()) {
        this.gameOver = true;
        this.winner = 'IMPERIAL';
        return;
      }

      return;
    }

    // Legacy 1v1 victory check
    const playerDead = this.playerShip?.isDestroyed ?? true;
    const aiDead = this.aiShip?.isDestroyed ?? true;

    if (!playerDead && !aiDead) {
      return;
    }

    this.gameOver = true;
    if (playerDead && aiDead) {
      this.winner = 'DRAW';
    } else if (aiDead) {
      this.winner = 'IMPERIAL';
    } else {
      this.winner = 'XENOS';
    }
  }
}
