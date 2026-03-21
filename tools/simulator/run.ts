// ══════════════════════════════════════════════════════════════
// SIMULATOR — Entry Point
// ══════════════════════════════════════════════════════════════

// MUST be first import — stubs Vite/browser APIs for Node.js
import './env-shim'

import { runSimulation } from './sim'
import { printReport } from './report'
import type { SimConfig } from './types'
import { DEFAULT_CONFIG } from './types'

// ── Parse CLI args ──
const args = process.argv.slice(2)
const config: SimConfig = { ...DEFAULT_CONFIG }

for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  const next = args[i + 1]
  if (arg === '--days' && next) { config.days = parseInt(next); i++ }
  else if (arg === '--agents' && next) { config.agentsPerCountry = parseInt(next); i++ }
  else if (arg === '--verbose' || arg === '-v') { config.verbose = true }
  else if (arg === '--help' || arg === '-h') {
    console.log(`
XWAR Balance Simulator
Usage: npx tsx tools/simulator/run.ts [options]

Options:
  --days <n>      Number of game-days to simulate (default: 100)
  --agents <n>    Agents per country (default: 3)
  --verbose, -v   Print per-week progress
  --help, -h      Show this help
    `)
    process.exit(0)
  }
}

console.log(`Configuration: ${config.days} days, ${config.agentsPerCountry} agents/country, ${config.countries.length} countries`)

const startTime = Date.now()
const report = runSimulation(config)
const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

console.log(`\nSimulation completed in ${elapsed}s`)
printReport(report)
