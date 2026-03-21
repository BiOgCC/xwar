/**
 * News Helper — single function to insert news events from anywhere in the server.
 */
import { db } from '../db/connection.js'
import { newsEvents } from '../db/schema.js'

export type NewsType =
  | 'battle_started' | 'battle_won' | 'region_captured'
  | 'election_result' | 'law_passed' | 'nuke_launched'
  | 'cyber_attack' | 'alliance_war' | 'bounty_claimed'
  | 'company_nationalized' | 'fund_snapshot' | 'general'

export async function insertNews(
  type: NewsType,
  headline: string,
  body?: string,
  countryCode?: string,
  data?: Record<string, any>,
) {
  try {
    await db.insert(newsEvents).values({
      type,
      headline,
      body: body ?? null,
      countryCode: countryCode ?? null,
      data: data ?? {},
    })
  } catch (err) {
    console.error('[NEWS] Failed to insert news event:', err)
  }
}
