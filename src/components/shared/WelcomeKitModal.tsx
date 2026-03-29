import { useState, useEffect } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useInventoryStore, TIER_COLORS, TIER_LABELS } from '../../stores/inventoryStore'
import { ENABLE_DIVISIONS } from '../../config/features'
import { claimWelcomeKit } from '../../api/client'
import type { EquipTier } from '../../types/inventory.types'

const RESOURCES = [
  { key: 'money',         label: 'Money',        amount: 500_000, icon: '💰' },
  { key: 'oil',           label: 'Oil',          amount: 5_000,   icon: '🛢️' },
  { key: 'materialX',     label: 'Material X',   amount: 2_000,   icon: '⚗️' },
  { key: 'scrap',         label: 'Scrap',        amount: 2_000,   icon: '🔩' },
  { key: 'bitcoin',       label: 'Bitcoin',      amount: 20,      icon: '₿'  },
  { key: 'bread',         label: 'Bread',        amount: 50,      icon: '🍞' },
  { key: 'sushi',         label: 'Sushi',        amount: 30,      icon: '🍣' },
  { key: 'wagyu',         label: 'Wagyu',        amount: 20,      icon: '🥩' },
  { key: 'lootBoxes',     label: 'Loot Boxes',   amount: 5,       icon: '📦' },
  { key: 'militaryBoxes', label: 'Mil Boxes',    amount: 3,       icon: '🧰' },
  { key: 'supplyBoxes',   label: 'Supply Boxes', amount: 2,       icon: '📋' },
  { key: 'badgesOfHonor', label: 'Badges',       amount: 15,      icon: '🏅' },
]

const XP_GRANT = 1000

export default function WelcomeKitModal() {
  const [show, setShow]         = useState(false)
  const [claimed, setClaimed]   = useState(false)
  const [animating, setAnimating] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  // On mount: fetch player from API, then show modal only if not yet claimed
  useEffect(() => {
    usePlayerStore.getState().fetchPlayer().then(() => {
      const { welcomeKitClaimed } = usePlayerStore.getState()
      if (!welcomeKitClaimed) {
        setTimeout(() => setShow(true), 1500)
      }
    })
  }, [])

  if (!show) return null

  const handleClaim = async () => {
    setAnimating(true)
    setError(null)

    try {
      // 1. Call server — generates items + grants resources (server-authoritative)
      const res = await claimWelcomeKit()

      if (res.success) {
        // 2. Re-fetch inventory from API (proper typed items)
        await useInventoryStore.getState().fetchInventory()

        // 3. Re-fetch player from API (updated resources + XP + welcomeKitClaimed = true)
        await usePlayerStore.getState().fetchPlayer()

        // 4. Show success state
        setTimeout(() => {
          setClaimed(true)
          setAnimating(false)
        }, 600)
      } else {
        setError(res.error ?? 'Failed to claim kit')
        setAnimating(false)
      }
    } catch (err: any) {
      // Server returns 400 if already claimed
      const msg = err?.message ?? 'Something went wrong'
      setError(msg)
      console.error('[WelcomeKit] Claim error:', err)
      setAnimating(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
      animation: 'fadeIn 0.4s ease',
    }}>
      <div style={{
        width: 520, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto',
        background: 'linear-gradient(165deg, rgba(15,23,42,0.98), rgba(2,6,23,0.99))',
        border: '1px solid rgba(245,158,11,0.3)',
        borderRadius: 12, padding: '28px 24px',
        boxShadow: '0 0 60px rgba(245,158,11,0.15), 0 0 120px rgba(245,158,11,0.05)',
        fontFamily: 'var(--font-primary)',
      }}>

        {/* ── Header ── */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 8, animation: 'pulse 2s infinite' }}>🎁</div>
          <div style={{
            fontSize: 22, fontWeight: 900, fontFamily: 'var(--font-display)',
            letterSpacing: 3, color: '#f59e0b',
            textShadow: '0 0 20px rgba(245,158,11,0.4)',
          }}>WELCOME KIT</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, letterSpacing: 1 }}>
            ONE-TIME STARTER PACKAGE — CLAIM YOUR ARSENAL
          </div>
        </div>

        {/* ── Claimed State ── */}
        {claimed ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{
              fontSize: 16, fontWeight: 900, color: '#22d38a',
              fontFamily: 'var(--font-display)', letterSpacing: 2,
            }}>KIT CLAIMED!</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
              All items and resources have been added to your account.
            </div>
            <button
              onClick={() => setShow(false)}
              style={{
                marginTop: 16, padding: '10px 32px',
                background: 'linear-gradient(135deg, #22d38a, #059669)',
                border: 'none', borderRadius: 6, cursor: 'pointer',
                fontSize: 13, fontWeight: 900, color: '#0a0a0a',
                fontFamily: 'var(--font-display)', letterSpacing: 2,
              }}
            >ENTER XWAR</button>
          </div>
        ) : (<>

          {/* ── XP Row ── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', marginBottom: 12,
            background: 'rgba(245,158,11,0.08)', borderRadius: 6,
            border: '1px solid rgba(245,158,11,0.2)',
          }}>
            <span style={{ fontSize: 20 }}>⭐</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#f59e0b', fontFamily: 'var(--font-display)', letterSpacing: 1 }}>
                +{XP_GRANT.toLocaleString()} XP
              </div>
              <div style={{ fontSize: 9, color: '#94a3b8' }}>Instant level boost</div>
            </div>
          </div>

          {/* ── Resources Grid ── */}
          <div style={{ fontSize: 9, fontWeight: 900, color: '#64748b', letterSpacing: 1.5, marginBottom: 6, fontFamily: 'var(--font-display)' }}>
            RESOURCES
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginBottom: 14 }}>
            {RESOURCES.map(r => (
              <div key={r.key} style={{
                padding: '6px 4px', textAlign: 'center',
                background: 'rgba(255,255,255,0.03)', borderRadius: 4,
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ fontSize: 14 }}>{r.icon}</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#22d38a', fontFamily: 'var(--font-mono)' }}>
                  {r.amount >= 1000 ? `${(r.amount / 1000).toFixed(0)}k` : r.amount}
                </div>
                <div style={{ fontSize: 7, color: '#64748b', fontWeight: 600 }}>{r.label}</div>
              </div>
            ))}
          </div>

          {/* ── Gear Tiers ── */}
          <div style={{ fontSize: 9, fontWeight: 900, color: '#64748b', letterSpacing: 1.5, marginBottom: 6, fontFamily: 'var(--font-display)' }}>
            FULL GEAR SET — ALL TIERS
          </div>
          <div style={{ display: 'flex', gap: 3, marginBottom: 14, flexWrap: 'wrap' }}>
            {(['t1', 't2', 't3', 't4', 't5', 't6'] as EquipTier[]).map(tier => (
              <div key={tier} style={{
                flex: 1, minWidth: 58, padding: '5px 4px', textAlign: 'center',
                background: `${TIER_COLORS[tier]}0a`, borderRadius: 4,
                border: `1px solid ${TIER_COLORS[tier]}33`,
              }}>
                <div style={{ fontSize: 9, fontWeight: 900, color: TIER_COLORS[tier], fontFamily: 'var(--font-display)' }}>
                  {tier.toUpperCase()}
                </div>
                <div style={{ fontSize: 7, color: '#94a3b8' }}>{TIER_LABELS[tier].split(' ')[0]}</div>
                <div style={{ fontSize: 7, color: '#64748b', marginTop: 2 }}>All slots</div>
              </div>
            ))}
          </div>

          {/* ── Error Banner ── */}
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 6, padding: '8px 12px', marginBottom: 10,
              fontSize: 11, color: '#f87171', textAlign: 'center',
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* ── Claim Button ── */}
          <button
            onClick={handleClaim}
            disabled={animating}
            style={{
              width: '100%', padding: '14px 0',
              background: animating
                ? 'rgba(245,158,11,0.3)'
                : 'linear-gradient(135deg, #f59e0b, #d97706)',
              border: '2px solid rgba(245,158,11,0.5)',
              borderRadius: 8, cursor: animating ? 'wait' : 'pointer',
              fontSize: 16, fontWeight: 900, color: '#0a0a0a',
              fontFamily: 'var(--font-display)', letterSpacing: 3,
              textTransform: 'uppercase' as const,
              boxShadow: '0 0 30px rgba(245,158,11,0.3)',
              transition: 'all 0.2s',
            }}
          >
            {animating ? '⏳ CLAIMING...' : '🎁 CLAIM WELCOME KIT'}
          </button>
          <div style={{ textAlign: 'center', fontSize: 8, color: '#475569', marginTop: 8, letterSpacing: 0.5 }}>
            This can only be claimed once per account
          </div>
        </>)}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
      `}</style>
    </div>
  )
}
