import { useEffect } from 'react'
import { useUIStore } from '../stores/uiStore'

/** Keyboard shortcuts: ESC, Alt+Enter, number keys 1-8 */
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
          const panel = ui.lastClosedPanel || 'profile'
          ui.setActivePanel(panel)
        } else {
          ui.setPanelFullscreen(!ui.panelFullscreen)
        }
        return
      }

      // ── Number keys 1-8: Action Bar shortcuts ──
      // Keys 1-4 toggle ActionBar flyout menus via custom event
      // Keys 5-8 directly open panels
      if (!e.altKey && !e.ctrlKey && !e.metaKey) {
        switch (e.key) {
          case '1': window.dispatchEvent(new CustomEvent('xwar-actionbar-toggle', { detail: 'work' })); return
          case '2': window.dispatchEvent(new CustomEvent('xwar-actionbar-toggle', { detail: 'hustle' })); return
          case '3': window.dispatchEvent(new CustomEvent('xwar-actionbar-toggle', { detail: 'produce' })); return
          case '4': window.dispatchEvent(new CustomEvent('xwar-actionbar-toggle', { detail: 'eat' })); return
          case '5': ui.setWarDefaultTab('battles'); ui.togglePanel('combat'); return
          case '6': ui.togglePanel('cyberwarfare'); return
          case '7': ui.togglePanel('military'); return
          case '8': ui.togglePanel('market'); return
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
