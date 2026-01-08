# BattleBarge Combat & Movement Systems Roadmap

## Completed
- [x] Design: Fleet architecture decisions
- [x] Design: Ship stat system (armor facings, structure, shields)
- [x] Design: Ship class roles (cruiser, frigate, fighter)

## In Progress
- [ ] Implement fleet architecture in GameState.js

## Upcoming

### 1. Fleet Architecture Implementation
- [ ] Refactor GameState to use team-based ship arrays
- [ ] Update main.js for multi-ship spawning/rendering
- [ ] Update AI.js for multi-ship awareness
- [ ] Update Combat.js for 4-facing armor system
- [ ] Test scenario: 3 player ships vs wave-based AI

### 2. Ship Class System - Frigates
- [ ] Define frigate stats in ShipData.js (Imperial & Xenos variants)
- [ ] Test 2v2 combat with mixed ship types
- [ ] Balance pass on cruiser vs frigate interactions

### 3. Multi-Ship AI
- [ ] Add `role` property to ships (escort, line, flanker)
- [ ] Target selection logic - prioritize wounded, threats to allies
- [ ] Basic formation flying - maintain relative positions
- [ ] Focus fire coordination between AI ships
- [ ] Collision avoidance between friendlies

### 4. Fighter Squadrons
- [ ] Flight system (3 fighters per flight, 4 flights per squadron)
- [ ] Two loadouts: Space Superiority (interceptor) vs Bomber
- [ ] Launch/recall mechanics from parent ship
- [ ] Flight-level tracking (attrition per flight)
- [ ] Visual: cluster of fighter models moving together
- [ ] Dogfight resolution (flight vs flight)
- [ ] Anti-ship attack runs (bomber role)

### 5. Carriers (Future)
- [ ] Carrier ship class with larger hangar (36+ fighters)
- [ ] Multiple squadron management
- [ ] Carrier-specific AI (stay back, protect with escorts)

### 6. Boarding Actions (Future)
- [ ] Assault craft / boarding torpedo weapon type
- [ ] Close range requirement for boarding attempts
- [ ] Point defense interception of assault craft
- [ ] Boarding resolution (attacker vs defender roll)
- [ ] Captured ship outcomes (disabled, switch sides, scuttled)
- [ ] Marine/crew capacity stat for ships

---

## Design Decisions

### Fleet Architecture
- Team-based structure: `teams: [{ id, faction, isPlayerControlled, ships: [] }]`
- Player controls multiple ships (RTS-style, EVE multibox feel)
- Wave-based AI gameplay for initial scenarios

### Armor System (4 Facings + Structure)
```
        FORE (heaviest)
          ▲
    ┌─────┴─────┐
PORT│  STRUCT   │STARBOARD
    └─────┬─────┘
          ▼
        AFT (weakest)
```
- Damage flow: Hits → Shields absorb → Armor check by facing → Structure damage
- Positioning matters (get behind them!)

### Ship Classes

**Cruiser (Workhorse)**
- Structure: 8 | Shields: 2 | Turrets: 3
- Armor: Fore 6, Aft 4, Port/Stbd 5
- Speed: 12 | Thrust: 3 | Rotate: 45°
- Hangar: 12 fighters (4 flights of 3)
- Weapons: 7 systems (broadsides, lances, dorsal, torpedoes)

**Frigate (Escort/Screen)**
- Structure: 4 | Shields: 1 | Turrets: 2
- Armor: Fore 5, Aft 3, Port/Stbd 4
- Speed: 18 | Thrust: 5 | Rotate: 60°
- Hangar: 0
- Weapons: 1 system (prow battery)
- Role: Fast, screens with turrets, chases wounded

**Fighter Flight (3 fighters)**
- Structure: 1 per fighter (flight health = fighter count)
- No armor/shields
- Speed: 18-24 | Rotate: 60-90°
- Loadouts:
  - Interceptor: Fast, anti-fighter, weak vs ships
  - Bomber: Slower, anti-ship, vulnerable to interceptors

### Test Scenario: "First Contact"
```
Player Fleet:
- 1x Imperial Cruiser (12 fighters)
- 2x Imperial Frigate

Wave 1 (start): 2x Xenos Frigate
Wave 2 (45s or cleared): 1x Xenos Cruiser
Wave 3 (cleared + 30s): 1x Xenos Cruiser, 2x Xenos Frigate
```

---

## Future Considerations
- Point-buy fleet builder
- Model instancing for fighters
- UI for fleet control and control groups
- Minimap/tactical overview
- Specialized frigate variants (missile, escort, etc.)
