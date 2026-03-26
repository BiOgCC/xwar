/**
 * XWAR State Hydration
 * Fetches full game state from server and hydrates all zustand stores.
 * Called after login/register to sync local state with server truth.
 */

import { api } from './client'
import { socketManager, startPresenceHeartbeat, stopPresenceHeartbeat } from './socket'

// ── Hydration Function ──

/**
 * Fetch full game state from server and hydrate all stores.
 * Returns true on success, false on failure (offline mode).
 */
export async function hydrateGameState(): Promise<boolean> {
  try {
    const state = await api.get<any>('/game/state')

    // Hydrate player store
    if (state.player) {
      const { usePlayerStore } = await import('../stores/playerStore')
      usePlayerStore.setState((s) => ({
        ...s,
        name: state.player.name,
        countryCode: state.player.countryCode,
        money: state.player.money ?? 0,
        oil: state.player.oil ?? 0,
        scrap: state.player.scrap ?? 0,
        materialX: state.player.materialX ?? 0,
        bitcoin: state.player.bitcoin ?? 0,
        stamina: Number(state.player.stamina ?? 0),
        level: state.player.level ?? 1,
        experience: state.player.experience ?? 0,
        equippedAmmo: state.player.equippedAmmo ?? 'none',
        wheat: state.player.wheat ?? 0,
        fish: state.player.fish ?? 0,
        steak: state.player.steak ?? 0,
        bread: state.player.bread ?? 0,
        sushi: state.player.sushi ?? 0,
        wagyu: state.player.wagyu ?? 0,
        greenBullets: state.player.greenBullets ?? 0,
        blueBullets: state.player.blueBullets ?? 0,
        purpleBullets: state.player.purpleBullets ?? 0,
        redBullets: state.player.redBullets ?? 0,
        lootBoxes: state.player.lootBoxes ?? 0,
        militaryBoxes: state.player.militaryBoxes ?? 0,
        magicTea: state.player.magicTea ?? 0,
        energyLeaves: state.player.energyLeaves ?? 0,
        badgesOfHonor: state.player.badgesOfHonor ?? 0,
        maxStamina: state.player.maxStamina ?? 120,
        hunger: state.player.hunger ?? 6,
        maxHunger: state.player.maxHunger ?? 6,
        work: state.player.work ?? 120,
        maxWork: state.player.maxWork ?? 120,
        entrepreneurship: state.player.entrepreneurship ?? 120,
        maxEntrepreneurship: state.player.maxEntrepreneurship ?? 120,
        skillPoints: state.player.skillPoints ?? 0,
        rank: Number(state.player.rank ?? 1),
        avatar: state.player.avatar ?? '/assets/avatars/avatar_male.png',
        damageDone: state.player.damageDone ?? 0,
        itemsProduced: state.player.itemsProduced ?? 0,
      }))

      // Hydrate skills
      if (state.player.skills) {
        const { useSkillsStore } = await import('../stores/skillsStore')
        useSkillsStore.setState((s) => ({
          ...s,
          ...state.player.skills,
        }))
      }
    }

    // Hydrate battles
    if (state.battles && Object.keys(state.battles).length > 0) {
      const { useBattleStore } = await import('../stores/battleStore')
      useBattleStore.setState({ battles: state.battles })
    }

    // Hydrate world/countries
    if (state.countries) {
      const { useWorldStore } = await import('../stores/worldStore')
      useWorldStore.setState({ countries: state.countries })
    }

    // Hydrate inventory
    if (state.inventory) {
      const { useInventoryStore } = await import('../stores/inventoryStore')
      useInventoryStore.setState({ items: state.inventory })
    }

    // Hydrate government
    if (state.government) {
      const { useGovernmentStore } = await import('../stores/governmentStore')
      useGovernmentStore.setState({ governments: state.government })
    }

    // Hydrate market orders
    if (state.market?.orders) {
      const { useMarketStore } = await import('../stores/market')
      useMarketStore.setState((s) => ({
        ...s,
        orders: state.market.orders,
      }))
    }

    // Hydrate stocks
    if (state.stocks) {
      const { useStockStore } = await import('../stores/stockStore')
      useStockStore.setState((s) => ({
        ...s,
        stocks: state.stocks.map((st: any) => ({
          code: st.countryCode,
          name: st.countryCode,
          price: Number(st.price),
          prevPrice: Number(st.openPrice),
          history: st.history ?? [],
          volume: st.volume ?? 0,
          netBuyVolume: 0,
        })),
        portfolio: (state.holdings ?? []).map((h: any) => ({
          code: h.countryCode,
          shares: h.shares,
          avgBuyPrice: Number(h.buyPrice),
        })),
      }))
    }

    // Hydrate bounties
    if (state.bounties) {
      const { useBountyStore } = await import('../stores/bountyStore')
      useBountyStore.setState({ bounties: state.bounties })
    }

    // Hydrate alliances
    if (state.alliances) {
      const { useAllianceStore } = await import('../stores/allianceStore')
      useAllianceStore.setState({ alliances: state.alliances })
    }

    // Hydrate sea route disruptions from server
    if (state.tradeRoutes) {
      const { useLeyLineStore } = await import('../stores/leyLineStore')
      const disruptions = (state.tradeRoutes as any[])
        .filter((r: any) => r.disruptedUntil && new Date(r.disruptedUntil).getTime() > Date.now())
        .map((r: any) => ({
          routeId: r.routeId,
          expiryMs: new Date(r.disruptedUntil).getTime(),
          reason: r.disruptedReason ?? 'unknown',
        }))
      useLeyLineStore.setState({ disruptions })
    }

    // Hydrate daily rewards
    if (state.daily) {
      const { useDailyRewardStore } = await import('../stores/dailyRewardStore')
      useDailyRewardStore.setState({
        loginStreak: state.daily.loginStreak ?? 0,
        lastClaimedAt: state.daily.lastClaimedAt ?? null,
      })
    }

    // Hydrate news
    if (state.news) {
      const { useNewsStore } = await import('../stores/newsStore')
      useNewsStore.setState({
        events: state.news.map((n: any) => ({
          id: n.id,
          category: n.type ?? 'system',
          message: n.headline ?? '',
          timestamp: new Date(n.createdAt).getTime(),
          icon: '📡',
          color: '#64748b',
        })),
      })
    }

    console.log('[HYDRATE] ✅ Game state synced from server')
    return true
  } catch (error) {
    console.warn('[HYDRATE] ⚠️ Server unreachable — running in offline mode', error)
    return false
  }
}

/**
 * Full initialization sequence after login.
 * Hydrates state, connects WebSocket, starts presence.
 */
export async function initializeMultiplayer(): Promise<{ online: boolean }> {
  // 1. Hydrate game state from server
  const online = await hydrateGameState()

  // 2. Connect WebSocket for real-time updates
  socketManager.connect()

  // 3. Start presence heartbeat
  if (online) {
    startPresenceHeartbeat()
  }

  return { online }
}

/**
 * Cleanup on logout.
 */
export function teardownMultiplayer() {
  stopPresenceHeartbeat()
  socketManager.disconnect()
}
