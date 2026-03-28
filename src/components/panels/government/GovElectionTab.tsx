import { useState, useEffect } from 'react'
import { usePlayerStore } from '../../../stores/playerStore'
import { getElectionApi, registerCandidateApi, voteElectionApi } from '../../../api/client'
import { Vote, Crown, Users, Clock, Trophy, ChevronRight } from 'lucide-react'

interface CandidateSummary {
  id: string
  name: string
  registeredAt: number
  totalWeightedVotes: number
  voterCount: number
}

interface ElectionData {
  phase: string
  cycleStart: number
  cycleEnd: number
  candidates: CandidateSummary[]
  totalVotes: number
  lastResult: {
    winnerId: string | null
    winnerName: string | null
    congress: string[]
    resolvedAt: number
    rankings: { id: string; name: string; totalWeightedVotes: number; voterCount: number }[]
  } | null
  currentPresident: string | null
  currentCongress: string[]
}

export default function GovElectionTab() {
  const player = usePlayerStore()
  const iso = player.countryCode || 'US'
  const [election, setElection] = useState<ElectionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionMsg, setActionMsg] = useState('')
  const [hasVoted, setHasVoted] = useState(false)

  const fetchElection = async () => {
    try {
      const res = await getElectionApi(iso)
      setElection(res.election)
    } catch {
      setElection(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchElection() }, [iso])

  const handleRegister = async () => {
    try {
      const res = await registerCandidateApi(iso)
      setActionMsg(res.message)
      fetchElection()
    } catch (err: any) {
      setActionMsg(err?.response?.data?.error || 'Failed to register.')
    }
  }

  const handleVote = async (candidateId: string) => {
    try {
      const res = await voteElectionApi(iso, candidateId)
      setActionMsg(res.message)
      setHasVoted(true)
      fetchElection()
    } catch (err: any) {
      setActionMsg(err?.response?.data?.error || 'Failed to vote.')
    }
  }

  if (loading) return <div style={{ padding: '16px', color: '#64748b', textAlign: 'center' }}>Loading election data...</div>
  if (!election) return <div style={{ padding: '16px', color: '#ef4444', textAlign: 'center' }}>No election data available.</div>

  const timeLeft = Math.max(0, election.cycleEnd - Date.now())
  const daysLeft = Math.floor(timeLeft / (24 * 60 * 60 * 1000))
  const hoursLeft = Math.floor((timeLeft % (24 * 60 * 60 * 1000)) / (3600000))
  const isRegistered = election.candidates.some(c => c.id === player.name)
  const sortedCandidates = [...election.candidates].sort((a, b) => b.totalWeightedVotes - a.totalWeightedVotes)

  return (
    <>
      {/* Status Banner */}
      <div className="gov-section" style={{ borderLeft: '3px solid #a78bfa' }}>
        <div className="gov-section__title" style={{ color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Vote size={14} /> ELECTION CYCLE
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <div>
            <div style={{ fontSize: '8px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</div>
            <div style={{
              fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
              color: election.phase === 'active' ? '#22d38a' : '#f59e0b',
            }}>
              {election.phase === 'active' ? '● VOTING OPEN' : `● ${election.phase.toUpperCase()}`}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '8px', color: '#64748b', textTransform: 'uppercase' }}>Time Remaining</div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} color="#a78bfa" />
              {daysLeft}d {hoursLeft}h
            </div>
          </div>
        </div>

        {/* Current Leadership */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <div style={{ flex: 1, padding: '4px 6px', background: 'rgba(34,211,138,0.06)', border: '1px solid rgba(34,211,138,0.15)', borderRadius: '4px' }}>
            <div style={{ fontSize: '7px', color: '#22d38a', textTransform: 'uppercase', fontWeight: 700, marginBottom: '2px' }}>
              <Crown size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />President
            </div>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#e2e8f0' }}>{election.currentPresident || 'Vacant'}</div>
          </div>
          <div style={{ flex: 1, padding: '4px 6px', background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '4px' }}>
            <div style={{ fontSize: '7px', color: '#38bdf8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '2px' }}>
              <Users size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />Congress
            </div>
            <div style={{ fontSize: '9px', color: '#94a3b8' }}>
              {(election.currentCongress || []).length > 0
                ? (election.currentCongress as string[]).join(', ')
                : 'No members'}
            </div>
          </div>
        </div>
      </div>

      {/* Action Message */}
      {actionMsg && (
        <div style={{ padding: '6px 10px', margin: '0 0 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 600, background: 'rgba(167,139,250,0.08)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)' }}>
          {actionMsg}
        </div>
      )}

      {/* Register / Run for Office */}
      {election.phase === 'active' && !isRegistered && (
        <button className="gov-btn gov-btn--green" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '6px' }} onClick={handleRegister}>
          <Vote size={14} /> RUN FOR OFFICE
        </button>
      )}
      {isRegistered && (
        <div style={{ padding: '4px 8px', background: 'rgba(34,211,138,0.08)', borderRadius: '4px', fontSize: '9px', color: '#22d38a', fontWeight: 700, textAlign: 'center', marginBottom: '6px', border: '1px solid rgba(34,211,138,0.2)' }}>
          ✓ YOU ARE REGISTERED AS CANDIDATE
        </div>
      )}

      {/* Candidates */}
      <div className="gov-section">
        <div className="gov-section__title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Users size={14} /> CANDIDATES ({election.candidates.length})
        </div>

        {sortedCandidates.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: '9px', padding: '8px 0', textAlign: 'center' }}>No candidates registered yet. Be the first to run!</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {sortedCandidates.map((c, i) => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 8px', borderRadius: '4px',
                background: i === 0 ? 'rgba(34,211,138,0.04)' : 'rgba(0,0,0,0.2)',
                border: i === 0 ? '1px solid rgba(34,211,138,0.15)' : '1px solid rgba(255,255,255,0.03)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: 900, color: i === 0 ? '#22d38a' : '#64748b',
                    background: i === 0 ? 'rgba(34,211,138,0.12)' : 'rgba(255,255,255,0.04)',
                  }}>#{i + 1}</div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: c.id === player.name ? '#a78bfa' : '#e2e8f0' }}>{c.name}</div>
                    <div style={{ fontSize: '8px', color: '#64748b' }}>
                      {c.totalWeightedVotes.toFixed(1)} PP · {c.voterCount} voter{c.voterCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                {election.phase === 'active' && !hasVoted && c.id !== player.name && (
                  <button onClick={() => handleVote(c.id)} style={{
                    padding: '3px 8px', fontSize: '8px', fontWeight: 700, borderRadius: '3px', cursor: 'pointer',
                    background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)',
                    display: 'flex', alignItems: 'center', gap: '3px',
                  }}>
                    <ChevronRight size={10} /> VOTE
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Last Election Results */}
      {election.lastResult && election.lastResult.winnerId && (
        <div className="gov-section" style={{ borderLeft: '3px solid #f59e0b' }}>
          <div className="gov-section__title" style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Trophy size={14} /> LAST ELECTION RESULTS
          </div>
          <div style={{ padding: '4px 6px', background: 'rgba(245,158,11,0.06)', borderRadius: '4px', marginBottom: '4px' }}>
            <div style={{ fontSize: '8px', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase' }}>Winner</div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#e2e8f0' }}>{election.lastResult.winnerName}</div>
          </div>
          {election.lastResult.congress.length > 0 && (
            <div style={{ padding: '4px 6px', background: 'rgba(56,189,248,0.06)', borderRadius: '4px', marginBottom: '4px' }}>
              <div style={{ fontSize: '8px', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>Congress</div>
              <div style={{ fontSize: '9px', color: '#94a3b8' }}>{election.lastResult.congress.join(', ')}</div>
            </div>
          )}
          {election.lastResult.rankings.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {election.lastResult.rankings.map((r: any, i: number) => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 6px', fontSize: '8px', color: i === 0 ? '#f59e0b' : '#64748b' }}>
                  <span style={{ fontWeight: i === 0 ? 700 : 400 }}>#{i + 1} {r.name}</span>
                  <span>{r.totalWeightedVotes.toFixed(1)} PP ({r.voterCount} votes)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
