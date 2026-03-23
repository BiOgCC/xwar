/**
 * Shared Ley Line types used by GameMap, RegionPanel, and stores.
 */

export type NodeOwnershipState = 'self' | 'ally' | 'enemy' | 'neutral' | 'unowned'

export interface LeyLineNodeProperties {
  regionId: string
  lineId: string
  archetype: 'prosperity' | 'dominion' | 'convergence'
  archetypeColor: string
  ownershipState: NodeOwnershipState
  ownerCountry: string | null
  isLineActive: boolean
  isLineCritical: boolean
}

/** Colors per ownership state — single source of truth for map & panel */
export const OWNERSHIP_COLORS: Record<NodeOwnershipState, string> = {
  self:    '#4ade80', // green
  ally:    '#60a5fa', // blue
  enemy:   '#f87171', // red
  neutral: '#facc15', // yellow
  unowned: '#6b7280', // gray
}
