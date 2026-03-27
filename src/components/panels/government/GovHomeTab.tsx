import { useWorldStore } from '../../../stores/worldStore'
import { useGovernmentStore } from '../../../stores/governmentStore'
import { usePlayerStore } from '../../../stores/playerStore'
import { useArmyStore } from '../../../stores/army'
import { useBattleStore, getCountryName } from '../../../stores/battleStore'
import CountryFlag from '../../shared/CountryFlag'
import {
  Swords, Mountain, Wrench, Users, Bitcoin, TrendingUp, Flame, Shield
} from 'lucide-react'

/** Compute a pseudo-rank for a country among all countries for a given metric */
function computeRank(countries: { code: string }[], iso: string, getValue: (c: any) => number): number {
  const sorted = [...countries].sort((a, b) => getValue(b) - getValue(a))
  const idx = sorted.findIndex(c => c.code === iso)
  return idx >= 0 ? idx + 1 : countries.length
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 1 : 2) + 'K'
  return n.toLocaleString()
}

/** HOME tab — Country overview dashboard (reference layout) */
export default function GovHomeTab() {
  const player = usePlayerStore()
  const world = useWorldStore()
  const gov = useGovernmentStore().governments[player.countryCode || 'US']
  const iso = player.countryCode || 'US'
  const myCountry = world.countries.find(c => c.code === iso)
  const fund = myCountry?.fund ?? { money: 0, oil: 0, scrap: 0, materialX: 0, bitcoin: 0, jets: 0 }
  const battles = useBattleStore()

  // ── Compute ranking stats ──
  const countries = world.countries.filter(c => c.population > 0)

  // Weekly damages (from warFundDamageTracker)
  const weeklyDmg = world.warFundDamageTracker[iso] || 0
  const weeklyDmgRank = computeRank(countries, iso, c => world.warFundDamageTracker[c.code] || 0)

  // Total damages (sum of all battle damage for this country)
  const myBattles = Object.values(battles.battles).filter(
    b => b.attackerId === iso || b.defenderId === iso
  )
  const totalDmg = myBattles.reduce((sum, b) => {
    return sum + b.rounds.reduce((rSum, r) => rSum + (r.attackerDmgTotal || 0) + (r.defenderDmgTotal || 0), 0)
  }, 0) + weeklyDmg
  const totalDmgRank = computeRank(countries, iso, c => {
    const cBattles = Object.values(battles.battles).filter(b => b.attackerId === c.code || b.defenderId === c.code)
    return cBattles.reduce((sum, b) => sum + b.rounds.reduce((rSum, r) => rSum + (r.attackerDmgTotal || 0) + (r.defenderDmgTotal || 0), 0), 0) + (world.warFundDamageTracker[c.code] || 0)
  })

  // Region diff
  const regionDiff = myCountry?.regions || 0
  const regionRank = computeRank(countries, iso, c => c.regions)

  // Development (sum of infrastructure levels)
  const dev = myCountry
    ? ((myCountry.portLevel || 0) + (myCountry.airportLevel || 0) + (myCountry.bunkerLevel || 0) + (myCountry.militaryBaseLevel || 0))
    : 0
  const devFormatted = (dev * 14.24).toFixed(2) // scale to look like real dev index
  const devRank = computeRank(countries, iso, c => (c.portLevel || 0) + (c.airportLevel || 0) + (c.bunkerLevel || 0) + (c.militaryBaseLevel || 0))

  // Active citizens
  const citizenCount = gov?.citizens?.length || 0
  const citizenRank = computeRank(countries, iso, c => {
    const g = useGovernmentStore.getState().governments[c.code]
    return g?.citizens?.length || 0
  })

  // ── Diplomacy ──
  const alliances = gov?.alliances || []
  const swornEnemy = gov?.swornEnemy || null
  const swornEnemyCountry = swornEnemy ? world.countries.find(c => c.code === swornEnemy) : null

  // Active wars involving this country
  const activeWars = world.wars.filter(
    w => w.status === 'active' && (w.attacker === iso || w.defender === iso)
  )

  // Treasury
  const treasuryBtc = fund.bitcoin
  const treasuryMoney = fund.money

  return (
    <>
      {/* ── Rankings Section ── */}
      <div className="gov-section" style={{ border: 'none', background: 'transparent', padding: '4px 0' }}>
        <div className="gov-rankings-header">
          <span className="gov-rankings-header__title">Rankings</span>
          <span className="gov-rankings-header__arrow">→</span>
        </div>

        <div className="gov-rankings-grid">
          {/* Weekly damages */}
          <div className="gov-ranking-card">
            <div className="gov-ranking-card__label">Weekly damages</div>
            <div className="gov-ranking-card__value">
              <Swords size={13} color="#ef4444" />
              {formatNum(weeklyDmg)}
            </div>
            <div className="gov-ranking-card__rank">
              <span>🏅</span> {weeklyDmgRank}
            </div>
          </div>

          {/* Total damages */}
          <div className="gov-ranking-card">
            <div className="gov-ranking-card__label">Total damages</div>
            <div className="gov-ranking-card__value">
              <Flame size={13} color="#f59e0b" />
              {formatNum(totalDmg)}
            </div>
            <div className="gov-ranking-card__rank">
              <span>🏅</span> {totalDmgRank}
            </div>
          </div>

          {/* Region diff */}
          <div className="gov-ranking-card">
            <div className="gov-ranking-card__label">Region diff</div>
            <div className="gov-ranking-card__value">
              <Mountain size={13} color="#94a3b8" />
              {regionDiff}
            </div>
            <div className="gov-ranking-card__rank">
              <span>🏅</span> {regionRank}
            </div>
          </div>

          {/* Development */}
          <div className="gov-ranking-card">
            <div className="gov-ranking-card__label">Development</div>
            <div className="gov-ranking-card__value">
              <Wrench size={13} color="#3b82f6" />
              {devFormatted}
            </div>
            <div className="gov-ranking-card__rank">
              <span>🏅</span> {devRank}
            </div>
          </div>

          {/* Active citizens */}
          <div className="gov-ranking-card">
            <div className="gov-ranking-card__label">Active citizens</div>
            <div className="gov-ranking-card__value">
              <Users size={13} color="#22d38a" />
              {citizenCount}
            </div>
            <div className="gov-ranking-card__rank">
              <span>🏅</span> {citizenRank}
            </div>
          </div>
        </div>
      </div>

      {/* ── Diplomacy Section ── */}
      <div className="gov-section" style={{ border: 'none', background: 'transparent', padding: '4px 0' }}>
        <div className="gov-diplomacy-header">
          <span className="gov-diplomacy-header__title">Diplomacy</span>
          <span className="gov-diplomacy-header__info" title="Alliance and enemy relations">ℹ</span>
        </div>

        <div className="gov-diplomacy-row">
          {/* Alliances card */}
          <div className="gov-diplomacy-card gov-diplomacy-card--alliance">
            <div className="gov-diplomacy-card__header gov-diplomacy-card__header--alliance">
              <Shield size={12} /> Alliances
            </div>
            <div className="gov-diplomacy-card__flags">
              {alliances.length > 0 ? alliances.map((a: string) => {
                // Try to find a country flag for the alliance code
                const allianceCountry = world.countries.find(c => c.code === a || c.name === a)
                return allianceCountry
                  ? <CountryFlag key={a} iso={allianceCountry.code} size={22} />
                  : <span key={a} style={{ fontSize: '9px', color: '#22d38a', background: 'rgba(34,211,138,0.1)', padding: '2px 6px', borderRadius: '3px' }}>{a}</span>
              }) : (
                <span style={{ fontSize: '9px', color: '#475569' }}>None</span>
              )}
            </div>
            <div className="gov-diplomacy-card__stats">
              <span className="gov-diplomacy-card__stat gov-diplomacy-card__stat--green">
                <Swords size={10} /> +10%
              </span>
              <span className="gov-diplomacy-card__stat gov-diplomacy-card__stat--amber">
                <Bitcoin size={10} /> -1/day
              </span>
            </div>
          </div>

          {/* Sworn enemy card */}
          <div className="gov-diplomacy-card gov-diplomacy-card--enemy">
            <div className="gov-diplomacy-card__header gov-diplomacy-card__header--enemy">
              <Swords size={12} /> Sworn enemy
            </div>
            <div className="gov-diplomacy-card__flags">
              {swornEnemy ? (
                <CountryFlag iso={swornEnemy} size={22} />
              ) : (
                <span style={{ fontSize: '9px', color: '#475569' }}>None</span>
              )}
            </div>
            <div className="gov-diplomacy-card__stats">
              <span className="gov-diplomacy-card__stat gov-diplomacy-card__stat--green">
                <Swords size={10} /> +10%
              </span>
              <span className="gov-diplomacy-card__stat gov-diplomacy-card__stat--red">
                <Bitcoin size={10} /> -3/day
              </span>
            </div>
          </div>
        </div>

        {/* Active wars card */}
        {activeWars.length > 0 && (
          <div className="gov-active-wars">
            <div className="gov-active-wars__header">
              <Flame size={12} /> Active wars
            </div>
            <div className="gov-active-wars__grid">
              {activeWars.map(w => (
                <div key={w.id} className="gov-active-wars__pair">
                  <CountryFlag iso={w.attacker} size={18} />
                  <CountryFlag iso={w.defender} size={18} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Account Strip ── */}
      <div className="gov-account-strip">
        <div className="gov-account-strip__header">
          <span className="gov-account-strip__title">Account</span>
          <span className="gov-account-strip__arrow">→</span>
        </div>
        <div className="gov-account-strip__row">
          <div className="gov-account-strip__value">
            <Bitcoin size={14} color="#f59e0b" />
            {formatNum(treasuryBtc)}
          </div>
          <div className="gov-account-strip__change">
            <Bitcoin size={11} color="#22d38a" />
            +{formatNum(Math.floor(treasuryMoney * 0.001))}
          </div>
        </div>
        <div className="gov-account-strip__bar">
          <div
            className="gov-account-strip__bar-fill"
            style={{ width: `${Math.min(100, (treasuryBtc / 100_000) * 100)}%` }}
          />
        </div>
      </div>
    </>
  )
}
