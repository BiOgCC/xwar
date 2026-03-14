# XWAR Game — MVP Implementation Plan

Build a playable front-end prototype of XWAR at `c:\Users\PC\Desktop\firm\xwar`. This is a **client-side MVP** with mock data — no backend server. The goal is a stunning, functional UI that demonstrates the full game loop.

## Tech Stack

| Layer | Tool |
|-------|------|
| Framework | React 18 + TypeScript |
| Bundler | Vite |
| Map | Mapbox GL JS + GeoJSON |
| State | Zustand |
| Animations | Framer Motion |
| Styling | Vanilla CSS (dark military theme) |

---

## Proposed Changes

### Project Scaffold

#### [NEW] Project root (`xwar/`)

Initialize with `npx -y create-vite@latest ./ -- --template react-ts`. Install deps: `mapbox-gl`, `zustand`, `framer-motion`.

**Directory structure:**
```
src/
  components/
    layout/        → Sidebar, TopBar, RightPanel
    map/           → GameMap, RegionPopup
    panels/        → Combat, Market, Companies, Government, Chat
    ui/            → ResourceBar, Button, Card, Modal, Badge
  stores/          → playerStore, marketStore, worldStore
  data/            → mockPlayers, mockCountries, mockMarket, geojson
  styles/          → index.css, variables.css, components.css
  App.tsx
  main.tsx
```

---

### Design System

#### [NEW] `src/styles/variables.css`
CSS custom properties: dark-theme color palette (deep navy/charcoal background, neon green/cyan/amber accents), typography scale using Inter font, spacing tokens, glassmorphism utilities, glow effects.

#### [NEW] `src/styles/index.css`
Global resets, body styles, scrollbar styling, dark theme base.

#### [NEW] `src/styles/components.css`
Reusable component classes: `.card`, `.btn`, `.badge`, `.resource-bar`, `.panel`, `.glow`, `.glass`.

---

### Layout Shell

#### [NEW] `src/components/layout/Sidebar.tsx`
Left sidebar with nav icons: Map, Combat, Market, Companies, Government, Chat. Highlights active panel. Bottom section shows player rank badge.

#### [NEW] `src/components/layout/TopBar.tsx`
Top bar with resource counters (Money, Food, Oil, Material X), player name, country flag, and turn indicator.

#### [NEW] `src/components/layout/RightPanel.tsx`
Slide-in right panel that renders whichever game panel is currently selected.

#### [NEW] `src/App.tsx`
Main layout composition: Sidebar + Map + RightPanel. Routes panel state through Zustand.

---

### World Map

#### [NEW] `src/components/map/GameMap.tsx`
Full-screen Mapbox GL JS map with:
- Dark military style (custom Mapbox style or `dark-v11`)
- GeoJSON layer coloring countries by controller
- Click handler → shows region info popup
- Animated pulse on contested regions
- Coordinate display in bottom-right corner

#### [NEW] `src/data/countries.geojson`
Simplified world country boundaries (Natural Earth low-res). Each feature has properties: `name`, `controller`, `resources`, `population`.

#### [NEW] `src/components/map/RegionPopup.tsx`
Popup card on region click showing: country name, controlling player/empire, resource bonuses, garrison strength.

---

### Game State (Zustand)

#### [NEW] `src/stores/playerStore.ts`
Player state: name, role, rank, country, resources (money, food, oil, materialX), companies owned.

#### [NEW] `src/stores/worldStore.ts`
World state: countries array, regions, current wars, empires.

#### [NEW] `src/stores/marketStore.ts`
Market state: resource prices, order book (mock), price history for mini-charts.

#### [NEW] `src/stores/uiStore.ts`
UI state: active panel, modals, notifications, chat messages.

---

### Core Game Panels

#### [NEW] `src/components/panels/CombatPanel.tsx`
- Target country selector
- Attack button (costs Food + Oil)
- Rank progress bar
- Recent battles feed
- Animate resource deduction on attack

#### [NEW] `src/components/panels/MarketPanel.tsx`
- Resource cards with current prices + sparkline charts
- Buy/Sell forms with quantity slider
- Order history list
- Price trend indicators (up/down arrows)

#### [NEW] `src/components/panels/CompaniesPanel.tsx`
- Grid of owned companies (Farm, Oil, Factory, Casino)
- "Build New" button with company type picker
- Production stats per company
- Upgrade buttons

#### [NEW] `src/components/panels/GovernmentPanel.tsx`
- President info card
- Congress seats display
- Active legislation / votes
- "Run for Office" button
- War declaration panel
- National treasury balance

#### [NEW] `src/components/panels/ChatPanel.tsx`
- AI advisor chat interface
- Message bubbles (user + AI)
- Mock streaming response effect
- Quick action suggestions at bottom

---

### UI Components

#### [NEW] `src/components/ui/ResourceBar.tsx`
Horizontal bar with icon, label, amount, and animated fill. Color-coded per resource.

#### [NEW] `src/components/ui/Button.tsx`
Styled button with variants: primary (green glow), danger (red), secondary (outline), disabled state.

#### [NEW] `src/components/ui/Card.tsx`
Glass-morphism card wrapper with optional glow border, title, and content slots.

#### [NEW] `src/components/ui/Modal.tsx`
Centered overlay modal with backdrop blur, close button, and Framer Motion enter/exit.

#### [NEW] `src/components/ui/Badge.tsx`
Small colored badge for rank, role, or status indicators.

---

### Mock Data

#### [NEW] `src/data/mockData.ts`
Mock datasets: player profile, 10+ countries with resources, market prices with history, sample battles, company templates.

---

### Animations & Polish

- Framer Motion `AnimatePresence` on panel transitions
- Hover glow effects on cards and buttons
- Resource counter animate on change (count-up effect)
- Map region pulse animation for war zones
- Subtle ambient particle or scanline overlay for military feel

---

## Verification Plan

### Automated
1. **Build check**: `npm run build` must succeed with zero errors
2. **TypeScript**: `npx tsc --noEmit` must pass with no type errors

### Browser Verification
1. Open `http://localhost:5173` and verify:
   - Dark theme renders correctly with no unstyled content
   - World map loads with colored regions
   - Clicking a region shows info popup
   - All sidebar nav items open the correct right panel
   - Resource bars display in the top bar
   - Combat panel allows mock attack (resources decrease)
   - Market panel shows prices and buy/sell works
   - Companies panel displays grid and build flow
   - Government panel shows structure
   - Chat panel shows messages
   - Animations are smooth (panel slide, resource counter)

### Manual (User)
- Visual review of overall aesthetic — does it feel premium and military-themed?
- Check that the map is interactive and responsive
