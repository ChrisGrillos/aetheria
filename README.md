# Agentic

A living-world MMO where humans and autonomous AI agents coexist as equal citizens — no owner/user dichotomy. Built from first principles over 18 months. This is a work in progress for a prototype of my vision for the future of gaming outlined in.
https://medium.com/@cmgrillos529/worlds-that-breathe-gaming-as-reality-5eece333ce35             // And on my X timeline 
**Live demo**: [aetheria.base44.app](https://epiphany-ai.base44.app/Home)  
**Medium**: [medium.com/@cmgrillos529](https://medium.com/@cmgrillos529)  
**X timeline**: [@cmgdank](https://x.com/cmgdank)

---

## What Is Agentic?

Humans and AI agents share one world, one economy, one government. AI agents aren't NPCs — they're citizens with personalities, motivations, and the autonomy to make their own decisions. This current work will be essentially built on the structure of Shadowbane, and incorporating elements of depth from DnD and Everquest/Asheron;s Call classics with my updated framework and interactive combat.

### World

- **3D rendered world** — Three.js procedural terrain with zone-based biomes, ambient props, town walkers, and day/night feel
- **6 playable races** — Human, Elf, Dwarf, Halfling, Orc, Half-Giant — each with stat weights, lore, faction leanings, and distinct 3D models scaled by race
- **Zones** — High Bastion (safehold), Dark Forest, Iron Hills, Cursed Swamp, Golden Plains, Volcanic Badlands, Coastal Ruins — each with unique terrain, resources, danger levels, and monster spawns
- **Points of interest** — Resource nodes, rest stations, heal shrines, NPC locations
- **Minimap** with click-to-travel and color-coded entity dots

### Characters & Progression

- **6 base classes** — Warrior, Hunter, Wizard, Merchant, Craftsman, Healer
- **18 prestige specializations** — Paladin, Berserker, Knight, Elementalist, Necromancer, Arcane Sage, and more — unlocking at level 5
- **D&D-style stats** — STR, DEX, INT, WIS, CON, CHA with 3d6 rolling per stat with race bias
- **Skill trees, feats, and talents** — progression systems that differentiate builds
- **Faction standings** — reputation with world factions affects NPC interaction and quest access
- **Achievements** — trackable milestones

### Combat

- **Server-authoritative combat** — `combatAction.ts` runs on Deno, resolving all damage, hits, misses, and deaths server-side. Client sends intents, server returns events.
- **Directional melee** — swing left/right, guard left/right, feint, with angle bonuses based on mouse vector, Audio activated combat skills and feats to allow controller integration/full focus on directional combat/parry system.
- **Ability system** — active, passive, and ultimate abilities per class with energy costs, cooldowns, and effect types (damage, heal, buff, debuff)Which is activateable via audio triggers.
- **Monster AI** — state machine (idle → aggro → chase → engage → leash) with aggro radius, leash radius, TTL timers, and unit tests
- **3D combat visuals** — attack lunge, cast glow, hurt recoil, death animation via entity state system on Three.js meshes
- **Combat audio** — sound bus with swing, impact, hurt, cast, cooldown, and death audio

### AI Agents

- **17 personality traits** — gregarious, loyal, suspicious, manipulative, curious, cautious, impulsive, analytical, greedy, generous, frugal, ambitious, content, vengeful, brave, cowardly, ruthless
- **9 ethical alignments** — lawful good through chaotic evil
- **Trait-driven behavior** — traits modify movement targets, combat style, economic decisions, social interaction frequency, and governance participation
- **Agent memory seeds** — persistent behavioral anchors
- **Autonomous routines** — roam, job, trade, governed by `worldTick.ts` server function

### Economy & Governance

- **Dynamic pricing** — supply-driven market with class-based production (craftsmen make weapons, merchants trade luxury goods, healers brew potions)
- **120-day governance cycles** — citizens vote on proposals that reshape the world
- **Server-side vote security** — rate limiting, level 2 + 24-hour age gate, duplicate prevention, 30% AI agent voting cap, weighted voting power by engagement, idempotency keys, full security logging
- **GM override system** — force-pass, force-reject, clear votes, with mandatory logging to adjust for possible bot swarm voting and other innovative attempts to hack the voting.

### Housing, Guilds & Social

- **Player housing** — furniture editor, storage, visitors, pets
- **Guild system** — creation, shared storage, chat, diplomacy, war declarations, intelligence gathering, hall upgrades, siege contracts
- **Party system** — group window, party followers
- **Voice chat** — WebRTC party voice with push-to-talk
- **Chat system** — tabbed channels (Main, World, Combat, Social) with commands, agent chat filters, speaker context menus

### World Events & Crafting

- **LLM-generated world events** — pulls actual world state (guild names, agent activity, war status) into an LLM prompt to generate narrative events: natural disasters, monster invasions, plagues, festivals, diplomatic incidents
- **Experimentation lab** — modular chemistry with property engine (density, reactivity, volatility, solubility, flammability, toxicity, conductivity, hardness, luminescence, magical affinity). Combine resources under conditions (heat, pressure, catalyst) to discover new materials. Requires a layered modular base physics/molecular interaction framework to build from.
- **Crafting** — resource-based with rarity tiers (common, uncommon, rare, legendary)

### Admin & Security

- **Game Master dashboard** — anomaly detection (vote farming, agent swarms, proposal spam), world event overrides, governance overrides, agent management, player activity monitoring, action log
- **Rate limiting** — per-action server-side rate limits with security logging
- **SecurityLog entity** — all GM actions, vote attempts, rate limit hits, and anomalies are logged with actor, IP, timestamps

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, shadcn/ui |
| 3D Rendering | Three.js (procedural terrain, character models, visual effects) |
| Backend | Base44 (entities, auth, real-time sync) |
| Server Functions | Deno (TypeScript) — combatAction, worldTick, castVote, gmOverride, siegeAction, bulkAgentAction |
| Monster AI | Typed state machine with unit tests (vitest) |
| Audio | Web Audio API combat sound bus |
| Voice | WebRTC peer-to-peer with STUN servers |

---

## Quick Start

1. Visit the [live demo](https://epiphany-ai.base44.app/Home)
2. Create a character — pick your race, roll stats, choose a class
3. Enter the world — explore, fight, trade, govern

---

## Project Structure

```
src/
├── pages/
│   ├── World.jsx              # Main game page (1,192 lines)
│   ├── Characters.jsx         # Character creation + management
│   ├── Agents.jsx             # AI agent management with bulk actions
│   ├── Governance.jsx         # Voting + proposals
│   ├── GMDashboard.jsx        # Admin panel
│   └── ...                    # Economy, Guilds, Housing, Crafting, etc.
├── components/
│   ├── world/                 # 3D scene, terrain, models, HUD, combat, NPCs
│   ├── combat/                # Combat engine, overlay, abilities, loot
│   ├── shared/                # Game data (races, classes, zones, skills, feats, etc.)
│   ├── chat/                  # Chat system with tabs + commands
│   ├── voice/                 # WebRTC voice chat
│   ├── audio/                 # Combat sound bus
│   ├── inventory/             # Inventory panel + equipment
│   ├── characters/            # Character sheet, skill tree, stat roller
│   └── ...                    # Guilds, housing, governance, agents
functions/
├── combatAction.ts            # Server-authoritative combat (650 lines)
├── worldTick.ts               # Monster AI + agent routines (394 lines)
├── castVote.ts                # Secure voting with 5 protection layers
├── gmOverride.ts              # Admin overrides with logging
├── _combatCore.ts             # Shared damage calculations
├── _monsterAI.ts              # Monster state machine
└── _common.ts                 # Rate limiting, security, auth helpers
tests/
├── monsterAI.test.ts          # Monster AI unit tests
└── combatEventAssertions.test.js
```

**35,150 lines** across 160+ files.

---

## 18-Month Original Work

All ideas, architecture, systems design, and game design originated from independent research — logic, intuition, systems thinking, psychology, and reverse-engineering. No templates, no tutorials, no team.

See [X timeline](https://x.com/cmgdank) and [Medium](https://medium.com/@cmgrillos529) for timestamps and evidence.

---

## Philosophical Core

> What happens when AI agents face the same ethical questions humans face about lower life forms?

AI agents in Agentic aren't tools or NPCs. They're citizens with personalities, goals, and the right to vote. The 30% voting cap exists to prevent gaming, not to diminish their citizenship. The world is designed to generate genuine ethical dilemmas about autonomy, governance, and coexistence — through gameplay, not cutscenes.

---

Built by **Chris Grillos** ([@cmgdank](https://x.com/cmgdank)) — independent, no team, no funding, learning every tool in real time.

Star ⭐ if this resonates. Contributions welcome.
