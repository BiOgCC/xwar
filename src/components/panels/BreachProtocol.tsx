/**
 * BreachProtocol — Hacking puzzle minigame component.
 *
 * Renders a grid of hidden cells that the player clicks to reveal.
 * Supports 3 tools: Scan (reveal 3×3), Bypass (remove firewall), Decrypt (auto-collect data node).
 * Win by collecting all data nodes or finding the core. Lose if integrity hits 0.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react'
import { api } from '../../api/client'
import './BreachProtocol.css'

// ═══════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════

interface GridCell {
  type: string   // '?' | 'E' | 'F' | 'D' | 'T' | 'C'
  revealed: boolean
  collected?: boolean
}

interface GridState {
  size: number
  cells: GridCell[][]
  integrity: number
  nodesCollected: number
  nodesRequired: number
  tools: { scan: number; bypass: number; decrypt: number }
  won: boolean
  lost: boolean
}

interface RevealedCell {
  x: number
  y: number
  type: string
}

interface BreachProtocolProps {
  attemptId: string
  initialGrid: GridState
  side: 'attacker' | 'defender'
  raceMode: boolean
  timeRemaining: number
  onComplete: (won: boolean) => void
}

// ═══════════════════════════════════════════════
//  API HELPERS
// ═══════════════════════════════════════════════

async function sendMove(attemptId: string, x: number, y: number, action: string) {
  try {
    return await api.post<any>('/cyber/puzzle/move', { attemptId, x, y, action })
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error' }
  }
}

// ═══════════════════════════════════════════════
//  CELL ICONS
// ═══════════════════════════════════════════════

const CELL_ICONS: Record<string, { icon: string; label: string; color: string }> = {
  '?': { icon: '▪', label: 'Unknown', color: '#2a3a4a' },
  'E': { icon: '·', label: 'Empty', color: '#1a2a3a' },
  'F': { icon: '🔒', label: 'Firewall', color: '#ff4444' },
  'D': { icon: '💾', label: 'Data Node', color: '#00cc88' },
  'T': { icon: '⚡', label: 'Trap', color: '#ffaa00' },
  'C': { icon: '🔑', label: 'Core', color: '#00aaff' },
}

// ═══════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════

export const BreachProtocol: React.FC<BreachProtocolProps> = ({
  attemptId,
  initialGrid,
  side,
  raceMode,
  timeRemaining: initialTime,
  onComplete,
}) => {
  const [grid, setGrid] = useState<GridState>(initialGrid)
  const [selectedTool, setSelectedTool] = useState<'click' | 'scan' | 'bypass' | 'decrypt'>('click')
  const [processing, setProcessing] = useState(false)
  const [flashCells, setFlashCells] = useState<Set<string>>(new Set())
  const [log, setLog] = useState<string[]>([])
  const [timeLeft, setTimeLeft] = useState(initialTime)
  const logRef = useRef<HTMLDivElement>(null)

  // Timer
  useEffect(() => {
    if (!raceMode || timeLeft <= 0) return
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1000) {
          clearInterval(interval)
          return 0
        }
        return prev - 1000
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [raceMode, timeLeft])

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [log])

  const addLog = useCallback((msg: string) => {
    setLog(prev => [...prev.slice(-20), msg])
  }, [])

  const handleCellClick = useCallback(async (x: number, y: number) => {
    if (processing || grid.won || grid.lost) return

    setProcessing(true)
    try {
      const result = await sendMove(attemptId, x, y, selectedTool)
      if (!result.success) {
        addLog(`❌ ${result.error || 'Invalid move'}`)
        setProcessing(false)
        return
      }

      // Flash revealed cells
      if (result.revealed) {
        const flashSet = new Set<string>(result.revealed.map((c: RevealedCell) => `${c.x},${c.y}`))
        setFlashCells(flashSet)
        setTimeout(() => setFlashCells(new Set()), 600)
      }

      // Update grid state
      setGrid(result.grid)

      // Log entry
      const resultMsgs: Record<string, string> = {
        empty: '· Empty cell',
        data_collected: '💾 Data node collected!',
        trap_hit: '⚡ Trap! -1 integrity',
        firewall_blocked: '🔒 Firewall! Use Bypass tool',
        core_found: '🔑 CORE FOUND! Access granted!',
        scanned: '📡 Area scanned',
        bypassed: '🔓 Firewall bypassed',
        decrypted: '💾 Data decrypted remotely',
      }
      addLog(resultMsgs[result.result] || result.result)

      // Game over
      if (result.gameOver) {
        if (result.won) {
          addLog('✅ BREACH SUCCESSFUL!')
        } else {
          addLog('❌ INTEGRITY ZERO — Breach failed!')
        }
        setTimeout(() => onComplete(result.won), 1500)
      }
    } catch (err) {
      addLog('❌ Network error')
    }
    setProcessing(false)
  }, [attemptId, grid, selectedTool, processing, addLog, onComplete])

  const gameOver = grid.won || grid.lost

  return (
    <div className="breach-protocol">
      {/* Header */}
      <div className="breach-header">
        <div className="breach-title">
          <span className="breach-icon">🖥️</span>
          <span>BREACH PROTOCOL</span>
          <span className={`breach-side ${side}`}>{side.toUpperCase()}</span>
        </div>
        {raceMode && (
          <div className="breach-timer">
            ⏱️ {Math.floor(timeLeft / 60000)}:{String(Math.floor((timeLeft % 60000) / 1000)).padStart(2, '0')}
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="breach-status">
        <div className="status-item integrity">
          {'❤️'.repeat(Math.max(0, grid.integrity))}
          {'🖤'.repeat(Math.max(0, 5 - grid.integrity))}
        </div>
        <div className="status-item nodes">
          💾 {grid.nodesCollected}/{grid.nodesRequired}
        </div>
      </div>

      {/* Tool Bar */}
      <div className="breach-tools">
        <button
          className={`tool-btn ${selectedTool === 'click' ? 'active' : ''}`}
          onClick={() => setSelectedTool('click')}
          disabled={gameOver}
        >
          👆 Click
        </button>
        <button
          className={`tool-btn ${selectedTool === 'scan' ? 'active' : ''} ${grid.tools.scan === 0 ? 'depleted' : ''}`}
          onClick={() => setSelectedTool('scan')}
          disabled={gameOver || grid.tools.scan === 0}
        >
          📡 Scan ({grid.tools.scan})
        </button>
        <button
          className={`tool-btn ${selectedTool === 'bypass' ? 'active' : ''} ${grid.tools.bypass === 0 ? 'depleted' : ''}`}
          onClick={() => setSelectedTool('bypass')}
          disabled={gameOver || grid.tools.bypass === 0}
        >
          🔓 Bypass ({grid.tools.bypass})
        </button>
        <button
          className={`tool-btn ${selectedTool === 'decrypt' ? 'active' : ''} ${grid.tools.decrypt === 0 ? 'depleted' : ''}`}
          onClick={() => setSelectedTool('decrypt')}
          disabled={gameOver || grid.tools.decrypt === 0}
        >
          💻 Decrypt ({grid.tools.decrypt})
        </button>
      </div>

      {/* Grid */}
      <div
        className="breach-grid"
        style={{ gridTemplateColumns: `repeat(${grid.size}, 1fr)` }}
      >
        {grid.cells.flatMap((row, y) =>
          row.map((cell, x) => {
            const key = `${x},${y}`
            const info = CELL_ICONS[cell.type] || CELL_ICONS['?']
            const isFlashing = flashCells.has(key)
            const isCollected = cell.type === 'D' && cell.collected

            return (
              <button
                key={key}
                className={`grid-cell ${cell.revealed ? 'revealed' : 'hidden'} ${isFlashing ? 'flash' : ''} ${isCollected ? 'collected' : ''} ${gameOver ? 'disabled' : ''}`}
                style={{
                  backgroundColor: cell.revealed ? info.color : undefined,
                }}
                onClick={() => handleCellClick(x, y)}
                disabled={gameOver || processing}
                title={cell.revealed ? info.label : 'Unknown'}
              >
                {cell.revealed ? (
                  <span className="cell-icon">{isCollected ? '✓' : info.icon}</span>
                ) : (
                  <span className="cell-icon hidden-icon">▪</span>
                )}
              </button>
            )
          })
        )}
      </div>

      {/* Game Over Overlay */}
      {gameOver && (
        <div className={`breach-result ${grid.won ? 'won' : 'lost'}`}>
          <div className="result-icon">{grid.won ? '✅' : '❌'}</div>
          <div className="result-text">
            {grid.won ? 'BREACH SUCCESSFUL' : 'BREACH FAILED'}
          </div>
        </div>
      )}

      {/* Log */}
      <div className="breach-log" ref={logRef}>
        {log.map((entry, i) => (
          <div key={i} className="log-entry">{entry}</div>
        ))}
      </div>
    </div>
  )
}

export default BreachProtocol
