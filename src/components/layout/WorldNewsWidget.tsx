import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  useWorldNewsStore,
  NEWS_CATEGORIES,
  CATEGORY_ICONS,
  type NewsCategoryFilter,
} from '../../stores/worldNewsStore'
import '../../styles/world-news.css'

/* ══════════════════════════════════════════════
   XWAR — World Intel Feed Widget
   Real-time headlines from World Monitor
   ══════════════════════════════════════════════ */

const DEFAULT_POS = { x: 12, y: 12 }

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

export default function WorldNewsWidget() {
  const items = useWorldNewsStore((s) => s.items)
  const loading = useWorldNewsStore((s) => s.loading)
  const categoryFilter = useWorldNewsStore((s) => s.categoryFilter)
  const setCategoryFilter = useWorldNewsStore((s) => s.setCategoryFilter)
  const startAutoRefresh = useWorldNewsStore((s) => s.startAutoRefresh)

  const [minimized, setMinimized] = useState(true)
  const [closed, setClosed] = useState(false)
  const [pos, setPos] = useState(DEFAULT_POS)

  // Drag state
  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  // Start fetching on mount
  useEffect(() => {
    const stop = startAutoRefresh()
    return stop
  }, [startAutoRefresh])

  // Filter items by category
  const filtered = useMemo(() => {
    if (categoryFilter === 'all') return items
    return items.filter((it) => it.category === categoryFilter)
  }, [items, categoryFilter])

  /* ── Drag handlers ── */
  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('.wn__minimize')) return
      if ((e.target as HTMLElement).closest('.wn__close')) return
      if ((e.target as HTMLElement).closest('.wn__cat-pill')) return
      dragging.current = true
      dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
      document.body.style.cursor = 'grabbing'
      document.body.style.userSelect = 'none'

      const onMove = (ev: MouseEvent) => {
        if (!dragging.current) return
        const nx = Math.max(0, Math.min(window.innerWidth - 310, ev.clientX - dragOffset.current.x))
        const ny = Math.max(0, Math.min(window.innerHeight - 100, ev.clientY - dragOffset.current.y))
        setPos({ x: nx, y: ny })
      }

      const onUp = () => {
        dragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [pos.x, pos.y],
  )

  /* ── Closed state ── */
  if (closed) return null

  /* ── Minimized tab ── */
  if (minimized) {
    return (
      <button
        className="wn__tab"
        style={{ left: pos.x, top: pos.y }}
        onClick={() => setMinimized(false)}
        title="Open Intel Feed"
      >
        <span className="wn__tab-dot" />
        <span>INTEL</span>
      </button>
    )
  }

  return (
    <div className="wn" style={{ left: pos.x, top: pos.y }}>
      {/* ── Header ── */}
      <div className="wn__header" onMouseDown={onDragStart}>
        <div className="wn__live">
          <span className="wn__live-dot" />
          LIVE
        </div>
        <span className="wn__title">INTEL FEED</span>
        <div className="wn__actions">
          <button
            className="wn__minimize"
            onClick={() => setMinimized(true)}
            title="Minimize"
          >
            ▁
          </button>
          <button
            className="wn__close"
            onClick={() => setClosed(true)}
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Category pills ── */}
      <div className="wn__cats">
        {NEWS_CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`wn__cat-pill ${categoryFilter === cat ? 'wn__cat-pill--active' : ''}`}
            onClick={() => setCategoryFilter(cat as NewsCategoryFilter)}
            title={cat}
          >
            <span className="wn__cat-icon">{CATEGORY_ICONS[cat] || '📰'}</span>
            <span className="wn__cat-label">{cat.toUpperCase()}</span>
          </button>
        ))}
      </div>

      {/* ── News list ── */}
      <div className="wn__list">
        {loading && items.length === 0 && (
          <div className="wn__loading">
            <span className="wn__loading-dot" />
            FETCHING INTEL…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="wn__empty">No intel in this category</div>
        )}

        {filtered.map((item) => (
          <a
            key={item.id}
            className={`wn__item ${item.isAlert ? 'wn__item--alert' : ''}`}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            title={item.title}
          >
            <span
              className="wn__threat-dot"
              style={{ background: item.threatColor, boxShadow: `0 0 6px ${item.threatColor}66` }}
            />
            <div className="wn__item-body">
              <span className="wn__source">{item.source}</span>
              <span className="wn__headline">{item.title}</span>
            </div>
            <span className="wn__time">{relativeTime(item.publishedAt)}</span>
          </a>
        ))}
      </div>

      {/* ── Scanline overlay ── */}
      <div className="wn__scanlines" />

      {/* ── Footer ── */}
      <div className="wn__footer">
        <span>{filtered.length} items</span>
        <span className="wn__footer-src">via World Monitor</span>
      </div>
    </div>
  )
}
