import { useState } from 'react'
import { useGovernmentStore } from '../../../stores/governmentStore'
import { usePlayerStore } from '../../../stores/playerStore'
import { Crown, UserPlus, ShieldCheck, TrendingUp, Users, ChevronDown, X, Plus, Check } from 'lucide-react'

type AppointablePosition = 'vicePresident' | 'defenseMinister' | 'ecoMinister'

interface PositionCardProps {
  icon: React.ReactNode
  iconColor: string
  title: string
  holder: string | null | undefined
  position?: AppointablePosition
  countryCode: string
  isPresident: boolean
  citizens: string[]
}

function PositionCard({ icon, iconColor, title, holder, position, countryCode, isPresident, citizens }: PositionCardProps) {
  const govStore = useGovernmentStore()
  const [showPicker, setShowPicker] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const filtered = citizens.filter(n => n.toLowerCase().includes(search.toLowerCase())).slice(0, 8)

  async function appoint(name: string | null) {
    if (!position) return
    setLoading(true)
    const res = await govStore.appointPosition(countryCode, position, name)
    setMsg({ text: res.message, ok: res.success })
    setLoading(false)
    setShowPicker(false)
    setTimeout(() => setMsg(null), 3000)
  }

  const isVacant = !holder

  return (
    <div className="gov-people-card">
      <div className="gov-people-card__icon" style={{ color: iconColor }}>
        {icon}
      </div>
      <div className="gov-people-card__body">
        <div className="gov-people-card__title">{title}</div>
        {isVacant ? (
          <div className="gov-people-card__vacant">Vacant</div>
        ) : (
          <div className="gov-people-card__holder">{holder}</div>
        )}
      </div>

      {isPresident && position && (
        <div className="gov-people-card__actions">
          {holder && (
            <button
              className="gov-people-btn gov-people-btn--remove"
              onClick={() => appoint(null)}
              disabled={loading}
              title="Remove from position"
            >
              <X size={12} />
            </button>
          )}
          <button
            className="gov-people-btn gov-people-btn--appoint"
            onClick={() => setShowPicker(v => !v)}
            disabled={loading}
            title="Appoint"
          >
            <UserPlus size={12} />
          </button>
        </div>
      )}

      {msg && (
        <div className={`gov-people-msg ${msg.ok ? 'gov-people-msg--ok' : 'gov-people-msg--err'}`}>
          {msg.ok ? <Check size={11} /> : <X size={11} />} {msg.text}
        </div>
      )}

      {showPicker && (
        <div className="gov-people-picker">
          <input
            className="gov-people-picker__search"
            placeholder="Search citizen…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          <div className="gov-people-picker__list">
            {filtered.length === 0 ? (
              <div className="gov-people-picker__empty">No citizens found</div>
            ) : filtered.map(name => (
              <button
                key={name}
                className="gov-people-picker__item"
                onClick={() => { appoint(name); setSearch('') }}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface CongressRowProps {
  member: string
  countryCode: string
  isPresident: boolean
}

function CongressRow({ member, countryCode, isPresident }: CongressRowProps) {
  const govStore = useGovernmentStore()
  const [loading, setLoading] = useState(false)

  async function remove() {
    setLoading(true)
    await govStore.appointCongressMember(countryCode, member, 'remove')
    setLoading(false)
  }

  return (
    <div className="gov-congress-row">
      <Users size={12} style={{ color: '#64748b', flexShrink: 0 }} />
      <span className="gov-congress-row__name">{member}</span>
      {isPresident && (
        <button
          className="gov-people-btn gov-people-btn--remove"
          onClick={remove}
          disabled={loading}
          title="Remove from congress"
          style={{ marginLeft: 'auto' }}
        >
          <X size={11} />
        </button>
      )}
    </div>
  )
}

export default function GovPeopleTab() {
  const player = usePlayerStore()
  const govStore = useGovernmentStore()
  const iso = player.countryCode || 'US'
  const gov = govStore.governments[iso]

  const [showCongressAdd, setShowCongressAdd] = useState(false)
  const [congressSearch, setCongressSearch] = useState('')
  const [congressMsg, setCongressMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [loading, setLoading] = useState(false)

  if (!gov) return (
    <div className="gov-empty">Government data unavailable.</div>
  )

  const isPresident = gov.president === player.name
  // Build a list of citizens (excluding those already in positions/congress)
  const occupiedNames = new Set([gov.president, gov.vicePresident, gov.defenseMinister, gov.ecoMinister].filter(Boolean))
  const citizens = (gov.citizens || [])
    .map((c: { name: string }) => c.name)
    .filter((n: string) => !occupiedNames.has(n))

  const congressFiltered = citizens
    .filter((n: string) => !gov.congress.includes(n) && n.toLowerCase().includes(congressSearch.toLowerCase()))
    .slice(0, 8)

  async function addCongress(name: string) {
    setLoading(true)
    const res = await govStore.appointCongressMember(iso, name, 'add')
    setCongressMsg({ text: res.message, ok: res.success })
    setLoading(false)
    setShowCongressAdd(false)
    setCongressSearch('')
    setTimeout(() => setCongressMsg(null), 3000)
  }

  return (
    <div className="gov-people">
      {/* ── Executive Branch ── */}
      <div className="gov-people-section-title">
        <Crown size={13} style={{ color: '#f59e0b' }} /> Executive Branch
      </div>

      <div className="gov-people-cards">
        {/* President (display only) */}
        <div className="gov-people-card gov-people-card--president">
          <div className="gov-people-card__icon" style={{ color: '#f59e0b' }}>
            <Crown size={22} />
          </div>
          <div className="gov-people-card__body">
            <div className="gov-people-card__title">President</div>
            {gov.president ? (
              <div className="gov-people-card__holder">{gov.president}</div>
            ) : (
              <div className="gov-people-card__vacant">Vacant</div>
            )}
          </div>
        </div>

        {/* Vice President */}
        <PositionCard
          icon={<ChevronDown size={20} />}
          iconColor="#a78bfa"
          title="Vice President"
          holder={gov.vicePresident}
          position="vicePresident"
          countryCode={iso}
          isPresident={isPresident}
          citizens={citizens}
        />
      </div>

      {/* ── Cabinet ── */}
      <div className="gov-people-section-title" style={{ marginTop: '14px' }}>
        <ShieldCheck size={13} style={{ color: '#22d38a' }} /> Cabinet
      </div>

      <div className="gov-people-cards">
        {/* Minister of Defense */}
        <PositionCard
          icon={<ShieldCheck size={20} />}
          iconColor="#ef4444"
          title="Minister of Defense"
          holder={gov.defenseMinister}
          position="defenseMinister"
          countryCode={iso}
          isPresident={isPresident}
          citizens={citizens}
        />

        {/* Minister of Economy */}
        <PositionCard
          icon={<TrendingUp size={20} />}
          iconColor="#22d38a"
          title="Minister of Economy"
          holder={gov.ecoMinister}
          position="ecoMinister"
          countryCode={iso}
          isPresident={isPresident}
          citizens={citizens}
        />
      </div>

      {/* ── Congress ── */}
      <div className="gov-people-section-title" style={{ marginTop: '14px' }}>
        <Users size={13} style={{ color: '#60a5fa' }} /> Congress
        <span className="gov-people-congress-count">{gov.congress.length}/10</span>
        {isPresident && gov.congress.length < 10 && (
          <button
            className="gov-people-btn gov-people-btn--appoint"
            style={{ marginLeft: 'auto' }}
            onClick={() => setShowCongressAdd(v => !v)}
            title="Add congress member"
          >
            <Plus size={12} />
          </button>
        )}
      </div>

      {congressMsg && (
        <div className={`gov-people-msg ${congressMsg.ok ? 'gov-people-msg--ok' : 'gov-people-msg--err'}`} style={{ marginBottom: '6px' }}>
          {congressMsg.ok ? <Check size={11} /> : <X size={11} />} {congressMsg.text}
        </div>
      )}

      {showCongressAdd && (
        <div className="gov-people-picker" style={{ marginBottom: '8px' }}>
          <input
            className="gov-people-picker__search"
            placeholder="Search citizen to add…"
            value={congressSearch}
            onChange={e => setCongressSearch(e.target.value)}
            autoFocus
          />
          <div className="gov-people-picker__list">
            {congressFiltered.length === 0 ? (
              <div className="gov-people-picker__empty">No citizens found</div>
            ) : congressFiltered.map((name: string) => (
              <button
                key={name}
                className="gov-people-picker__item"
                onClick={() => addCongress(name)}
                disabled={loading}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="gov-congress-list">
        {gov.congress.length === 0 ? (
          <div className="gov-congress-empty">No congress members yet.</div>
        ) : gov.congress.map((m: string) => (
          <CongressRow
            key={m}
            member={m}
            countryCode={iso}
            isPresident={isPresident}
          />
        ))}
      </div>
    </div>
  )
}
