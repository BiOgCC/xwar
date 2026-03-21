/**
 * Breach Protocol — Deterministic grid-based hacking puzzle.
 *
 * Grid cells:
 *   E = empty         (safe to traverse)
 *   F = firewall       (blocks movement, can be bypassed with tool)
 *   D = data node      (collect 3 to win)
 *   T = trap           (–1 integrity)
 *   C = core           (instant win)
 *
 * Player tools (per attempt):
 *   scan    → reveal a 3×3 area around a cell
 *   bypass  → remove one firewall
 *   decrypt → auto-collect one data node anywhere on the grid
 *
 * Grid is deterministic from a seed string → same seed = same layout.
 */

// ═══════════════════════════════════════════════
//  SEEDED RNG (deterministic from string seed)
// ═══════════════════════════════════════════════

function hashSeed(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function createRng(seed: string) {
  let state = hashSeed(seed)
  return () => {
    state = (state * 1664525 + 1013904223) & 0x7fffffff
    return state / 0x7fffffff
  }
}

// ═══════════════════════════════════════════════
//  CELL TYPES
// ═══════════════════════════════════════════════

export type CellType = 'E' | 'F' | 'D' | 'T' | 'C'

export interface GridCell {
  type: CellType
  revealed: boolean
  collected: boolean  // for data nodes
}

export interface BreachGrid {
  size: number
  cells: GridCell[][]
  seed: string
}

// ═══════════════════════════════════════════════
//  DIFFICULTY PRESETS
// ═══════════════════════════════════════════════

export interface DifficultyPreset {
  gridSize: number
  dataNodes: number     // need to collect these to win (or find core)
  firewalls: number
  traps: number
  hasCore: boolean      // true = instant-win node exists
  startIntegrity: number
  tools: { scan: number; bypass: number; decrypt: number }
}

// Difficulty levels based on operation tier
const DIFFICULTY: Record<string, DifficultyPreset> = {
  // T1 Espionage — easy, solo
  solo_easy: {
    gridSize: 6, dataNodes: 3, firewalls: 4, traps: 3,
    hasCore: true, startIntegrity: 5,
    tools: { scan: 3, bypass: 2, decrypt: 1 },
  },
  // T2 Espionage — harder solo
  solo_hard: {
    gridSize: 8, dataNodes: 4, firewalls: 8, traps: 6,
    hasCore: true, startIntegrity: 5,
    tools: { scan: 2, bypass: 1, decrypt: 1 },
  },
  // T3/T4 — 5v5 race grids (medium difficulty, speed matters)
  race: {
    gridSize: 6, dataNodes: 3, firewalls: 5, traps: 4,
    hasCore: false, startIntegrity: 5,
    tools: { scan: 2, bypass: 1, decrypt: 1 },
  },
}

export function getDifficulty(operationId: string): DifficultyPreset {
  const t1t2 = ['resource_intel', 'military_intel', 'infrastructure_scan', 'blueprint_loot']
  const t2 = ['blueprint_loot']

  if (t2.includes(operationId)) return DIFFICULTY.solo_hard
  if (t1t2.includes(operationId)) return DIFFICULTY.solo_easy
  return DIFFICULTY.race // T3/T4 sabotage + propaganda
}

export function isRaceMode(operationId: string): boolean {
  const soloOps = ['resource_intel', 'military_intel', 'infrastructure_scan', 'blueprint_loot']
  return !soloOps.includes(operationId)
}

// ═══════════════════════════════════════════════
//  GRID GENERATOR  (deterministic from seed)
// ═══════════════════════════════════════════════

export function generateGrid(seed: string, preset: DifficultyPreset): BreachGrid {
  const rng = createRng(seed)
  const { gridSize, dataNodes, firewalls, traps, hasCore } = preset

  // Initialize empty grid
  const cells: GridCell[][] = Array.from({ length: gridSize }, () =>
    Array.from({ length: gridSize }, () => ({
      type: 'E' as CellType,
      revealed: false,
      collected: false,
    }))
  )

  // Place special cells using RNG
  const placed: Set<string> = new Set()

  // Reserve start position (top-left quadrant)
  const startX = Math.floor(rng() * 2)
  const startY = Math.floor(rng() * 2)
  placed.add(`${startX},${startY}`)
  cells[startY][startX].revealed = true // start cell is always revealed

  function placeRandom(type: CellType, count: number) {
    let attempts = 0
    let remaining = count
    while (remaining > 0 && attempts < 200) {
      const x = Math.floor(rng() * gridSize)
      const y = Math.floor(rng() * gridSize)
      const key = `${x},${y}`
      if (!placed.has(key)) {
        cells[y][x].type = type
        placed.add(key)
        remaining--
      }
      attempts++
    }
  }

  // Place core first (far from start if possible)
  if (hasCore) {
    const coreX = gridSize - 1 - Math.floor(rng() * 2)
    const coreY = gridSize - 1 - Math.floor(rng() * 2)
    const key = `${coreX},${coreY}`
    if (!placed.has(key)) {
      cells[coreY][coreX].type = 'C'
      placed.add(key)
    } else {
      placeRandom('C', 1)
    }
  }

  placeRandom('D', dataNodes)
  placeRandom('F', firewalls)
  placeRandom('T', traps)

  return { size: gridSize, cells, seed }
}

// ═══════════════════════════════════════════════
//  GAME STATE (server-side simulation)
// ═══════════════════════════════════════════════

export interface BreachState {
  grid: BreachGrid
  integrity: number
  nodesCollected: number
  nodesRequired: number
  tools: { scan: number; bypass: number; decrypt: number }
  won: boolean
  lost: boolean
  moves: { x: number; y: number; action: string; result: string }[]
}

export function createBreachState(seed: string, preset: DifficultyPreset): BreachState {
  return {
    grid: generateGrid(seed, preset),
    integrity: preset.startIntegrity,
    nodesCollected: 0,
    nodesRequired: preset.dataNodes,
    tools: { ...preset.tools },
    won: false,
    lost: false,
    moves: [],
  }
}

// ═══════════════════════════════════════════════
//  MOVE PROCESSING
// ═══════════════════════════════════════════════

export type MoveAction = 'click' | 'scan' | 'bypass' | 'decrypt'

export interface MoveInput {
  x: number
  y: number
  action: MoveAction
}

export interface MoveResult {
  valid: boolean
  result: string     // 'empty' | 'data_collected' | 'trap_hit' | 'firewall_blocked' | 'core_found' | 'scanned' | 'bypassed' | 'decrypted'
  integrity: number
  nodesCollected: number
  won: boolean
  lost: boolean
  revealed?: { x: number; y: number; type: CellType }[]  // cells revealed by this move
}

export function processMove(state: BreachState, move: MoveInput): MoveResult {
  const { grid, tools } = state
  const { x, y, action } = move

  // Bounds check
  if (x < 0 || x >= grid.size || y < 0 || y >= grid.size) {
    return { valid: false, result: 'out_of_bounds', integrity: state.integrity, nodesCollected: state.nodesCollected, won: false, lost: false }
  }

  // Game already over
  if (state.won || state.lost) {
    return { valid: false, result: 'game_over', integrity: state.integrity, nodesCollected: state.nodesCollected, won: state.won, lost: state.lost }
  }

  const cell = grid.cells[y][x]
  const revealed: { x: number; y: number; type: CellType }[] = []

  // ── TOOL: Scan (reveal 3×3 area) ──
  if (action === 'scan') {
    if (tools.scan <= 0) {
      return { valid: false, result: 'no_scans_left', integrity: state.integrity, nodesCollected: state.nodesCollected, won: false, lost: false }
    }
    tools.scan--
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy
        if (nx >= 0 && nx < grid.size && ny >= 0 && ny < grid.size) {
          if (!grid.cells[ny][nx].revealed) {
            grid.cells[ny][nx].revealed = true
            revealed.push({ x: nx, y: ny, type: grid.cells[ny][nx].type })
          }
        }
      }
    }
    state.moves.push({ x, y, action: 'scan', result: `revealed ${revealed.length} cells` })
    return { valid: true, result: 'scanned', integrity: state.integrity, nodesCollected: state.nodesCollected, won: false, lost: false, revealed }
  }

  // ── TOOL: Bypass (remove firewall) ──
  if (action === 'bypass') {
    if (tools.bypass <= 0) {
      return { valid: false, result: 'no_bypasses_left', integrity: state.integrity, nodesCollected: state.nodesCollected, won: false, lost: false }
    }
    if (cell.type !== 'F') {
      return { valid: false, result: 'not_a_firewall', integrity: state.integrity, nodesCollected: state.nodesCollected, won: false, lost: false }
    }
    tools.bypass--
    cell.type = 'E'
    cell.revealed = true
    revealed.push({ x, y, type: 'E' })
    state.moves.push({ x, y, action: 'bypass', result: 'firewall removed' })
    return { valid: true, result: 'bypassed', integrity: state.integrity, nodesCollected: state.nodesCollected, won: false, lost: false, revealed }
  }

  // ── TOOL: Decrypt (auto-collect any data node) ──
  if (action === 'decrypt') {
    if (tools.decrypt <= 0) {
      return { valid: false, result: 'no_decrypts_left', integrity: state.integrity, nodesCollected: state.nodesCollected, won: false, lost: false }
    }
    // Find first uncollected data node
    let found = false
    for (let gy = 0; gy < grid.size && !found; gy++) {
      for (let gx = 0; gx < grid.size && !found; gx++) {
        const c = grid.cells[gy][gx]
        if (c.type === 'D' && !c.collected) {
          tools.decrypt--
          c.collected = true
          c.revealed = true
          state.nodesCollected++
          revealed.push({ x: gx, y: gy, type: 'D' })
          found = true
        }
      }
    }
    if (!found) {
      return { valid: false, result: 'no_data_nodes_left', integrity: state.integrity, nodesCollected: state.nodesCollected, won: false, lost: false }
    }
    const won = state.nodesCollected >= state.nodesRequired
    if (won) state.won = true
    state.moves.push({ x, y, action: 'decrypt', result: 'data decrypted' })
    return { valid: true, result: 'decrypted', integrity: state.integrity, nodesCollected: state.nodesCollected, won, lost: false, revealed }
  }

  // ── Normal click ──
  cell.revealed = true
  revealed.push({ x, y, type: cell.type })

  switch (cell.type) {
    case 'E':
      state.moves.push({ x, y, action: 'click', result: 'empty' })
      return { valid: true, result: 'empty', integrity: state.integrity, nodesCollected: state.nodesCollected, won: false, lost: false, revealed }

    case 'D':
      if (!cell.collected) {
        cell.collected = true
        state.nodesCollected++
        const won = state.nodesCollected >= state.nodesRequired
        if (won) state.won = true
        state.moves.push({ x, y, action: 'click', result: 'data_collected' })
        return { valid: true, result: 'data_collected', integrity: state.integrity, nodesCollected: state.nodesCollected, won, lost: false, revealed }
      }
      state.moves.push({ x, y, action: 'click', result: 'already_collected' })
      return { valid: true, result: 'empty', integrity: state.integrity, nodesCollected: state.nodesCollected, won: false, lost: false, revealed }

    case 'T':
      state.integrity--
      cell.type = 'E' // trap consumed
      const lost = state.integrity <= 0
      if (lost) state.lost = true
      state.moves.push({ x, y, action: 'click', result: 'trap_hit' })
      return { valid: true, result: 'trap_hit', integrity: state.integrity, nodesCollected: state.nodesCollected, won: false, lost, revealed }

    case 'F':
      state.moves.push({ x, y, action: 'click', result: 'firewall_blocked' })
      return { valid: true, result: 'firewall_blocked', integrity: state.integrity, nodesCollected: state.nodesCollected, won: false, lost: false, revealed }

    case 'C':
      state.won = true
      state.moves.push({ x, y, action: 'click', result: 'core_found' })
      return { valid: true, result: 'core_found', integrity: state.integrity, nodesCollected: state.nodesCollected, won: true, lost: false, revealed }

    default:
      return { valid: false, result: 'unknown_cell', integrity: state.integrity, nodesCollected: state.nodesCollected, won: false, lost: false }
  }
}

// ═══════════════════════════════════════════════
//  SEED GENERATOR
// ═══════════════════════════════════════════════

export function generateSeed(opId: string, playerId: string): string {
  return `b_${opId.slice(0, 8)}_${playerId.slice(0, 8)}_${Date.now()}`
}

// ═══════════════════════════════════════════════
//  CLIENT-SAFE GRID (hidden cells are masked)
// ═══════════════════════════════════════════════

export function getClientGrid(state: BreachState) {
  return {
    size: state.grid.size,
    cells: state.grid.cells.map(row =>
      row.map(cell => ({
        revealed: cell.revealed,
        type: cell.revealed ? cell.type : '?',
        collected: cell.type === 'D' ? cell.collected : undefined,
      }))
    ),
    integrity: state.integrity,
    nodesCollected: state.nodesCollected,
    nodesRequired: state.nodesRequired,
    tools: { ...state.tools },
    won: state.won,
    lost: state.lost,
  }
}
