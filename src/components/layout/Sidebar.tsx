import { useState, useCallback } from 'react'
import { useUIStore } from '../../stores/uiStore'
import { useSidebarLayoutStore, type PanelId, type SidebarItem } from '../../stores/sidebarLayoutStore'

interface DragState {
  panel: PanelId
  index: number
}

interface DropTarget {
  panel: PanelId
  index: number
}

function SidebarPanel({
  panelId,
  items,
  borderColor,
  dragState,
  dropTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onDragLeave,
  renderItem,
}: {
  panelId: PanelId
  items: SidebarItem[]
  borderColor: string
  dragState: DragState | null
  dropTarget: DropTarget | null
  onDragStart: (panel: PanelId, index: number, e: React.DragEvent) => void
  onDragOver: (panel: PanelId, index: number, e: React.DragEvent) => void
  onDrop: (panel: PanelId, e: React.DragEvent) => void
  onDragEnd: () => void
  onDragLeave: (e: React.DragEvent) => void
  renderItem: (item: SidebarItem, index: number, panelId: PanelId) => React.ReactNode
}) {
  return (
    <div
      className="hud-sidebar__panel"
      style={{ borderColor }}
      onDragOver={(e) => {
        e.preventDefault()
        // If dragging over the empty area below all items, target the end
        if (items.length === 0) {
          onDragOver(panelId, 0, e)
        }
      }}
      onDrop={(e) => onDrop(panelId, e)}
      onDragLeave={onDragLeave}
    >
      {items.map((item, index) => {
        const isDragging = dragState?.panel === panelId && dragState.index === index
        const isDropBefore = dropTarget?.panel === panelId && dropTarget.index === index
        return (
          <div key={item.id} style={{ position: 'relative' }}>
            {isDropBefore && (
              <div className="hud-sidebar__drop-indicator" />
            )}
            <div
              className={`hud-sidebar__drag-wrapper ${isDragging ? 'hud-sidebar__drag-wrapper--dragging' : ''}`}
              draggable
              onDragStart={(e) => onDragStart(panelId, index, e)}
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const rect = e.currentTarget.getBoundingClientRect()
                const midY = rect.top + rect.height / 2
                const targetIndex = e.clientY < midY ? index : index + 1
                onDragOver(panelId, targetIndex, e)
              }}
              onDragEnd={onDragEnd}
            >
              {renderItem(item, index, panelId)}
            </div>
          </div>
        )
      })}
      {/* Drop indicator at the very end */}
      {dropTarget?.panel === panelId && dropTarget.index === items.length && (
        <div className="hud-sidebar__drop-indicator" />
      )}
      {/* Empty panel drop zone */}
      {items.length === 0 && (
        <div className="hud-sidebar__empty-drop">
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em', fontFamily: 'var(--font-display)' }}>
            DROP HERE
          </span>
        </div>
      )}
    </div>
  )
}

export default function Sidebar() {
  const { activePanel, togglePanel, cycleResourceView, resourceViewMode, setProfileDefaultTab, setActivePanel } = useUIStore()
  const { topItems, bottomItems, moveItem, resetLayout } = useSidebarLayoutStore()

  const [collapsed, setCollapsed] = useState(true)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)

  const handleDragStart = useCallback((panel: PanelId, index: number, e: React.DragEvent) => {
    setDragState({ panel, index })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', `${panel}:${index}`)
  }, [])

  const handleDragOver = useCallback((panel: PanelId, index: number, _e: React.DragEvent) => {
    setDropTarget({ panel, index })
  }, [])

  const handleDrop = useCallback((_panel: PanelId, _e: React.DragEvent) => {
    if (!dragState || !dropTarget) return
    if (dragState.panel !== dropTarget.panel || dragState.index !== dropTarget.index) {
      moveItem(dragState.panel, dropTarget.panel, dragState.index, dropTarget.index)
    }
    setDragState(null)
    setDropTarget(null)
  }, [dragState, dropTarget, moveItem])

  const handleDragEnd = useCallback(() => {
    setDragState(null)
    setDropTarget(null)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if actually leaving the panel
    const related = e.relatedTarget as HTMLElement | null
    if (!related || !e.currentTarget.contains(related)) {
      // Don't clear if moving to another panel
    }
  }, [])

  const handleItemClick = useCallback((item: SidebarItem) => {
    if (item.id === 'profile') {
      setProfileDefaultTab(null)
      setActivePanel('profile')
    } else if (item.id === 'inventory') {
      setProfileDefaultTab('inventory')
      setActivePanel('profile')
    } else if (item.id === 'companies') {
      setProfileDefaultTab('companies')
      setActivePanel('profile')
    } else if (item.id === 'resources') {
      if (activePanel === 'resources') {
        cycleResourceView()
      } else {
        togglePanel('resources')
      }
    } else {
      togglePanel(item.id as any)
    }
    // Auto-collapse after selecting a panel
    setCollapsed(true)
  }, [activePanel, togglePanel, cycleResourceView, setProfileDefaultTab, setActivePanel])

  const renderItem = useCallback((item: SidebarItem, _index: number, _panelId: PanelId) => {
    const isActive =
      (item.id === 'companies' || item.id === 'inventory')
        ? activePanel === 'profile'
        : activePanel === item.id

    return (
      <button
        className={`hud-sidebar__item ${isActive ? 'hud-sidebar__item--active' : ''}`}
        onClick={() => handleItemClick(item)}
        onMouseDown={(e) => {
          // Don't trigger click when starting a drag
          // Clicks are on mouseup, so this is fine
        }}
      >
        <span className="hud-sidebar__icon">{item.icon}</span>
        <span className="hud-sidebar__label">
          {item.id === 'resources' && activePanel === 'resources'
            ? resourceViewMode === 'deposits' ? 'DEPOSITS'
            : resourceViewMode === 'strategic' ? 'STRATEGIC'
            : 'POLITICAL'
          : item.label}
        </span>
        {item.id === 'combat' && <span className="hud-sidebar__dot" />}
      </button>
    )
  }, [activePanel, resourceViewMode, handleItemClick])

  return (
    <div className={`hud-sidebar-wrap ${collapsed ? 'hud-sidebar-wrap--collapsed' : ''}`}>
      {/* Toggle tab — always visible, outside the sliding panel */}
      <button
        className="hud-sidebar__toggle"
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? 'Open menu' : 'Close menu'}
      >
        <span className="hud-sidebar__toggle-icon">{collapsed ? '◀' : '▶'}</span>
        <span className="hud-sidebar__toggle-label">MENU</span>
      </button>

      <nav className={`hud-sidebar ${dragState ? 'hud-sidebar--dragging' : ''} ${collapsed ? 'hud-sidebar--collapsed' : ''}`}>
        <div className="hud-sidebar__content">
          <SidebarPanel
            panelId="top"
            items={topItems}
            borderColor="rgba(59,130,246,0.35)"
            dragState={dragState}
            dropTarget={dropTarget}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            onDragLeave={handleDragLeave}
            renderItem={renderItem}
          />
          <SidebarPanel
            panelId="bottom"
            items={bottomItems}
            borderColor="rgba(239,68,68,0.35)"
            dragState={dragState}
            dropTarget={dropTarget}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            onDragLeave={handleDragLeave}
            renderItem={renderItem}
          />

          {/* Reset button */}
          <button
            className="hud-sidebar__reset"
            onClick={resetLayout}
            title="Reset sidebar layout"
          >
            ↺
          </button>
        </div>
      </nav>
    </div>
  )
}
