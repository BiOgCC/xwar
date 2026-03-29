import { create } from 'zustand'
import { usePlayerStore } from './playerStore'
import { useSpecializationStore } from './specializationStore'
import { useNewsStore } from './newsStore'

/* ══════════════════════════════════════════════
   XWAR — Social Club Store
   Friends, Wall, Blood Pact, Mentorship, Articles
   ══════════════════════════════════════════════ */

// ── Types ──────────────────────────────────────────────────────────────────

export interface Friend {
  name: string
  countryCode: string
  addedAt: number
}

export interface FriendRequest {
  id: string
  from: string
  fromCountry: string
  to: string
  sentAt: number
}

export interface WallMessage {
  id: string
  authorName: string
  authorCountry: string
  targetName: string
  message: string
  timestamp: number
}

export interface BloodPact {
  id: string
  player1: string
  player2: string
  level: number          // 1-5
  xp: number
  xpToNext: number
  title: string
  startedAt: number
}

const BLOOD_PACT_LEVELS = [
  { level: 1, xpRequired: 0, title: 'Acquaintance' },
  { level: 2, xpRequired: 100, title: 'Comrade' },
  { level: 3, xpRequired: 350, title: 'Sworn Ally' },
  { level: 4, xpRequired: 800, title: 'Blood Brother' },
  { level: 5, xpRequired: 1500, title: 'Blood Brothers' },
]

export interface MenteeQuest {
  id: string
  icon: string
  title: string
  description: string
  action: string        // game action key
  completed: boolean
  xpReward: number
}

const INITIAL_QUESTS: Omit<MenteeQuest, 'completed'>[] = [
  { id: 'q_work',     icon: '💼', title: 'First Shift',        description: 'Work at a company to earn salary',           action: 'work',     xpReward: 15 },
  { id: 'q_produce',  icon: '🏭', title: 'Production Line',    description: 'Produce goods at a company you own or manage', action: 'produce',  xpReward: 15 },
  { id: 'q_fight',    icon: '⚔️', title: 'Battle Ready',       description: 'Fight in an active war',                      action: 'fight',    xpReward: 20 },
  { id: 'q_eat',      icon: '🍖', title: 'Fuel Up',             description: 'Eat food to restore energy',                  action: 'eat',      xpReward: 10 },
  { id: 'q_cyber',    icon: '🖥️', title: 'Cyber Operative',     description: 'Complete a cyberwarfare operation',           action: 'cyber',    xpReward: 15 },
  { id: 'q_military', icon: '🎖️', title: 'Military Drill',      description: 'Train or upgrade at the military panel',      action: 'military', xpReward: 15 },
  { id: 'q_market',   icon: '📈', title: 'Market Trader',       description: 'Buy or sell on the market',                   action: 'market',   xpReward: 15 },
]

export interface Mentorship {
  id: string
  mentorName: string
  mentorCountry: string
  menteeName: string
  menteeCountry: string
  level: number          // 1-5
  xp: number
  xpToNext: number
  referralSet: boolean   // unlocked at level 2
  graduated: boolean     // true after level 5 graduation
  startedAt: number
  quests: MenteeQuest[]  // 7 initial quests
}

const MENTORSHIP_LEVELS = [
  { level: 1, xpRequired: 0, label: 'Paired' },
  { level: 2, xpRequired: 80, label: 'Referrals Unlocked' },
  { level: 3, xpRequired: 200, label: 'Training Together' },
  { level: 4, xpRequired: 450, label: 'Advanced Partnership' },
  { level: 5, xpRequired: 800, label: 'Graduation' },
]

export interface Article {
  id: string
  authorName: string
  authorCountry: string
  title: string
  content: string
  publishedAt: number
  votes: number
}

// ── Seed Data (no NPCs — real players only) ──────────────────────────────

const SEED_FRIENDS: Friend[] = []

const SEED_WALL: WallMessage[] = []

const SEED_ARTICLES: Article[] = []

// ── Store ──────────────────────────────────────────────────────────────────

export interface SocialClubState {
  // Friends
  friends: Friend[]
  friendRequests: FriendRequest[]
  maxFriends: number

  // Wall
  wallMessages: WallMessage[]

  // Blood Pact
  bloodPacts: BloodPact[]

  // Mentorship
  mentorships: Mentorship[]
  isRegisteredMentor: boolean
  isRegisteredMentee: boolean

  // Articles
  articles: Article[]

  // Actions — Friends
  sendFriendRequest: (targetName: string, targetCountry: string) => { success: boolean; message: string }
  acceptFriendRequest: (requestId: string) => { success: boolean; message: string }
  declineFriendRequest: (requestId: string) => void
  removeFriend: (name: string) => void

  // Actions — Wall
  postToWall: (targetName: string, message: string) => { success: boolean; message: string }

  // Actions — Blood Pact
  initiateBloodPact: (friendName: string) => { success: boolean; message: string }
  addBloodPactXP: (pactId: string, amount: number) => void

  // Actions — Mentorship
  registerAsMentor: () => { success: boolean; message: string }
  registerAsMentee: () => { success: boolean; message: string }
  startMentorship: (menteeName: string, menteeCountry: string) => { success: boolean; message: string }
  addMentorshipXP: (mentorshipId: string, amount: number) => void
  setReferral: (mentorshipId: string) => { success: boolean; message: string }
  graduateMentorship: (mentorshipId: string) => { success: boolean; message: string }
  completeQuest: (mentorshipId: string, questId: string) => { success: boolean; message: string }

  // Actions — Articles
  publishArticle: (title: string, content: string) => { success: boolean; message: string }
  voteArticle: (articleId: string) => void
}

let idCounter = 100

export const useSocialClubStore = create<SocialClubState>((set, get) => ({
  friends: SEED_FRIENDS,
  friendRequests: [],
  maxFriends: 10,

  wallMessages: SEED_WALL,

  bloodPacts: [],

  mentorships: [],
  isRegisteredMentor: false,
  isRegisteredMentee: false,

  articles: SEED_ARTICLES,

  // ═══ FRIENDS ═══

  sendFriendRequest: (targetName, targetCountry) => {
    const state = get()
    const player = usePlayerStore.getState()

    if (state.friends.length >= state.maxFriends) return { success: false, message: 'Friend list is full' }
    if (state.friends.some(f => f.name === targetName)) return { success: false, message: 'Already friends' }
    if (state.friendRequests.some(r => r.to === targetName && r.from === player.name)) return { success: false, message: 'Request already sent' }

    const request: FriendRequest = {
      id: `freq_${++idCounter}`,
      from: player.name,
      fromCountry: player.countryCode,
      to: targetName,
      sentAt: Date.now(),
    }

    set(s => ({ friendRequests: [...s.friendRequests, request] }))
    return { success: true, message: `Friend request sent to ${targetName}` }
  },

  acceptFriendRequest: (requestId) => {
    const state = get()
    const request = state.friendRequests.find(r => r.id === requestId)
    if (!request) return { success: false, message: 'Request not found' }

    const newFriend: Friend = {
      name: request.from,
      countryCode: request.fromCountry,
      addedAt: Date.now(),
    }

    set(s => ({
      friends: [...s.friends, newFriend],
      friendRequests: s.friendRequests.filter(r => r.id !== requestId),
    }))

    return { success: true, message: `${request.from} added as friend!` }
  },

  declineFriendRequest: (requestId) => {
    set(s => ({ friendRequests: s.friendRequests.filter(r => r.id !== requestId) }))
  },

  removeFriend: (name) => {
    set(s => ({
      friends: s.friends.filter(f => f.name !== name),
      bloodPacts: s.bloodPacts.filter(p => p.player1 !== name && p.player2 !== name),
    }))
  },

  // ═══ WALL ═══

  postToWall: (targetName, message) => {
    const player = usePlayerStore.getState()
    const state = get()

    if (!state.friends.some(f => f.name === targetName) && targetName !== player.name) {
      return { success: false, message: 'Can only post on friends\' walls' }
    }
    if (message.trim().length === 0) return { success: false, message: 'Message cannot be empty' }
    if (message.length > 200) return { success: false, message: 'Message too long (max 200 chars)' }

    const wallMsg: WallMessage = {
      id: `wall_${++idCounter}_${Date.now()}`,
      authorName: player.name,
      authorCountry: player.countryCode,
      targetName,
      message: message.trim(),
      timestamp: Date.now(),
    }

    set(s => ({ wallMessages: [wallMsg, ...s.wallMessages].slice(0, 100) }))

    // Influencer XP for wall post
    useSpecializationStore.getState().recordWallPost()

    return { success: true, message: 'Message posted!' }
  },

  // ═══ BLOOD PACT ═══

  initiateBloodPact: (friendName) => {
    const player = usePlayerStore.getState()
    const state = get()

    if (!state.friends.some(f => f.name === friendName)) return { success: false, message: 'Not on your friend list' }
    if (state.bloodPacts.some(p => (p.player1 === player.name && p.player2 === friendName) || (p.player1 === friendName && p.player2 === player.name))) {
      return { success: false, message: 'Blood Pact already exists' }
    }

    const pact: BloodPact = {
      id: `pact_${++idCounter}`,
      player1: player.name,
      player2: friendName,
      level: 1,
      xp: 0,
      xpToNext: BLOOD_PACT_LEVELS[1].xpRequired,
      title: BLOOD_PACT_LEVELS[0].title,
      startedAt: Date.now(),
    }

    set(s => ({ bloodPacts: [...s.bloodPacts, pact] }))
    useNewsStore.getState().pushEvent('alliance', `🩸 ${player.name} and ${friendName} formed a Blood Pact!`)

    return { success: true, message: `Blood Pact with ${friendName} established!` }
  },

  addBloodPactXP: (pactId, amount) => {
    set(s => ({
      bloodPacts: s.bloodPacts.map(p => {
        if (p.id !== pactId || p.level >= 5) return p

        // Apply Influencer bonus
        const infBonus = useSpecializationStore.getState().getInfluencerBonuses().bloodPactXPBonus
        const adjustedAmount = Math.round(amount * (1 + infBonus / 100))

        let newXP = p.xp + adjustedAmount
        let newLevel = p.level
        let newTitle = p.title

        // Check level ups
        while (newLevel < 5) {
          const nextLevelData = BLOOD_PACT_LEVELS[newLevel] // next level entry (index = current level)
          if (!nextLevelData) break
          if (newXP >= nextLevelData.xpRequired - (BLOOD_PACT_LEVELS[newLevel - 1]?.xpRequired || 0)) {
            const overflow = newXP - (nextLevelData.xpRequired - (BLOOD_PACT_LEVELS[newLevel - 1]?.xpRequired || 0))
            newLevel++
            newXP = overflow
            newTitle = BLOOD_PACT_LEVELS[newLevel - 1].title

            // Grant Influencer XP on level up
            useSpecializationStore.getState().recordBloodPactLevelUp()

            if (newLevel >= 5) {
              useNewsStore.getState().pushEvent('alliance', `🩸 Blood Pact between ${p.player1} and ${p.player2} reached MAX LEVEL — Blood Brothers!`)
            }
          } else {
            break
          }
        }

        const nextEntry = BLOOD_PACT_LEVELS[newLevel] || BLOOD_PACT_LEVELS[4]
        const prevEntry = BLOOD_PACT_LEVELS[newLevel - 1] || BLOOD_PACT_LEVELS[0]
        const xpToNext = nextEntry.xpRequired - prevEntry.xpRequired

        return { ...p, xp: newXP, level: newLevel, title: newTitle, xpToNext: newLevel >= 5 ? 0 : xpToNext }
      }),
    }))
  },

  // ═══ MENTORSHIP ═══

  registerAsMentor: () => {
    const player = usePlayerStore.getState()
    if (player.level < 10) return { success: false, message: 'Must be level 10+ to mentor' }
    set({ isRegisteredMentor: true })
    return { success: true, message: 'Registered as mentor! Newcomers can now find you.' }
  },

  registerAsMentee: () => {
    const player = usePlayerStore.getState()
    if (player.level > 5) return { success: false, message: 'Must be level 5 or below to register as mentee' }
    set({ isRegisteredMentee: true })
    return { success: true, message: 'Registered as mentee! Mentors can now pair with you.' }
  },

  startMentorship: (menteeName, menteeCountry) => {
    const player = usePlayerStore.getState()
    const state = get()

    if (!state.isRegisteredMentor) return { success: false, message: 'Not registered as mentor' }

    const infBonuses = useSpecializationStore.getState().getInfluencerBonuses()
    const maxMentees = infBonuses.extraMenteeSlots
    const activeMentorships = state.mentorships.filter(m => m.mentorName === player.name && !m.graduated)
    if (activeMentorships.length >= maxMentees) return { success: false, message: `Max ${maxMentees} active mentees (upgrade Influencer spec for more)` }

    if (state.mentorships.some(m => m.menteeName === menteeName && !m.graduated)) {
      return { success: false, message: `${menteeName} already has an active mentor` }
    }

    const mentorship: Mentorship = {
      id: `ment_${++idCounter}`,
      mentorName: player.name,
      mentorCountry: player.countryCode,
      menteeName,
      menteeCountry,
      level: 1,
      xp: 0,
      xpToNext: MENTORSHIP_LEVELS[1].xpRequired,
      referralSet: false,
      graduated: false,
      startedAt: Date.now(),
      quests: INITIAL_QUESTS.map(q => ({ ...q, completed: false })),
    }

    set(s => ({ mentorships: [...s.mentorships, mentorship] }))
    useNewsStore.getState().pushEvent('alliance', `🎓 ${player.name} is now mentoring ${menteeName}!`)

    return { success: true, message: `Now mentoring ${menteeName}!` }
  },

  addMentorshipXP: (mentorshipId, amount) => {
    const state = get()

    set(s => ({
      mentorships: s.mentorships.map(m => {
        if (m.id !== mentorshipId || m.graduated || m.level >= 5) return m

        let newXP = m.xp + amount
        let newLevel = m.level

        while (newLevel < 5) {
          const nextData = MENTORSHIP_LEVELS[newLevel]
          if (!nextData) break
          const needed = nextData.xpRequired - (MENTORSHIP_LEVELS[newLevel - 1]?.xpRequired || 0)
          if (newXP >= needed) {
            newXP -= needed
            newLevel++

            // Grant Influencer XP on mentee progress
            useSpecializationStore.getState().recordMenteeProgress()
          } else {
            break
          }
        }

        const nextEntry = MENTORSHIP_LEVELS[newLevel] || MENTORSHIP_LEVELS[4]
        const prevEntry = MENTORSHIP_LEVELS[newLevel - 1] || MENTORSHIP_LEVELS[0]
        const xpToNext = nextEntry.xpRequired - prevEntry.xpRequired

        return { ...m, xp: newXP, level: newLevel, xpToNext: newLevel >= 5 ? 0 : xpToNext }
      }),
    }))
  },

  setReferral: (mentorshipId) => {
    const state = get()
    const mentorship = state.mentorships.find(m => m.id === mentorshipId)
    if (!mentorship) return { success: false, message: 'Mentorship not found' }
    if (mentorship.level < 2) return { success: false, message: 'Requires mentorship level 2' }
    if (mentorship.referralSet) return { success: false, message: 'Referral already set' }

    set(s => ({
      mentorships: s.mentorships.map(m =>
        m.id === mentorshipId ? { ...m, referralSet: true } : m
      ),
    }))

    // Grant Influencer XP for referral
    useSpecializationStore.getState().recordReferral()

    return { success: true, message: 'Referral set! Both players benefit from bonus XP.' }
  },

  graduateMentorship: (mentorshipId) => {
    const state = get()
    const mentorship = state.mentorships.find(m => m.id === mentorshipId)
    if (!mentorship) return { success: false, message: 'Mentorship not found' }
    if (mentorship.level < 5) return { success: false, message: 'Requires mentorship level 5 to graduate' }
    if (mentorship.graduated) return { success: false, message: 'Already graduated' }

    // Mark graduated
    set(s => ({
      mentorships: s.mentorships.map(m =>
        m.id === mentorshipId ? { ...m, graduated: true } : m
      ),
    }))

    // Grant graduation rewards to player
    const player = usePlayerStore.getState()
    player.earnMoney(500_000)
    set(s => {
      // Add bitcoin via playerStore
      const ps = usePlayerStore.getState()
      usePlayerStore.setState({
        bitcoin: ps.bitcoin + 1,
        lootBoxes: ps.lootBoxes + 5,
        militaryBoxes: ps.militaryBoxes + 5,
        materialX: ps.materialX + 50_000,
        oil: ps.oil + 50_000,
        scrap: ps.scrap + 50_000,
      })
      return {}
    })

    useNewsStore.getState().pushEvent('alliance',
      `🎓 GRADUATION! ${mentorship.mentorName} & ${mentorship.menteeName} completed their mentorship! Both received rewards!`
    )

    return { success: true, message: '🎓 Graduated! Rewards claimed: $500k, 1 BTC, 5 loot boxes, 5 military boxes, 50k materials!' }
  },

  completeQuest: (mentorshipId, questId) => {
    const state = get()
    const mentorship = state.mentorships.find(m => m.id === mentorshipId)
    if (!mentorship) return { success: false, message: 'Mentorship not found' }
    if (mentorship.graduated) return { success: false, message: 'Already graduated' }

    const quest = mentorship.quests.find(q => q.id === questId)
    if (!quest) return { success: false, message: 'Quest not found' }
    if (quest.completed) return { success: false, message: 'Quest already completed' }

    // Mark quest completed and award XP to the mentorship
    set(s => ({
      mentorships: s.mentorships.map(m => {
        if (m.id !== mentorshipId) return m
        const updatedQuests = m.quests.map(q =>
          q.id === questId ? { ...q, completed: true } : q
        )
        return { ...m, quests: updatedQuests }
      }),
    }))

    // Add quest XP to the mentorship progression
    get().addMentorshipXP(mentorshipId, quest.xpReward)

    return { success: true, message: `Quest "${quest.title}" completed! +${quest.xpReward} XP` }
  },

  // ═══ ARTICLES ═══

  publishArticle: (title, content) => {
    const player = usePlayerStore.getState()

    if (title.trim().length === 0) return { success: false, message: 'Title cannot be empty' }
    if (title.length > 100) return { success: false, message: 'Title too long (max 100 chars)' }
    if (content.trim().length === 0) return { success: false, message: 'Content cannot be empty' }
    if (content.length > 2000) return { success: false, message: 'Content too long (max 2000 chars)' }

    const article: Article = {
      id: `art_${++idCounter}_${Date.now()}`,
      authorName: player.name,
      authorCountry: player.countryCode,
      title: title.trim(),
      content: content.trim(),
      publishedAt: Date.now(),
      votes: 0,
    }

    set(s => ({ articles: [article, ...s.articles].slice(0, 50) }))

    // Influencer XP for publishing
    useSpecializationStore.getState().recordArticlePublish()

    useNewsStore.getState().pushEvent('system', `📰 ${player.name} published: "${title}"`)

    return { success: true, message: 'Article published!' }
  },

  voteArticle: (articleId) => {
    set(s => ({
      articles: s.articles.map(a =>
        a.id === articleId ? { ...a, votes: a.votes + 1 } : a
      ),
    }))
  },
}))
