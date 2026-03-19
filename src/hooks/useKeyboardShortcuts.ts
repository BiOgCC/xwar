import { useEffect } from 'react'
import { useUIStore } from '../stores/uiStore'

/** Keyboard shortcuts: ESC (close/exit fullscreen), Alt+Enter (open/fullscreen) */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if an input is focused
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const ui = useUIStore.getState()

      // ── ESC: close popup → exit fullscreen → close panel → reopen last panel ──
      if (e.key === 'Escape') {
        // 1. If any modal overlay is visible, close it via custom event
        const overlay = document.querySelector('.inv-modal-overlay')
        if (overlay) {
          window.dispatchEvent(new CustomEvent('xwar-close-modal'))
          return
        }

        // 2. Panel management
        if (ui.activePanel) {
          if (ui.panelFullscreen) {
            ui.setPanelFullscreen(false)
          } else {
            ui.togglePanel(ui.activePanel)
          }
        } else if (ui.lastClosedPanel) {
          ui.setActivePanel(ui.lastClosedPanel)
        }
        return
      }

      // ── Alt+Enter: open panel / toggle fullscreen ──
      if (e.key === 'Enter' && e.altKey) {
        e.preventDefault()
        if (!ui.activePanel) {
          // No panel open → open last closed panel (or default to profile)
          const panel = ui.lastClosedPanel || 'profile'
          ui.setActivePanel(panel)
        } else {
          // Panel open → toggle fullscreen
          ui.setPanelFullscreen(!ui.panelFullscreen)
        }
        return
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
