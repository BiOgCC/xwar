// ══════════════════════════════════════════════════════════════════
// Feature Flags — toggle major game systems on/off
// ══════════════════════════════════════════════════════════════════

/**
 * Division system: army management, division combat ticks, recruitment,
 * star quality, equipment mapping, division marketplace, armed forces.
 *
 * When false:
 * - Division UI tabs/panels are hidden
 * - Automated division combat ticks are skipped
 * - Training ticks are skipped
 * - Government shop division spawning is skipped
 * - Attack hook skips army lookup (goes straight to personal PvP)
 * - Army store stays alive (no cascading breakage) but is inert
 *
 * Set to true to re-enable everything.
 */
export const ENABLE_DIVISIONS = false
