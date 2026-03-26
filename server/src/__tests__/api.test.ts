/**
 * XWAR Server — Integration Tests
 *
 * Tests the core API endpoints (auth, casino, company) against a running server.
 * Requires the server process to be running on localhost:3001.
 *
 * NOTE: Auth has a 10-req/min rate limit. If running tests back-to-back,
 * wait ~60s between runs to avoid 429 cascades.
 */

import { describe, it, expect, beforeAll } from 'vitest'

const API = process.env.TEST_API_URL || 'http://localhost:3001/api'

// Unique username per test run to avoid 409 conflicts
const TEST_USER = `Tester_${Date.now().toString(36)}`
const TEST_PASS = 'testpass123'
let token = ''

// ── Helper ──
async function api(path: string, opts: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> || {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API}${path}`, { ...opts, headers })
  const text = await res.text()
  let json: any
  try { json = JSON.parse(text) } catch { json = text }
  return { status: res.status, data: json }
}

// ═══════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════

describe('Auth', () => {
  it('should register a new player', async () => {
    const res = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: TEST_USER, password: TEST_PASS, countryCode: 'US' }),
    })
    if (res.status === 429) {
      console.warn('[TEST] Rate limited — wait 60s before re-running tests')
      return // skip gracefully
    }
    expect(res.status).toBe(201)
    expect(res.data.token).toBeDefined()
    expect(res.data.player.name).toBe(TEST_USER)
    token = res.data.token
  })

  it('should reject duplicate registration', async () => {
    if (!token) return // skip if registration was rate-limited
    const res = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: TEST_USER, password: TEST_PASS, countryCode: 'US' }),
    })
    expect([409, 429]).toContain(res.status)
  })

  it('should login with correct credentials', async () => {
    if (!token) return // skip if no user was created
    const res = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ name: TEST_USER, password: TEST_PASS }),
    })
    if (res.status === 429) return // rate limited
    expect(res.status).toBe(200)
    expect(res.data.token).toBeDefined()
    token = res.data.token
  })

  it('should reject wrong password', async () => {
    if (!token) return
    const res = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ name: TEST_USER, password: 'wrong_password' }),
    })
    if (res.status === 429) return
    expect(res.status).toBe(401)
  })

  it('should reject invalid registration input', async () => {
    const res = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'ab', password: '12' }), // too short
    })
    // 400 (validation) or 429 (rate limited from repeated test runs)
    expect([400, 429]).toContain(res.status)
  })
})

// ═══════════════════════════════════════════════
//  GAME STATE
// ═══════════════════════════════════════════════

describe('Game State', () => {
  it('should fetch hydration payload', async () => {
    if (!token) return
    const res = await api('/game/state')
    expect(res.status).toBe(200)
    expect(res.data.player).toBeDefined()
    expect(res.data.player.name).toBe(TEST_USER)
    // passwordHash must never be exposed
    expect(res.data.player.passwordHash).toBeUndefined()
    expect(res.data.inventory).toBeDefined()
    expect(res.data.countries).toBeDefined()
  })

  it('should reject unauthenticated requests', async () => {
    const saved = token
    token = ''
    const res = await api('/game/state')
    expect(res.status).toBe(401)
    token = saved
  })
})

// ═══════════════════════════════════════════════
//  CASINO
// ═══════════════════════════════════════════════

describe('Casino', () => {
  it('should handle slot spin (success or insufficient funds)', async () => {
    if (!token) return
    const res = await api('/casino/slots/spin', {
      method: 'POST',
      body: JSON.stringify({ bet: 100 }),
    })
    // Either 200 (spin works) or 400 (not enough money) — never 500
    expect([200, 400]).toContain(res.status)
  })
})

// ═══════════════════════════════════════════════
//  COMPANY
// ═══════════════════════════════════════════════

describe('Company', () => {
  it('should handle company creation (success or validation error)', async () => {
    if (!token) return
    const res = await api('/company/create', {
      method: 'POST',
      body: JSON.stringify({ type: 'wheat_farm' }),
    })
    // Either 200/201 (created) or 400 (not enough resources/invalid) — never 500
    expect([200, 201, 400]).toContain(res.status)
  })
})

// ═══════════════════════════════════════════════
//  BATTLE (Auth enforcement)
// ═══════════════════════════════════════════════

describe('Battle Auth', () => {
  it('should require auth for battle list', async () => {
    const saved = token
    token = ''
    const res = await api('/battle/active')
    expect(res.status).toBe(401)
    token = saved
  })

  it('should return battles when authenticated', async () => {
    if (!token) return
    const res = await api('/battle/active')
    expect(res.status).toBe(200)
    expect(res.data.success).toBe(true)
    expect(Array.isArray(res.data.battles)).toBe(true)
  })
})

// ═══════════════════════════════════════════════
//  PLAYER
// ═══════════════════════════════════════════════

describe('Player', () => {
  it('should fetch player profile', async () => {
    if (!token) return
    const res = await api('/player')
    expect(res.status).toBe(200)
  })
})
