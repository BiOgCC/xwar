import { useState, useEffect, useCallback, useRef } from 'react'
import '../../styles/news-slideshow.css'

/*
 * ══════════════════════════════════════════════
 *  WAR NEWS SLIDES
 *  To add your own GIFs, just add an entry:
 *    { gif: 'https://your-url.gif', tag: 'LABEL', headline: 'Your caption' }
 * ══════════════════════════════════════════════
 */
const SLIDES = [
  // ── Giphy: War & Military ──
  { gif: 'https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif',       tag: 'BREAKING',       headline: 'Allied forces advance through Western front' },
  { gif: 'https://media.giphy.com/media/3o7btQ8jDTPGDpgc6I/giphy.gif',       tag: 'WAR REPORT',     headline: 'Naval fleet spotted near coastal territories' },
  { gif: 'https://media.giphy.com/media/l3q2XhfQ8oCkm1Ts4/giphy.gif',       tag: 'INTELLIGENCE',   headline: 'Encrypted transmissions intercepted by HQ' },
  { gif: 'https://media.giphy.com/media/26BRuo6sLetdllPAQ/giphy.gif',       tag: 'MARKET ALERT',   headline: 'Supply lines disrupted — prices surging' },
  { gif: 'https://media.giphy.com/media/xT9IgzoKnwFNmISR8I/giphy.gif',      tag: 'URGENT',         headline: 'Enemy reinforcements mobilizing at the border' },
  { gif: 'https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif',      tag: 'LIVE FEED',      headline: 'Air support conducting recon missions' },
  { gif: 'https://media.giphy.com/media/l0MYGb1LuZ3n7dRnO/giphy.gif',       tag: 'FLASH',          headline: 'Resistance fighters rally behind new leader' },
  { gif: 'https://media.giphy.com/media/3o6Zt481isNVuQI1l6/giphy.gif',      tag: 'SPECIAL OPS',    headline: 'Covert operation launched behind enemy lines' },
  // ── Giphy: Explosions & Combat ──
  { gif: 'https://media.giphy.com/media/l0HlEXqS1wD33kXO8/giphy.gif',       tag: 'EXPLOSION',      headline: 'Massive detonation rocks enemy stronghold' },
  { gif: 'https://media.giphy.com/media/YqQk7X00q9Rzk0G9y4/giphy.gif',      tag: 'ARMY OPS',       headline: 'Artillery barrage commences at dawn' },
  { gif: 'https://media.giphy.com/media/oe33xf3B50fsc/giphy.gif',           tag: 'AIR STRIKE',     headline: 'Bombers deployed over strategic targets' },
  { gif: 'https://media.giphy.com/media/LpkBAUDg53FI8xLmg1/giphy.gif',      tag: 'COMBAT',         headline: 'Ground forces engage in fierce firefight' },
  { gif: 'https://media.giphy.com/media/Year2mBh3hVlu/giphy.gif',           tag: 'NAVY',           headline: 'Battleship fleet conducting naval exercises' },
  { gif: 'https://media.giphy.com/media/cKJjGbOMPmKRO/giphy.gif',           tag: 'TACTICAL',       headline: 'Armored division advances through valley' },
  { gif: 'https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.gif',          tag: 'RECON',          headline: 'Surveillance drone captures enemy movement' },
  // ── Giphy: Strategy & Propaganda ──
  { gif: 'https://media.giphy.com/media/l46Cy1rHbQ92uuLXa/giphy.gif',       tag: 'PROPAGANDA',     headline: 'New recruitment campaign launched nationwide' },
  { gif: 'https://media.giphy.com/media/3og0IFrHkIglEOg8Ba/giphy.gif',      tag: 'DEFCON 2',       headline: 'Defense readiness elevated across all sectors' },
  { gif: 'https://media.giphy.com/media/xUPGGDNsLvqsBOhuU0/giphy.gif',      tag: 'CLASSIFIED',     headline: 'Top-secret documents recovered from bunker' },
  { gif: 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif',      tag: 'DISPATCH',       headline: 'Military movements detected near DMZ' },
  { gif: 'https://media.giphy.com/media/l0HlvtIPdijJCx2qQ/giphy.gif',       tag: 'FRONTLINE',      headline: 'Medics rush to aid wounded at the front' },

  // ═══ ADD YOUR OWN GIFS BELOW THIS LINE ═══
  // { gif: 'https://your-gif-url.gif', tag: 'YOUR TAG', headline: 'Your headline text' },
]

/* Shuffle slides on page load so it feels fresh each session */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const SHUFFLED = shuffle(SLIDES)

const CYCLE_MS = 6000
const DEFAULT_POS = { x: 12, y: 56 }

export default function NewsSlideshow() {
  const [index, setIndex] = useState(0)
  const [minimized, setMinimized] = useState(true)
  const [closed, setClosed] = useState(false)
  const [fading, setFading] = useState(false)
  const [pos, setPos] = useState(DEFAULT_POS)

  /* ── Drag state (refs to avoid re-renders during drag) ── */
  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  const advance = useCallback(() => {
    setFading(true)
    setTimeout(() => {
      setIndex((prev) => (prev + 1) % SHUFFLED.length)
      setFading(false)
    }, 400)
  }, [])

  useEffect(() => {
    if (minimized || closed) return
    const id = setInterval(advance, CYCLE_MS)
    return () => clearInterval(id)
  }, [minimized, closed, advance])

  /* ── Drag handlers ── */
  const onDragStart = useCallback((e: React.MouseEvent) => {
    // Don't drag if clicking action buttons
    if ((e.target as HTMLElement).closest('.news-pip__minimize')) return
    if ((e.target as HTMLElement).closest('.news-pip__close')) return
    dragging.current = true
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const nx = Math.max(0, Math.min(window.innerWidth - 260, ev.clientX - dragOffset.current.x))
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
  }, [pos.x, pos.y])

  const slide = SHUFFLED[index]

  /* ── Closed state ── */
  if (closed) return null

  /* ── Minimized state: tiny tab ── */
  if (minimized) {
    return (
      <button
        className="news-pip__tab"
        style={{ left: pos.x, top: pos.y }}
        onClick={() => setMinimized(false)}
        title="Open News Feed"
      >
        <span className="news-pip__tab-dot" />
        <span>NEWS</span>
      </button>
    )
  }

  return (
    <div className="news-pip" style={{ left: pos.x, top: pos.y }}>
      {/* Header bar — drag handle */}
      <div
        className="news-pip__header news-pip__header--draggable"
        onMouseDown={onDragStart}
      >
        <div className="news-pip__live">
          <span className="news-pip__live-dot" />
          LIVE
        </div>
        <span className="news-pip__title">XWAR NEWS</span>
        <div className="news-pip__actions">
          <button
            className="news-pip__minimize"
            onClick={() => setMinimized(true)}
            title="Minimize"
          >
            ▁
          </button>
          <button
            className="news-pip__close"
            onClick={() => setClosed(true)}
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* GIF viewport */}
      <div className="news-pip__viewport">
        <img
          className={`news-pip__gif ${fading ? 'news-pip__gif--fade' : ''}`}
          src={slide.gif}
          alt={slide.headline}
          draggable={false}
        />

        {/* Scanline overlay on the GIF */}
        <div className="news-pip__scanlines" />

        {/* Vignette */}
        <div className="news-pip__vignette" />
      </div>

      {/* Caption chyron */}
      <div className="news-pip__chyron">
        <span className="news-pip__tag">{slide.tag}</span>
        <span className="news-pip__headline">{slide.headline}</span>
      </div>

      {/* Progress pips */}
      <div className="news-pip__pips">
        {SHUFFLED.map((_, i) => (
          <span
            key={i}
            className={`news-pip__pip ${i === index ? 'news-pip__pip--active' : ''}`}
          />
        ))}
      </div>
    </div>
  )
}
