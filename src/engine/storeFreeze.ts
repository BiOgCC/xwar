// ══════════════════════════════════════════════
// Fix 7: DevTools Store Freeze (Production Only)
// Deters direct state manipulation from browser console.
// ══════════════════════════════════════════════

import { logSuspicion } from './AntiExploit'

/** Critical balance fields that should not be directly set to absurd values */
const CRITICAL_FIELDS = [
  'money', 'bitcoin', 'oil', 'materialX', 'scrap',
  'skillPoints', 'lootBoxes', 'militaryBoxes',
  'greenBullets', 'blueBullets', 'purpleBullets', 'redBullets',
] as const

/** Maximum suspicious threshold per field */
const THRESHOLDS: Record<string, number> = {
  money: 100_000_000,        // $100M
  bitcoin: 10_000,           // 10K btc
  oil: 100_000,              // 100K oil
  materialX: 100_000,        // 100K matX
  scrap: 500_000,            // 500K scrap
  skillPoints: 200,          // 200 SP
  lootBoxes: 500,            // 500 boxes
  militaryBoxes: 200,        // 200 boxes
  greenBullets: 50_000,
  blueBullets: 20_000,
  purpleBullets: 10_000,
  redBullets: 5_000,
}

/**
 * Wrap a zustand store's setState to detect suspicious direct mutations.
 * In production, logs and optionally blocks absurd balance changes.
 * Should be called once per critical store during app initialization.
 */
export function wrapStoreWithIntegrityCheck<T>(
  store: any,
  storeName: string
): void {
  // Only apply in production
  if (import.meta.env.DEV) return

  const originalSetState = store.setState.bind(store)

  store.setState = (partial: any, replace?: boolean) => {
    // If partial is a function, let it through (internal zustand updater)
    if (typeof partial === 'function') {
      originalSetState(partial, replace)
      return
    }

    // Check for suspicious direct field assignments
    if (typeof partial === 'object' && partial !== null) {
      for (const field of CRITICAL_FIELDS) {
        if (field in partial) {
          const newValue = partial[field]
          const threshold = THRESHOLDS[field]
          if (typeof newValue === 'number' && threshold && newValue > threshold) {
            logSuspicion('store_tamper', `${storeName}.${field} set to ${newValue} (threshold: ${threshold})`)
            // Block the suspicious field but allow others
            delete partial[field]
          }
        }
      }
    }

    originalSetState(partial, replace)
  }
}
