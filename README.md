<div align="center">

# ⬡ XWAR

**A real-time geopolitical strategy MMO built with React, Express & PostgreSQL**

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express&logoColor=white)](https://expressjs.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)](https://neon.tech)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.7-010101?logo=socket.io&logoColor=white)](https://socket.io)
[![License](https://img.shields.io/badge/License-Private-red)]()

</div>

---

## 🎮 Overview

XWAR is a **multiplayer geopolitical war game** where players compete for global dominance. Command armies, manage economies, wage cyber warfare, trade on a global market, and build empires — all rendered on an interactive dark-themed world map with real-time updates via WebSocket.

---

## ✨ Core Systems

| System | Description |
|--------|-------------|
| **🗺️ World Map** | Full-screen MapLibre GL map with region markers, ley line overlays, and trade route visualization |
| **⚔️ Battle System** | Server-authoritative combat with rounds, divisions, adrenaline, battle orders, and equipment stats |
| **🌐 Region Ownership** | Server-persisted region state with infrastructure levels, revolt pressure, and government transfers |
| **📊 Market & Stocks** | Live resource market, country stock exchange, bonds, and trade routes with disruption mechanics |
| **🏭 Companies** | Player-owned production companies with jobs, maintenance, and oil upkeep |
| **🏛️ Government** | Elections (PP-weighted), congress, law proposals, tax rates, embargoes, alliances, nuclear authorization |
| **🎖️ Military Units** | Player-owned and state-owned MUs with vaults, upgrades, contracts, and weekly damage tracking |
| **🎰 Casino** | Slots, blackjack, and crash — all server-driven with atomic balance operations |
| **🕵️ Cyber Ops** | Espionage, sabotage, and propaganda missions with a breach minigame |
| **🚢 Naval & Trade Routes** | Naval operations, trade route disruption, and strategic objectives |
| **🔮 Ley Lines** | Continental power networks with region-based node control, bonuses, tradeoffs, and resonance |
| **🎯 Bounties & Raids** | Player bounties with hunter subscriptions; raid boss damage-race events |
| **💬 Chat** | Global, country, alliance, and whisper channels |

---

## 🛠️ Tech Stack

| Layer | Tool |
|---|---|
| **Frontend** | React 19 + TypeScript + Vite |
| **Map** | MapLibre GL JS |
| **State** | Zustand |
| **Animations** | Framer Motion |
| **Styling** | Vanilla CSS (dark military theme) |
| **Backend** | Express 4 + TypeScript (tsx) |
| **Database** | PostgreSQL (Neon) via Drizzle ORM |
| **Real-time** | Socket.IO |
| **Auth** | JWT + bcrypt |
| **Validation** | Zod |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- PostgreSQL database (or [Neon](https://neon.tech) serverless)

### Installation

```bash
# Clone the repository
git clone https://github.com/AminemlA/xwar.git
cd xwar

# Install client dependencies
npm install

# Install server dependencies
cd server && npm install
```

### Configuration

Create `server/.env`:

```env
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
JWT_SECRET=your_jwt_secret
```

### Database Setup

```bash
# Push schema to database
cd server && npm run db:push

# Seed initial data
npm run db:seed
```

### Running

```bash
# Terminal 1: Start the server (port 3001)
cd server && npm run dev

# Terminal 2: Start the client (port 5173)
npm run dev
```

---

## 📁 Project Structure

```
xwar/
├── src/                        # Frontend (React)
│   ├── api/
│   │   ├── client.ts           # Centralized API client (22+ endpoint wrappers)
│   │   ├── hydrate.ts          # Server → client state sync on login
│   │   └── socket.ts           # Socket.IO manager
│   ├── components/             # UI components (map, panels, HUD)
│   ├── stores/                 # Zustand stores
│   │   ├── playerStore.ts      # Player state, resources, skills
│   │   ├── regionStore.ts      # 293 regions with infrastructure & ownership
│   │   ├── battleStore.ts      # Battle state & combat log
│   │   ├── marketStore.ts      # Resource market & orders
│   │   └── ...                 # 15+ specialized stores
│   └── styles/                 # CSS design system
│
├── server/                     # Backend (Express)
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.ts       # Drizzle ORM schema (30+ tables)
│   │   │   ├── connection.ts   # PostgreSQL connection
│   │   │   └── seed.ts         # Initial data seeding
│   │   ├── routes/             # 27 route files
│   │   │   ├── auth.routes.ts
│   │   │   ├── battle.routes.ts
│   │   │   ├── region.routes.ts
│   │   │   ├── gov.routes.ts
│   │   │   └── ...
│   │   ├── services/           # Battle service, game logic
│   │   ├── pipelines/          # Ley line engine, cron jobs
│   │   └── middleware/         # Auth, rate limit, validation
│   ├── migrations/             # SQL migration files
│   └── scripts/                # Utility & seed scripts
│
└── package.json
```

---

## 🔌 API Endpoints (Highlights)

| Area | Endpoints |
|------|-----------|
| **Auth** | `POST /auth/register`, `POST /auth/login` |
| **Game** | `GET /game/state` (full hydration payload) |
| **Regions** | `GET /regions`, `POST /regions/:id/transfer`, `POST /regions/:id/infrastructure` |
| **Battle** | `GET /battle/active`, `POST /battle/attack`, `POST /battle/order` |
| **Market** | `GET /market/orders`, `POST /market/buy`, `POST /market/sell` |
| **Gov** | `POST /gov/set-tax`, `POST /gov/build-infra`, `POST /gov/propose-law`, `POST /gov/vote` |
| **Player** | `PATCH /player/country` (24h cooldown), `POST /player/consume-bar` |
| **Bounty** | `POST /bounty/place`, `POST /bounty/claim`, `GET /bounty/active` |
| **Raids** | `GET /raid/active`, `POST /raid/attack`, `POST /raid/fund` |
| **Trade Routes** | `GET /trade-routes`, `POST /trade-routes/disrupt` |
| **Ley Lines** | `GET /ley-lines`, `GET /ley-lines/defs` |

---

## 📄 License

This project is private and proprietary.

---

<div align="center">

Built with ⚡ by [AminemlA](https://github.com/AminemlA) & [BiOgCC](https://github.com/BiOgCC)

</div>
