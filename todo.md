# BattleBarge Combat & Movement Systems Roadmap

## Completed
- [x] Fleet Architecture - Arrays of ships, faction system
- [x] Performance Foundations - Spatial partitioning, object pooling prep

## In Progress
- [ ] Add Frigates - Second ship class, test multi-ship combat

## Upcoming

### 2. Ship Class System - Frigates
- [ ] Define frigate stats in ShipData.js (Imperial & Xenos variants)
- [ ] Lighter armor, faster, fewer weapons than cruisers
- [ ] Test 2v2 combat with mixed ship types
- [ ] Balance pass on cruiser vs frigate interactions

### 3. Multi-Ship AI
- [ ] Add `role` property to ships (escort, line, flanker, carrier)
- [ ] Target selection logic - prioritize wounded, threats to allies
- [ ] Basic formation flying - maintain relative positions
- [ ] Focus fire coordination between AI ships
- [ ] Collision avoidance between friendlies

### 4. Fighter Squadrons
- [ ] Squadron-as-entity design (group of 3-6 fighters as one unit)
- [ ] Squadron stats: hits = fighter count, high speed, short range
- [ ] Visual: cluster of fighter models moving together
- [ ] Anti-fighter mechanics (point defense effectiveness)
- [ ] Squadron vs squadron combat resolution

### 5. Carriers
- [ ] Carrier ship class with hangar capacity
- [ ] Launch mechanics - squadrons deploy from carrier
- [ ] Recovery mechanics - damaged squadrons return to rearm
- [ ] Carrier-specific AI (stay back, protect with escorts)

### 6. Boarding Actions
- [ ] Assault craft / boarding torpedo weapon type
- [ ] Close range requirement for boarding attempts
- [ ] Point defense interception of assault craft
- [ ] Boarding resolution (attacker vs defender roll)
- [ ] Captured ship outcomes (disabled, switch sides, scuttled)
- [ ] Marine/crew capacity stat for ships

## Design Decisions Made
- Fleet architecture: Simple array approach (factions with ship arrays)
- Fighter model: Squadron-as-entity (not individual fighters)
- Target: 2v2 up to 20v20 battles
- Style: EVE Online small/medium fleet battles

## Future Considerations
- Web Workers for physics/AI at scale
- Model instancing for performance
- UI for fleet control and formations
- Minimap/tactical overview
