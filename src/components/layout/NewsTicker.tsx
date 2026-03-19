import { useNewsStore } from '../../stores/newsStore'

export default function NewsTicker() {
  const newsEvents = useNewsStore(s => s.events)

  if (newsEvents.length === 0) return null

  return (
    <div className="news-ticker">
      <div className="news-ticker__track" style={{ '--ticker-duration': `${Math.max(20, newsEvents.length * 5)}s` } as React.CSSProperties}>
        {newsEvents.map((ev, i) => (
          <span key={ev.id} className={`news-ticker__event ${Date.now() - ev.timestamp < 10000 ? 'news-ticker__event--fresh' : ''}`}>
            <span className="news-ticker__dot" style={{ background: ev.color }} />
            <span className="news-ticker__msg" style={{ color: ev.color }}>{ev.message}</span>
            {i < newsEvents.length - 1 && <span className="news-ticker__sep">◆</span>}
          </span>
        ))}
      </div>
    </div>
  )
}
