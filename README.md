<div align="center">

# ⬡ XWAR

**A geopolitical strategy game built with React & MapLibre**

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![License](https://img.shields.io/badge/License-Private-red)]()

</div>

---

## 🎮 Overview

XWAR is a **real-time geopolitical war game** where players compete for global dominance. Command armies, manage economies, trade resources on a global market, and form empires — all rendered on an interactive dark-themed world map.

This is a **client-side MVP** with mock data — no backend server required. The goal is a stunning, functional UI that demonstrates the full game loop.

---

## ✨ Features

- **🗺️ Interactive World Map** — Full-screen MapLibre GL map with a dark military theme, country markers, and region popups on click
- **⚔️ Combat System** — Launch attacks against other countries, track battle history, and climb the ranks
- **📊 Resource Market** — Live market prices for Food, Oil, Material X, and Equipment with price trend indicators
- **🏭 Companies** — Own and manage companies that produce resources each turn
- **🏛️ Government** — View active wars, government structure, and political information
- **💬 AI Advisor** — In-game chat with an AI strategic advisor
- **🎨 Military HUD** — Dark theme UI with glassmorphism, glow effects, and scanline overlays

---

## 🛠️ Tech Stack

| Layer | Tool |
|---|---|
| **Framework** | React 19 + TypeScript |
| **Bundler** | Vite 8 |
| **Map** | MapLibre GL JS |
| **State** | Zustand |
| **Animations** | Framer Motion |
| **Styling** | Vanilla CSS (dark military theme) |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/AminemlA/xwar.git
cd xwar

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Build for Production

```bash
npm run build
npm run preview
```

---

## 📁 Project Structure

```
xwar/
├── public/              # Static assets (favicon, icons)
├── src/
│   ├── components/
│   │   └── map/         # GameMap, RegionPopup
│   ├── stores/          # Zustand state management
│   │   ├── playerStore  # Player resources, rank, actions
│   │   ├── worldStore   # Countries, wars, empires
│   │   ├── marketStore  # Resource prices, order book
│   │   └── uiStore      # Active panels, modals, notifications
│   ├── styles/          # CSS design system
│   │   ├── variables    # Color palette, typography, spacing tokens
│   │   ├── layout       # Main layout and grid styles
│   │   ├── components   # Reusable component classes
│   │   └── map          # Map-specific styles
│   ├── App.tsx          # Main app shell with HUD layout
│   └── main.tsx         # Entry point
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 🎯 Roadmap

- [x] Project scaffold (React + Vite + TypeScript)
- [x] Dark military design system
- [x] Interactive world map with region markers
- [x] Core game layout (sidebar, map area, panels)
- [x] Zustand state management (player, world, market, UI)
- [x] Combat panel with attack flow
- [x] Market panel with resource prices
- [ ] Full panel implementations (Companies, Government, Chat)
- [ ] Attack arc animations on map
- [ ] Live event feed (ticker / WebSocket)
- [ ] Backend API integration
- [ ] Multiplayer support

---

## 📄 License

This project is private and proprietary.

---

<div align="center">

Built with ⚡ by [AminemlA](https://github.com/AminemlA)

</div>
