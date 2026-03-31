/**
 * XWAR API Client
 * Centralized HTTP client for all backend calls.
 * Automatically injects JWT token and handles errors.
 */

import { socketManager } from './socket'

const API_BASE = 'http://localhost:3001/api'

let authToken: string | null = null

/** Set the JWT token (called after login/register) */
export function setAuthToken(token: string | null) {
  authToken = token
  if (token) {
    localStorage.setItem('xwar_token', token)
    socketManager.connect()
  } else {
    localStorage.removeItem('xwar_token')
    socketManager.disconnect()
  }
}

/** Get the current JWT token */
export function getAuthToken(): string | null {
  if (!authToken) {
    authToken = localStorage.getItem('xwar_token')
  }
  return authToken
}

/** Check if user is authenticated */
export function isAuthenticated(): boolean {
  return !!getAuthToken()
}

/** Clear auth state (logout) */
export function logout() {
  setAuthToken(null)
}

/** API Error class with status and server message */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Core fetch wrapper with auth headers and error handling */
async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Unknown error' }))

    // ── Auto-logout on expired/invalid token ──
    if (res.status === 401 && authToken) {
      console.warn('[API] 401 received — clearing stale token')
      logout()
      // Lazy-import to avoid circular dep
      import('../stores/authStore').then(({ useAuthStore }) => useAuthStore.getState().logout())
    }

    throw new ApiError(res.status, body.error || 'Request failed', body.details)
  }

  return res.json()
}

// ── Convenience methods ──────────────────────────────────────

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),

  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string) =>
    apiFetch<T>(path, { method: 'DELETE' }),
}

// ── Auth API ─────────────────────────────────────────────────

export interface AuthResponse {
  token: string
  player: { id: string; name: string }
}

export interface ChatMessageDto {
  id: string
  channel: 'global' | 'country' | 'alliance' | 'whisper'
  sender: string
  senderCountry: string
  senderAvatar?: string | null
  content: string
  timestamp: number
}

export async function register(name: string, password: string, countryCode: string = 'US'): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/register', { name, password, countryCode })
  setAuthToken(res.token)
  return res
}

export async function login(name: string, password: string): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/login', { name, password })
  setAuthToken(res.token)
  return res
}

// ── Chat API ─────────────────────────────────────────────────

export async function getChatBootstrap() {
  return api.get<{
    success: boolean
    allianceId: string | null
    messages: Record<'global' | 'country' | 'alliance' | 'whisper', ChatMessageDto[]>
  }>('/chat/bootstrap')
}

export async function sendChatMessage(channel: 'global' | 'country' | 'alliance', content: string) {
  return api.post<{ success: boolean; message: ChatMessageDto }>('/chat/message', { channel, content })
}

// ── Player API ───────────────────────────────────────────────

export async function getPlayer() {
  return api.get<Record<string, unknown>>('/player')
}

export async function setAvatar(avatar: string) {
  return api.patch('/player/avatar', { avatar })
}

export async function equipAmmo(type: string) {
  return api.patch('/player/ammo', { type })
}

export async function eatFood(type: string) {
  return api.post('/player/eat', { type })
}

export async function doWork() {
  return api.post('/player/work')
}

// ── Daily Rewards API ──────────────────────────────────────────

export async function getDailyStatus() {
  return api.get<any>('/daily/status')
}

export async function claimDailyReward() {
  return api.post<any>('/daily/claim')
}

// ── Naval API ──────────────────────────────────────────────────

export async function getActiveNavalOps() {
  return api.get<{ success: boolean; operations: any[] }>('/naval/active')
}

export async function initiateNavalOp(originRegion: string, targetRegion: string, warshipId: string) {
  return api.post<{ success: boolean; operationId: string; message: string }>('/naval/initiate', { originRegion, targetRegion, warshipId })
}

export async function joinNavalOp(opId: string) {
  return api.post<{ success: boolean; message: string; playersJoined: string[] }>(`/naval/join/${opId}`)
}

export async function launchNavalOp(opId: string) {
  return api.post<{ success: boolean; message: string }>(`/naval/launch/${opId}`)
}

// ── Inventory API ────────────────────────────────────────────

export async function getInventory(location?: string) {
  const query = location ? `?location=${location}` : ''
  return api.get<{ items: unknown[] }>(`/inventory${query}`)
}

export async function equipItem(itemId: string) {
  return api.post(`/inventory/equip/${itemId}`)
}

export async function unequipItem(itemId: string) {
  return api.post(`/inventory/unequip/${itemId}`)
}

export async function dismantleItem(itemId: string) {
  return api.post(`/inventory/dismantle/${itemId}`)
}

export async function openBox(boxType: 'loot' | 'military') {
  return api.post('/inventory/open-box', { boxType })
}

export async function sellItem(itemId: string) {
  return api.post(`/inventory/sell/${itemId}`)
}

export interface ClaimWelcomeKitResponse {
  success: boolean
  itemCount: number
  items: unknown[]
  xpGranted: number
  resourceGrants: Record<string, number>
  error?: string
}

export async function claimWelcomeKit() {
  return api.post<ClaimWelcomeKitResponse>('/inventory/claim-welcome-kit')
}

export async function craftItem(tier: string, slot: string, category: string) {
  return api.post<any>('/inventory/craft', { tier, slot, category })
}

export async function badgePurchase(tier: string) {
  return api.post<{ success: boolean; item: any; badgeCost: number }>('/inventory/badge-purchase', { tier })
}

// ── Skills API ──────────────────────────────────────────────

export async function getMySkills() {
  return api.get<{ success: boolean; skills: any; availablePoints: number }>('/skills/my-skills')
}

export async function upgradeSkill(skill: string) {
  return api.post<{ success: boolean; message: string }>('/skills/upgrade', { skill })
}

export async function getSpecialization() {
  return api.get<{ success: boolean; specialization: any }>('/skills/specialization')
}

export async function grantSpecializationApi(specType: string, xp: number) {
  return api.post<{ success: boolean; specType: string; xp: number; tier: number; message: string }>('/skills/specialization/grant', { specType, xp })
}

// ── World API ────────────────────────────────────────────────

export async function getCountries() {
  return api.get<{ countries: unknown[] }>('/world/countries')
}

export async function getWars() {
  return api.get<{ wars: unknown[] }>('/world/wars')
}

export async function getDeposits() {
  return api.get<{ deposits: unknown[] }>('/world/deposits')
}

// ── Research API ─────────────────────────────────────────────

export async function getResearch(countryCode: string) {
  return api.get<{ success: boolean; research: { military: string[]; economy: string[] }; activeResearch: any; nodes: any }>(`/research/${countryCode}`)
}
export async function selectResearchApi(countryCode: string, tree: 'military' | 'economy', nodeId: string) {
  return api.post<{ success: boolean; message: string; activeResearch: any }>('/research/select', { countryCode, tree, nodeId })
}
export async function contributeRPApi(rp: number, source?: string) {
  return api.post<{ success: boolean; completed?: boolean; rpCollected?: number; rpRequired?: number; progress?: number; message?: string }>('/research/contribute', { rp, source })
}


// ── Autodefense API ──────────────────────────────────────────

export async function setCountryAutoDefense(countryCode: string, limit: number) {
  return api.patch('/gov/autodefense', { countryCode, limit })
}


// ── Government Fund & Law API ────────────────────────────────

export async function donateToCountryFund(countryCode: string, resource: string, amount: number) {
  return api.post<{ success: boolean; message: string }>('/gov/donate', { countryCode, resource, amount })
}

export async function startEnrichmentApi(countryCode: string) {
  return api.post<{ success: boolean; message: string; enrichmentStartedAt?: string; enrichmentCompletedAt?: string }>('/gov/start-enrichment', { countryCode })
}

export async function launchNukeApi(countryCode: string, targetCode: string) {
  return api.post<{ success: boolean; message: string }>('/gov/nuke', { countryCode, targetCode })
}

export async function authorizeNukeApi(countryCode: string) {
  return api.post<{ success: boolean; message: string }>('/gov/authorize-nuke', { countryCode })
}

export async function proposeLawApi(countryCode: string, lawType: string, targetCountryId?: string, newValue?: number) {
  return api.post<{ success: boolean; message: string; proposal?: any }>('/gov/propose-law', { countryCode, lawType, targetCountryId, newValue })
}

export async function voteLawApi(countryCode: string, proposalId: string, vote: 'for' | 'against') {
  return api.post<{ success: boolean; message: string }>('/gov/vote-law', { countryCode, proposalId, vote })
}

export async function setSwornEnemyApi(countryCode: string, enemyCode: string) {
  return api.post<{ success: boolean; message: string }>('/gov/set-enemy', { countryCode, enemyCode })
}

// ── Military Unit (Guild) API ────────────────────────────────

export async function muCreateApi(name: string, regionId?: string) {
  return api.post<{ success: boolean; message: string; unitId?: string }>('/mu/create', { name, regionId })
}
export async function muJoinApi(unitId: string) {
  return api.post<{ success: boolean; message: string }>('/mu/join', { unitId })
}
export async function muLeaveApi() {
  return api.post<{ success: boolean; message: string }>('/mu/leave', {})
}
export async function muDonateApi(unitId: string, currency: string, amount: number, message?: string) {
  return api.post<{ success: boolean; message: string }>('/mu/donate', { unitId, currency, amount, message })
}
export async function muDistributeApi(unitId: string, resourceId: string, amount: number) {
  return api.post<{ success: boolean; message: string }>('/mu/distribute', { unitId, resourceId, amount })
}
export async function muUpgradeApi(unitId: string, track: string) {
  return api.post<{ success: boolean; message: string }>('/mu/upgrade', { unitId, track })
}
export async function muPromoteApi(unitId: string, targetPlayerId: string) {
  return api.post<{ success: boolean; message: string }>('/mu/promote', { unitId, targetPlayerId })
}
export async function muDemoteApi(unitId: string, targetPlayerId: string) {
  return api.post<{ success: boolean; message: string }>('/mu/demote', { unitId, targetPlayerId })
}
export async function muRecordDamageApi(unitId: string, playerName: string, damage: number) {
  return api.post<{ success: boolean }>('/mu/record-damage', { unitId, playerName, damage })
}
export async function muListApi(country?: string) {
  return api.get<{ success: boolean; units: any[] }>(`/mu/list${country ? `?country=${country}` : ''}`)
}
export async function muGetApi(unitId: string) {
  return api.get<{ success: boolean; unit: any }>(`/mu/${unitId}`)
}
export async function muPlayerUnitApi() {
  return api.get<{ success: boolean; unit: any; membership: any }>('/mu/player-unit')
}

// ── Election API ─────────────────────────────────────────────
export async function getElectionApi(countryCode: string) {
  return api.get<{ success: boolean; election: any }>(`/gov/election/${countryCode}`)
}
export async function registerCandidateApi(countryCode: string) {
  return api.post<{ success: boolean; message: string }>('/gov/register-candidate', { countryCode })
}
export async function voteElectionApi(countryCode: string, candidateId: string) {
  return api.post<{ success: boolean; message: string }>('/gov/vote', { countryCode, candidateId })
}

// ── Player Actions API ───────────────────────────────────────
// NOTE: eatFood(), equipAmmo() defined above are the canonical exports.
// Use those instead of duplicated *Api variants.

export async function attackApi() {
  return api.post('/player/attack')
}

export async function entrepreneurshipApi() {
  return api.post<{ success: boolean; productionBar: number; entrepreneurship: number }>('/player/entrepreneurship')
}
export async function produceApi() {
  return api.post<{ success: boolean; xpGain: number; itemsProduced: number }>('/player/produce')
}
export async function magicTeaApi() {
  return api.post<{ success: boolean; magicTea: number; buffUntil: number; debuffUntil: number }>('/player/magic-tea')
}

/** Kept as alias — stores import this by name */
export const eatFoodApi = eatFood

/** Kept as alias — stores import this by name */
export const equipAmmoApi = equipAmmo

export async function consumeBarApi(bar: string, amount: number) {
  return api.post('/player/consume-bar', { bar, amount })
}

export async function switchCountryApi(countryCode: string) {
  return api.patch('/player/country', { countryCode })
}

export async function allocateSkillsApi(tree: 'military' | 'economic', skill: string) {
  return api.post('/player/skills', { tree, skill })
}

export async function getAllPlayers() {
  return api.get<{ players: unknown[] }>('/player/all')
}

// ── Casino API ───────────────────────────────────────────────

export async function casinoSpinSlots(bet: number) {
  return api.post('/casino/slots/spin', { bet })
}

export async function casinoBjStart(bet: number) {
  return api.post('/casino/blackjack/start', { bet })
}

export async function casinoBjHit() {
  return api.post('/casino/blackjack/hit')
}

export async function casinoBjStand() {
  return api.post('/casino/blackjack/stand')
}

export async function casinoCrashBet(bet: number) {
  return api.post('/casino/crash/bet', { bet })
}

export async function casinoCrashCashout(multiplier: number) {
  return api.post('/casino/crash/cashout', { multiplier })
}

export async function casinoCrashReport() {
  return api.post('/casino/crash/report-crash')
}

export async function casinoWheelSpin(bet: number) {
  return api.post('/casino/wheel/spin', { bet })
}

// ── Battle API ───────────────────────────────────────────────

export async function getActiveBattles() {
  return api.get<{ success: boolean; battles: unknown[] }>('/battle/active')
}

export async function getBattle(battleId: string) {
  return api.get<{ success: boolean; battle: unknown }>(`/battle/${battleId}`)
}

export async function launchBattle(attackerCode: string, defenderCode: string, regionName: string, type?: string) {
  return api.post<{ success: boolean; message: string; battleId?: string }>('/battle/launch', { attackerCode, defenderCode, regionName, type: type || 'invasion' })
}

export interface BattleAttackResult {
  success: boolean
  damage: number
  isCrit: boolean
  isMiss: boolean
  isDodged: boolean
  side: 'attacker' | 'defender'
  message: string
  staminaLeft: number
  adrenaline: number
}

export async function battleAttack(battleId: string, side?: 'attacker' | 'defender') {
  return api.post<BattleAttackResult>(`/battle/${battleId}/attack`, side ? { side } : undefined)
}

export async function battleDefend(battleId: string) {
  return api.post(`/battle/${battleId}/defend`)
}

export async function battleSurge(battleId: string) {
  return api.post<{ success: boolean; message: string; adrenaline: number }>(`/battle/${battleId}/surge`)
}

export async function battleAdrenaline(battleId: string) {
  return api.get<{ success: boolean; adrenaline: number; isSurging: boolean; isCrashed: boolean }>(`/battle/${battleId}/adrenaline`)
}

export async function setBattleOrder(battleId: string, side: 'attacker' | 'defender', order: string) {
  return api.post(`/battle/${battleId}/order`, { side, order })
}

export async function battleMissile(battleId: string, side: 'attacker' | 'defender') {
  return api.post<{ success: boolean; message: string; damage?: number }>(`/battle/${battleId}/missile`, { side })
}

export async function battleMercenary(battleId: string, side: 'attacker' | 'defender', ratePerHit: number, totalPool: number) {
  return api.post<{ success: boolean; message: string }>(`/battle/${battleId}/mercenary`, { side, ratePerHit, totalPool })
}

// ── Cyber API ────────────────────────────────────────────────

export async function getCyberBoards() {
  return api.get<any>('/cyber/boards')
}

export async function cyberContribute(operationType: string) {
  return api.post('/cyber/contribute', { operationType })
}

export async function cyberLaunch(operationType: string, targetCountry?: string, targetRegion?: string, targetPlayer?: string) {
  return api.post('/cyber/launch', { operationType, targetCountry, targetRegion, targetPlayer })
}

export async function getCyberActive() {
  return api.get<{ success: boolean; operations: any[] }>('/cyber/active')
}

export async function getCyberReports() {
  return api.get<{ success: boolean; reports: any[] }>('/cyber/reports')
}

export async function getCyberEffects(countryCode: string) {
  return api.get<{ success: boolean; effects: any[] }>(`/cyber/effects/${countryCode}`)
}

export async function getCyberStats() {
  return api.get<any>('/cyber/stats')
}

export async function getCyberOps() {
  return api.get<any>('/cyber/ops')
}

export async function puzzleStart(cyberOpId: string, side: 'attacker' | 'defender') {
  return api.post('/cyber/puzzle/start', { cyberOpId, side })
}

export async function puzzleMove(attemptId: string, action: any) {
  return api.post('/cyber/puzzle/move', { attemptId, action })
}

export async function sabotageContribute(cyberOpId: string, side: 'attacker' | 'defender') {
  return api.post('/cyber/sabotage/contribute', { cyberOpId, side })
}

export async function sabotageRace(opId: string) {
  return api.get<any>(`/cyber/sabotage/race/${opId}`)
}

// ── Daily Rewards API (aliases) ──────────────────────────────
// Canonical: getDailyStatus() and claimDailyReward() above.
export const getDailyStatusApi = getDailyStatus
export const claimDailyApi = claimDailyReward


// ── Prestige API ─────────────────────────────────────────────

export async function getPrestigeRankings(week?: number) {
  const query = week ? `?week=${week}` : ''
  return api.get<{ success: boolean; rankings: any[]; prestigePlayers: any[]; currentWeek: number }>(`/prestige/rankings${query}`)
}

export async function getPrestigeArchive(week: number) {
  return api.get<{ success: boolean; archive: any[] }>(`/prestige/archive/${week}`)
}

export async function getPrestigeItems(playerId?: string) {
  const query = playerId ? `?playerId=${playerId}` : ''
  return api.get<{ success: boolean; items: any[]; blueprints: any[] }>(`/prestige/items${query}`)
}

export async function createPrestigeBlueprint() {
  return api.post<{ success: boolean; message: string; blueprint?: any }>('/prestige/blueprint/create')
}

export async function craftPrestigeItem(blueprintId: string) {
  return api.post<{ success: boolean; message: string; item?: any }>('/prestige/craft', { blueprintId })
}

export async function listPrestigeBlueprintOnMarket(blueprintId: string, price: number) {
  return api.post<{ success: boolean; message: string }>('/prestige/blueprint/list', { blueprintId, price })
}

export async function buyPrestigeBlueprint(blueprintId: string) {
  return api.post<{ success: boolean; message: string }>('/prestige/blueprint/buy', { blueprintId })
}


// ── Citizens API (Playerbase) ────────────────────────────────

export interface CitizenInfo {
  id: string
  name: string
  level: number
  role: string
  avatar: string
  damageDone: number
  joinedAt: number
}

export async function getCitizens(countryCode: string) {
  return api.get<{ success: boolean; citizens: CitizenInfo[]; population: number }>(`/gov/citizens/${countryCode}`)
}

// ── Health ───────────────────────────────────────────────────

export async function healthCheck() {
  return api.get<{ status: string; timestamp: string }>('/health')
}

// ── Region API ──────────────────────────────────────────────

export async function getRegions() {
  return api.get<{ success: boolean; regions: any[] }>('/regions')
}

export async function transferRegion(regionId: string, targetCountry: string) {
  return api.post<{ success: boolean; message: string }>(`/regions/${regionId}/transfer`, { targetCountry })
}

export async function buildRegionInfrastructure(regionId: string, infraKey: string, action: 'build' | 'toggle' = 'build') {
  return api.post<{ success: boolean; message: string; newLevel?: number; infraEnabled?: Record<string, boolean> }>(
    `/regions/${regionId}/infrastructure`, { infraKey, action }
  )
}

// ── Bounty API ──────────────────────────────────────────────

export async function getActiveBounties() {
  return api.get<{ success: boolean; bounties: any[] }>('/bounty/active')
}

export async function placeBounty(targetName: string, reward: number, reason?: string) {
  return api.post<{ success: boolean; bounty: any; message: string }>('/bounty/place', { targetName, reward, reason })
}

export async function claimBounty(bountyId: string) {
  return api.post<{ success: boolean; reward: number; message: string }>('/bounty/claim', { bountyId })
}

export async function subscribeBounty(bountyId: string) {
  return api.post<{ success: boolean; message: string }>(`/bounty/subscribe/${bountyId}`, {})
}

export async function unsubscribeBounty(bountyId: string) {
  return api.post<{ success: boolean; message: string }>(`/bounty/unsubscribe/${bountyId}`, {})
}

// ── Trade Route API ─────────────────────────────────────────

export async function getTradeRoutes() {
  return api.get<{ success: boolean; routes: any[] }>('/trade-routes')
}

export async function disruptTradeRoute(routeId: string, durationMinutes = 30, reason = 'naval disruption') {
  return api.post<{ success: boolean; routeId: string; disruptedUntil: string }>('/trade-routes/disrupt', { routeId, durationMinutes, reason })
}

export async function targetTradeRoute(routeId: string) {
  return api.post<{ success: boolean; routeId: string; marked: boolean }>('/trade-routes/target', { routeId })
}

export async function getTradeRouteIncome() {
  return api.get<{ success: boolean; totalMoney: number; totalOil: number; routes: any[] }>('/trade-routes/income')
}

// ── Raid API ────────────────────────────────────────────────

export async function getActiveRaid() {
  return api.get<{ success: boolean; event: any; participants: any[] }>('/raid/active')
}

export async function raidAttack(eventId: string) {
  return api.post<{ success: boolean; damage: number; isCrit: boolean; message: string }>('/raid/attack', { eventId })
}

export async function fundRaid(eventId: string, amount: number) {
  return api.post<{ success: boolean; funded: number; bossDmg: number; message: string }>('/raid/fund', { eventId, amount })
}

export async function getRaidHistory() {
  return api.get<{ success: boolean; events: any[] }>('/raid/history')
}

// ── Ley Line API ────────────────────────────────────────────

export async function getLeyLines() {
  return api.get<{ success: boolean; lines: any[] }>('/ley-lines')
}

export async function getLeyLinesByCountry(countryCode: string) {
  return api.get<{ success: boolean; lines: any[] }>(`/ley-lines/country/${countryCode}`)
}

export async function getLeyLinesByRegion(regionId: string) {
  return api.get<{ success: boolean; lines: any[] }>(`/ley-lines/region/${regionId}`)
}

export async function getLeyLineDefs() {
  return api.get<{ success: boolean; defs: any[] }>('/ley-lines/defs')
}

export async function getLeyLineDetail(lineId: string) {
  return api.get<{ success: boolean; line: any }>(`/ley-lines/${lineId}`)
}
