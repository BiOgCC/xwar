// ══════════════════════════════════════════════════════════════════
// DEPRECATED — Re-exports from market/ module for backward compat
// All logic now lives in ./market/
// ══════════════════════════════════════════════════════════════════
export {
  useMarketStore,
  RESOURCE_DEFS,
  RESOURCE_BY_KEY,
  TAX_RATE,
  LISTING_FEE_RATE,
  ORDER_EXPIRY_MS,
  MIN_EQUIP_PRICE,
  MAX_TRADES_HISTORY,
} from './market'

export type {
  ResourceId,
  ResourceDef,
  MarketTicker,
  OrderItemType,
  OrderSource,
  MarketOrder,
  TradeRecord,
  MarketState,
} from './market'
