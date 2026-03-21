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

// ── Health ───────────────────────────────────────────────────

export async function healthCheck() {
  return api.get<{ status: string; timestamp: string }>('/health')
}
