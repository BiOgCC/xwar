import { useState } from 'react'
import { useSocialClubStore } from '../../stores/socialClubStore'
import { usePlayerStore } from '../../stores/playerStore'
import CountryFlag from '../shared/CountryFlag'

type SocialTab = 'club' | 'wall' | 'pact' | 'articles' | 'mentorship' | 'chat'

const TABS: { id: SocialTab; icon: string; label: string }[] = [
  { id: 'club', icon: '🏠', label: 'Club' },
  { id: 'wall', icon: '🧱', label: 'Wall' },
  { id: 'pact', icon: '🩸', label: 'Blood Pact' },
  { id: 'articles', icon: '📰', label: 'Articles' },
  { id: 'mentorship', icon: '🎓', label: 'Mentorship' },
  { id: 'chat', icon: '💬', label: 'Chat' },
]

export default function SocialClubPanel() {
  const [tab, setTab] = useState<SocialTab>('club')

  return (
    <div className="social-club">
      <div className="social-club__tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`social-club__tab ${tab === t.id ? 'social-club__tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      <div className="social-club__body">
        {tab === 'club' && <ClubOverview />}
        {tab === 'wall' && <WallTab />}
        {tab === 'pact' && <BloodPactTab />}
        {tab === 'articles' && <ArticlesTab />}
        {tab === 'mentorship' && <MentorshipTab />}
        {tab === 'chat' && <ChatTab />}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   CLUB OVERVIEW
   ═══════════════════════════════════════════════════════════════════ */
function ClubOverview() {
  const sc = useSocialClubStore()
  const player = usePlayerStore()
  const activePacts = sc.bloodPacts.filter(p => p.level < 5)
  const maxPacts = sc.bloodPacts.filter(p => p.level >= 5)
  const activeMentorships = sc.mentorships.filter(m => !m.graduated)

  return (
    <div className="sc-overview">
      <div className="sc-overview__welcome">
        <div className="sc-overview__title">Welcome to the Social Club, {player.name}</div>
        <div className="sc-overview__subtitle">Connect, compete, and grow together</div>
      </div>

      <div className="sc-overview__grid">
        <div className="sc-stat-card">
          <div className="sc-stat-card__icon">👥</div>
          <div className="sc-stat-card__value">{sc.friends.length}</div>
          <div className="sc-stat-card__label">Friends</div>
        </div>
        <div className="sc-stat-card">
          <div className="sc-stat-card__icon">🩸</div>
          <div className="sc-stat-card__value">{activePacts.length + maxPacts.length}</div>
          <div className="sc-stat-card__label">Blood Pacts</div>
        </div>
        <div className="sc-stat-card">
          <div className="sc-stat-card__icon">🎓</div>
          <div className="sc-stat-card__value">{activeMentorships.length}</div>
          <div className="sc-stat-card__label">Mentorships</div>
        </div>
        <div className="sc-stat-card">
          <div className="sc-stat-card__icon">📰</div>
          <div className="sc-stat-card__value">{sc.articles.length}</div>
          <div className="sc-stat-card__label">Articles</div>
        </div>
      </div>

      {/* Recent Wall Activity */}
      <div className="sc-section">
        <div className="sc-section__title">📋 Recent Wall Activity</div>
        {sc.wallMessages.slice(0, 3).map(msg => (
          <div key={msg.id} className="sc-wall-preview">
            <CountryFlag iso={msg.authorCountry} size={14} />
            <span className="sc-wall-preview__author">{msg.authorName}</span>
            <span className="sc-wall-preview__arrow">→</span>
            <span className="sc-wall-preview__target">{msg.targetName}</span>
            <span className="sc-wall-preview__msg">{msg.message}</span>
          </div>
        ))}
        {sc.wallMessages.length === 0 && <div className="sc-empty">No wall activity yet</div>}
      </div>

      {/* Friends List */}
      <div className="sc-section">
        <div className="sc-section__title">👥 Friends ({sc.friends.length}/{sc.maxFriends})</div>
        <div className="sc-friends-list">
          {sc.friends.map(f => (
            <div key={f.name} className="sc-friend-chip">
              <CountryFlag iso={f.countryCode} size={14} />
              <span>{f.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   WALL TAB
   ═══════════════════════════════════════════════════════════════════ */
function WallTab() {
  const sc = useSocialClubStore()
  const player = usePlayerStore()
  const [selectedFriend, setSelectedFriend] = useState('')
  const [message, setMessage] = useState('')
  const [feedback, setFeedback] = useState('')

  const myWall = sc.wallMessages.filter(m => m.targetName === player.name)

  const handlePost = () => {
    const target = selectedFriend || player.name
    const result = sc.postToWall(target, message)
    setFeedback(result.message)
    if (result.success) setMessage('')
    setTimeout(() => setFeedback(''), 3000)
  }

  return (
    <div className="sc-wall">
      <div className="sc-section">
        <div className="sc-section__title">✍️ Sign a Wall</div>
        <div className="sc-wall__compose">
          <select
            className="sc-input sc-input--select"
            value={selectedFriend}
            onChange={e => setSelectedFriend(e.target.value)}
          >
            <option value="">My Wall</option>
            {sc.friends.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
          </select>
          <div className="sc-wall__compose-row">
            <input
              className="sc-input"
              placeholder="Write a message..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              maxLength={200}
              onKeyDown={e => e.key === 'Enter' && handlePost()}
            />
            <button className="sc-btn sc-btn--primary" onClick={handlePost}>Post</button>
          </div>
          {feedback && <div className="sc-feedback">{feedback}</div>}
        </div>
      </div>

      <div className="sc-section">
        <div className="sc-section__title">🧱 My Wall ({myWall.length})</div>
        {myWall.length === 0 && <div className="sc-empty">No messages on your wall yet. Ask friends to sign it!</div>}
        {myWall.map(msg => (
          <div key={msg.id} className="sc-wall-msg">
            <div className="sc-wall-msg__header">
              <CountryFlag iso={msg.authorCountry} size={14} />
              <span className="sc-wall-msg__author">{msg.authorName}</span>
              <span className="sc-wall-msg__time">{new Date(msg.timestamp).toLocaleDateString()}</span>
            </div>
            <div className="sc-wall-msg__body">{msg.message}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   BLOOD PACT TAB
   ═══════════════════════════════════════════════════════════════════ */
function BloodPactTab() {
  const sc = useSocialClubStore()
  const player = usePlayerStore()
  const [selectedFriend, setSelectedFriend] = useState('')
  const [feedback, setFeedback] = useState('')

  const availableFriends = sc.friends.filter(f =>
    !sc.bloodPacts.some(p => (p.player1 === f.name || p.player2 === f.name) && (p.player1 === player.name || p.player2 === player.name))
  )

  const handleInitiate = () => {
    if (!selectedFriend) return
    const result = sc.initiateBloodPact(selectedFriend)
    setFeedback(result.message)
    setSelectedFriend('')
    setTimeout(() => setFeedback(''), 3000)
  }

  // Simulate co-op XP (in real game this would trigger from shared battles etc.)
  const handleSimulateXP = (pactId: string) => {
    sc.addBloodPactXP(pactId, 25)
  }

  return (
    <div className="sc-pact">
      <div className="sc-section">
        <div className="sc-section__title">🩸 Blood Pact — Friendship Progression</div>
        <div className="sc-section__desc">Form blood pacts with friends. Progress together through 5 levels by fighting in the same battles, working in the same companies, and sharing alliance victories.</div>
      </div>

      {availableFriends.length > 0 && (
        <div className="sc-section">
          <div className="sc-section__title">⚡ Initiate New Pact</div>
          <div className="sc-pact__initiate">
            <select className="sc-input sc-input--select" value={selectedFriend} onChange={e => setSelectedFriend(e.target.value)}>
              <option value="">Select a friend...</option>
              {availableFriends.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
            </select>
            <button className="sc-btn sc-btn--blood" onClick={handleInitiate} disabled={!selectedFriend}>🩸 Form Pact</button>
          </div>
          {feedback && <div className="sc-feedback">{feedback}</div>}
        </div>
      )}

      <div className="sc-section">
        <div className="sc-section__title">📊 Active Pacts</div>
        {sc.bloodPacts.length === 0 && <div className="sc-empty">No blood pacts yet. Start one with a friend!</div>}
        {sc.bloodPacts.map(pact => {
          const partner = pact.player1 === player.name ? pact.player2 : pact.player1
          const percent = pact.xpToNext > 0 ? Math.min(100, (pact.xp / pact.xpToNext) * 100) : 100
          return (
            <div key={pact.id} className={`sc-pact-card ${pact.level >= 5 ? 'sc-pact-card--max' : ''}`}>
              <div className="sc-pact-card__header">
                <span className="sc-pact-card__partner">🩸 {partner}</span>
                <span className="sc-pact-card__title">{pact.title}</span>
                <span className="sc-pact-card__level">Lvl {pact.level}/5</span>
              </div>
              {pact.level < 5 && (
                <div className="sc-pact-card__bar-wrap">
                  <div className="sc-pact-card__bar">
                    <div className="sc-pact-card__bar-fill" style={{ width: `${percent}%` }} />
                  </div>
                  <span className="sc-pact-card__xp">{pact.xp}/{pact.xpToNext} XP</span>
                </div>
              )}
              {pact.level >= 5 && (
                <div className="sc-pact-card__max-label">★ MAX LEVEL — Blood Brothers ★</div>
              )}
              {pact.level < 5 && (
                <button className="sc-btn sc-btn--small" onClick={() => handleSimulateXP(pact.id)}>⚡ Co-op Action (+25 XP)</button>
              )}
            </div>
          )
        })}
      </div>

      {/* Tier Rewards Preview */}
      <div className="sc-section">
        <div className="sc-section__title">🎁 Pact Level Rewards</div>
        <div className="sc-tier-list">
          {[
            { lvl: 1, title: 'Acquaintance', reward: 'Pact formed' },
            { lvl: 2, title: 'Comrade', reward: '+5% shared battle XP' },
            { lvl: 3, title: 'Sworn Ally', reward: 'Exclusive title badge' },
            { lvl: 4, title: 'Blood Brother', reward: '+10% co-op bonuses' },
            { lvl: 5, title: 'Blood Brothers', reward: '★ Permanent title + cosmetic' },
          ].map(t => (
            <div key={t.lvl} className="sc-tier-row">
              <span className="sc-tier-row__lvl">Lvl {t.lvl}</span>
              <span className="sc-tier-row__title">{t.title}</span>
              <span className="sc-tier-row__reward">{t.reward}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   ARTICLES TAB
   ═══════════════════════════════════════════════════════════════════ */
function ArticlesTab() {
  const sc = useSocialClubStore()
  const [showCompose, setShowCompose] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [feedback, setFeedback] = useState('')

  const handlePublish = () => {
    const result = sc.publishArticle(title, content)
    setFeedback(result.message)
    if (result.success) {
      setTitle('')
      setContent('')
      setShowCompose(false)
    }
    setTimeout(() => setFeedback(''), 3000)
  }

  return (
    <div className="sc-articles">
      <div className="sc-section">
        <div className="sc-section__title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>📰 News Board</span>
          <button className="sc-btn sc-btn--primary" onClick={() => setShowCompose(!showCompose)}>
            {showCompose ? 'Cancel' : '✍️ Write Article'}
          </button>
        </div>
      </div>

      {showCompose && (
        <div className="sc-section sc-compose">
          <input
            className="sc-input"
            placeholder="Article title..."
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={100}
          />
          <textarea
            className="sc-input sc-input--textarea"
            placeholder="Write your article content..."
            value={content}
            onChange={e => setContent(e.target.value)}
            maxLength={2000}
            rows={6}
          />
          <div className="sc-compose__actions">
            <span className="sc-compose__count">{content.length}/2000</span>
            <button className="sc-btn sc-btn--primary" onClick={handlePublish}>Publish</button>
          </div>
          {feedback && <div className="sc-feedback">{feedback}</div>}
        </div>
      )}

      <div className="sc-articles__list">
        {sc.articles.map(art => (
          <div key={art.id} className="sc-article-card">
            <div className="sc-article-card__header">
              <div className="sc-article-card__author">
                <CountryFlag iso={art.authorCountry} size={16} />
                <span>{art.authorName}</span>
              </div>
              <span className="sc-article-card__date">{new Date(art.publishedAt).toLocaleDateString()}</span>
            </div>
            <div className="sc-article-card__title">{art.title}</div>
            <div className="sc-article-card__content">{art.content}</div>
            <div className="sc-article-card__footer">
              <button className="sc-btn sc-btn--vote" onClick={() => sc.voteArticle(art.id)}>
                👍 {art.votes}
              </button>
            </div>
          </div>
        ))}
        {sc.articles.length === 0 && <div className="sc-empty">No articles published yet. Be the first!</div>}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   MENTORSHIP TAB
   ═══════════════════════════════════════════════════════════════════ */
function MentorshipTab() {
  const sc = useSocialClubStore()
  const player = usePlayerStore()
  const [feedback, setFeedback] = useState('')

  const canMentor = player.level >= 10
  const canBeMentee = player.level <= 5
  const myMentorships = sc.mentorships.filter(m => m.mentorName === player.name || m.menteeName === player.name)

  const handleRegisterMentor = () => {
    const result = sc.registerAsMentor()
    setFeedback(result.message)
    setTimeout(() => setFeedback(''), 3000)
  }

  const handleRegisterMentee = () => {
    const result = sc.registerAsMentee()
    setFeedback(result.message)
    setTimeout(() => setFeedback(''), 3000)
  }

  const handleSimulateXP = (id: string) => {
    sc.addMentorshipXP(id, 20)
  }

  const handleGraduate = (id: string) => {
    const result = sc.graduateMentorship(id)
    setFeedback(result.message)
    setTimeout(() => setFeedback(''), 5000)
  }

  const handleReferral = (id: string) => {
    const result = sc.setReferral(id)
    setFeedback(result.message)
    setTimeout(() => setFeedback(''), 3000)
  }

  const handleCompleteQuest = (mentorshipId: string, questId: string) => {
    const result = sc.completeQuest(mentorshipId, questId)
    setFeedback(result.message)
    setTimeout(() => setFeedback(''), 3000)
  }

  // Demo: start mentorship with a seeded friend
  const handleStartDemo = () => {
    const friend = sc.friends[0]
    if (!friend) {
      setFeedback('No friends to mentor')
      return
    }
    const result = sc.startMentorship(friend.name, friend.countryCode)
    setFeedback(result.message)
    setTimeout(() => setFeedback(''), 3000)
  }

  return (
    <div className="sc-mentorship">
      <div className="sc-section">
        <div className="sc-section__title">🎓 Mentorship Program</div>
        <div className="sc-section__desc">
          Veterans (Lvl 10+) can mentor newcomers (Lvl 1–5). Complete quests, progress together through 5 levels, and graduate with massive rewards!
        </div>
      </div>

      {/* Registration */}
      <div className="sc-section">
        <div className="sc-section__title">📋 Registration</div>
        <div className="sc-mentorship__actions">
          {canMentor && !sc.isRegisteredMentor && (
            <button className="sc-btn sc-btn--mentor" onClick={handleRegisterMentor}>🎖️ Register as Mentor</button>
          )}
          {sc.isRegisteredMentor && (
            <div className="sc-badge sc-badge--mentor">✅ Registered Mentor</div>
          )}
          {canBeMentee && !sc.isRegisteredMentee && (
            <button className="sc-btn sc-btn--mentee" onClick={handleRegisterMentee}>🌱 Register as Mentee</button>
          )}
          {sc.isRegisteredMentee && (
            <div className="sc-badge sc-badge--mentee">✅ Registered Mentee</div>
          )}
          {!canMentor && !canBeMentee && (
            <div className="sc-section__desc">Level 6–9: Keep growing! At level 10 you can become a mentor.</div>
          )}
          {sc.isRegisteredMentor && (
            <button className="sc-btn sc-btn--primary" onClick={handleStartDemo}>🤝 Start Mentorship (Demo)</button>
          )}
        </div>
        {feedback && <div className="sc-feedback">{feedback}</div>}
      </div>

      {/* Active Mentorships */}
      <div className="sc-section">
        <div className="sc-section__title">📊 Active Mentorships</div>
        {myMentorships.length === 0 && <div className="sc-empty">No active mentorships</div>}
        {myMentorships.map(m => {
          const isMentor = m.mentorName === player.name
          const partnerName = isMentor ? m.menteeName : m.mentorName
          const percent = m.xpToNext > 0 ? Math.min(100, (m.xp / m.xpToNext) * 100) : 100
          const levelLabel = ['', 'Paired', 'Referrals Unlocked', 'Training Together', 'Advanced Partnership', 'Graduation'][m.level] || ''

          // Mentee progression
          const completedQuests = m.quests?.filter(q => q.completed).length || 0
          const totalQuests = m.quests?.length || 7
          const questPercent = Math.round((completedQuests / totalQuests) * 100)

          return (
            <div key={m.id} className={`sc-mentor-card ${m.graduated ? 'sc-mentor-card--graduated' : ''}`}>
              <div className="sc-mentor-card__header">
                <span className="sc-mentor-card__role">{isMentor ? '🎖️ Mentor' : '🌱 Mentee'}</span>
                <span className="sc-mentor-card__partner">
                  <CountryFlag iso={isMentor ? m.menteeCountry : m.mentorCountry} size={14} />
                  {partnerName}
                </span>
                <span className="sc-mentor-card__level">Lvl {m.level}/5</span>
              </div>

              <div className="sc-mentor-card__status">{levelLabel}</div>

              {/* Mentorship Level Bar */}
              {!m.graduated && m.level < 5 && (
                <div className="sc-mentor-card__bar-wrap">
                  <div className="sc-mentor-card__bar">
                    <div className="sc-mentor-card__bar-fill" style={{ width: `${percent}%` }} />
                  </div>
                  <span className="sc-mentor-card__xp">{m.xp}/{m.xpToNext} XP</span>
                </div>
              )}

              {/* Mentee Quest Progression Bar */}
              {!m.graduated && m.quests && m.quests.length > 0 && (
                <div className="sc-quest-progress">
                  <div className="sc-quest-progress__header">
                    <span className="sc-quest-progress__label">📜 Mentee Progress</span>
                    <span className="sc-quest-progress__count">{completedQuests}/{totalQuests} Quests</span>
                  </div>
                  <div className="sc-quest-progress__bar">
                    <div className="sc-quest-progress__bar-fill" style={{ width: `${questPercent}%` }} />
                  </div>
                  <span className="sc-quest-progress__pct">{questPercent}%</span>
                </div>
              )}

              {m.graduated && (
                <div className="sc-mentor-card__graduated-label">🎓 GRADUATED — Rewards Claimed!</div>
              )}

              {/* Actions: Referral always visible, locked if < lvl2 */}
              {!m.graduated && (
                <div className="sc-mentor-card__actions">
                  <button className="sc-btn sc-btn--small" onClick={() => handleSimulateXP(m.id)}>⚡ Co-op (+20 XP)</button>

                  {/* Referral button: always visible, disabled until lvl 2 */}
                  {!m.referralSet && (
                    <button
                      className={`sc-btn sc-btn--small ${m.level >= 2 ? 'sc-btn--accent' : 'sc-btn--locked'}`}
                      onClick={() => m.level >= 2 && handleReferral(m.id)}
                      disabled={m.level < 2}
                      title={m.level < 2 ? 'Unlocks at Level 2' : 'Set your referral link'}
                    >
                      🔗 {m.level < 2 ? 'Referral (Lvl 2)' : 'Set Referral'}
                    </button>
                  )}
                  {m.referralSet && <span className="sc-badge sc-badge--referral">🔗 Referral Active</span>}
                  {m.level >= 5 && (
                    <button className="sc-btn sc-btn--graduate" onClick={() => handleGraduate(m.id)}>🎓 Graduate!</button>
                  )}
                </div>
              )}

              {/* Quests Section */}
              {!m.graduated && m.quests && m.quests.length > 0 && (
                <div className="sc-quests">
                  <div className="sc-quests__title">📋 Initial Quests</div>
                  <div className="sc-quests__list">
                    {m.quests.map(q => (
                      <div key={q.id} className={`sc-quest ${q.completed ? 'sc-quest--done' : ''}`}>
                        <span className="sc-quest__icon">{q.icon}</span>
                        <div className="sc-quest__info">
                          <div className="sc-quest__name">{q.title}</div>
                          <div className="sc-quest__desc">{q.description}</div>
                        </div>
                        <div className="sc-quest__right">
                          <span className="sc-quest__xp">+{q.xpReward} XP</span>
                          {q.completed ? (
                            <span className="sc-quest__check">✅</span>
                          ) : (
                            <button
                              className="sc-btn sc-btn--small sc-btn--primary"
                              onClick={() => handleCompleteQuest(m.id, q.id)}
                            >
                              Complete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Graduation Rewards */}
      <div className="sc-section">
        <div className="sc-section__title">🎁 Graduation Rewards (Level 5)</div>
        <div className="sc-tier-list">
          <div className="sc-tier-row"><span className="sc-tier-row__reward">🏅 Graduation Badge</span></div>
          <div className="sc-tier-row"><span className="sc-tier-row__reward">⚔️ Division Rewards</span></div>
          <div className="sc-tier-row"><span className="sc-tier-row__reward">📦 5 Loot Boxes + 5 Military Boxes</span></div>
          <div className="sc-tier-row"><span className="sc-tier-row__reward">🔧 50k Material X + 50k Oil + 50k Scrap</span></div>
          <div className="sc-tier-row"><span className="sc-tier-row__reward">💰 $500,000</span></div>
          <div className="sc-tier-row"><span className="sc-tier-row__reward">₿ 1 Bitcoin</span></div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   CHAT TAB (Placeholder for Socket.IO)
   ═══════════════════════════════════════════════════════════════════ */
function ChatTab() {
  const [channel, setChannel] = useState<'general' | 'war' | 'trade'>('general')
  const channels = [
    { id: 'general' as const, icon: '💬', label: '#general' },
    { id: 'war' as const, icon: '⚔️', label: '#war' },
    { id: 'trade' as const, icon: '💰', label: '#trade' },
  ]

  return (
    <div className="sc-chat">
      <div className="sc-chat__channels">
        {channels.map(c => (
          <button
            key={c.id}
            className={`sc-chat__channel ${channel === c.id ? 'sc-chat__channel--active' : ''}`}
            onClick={() => setChannel(c.id)}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>
      <div className="sc-chat__messages">
        <div className="sc-chat__placeholder">
          <div className="sc-chat__placeholder-icon">💬</div>
          <div className="sc-chat__placeholder-title">Global Chat Coming Soon</div>
          <div className="sc-chat__placeholder-desc">
            Real-time chat channels powered by Socket.IO will be available in a future update.
            For now, use the Wall and Articles to communicate with other players.
          </div>
        </div>
      </div>
      <div className="sc-chat__input-wrap">
        <input className="sc-input" placeholder={`Message ${channels.find(c => c.id === channel)?.label}...`} disabled />
        <button className="sc-btn sc-btn--primary" disabled>Send</button>
      </div>
    </div>
  )
}
