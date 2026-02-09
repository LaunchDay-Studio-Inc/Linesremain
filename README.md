# LINEREMAIN

**Draw your last line.**

A multiplayer survival game rendered entirely in the browser. Gather, craft, build, raid, and survive in a procedurally generated voxel world — no downloads, no installs, just open a tab and play.

---

## What Is Lineremain?

Lineremain is a browser-based survival game inspired by Rust, built from scratch with TypeScript, HTML5 Canvas, and WebSockets. Every structure, every tool, every battle happens in real time across a shared persistent world that wipes on a weekly season cycle.

You wake up with nothing. The world doesn't care. Draw your line — or don't.

---

## Features

### Survival

- **Hunger, thirst, temperature, health** — four stats that will kill you if ignored
- **Day/night cycle** with dynamic sky, lighting, and temperature shifts
- **Weather systems** — rain, fog, blizzards, environmental hazards
- **Biome-specific dangers** — desert heat, tundra cold, swamp creatures

### Crafting & Progression

- **60+ items** — weapons, tools, armor, building materials, explosives
- **Tiered workbenches** unlock advanced recipes
- **Research tables** let you study found items to learn their blueprints
- **Blueprints persist through death** — knowledge is permanent, gear is not

### Building & Raiding

- **Modular building system** — foundations, walls, doorways, floors, roofs
- **Tool cupboard authorization** — control who can build near your base
- **Code locks** — secure your doors with 4-digit codes
- **C4 explosives and raiding** — breach enemy walls, steal their loot
- **Building decay** — unprotected structures crumble over time

### Combat

- **Melee and ranged weapons** with hit detection and projectile physics
- **PvP and PvE** — fight players and AI creatures
- **Loot drops on death** — everything you carry is up for grabs
- **Armor system** — reduce incoming damage with crafted gear

### Living World

- **Procedural terrain** — infinite world with 10+ biomes (forest, desert, tundra, swamp, savanna, snowy mountains, and more)
- **Monuments and ruins** — explorable structures with high-tier loot and NPC guards
- **Abandoned camps** with journal fragments that tell the world's story
- **The Last Line** — a massive fallen fortification, the world's only unique monument
- **World events** — Blood Moons (red sky, boosted spawns), Supply Drops (timed airdrops), Fog (dense cover)
- **Biome atmosphere** — per-biome particles (snow, dust, fireflies, blizzards), fog tints, ambient color
- **Procedural ambient audio** — Web Audio API synthesized drones that shift with biome and time of day

### Creatures

- **HuskWalker** — shambling undead, common at night
- **MireBrute** — heavy swamp dweller
- **FrostStalker** — icy predator in tundra, hunts in packs
- **CrimsonHusk** — Blood Moon exclusive, aggressive and fast
- **Stag, Boar, Wolf, Bear** — wildlife for hunting and danger

### Progression & Achievements

- **XP and leveling** from gathering, crafting, combat, and exploration
- **Achievement system** with 15+ unlockable milestones
- **Cosmetic customization** — body colors, accessories, trails, death effects, titles
- **Tutorial system** guiding new players through survival basics
- **Leaderboard** tracking top players by level and achievements

### Seasons & Wipes

- **Weekly wipe cycle** — the world resets, blueprints carry forward
- **Season tracking** with wipe countdown warnings
- **Fresh starts** keep the playing field level

### Monetization (Cosmetic Only)

- **Battle Pass** — 20 tiers per season, free and premium tracks ($4.99)
- **Cosmetic Store** — skins, trails, death effects, accessories
- **No gameplay advantages** — every purchasable item is purely visual

### Multiplayer

- **Real-time WebSocket networking** with delta compression
- **Teams and clans** — share bases, coordinate raids
- **Proximity and global chat** channels
- **Server-authoritative** — anti-cheat by design

### Polish

- **Animated main menu** with parallax landscape and day/night cycle
- **Thematic death screen** — "YOUR LINE ENDS HERE"
- **Professional loading screen** with staged progress and gameplay tips
- **Unified notification system** — typed toasts for achievements, loot, warnings, and events

---

## Tech Stack

| Layer        | Technology                                                          |
| ------------ | ------------------------------------------------------------------- |
| **Client**   | TypeScript, React 18, Zustand, HTML5 Canvas, Web Audio API          |
| **Server**   | TypeScript, Node.js, Express, Socket.IO, Pino                       |
| **Database** | PostgreSQL 16, Drizzle ORM                                          |
| **Cache**    | Redis 7                                                             |
| **Build**    | Vite, npm workspaces                                                |
| **Deploy**   | Docker, Docker Compose, nginx                                       |
| **Shared**   | Monorepo with `shared/` package for types, constants, and utilities |

---

## Quick Start

### Prerequisites

- **Node.js 20+** and **npm 10+**
- **PostgreSQL 16** and **Redis 7** (or use Docker)

### Setup

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/lineremain.git
cd lineremain

# Start databases
docker compose up postgres redis -d

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Build shared library
npm run build -w shared

# Run migrations
npm run db:migrate -w server

# Start servers (two terminals)
npm run dev -w server    # Terminal 1
npm run dev -w client    # Terminal 2
```

Open `http://localhost:5173` in your browser.

---

## Production Deployment

```bash
docker compose up --build -d
```

See [deploy/DEPLOYMENT.md](deploy/DEPLOYMENT.md) for the full guide.

---

## Controls

| Key             | Action               |
| --------------- | -------------------- |
| `W` `A` `S` `D` | Move                 |
| `Mouse`         | Look around          |
| `Shift`         | Attack / Gather      |
| `F`             | Interact / Open      |
| `Right Click`   | Place building piece |
| `1` - `6`       | Select hotbar slot   |
| `Tab`           | Open inventory       |
| `C`             | Open crafting menu   |
| `B`             | Open building menu   |
| `M`             | Open map             |
| `T`             | Open team panel      |
| `Enter`         | Open chat            |
| `Escape`        | Close current panel  |

---

## Architecture

```
lineremain/
├── shared/          # Shared types, constants, utilities
│   └── src/
│       ├── types/       # Items, blocks, entities, network, monetization, seasons
│       ├── constants/   # Game balance, recipes, items, monetization, loading tips
│       └── utils/       # Chunk math, inventory helpers
├── server/          # Game server
│   └── src/
│       ├── api/         # REST API (Express routes, auth, validation)
│       ├── auth/        # JWT authentication, password hashing
│       ├── database/    # Drizzle schema, migrations, repositories
│       ├── game/        # ECS game loop + systems:
│       │   └── systems/     # Combat, Physics, AI, DayNight, Weather,
│       │                    # WorldEvent, Journal, Blueprint, Container,
│       │                    # Defense, Door, Raiding, Wipe
│       ├── network/     # Socket.IO server, handlers, state broadcasting
│       ├── world/       # Terrain generation, biomes, structures, monuments
│       └── utils/       # Logger, math, noise, graceful shutdown
├── client/          # Game client
│   └── src/
│       ├── engine/      # Camera, input, particles, audio, ambient synthesis
│       ├── entities/    # Player, NPC, building, item, supply drop renderers
│       ├── network/     # Socket.IO client, message handling, input sending
│       ├── stores/      # Zustand state (game, player, UI, settings, chat,
│       │                #   achievement, endgame)
│       ├── systems/     # Prediction, interpolation, animation, combat FX
│       ├── ui/
│       │   ├── hud/         # Health bars, hotbar, minimap, notifications,
│       │   │                #   raid alerts, wipe warnings, cinematic text
│       │   ├── panels/      # Inventory, crafting, building, map, team, chat,
│       │   │                #   settings, leaderboard, achievements, store,
│       │   │                #   code lock, research, journal
│       │   ├── screens/     # Main menu, loading, game canvas, death screen
│       │   └── common/      # Shared UI primitives
│       ├── world/       # Chunk meshing, lighting, sky, water, weather,
│       │                #   biome tracking, atmosphere, particles
│       └── utils/       # Item icons, helpers
├── deploy/          # Deployment scripts and documentation
├── Dockerfile.server
├── Dockerfile.client
└── docker-compose.yml
```

### Design Decisions

- **ECS Architecture** — Server logic uses Entity Component System for clean separation
- **Client Prediction** — Player movement is predicted locally and reconciled with server
- **Entity Interpolation** — Remote entities are smoothly interpolated between snapshots
- **Chunk Streaming** — Terrain is divided into chunks for efficient loading and persistence
- **Delta Compression** — Only changed entity components are sent each tick
- **Server-Authoritative** — All game state lives on the server; clients are rendering terminals
- **Cosmetic-Only Monetization** — No pay-to-win; all purchases are visual customization

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Build and test: `npm run build`
4. Commit with a descriptive message
5. Open a Pull Request

### Code Style

- TypeScript strict mode
- Prettier for formatting
- ESLint for linting
- Pino for server logging (no `console.log`)
- Import order: external, internal, relative

---

## License

MIT License — see [LICENSE](LICENSE).

---

## Credits

- **Procedural Generation** — Custom simplex noise implementation
- **Networking** — [Socket.IO](https://socket.io/)
- **Database** — [Drizzle ORM](https://orm.drizzle.team/) + PostgreSQL
- **UI** — [React](https://react.dev/) + [Zustand](https://zustand-demo.pmnd.rs/)
- **Build** — [Vite](https://vitejs.dev/)
- **Audio** — [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

---

_Every line you draw may be your last. Build wisely._
