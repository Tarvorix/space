# CLAUDE.md - BattleBarge Space Combat Game

## Project Overview

BattleBarge is a 6DOF (six degrees of freedom) Newtonian space combat game built with Three.js. Players command capital ships in tactical combat featuring realistic physics, weapon systems, shields, and critical damage mechanics.

## Tech Stack

- **Runtime**: Browser (ES Modules)
- **Build Tool**: Vite 5.x
- **3D Engine**: Three.js 0.160.x
- **Language**: Vanilla JavaScript (ES6+)
- **Deployment**: GitHub Pages (via GitHub Actions)

## Directory Structure

```
/
├── index.html           # Entry point, minimal HTML shell
├── package.json         # Dependencies and scripts
├── vite.config.js       # Vite config (base path: /space/)
├── .github/workflows/
│   └── deploy.yml       # GitHub Pages deployment workflow
├── assets/models/       # GLB ship models
│   ├── Imperial_Cruiser.glb
│   ├── Serpent_Cruiser.glb
│   └── ...
└── src/
    ├── main.js          # Game entry point and main loop
    ├── scene.js         # Three.js scene, camera, controls setup
    ├── GameState.js     # Central game state management
    ├── Ship.js          # Ship class with position, velocity, stats
    ├── ShipData.js      # Ship stats, weapons, constants
    ├── ShipLoader.js    # GLB model loading with caching
    ├── Physics.js       # Newtonian physics and movement
    ├── Combat.js        # Weapon resolution, damage application
    ├── CriticalHits.js  # Critical hit tables and effects
    ├── AI.js            # Enemy AI behavior
    ├── UI.js            # HUD and control panel
    ├── InputManager.js  # Keyboard, mouse, touch input handling
    ├── BlastMarkers.js  # Debris field mechanics
    ├── Torpedoes.js     # Torpedo salvo management
    ├── Shields.js       # Shield helper functions
    ├── Effects.js       # Visual effects (weapon lines, explosions)
    └── VelocityArrow.js # Velocity vector visualization
```

## Architecture

### Core Systems

1. **GameState** (`GameState.js`): Manages game time, rounds, ships, and victory conditions
2. **Ship** (`Ship.js`): Entity class with position/velocity (THREE.Vector3), quaternion rotation, stats, and critical damage state
3. **Physics** (`Physics.js`): Newtonian movement with thrust, rotation limits, and speed caps
4. **Combat** (`Combat.js`): Weapon arc checking, hit resolution, damage application

### Game Loop

The main loop in `main.js`:
1. Process input (InputManager)
2. Update AI
3. Apply physics to all ships
4. Update blast markers and torpedoes
5. Handle weapon cooldowns and auto-fire
6. Check round transitions and end-phase effects
7. Check destruction and victory conditions
8. Render

### Key Constants

```javascript
// main.js
const TURN_DURATION = 10;    // Seconds per game round
const FIRE_COOLDOWN = 10;    // Seconds between weapon fires

// ShipData.js
const RANGES = {
  CLOSE: 6,    // Close range bonus
  MEDIUM: 18,  // Standard range
  LONG: 30,    // Long range penalty
  MAX: 60      // Maximum engagement range
};
```

## Development Workflow

### Commands

```bash
npm install      # Install dependencies
npm run dev      # Start dev server (http://localhost:5173/space/)
npm run build    # Production build to dist/
npm run preview  # Preview production build
```

### Git Commit Requirements

**All commits must be authored by Tarvorix.** Never use "Claude" or any AI-related attribution in:
- Git author name/email
- Git committer name/email
- Commit messages
- Branch names (except system-generated ones)

When making commits, ensure the git config is set appropriately or commits are attributed to the repository owner.

### Key Development Notes

- The game uses ES modules (`"type": "module"` in package.json)
- Vite base path is `/space/` for GitHub Pages deployment
- Models are loaded asynchronously via GLTFLoader
- Three.js OrbitControls are used for camera manipulation

## Code Conventions

### Module Organization

- Each system is a separate module with clear exports
- No global state; GameState instance passed where needed
- Classes use THREE.Vector3/Quaternion for 3D math

### Naming Conventions

- Classes: PascalCase (`Ship`, `GameState`, `BlastMarkerManager`)
- Functions: camelCase (`createScene`, `applyRTSPhysics`)
- Constants: UPPER_SNAKE_CASE (`FIRE_ARCS`, `WEAPON_TYPES`)
- Private methods: prefix with underscore (`_onPointerDown`)

### Pattern Examples

**Ship stats are defined in ShipData.js:**
```javascript
export const PLAYER_CRUISER = {
  name: 'Imperial Cruiser',
  modelFile: 'Imperial_Cruiser.glb',
  modelScale: 2.5,
  hits: 8,
  shields: 2,
  thrust: 3,
  weapons: [...]
};
```

**Combat resolution pattern:**
```javascript
const results = resolveAllWeapons(attacker, target, blastMarkers, torpedoes);
for (const result of results) {
  // Handle hits, damage, criticals
}
```

## Game Mechanics

### Movement

- Ships have position, velocity, and quaternion orientation
- Thrust adds to velocity; speed is capped at `maxSpeed`
- Rotation is limited per turn by `rotate` stat (degrees)
- "Brace" stance halves rotation and offensive capabilities

### Combat

**Weapon Types:**
- **Battery**: Roll firepower dice, hit on roll >= armor value
- **Lance**: Roll strength dice, hit on 4+, ignores armor
- **Torpedo**: Launched salvos travel forward, intercepted by turrets

**Damage Flow:**
1. Hits absorbed by shields first
2. Remaining hits apply to hull
3. Each hull hit has 1/6 chance of critical
4. At 0 hits: catastrophic damage roll

### Critical Hits (2d6)

| Roll | Effect |
|------|--------|
| 2-5  | Weapon arc disabled |
| 6    | Engine room damaged |
| 7    | Fire! |
| 8    | Thrusters damaged |
| 9    | Bridge smashed |
| 10   | Shields collapse |
| 11   | Hull breach (D3 extra damage) |
| 12   | Bulkhead collapse (D6 extra damage) |

### Factions

- **Imperial** (Player): Blue color, balanced stats
- **Xenos** (AI): Red color, faster with longer-range weapons

## Input Controls

- **WASD/Arrows**: Thrust direction (camera-relative)
- **Q/E**: Vertical thrust (up/down)
- **Mouse drag on ship**: Set thrust direction and power
- **Mouse drag on empty space**: Rotate camera
- **Click enemy**: Set as target
- **Space**: Pause/Resume

## Deployment

Automatic deployment to GitHub Pages on push to `main`:

1. Checkout repository
2. Install dependencies (`npm ci`)
3. Build (`npm run build`)
4. Deploy `dist/` to GitHub Pages

The game is accessible at: `https://<username>.github.io/space/`

## Testing

Currently no automated tests. Manual testing workflow:
1. Run `npm run dev`
2. Test ship movement and camera controls
3. Verify weapon firing and damage
4. Check AI behavior
5. Test victory/defeat conditions

## Adding New Ships

1. Add GLB model to `assets/models/`
2. Create ship stats object in `ShipData.js`:
   ```javascript
   export const NEW_SHIP = {
     name: 'Ship Name',
     modelFile: 'Model.glb',
     modelScale: 2.5,
     hits: 6,
     armorFront: 5,
     armorOther: 4,
     shields: 1,
     turrets: 1,
     thrust: 4,
     rotate: 45,
     maxSpeed: 10,
     weapons: [...]
   };
   ```
3. Use in GameState or spawn logic

## Adding New Weapons

1. Add weapon type to `WEAPON_TYPES` if needed
2. Add weapon to ship's `weapons` array in ShipData.js
3. Add resolution logic in `Combat.js` if new type

## Common Issues

- **Models not loading**: Check path in `ShipLoader.js`, ensure file exists
- **Camera issues**: OrbitControls may conflict with InputManager during drag
- **Physics glitches**: Check `dt` clamping in animate loop (max 0.1s)
