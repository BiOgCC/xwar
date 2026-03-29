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
        supplyBoxes: state.player.supplyBoxes ?? 0,
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
        productionBar: state.player.productionBar ?? 0,
        productionBarMax: state.player.productionBarMax ?? 100,
        experienceToNext: state.player.expToNext ?? state.player.experienceToNext ?? 100,
        magicTeaBuffUntil: state.player.magicTeaBuffUntil
          ? new Date(state.player.magicTeaBuffUntil).getTime() : 0,
        magicTeaDebuffUntil: state.player.magicTeaDebuffUntil
          ? new Date(state.player.magicTeaDebuffUntil).getTime() : 0,
      }))

      // Hydrate skills
      if (state.player.skills) {
        const { useSkillsStore } = await import('../stores/skillsStore')
        useSkillsStore.setState((s) => ({
          ...s,
          ...state.player.skills,
        }))
      }

      // Hydrate specialization
      if (state.player.specialization) {
        const { useSpecializationStore } = await import('../stores/specializationStore')
        useSpecializationStore.getState().hydrateFromServer(state.player.specialization)
      }
    }

    // Hydrate battles — normalize server objects to include all client-required fields
    if (state.battles && Object.keys(state.battles).length > 0) {
      const { useBattleStore } = await import('../stores/battleStore')
      const normalized: Record<string, any> = {}
      for (const [id, b] of Object.entries(state.battles as Record<string, any>)) {
        normalized[id] = {
          id: b.id ?? id,
          type: b.type ?? 'invasion',
          attackerId: b.attackerId ?? b.attacker_id ?? '',
          defenderId: b.defenderId ?? b.defender_id ?? '',
          regionName: b.regionName ?? b.region_name ?? '',
          startedAt: b.startedAt ?? (b.started_at ? new Date(b.started_at).getTime() : Date.now()),
          ticksElapsed: b.ticksElapsed ?? 0,
          status: b.status ?? 'active',
          attacker: b.attacker ?? {
            countryCode: b.attackerId ?? b.attacker_id ?? '',
            divisionIds: [], engagedDivisionIds: [],
            damageDealt: b.attackerDamage ?? 0,
            manpowerLost: 0, divisionsDestroyed: 0, divisionsRetreated: 0,
          },
          defender: b.defender ?? {
            countryCode: b.defenderId ?? b.defender_id ?? '',
            divisionIds: [], engagedDivisionIds: [],
            damageDealt: b.defenderDamage ?? 0,
            manpowerLost: 0, divisionsDestroyed: 0, divisionsRetreated: 0,
          },
          attackerRoundsWon: b.attackerRoundsWon ?? 0,
          defenderRoundsWon: b.defenderRoundsWon ?? 0,
          rounds: b.rounds?.length ? b.rounds : [{ attackerPoints: 0, defenderPoints: 0, status: 'active', startedAt: b.startedAt ?? Date.now() }],
          currentTick: b.currentTick ?? { attackerDamage: 0, defenderDamage: 0 },
          combatLog: b.combatLog ?? [],
          attackerDamageDealers: b.attackerDamageDealers ?? {},
          defenderDamageDealers: b.defenderDamageDealers ?? {},
          damageFeed: b.damageFeed ?? [],
          divisionCooldowns: b.divisionCooldowns ?? {},
          attackerOrder: b.attackerOrder ?? 'none',
          defenderOrder: b.defenderOrder ?? 'none',
          orderMessage: b.orderMessage ?? '',
          motd: b.motd ?? '',
          playerBattleStats: b.playerBattleStats ?? {},
          // Bridge persisted adrenaline state to client-side playerAdrenaline map
          playerAdrenaline: b.adrenalineState
            ? Object.fromEntries(
                Object.entries(b.adrenalineState as Record<string, any>).map(([k, v]) => [k, v?.value ?? 0])
              )
            : (b.playerAdrenaline ?? {}),
          playerSurge: b.playerSurge ?? {},
          playerCrash: b.playerCrash ?? {},
          playerAdrenalinePeakAt: b.playerAdrenalinePeakAt ?? {},
          vengeanceBuff: b.vengeanceBuff ?? { attacker: -1, defender: -1 },
          mercenaryContracts: b.mercenaryContracts ?? [],
          weaponPresence: b.weaponPresence ?? { attacker: {}, defender: {} },
        }
      }
      useBattleStore.setState(s => ({ battles: { ...s.battles, ...normalized } }))
      console.log(`[HYDRATE] ⚔️ Loaded ${Object.keys(normalized).length} active battle(s) from game state`)
    }

    // Hydrate world/countries
    if (state.countries) {
      const { useWorldStore } = await import('../stores/worldStore')
      useWorldStore.setState({ countries: state.countries })
    }

    // Hydrate active wars into worldStore
    if (state.wars && Array.isArray(state.wars) && state.wars.length > 0) {
      const { useWorldStore } = await import('../stores/worldStore')
      const warsMap: Record<string, any> = {}
      for (const w of state.wars) {
        const key = w.id || `${w.attackerCode}_${w.defenderCode}`
        warsMap[key] = {
          id: key,
          attacker: w.attackerCode,
          defender: w.defenderCode,
          status: w.status || 'active',
          startedAt: w.startedAt ? new Date(w.startedAt).getTime() : Date.now(),
        }
      }
      useWorldStore.setState((s: any) => ({ ...s, wars: { ...s.wars, ...warsMap } }))
    }

    // Hydrate inventory
    if (state.inventory) {
      const { useInventoryStore } = await import('../stores/inventoryStore')
      useInventoryStore.setState({ items: state.inventory })
    }

    // Hydrate government — merge with existing defaults to preserve client-only fields
    if (state.government) {
      const { useGovernmentStore } = await import('../stores/governmentStore')
      const existing = useGovernmentStore.getState().governments
      const merged: Record<string, any> = { ...existing }
      for (const [iso, dbRow] of Object.entries(state.government as Record<string, any>)) {
        const base = existing[iso] || {}
        const congress = Array.isArray(dbRow.congress) ? dbRow.congress : []
        merged[iso] = {
          ...base,
          // Server-authoritative fields
          president: dbRow.president ?? base.president ?? '',
          vicePresident: dbRow.vicePresident ?? dbRow.vice_president ?? base.vicePresident ?? '',
          defenseMinister: dbRow.defenseMinister ?? dbRow.defense_minister ?? base.defenseMinister ?? '',
          ecoMinister: dbRow.ecoMinister ?? dbRow.eco_minister ?? base.ecoMinister ?? '',
          taxRate: dbRow.taxRate ?? dbRow.tax_rate ?? base.taxRate ?? 25,
          swornEnemy: dbRow.swornEnemy ?? dbRow.sworn_enemy ?? base.swornEnemy ?? null,
          congress,
          laws: dbRow.laws ?? base.laws ?? { proposals: [] },
          nuclearAuthorized: dbRow.nuclearAuthorized ?? dbRow.nuclear_authorized ?? false,
          enrichmentStartedAt: dbRow.enrichmentStartedAt ?? dbRow.enrichment_started_at ?? null,
          enrichmentCompletedAt: dbRow.enrichmentCompletedAt ?? dbRow.enrichment_completed_at ?? null,
          citizenDividendPercent: dbRow.citizenDividendPercent ?? dbRow.citizen_dividend_percent ?? 0,
          embargoes: dbRow.embargoes ?? base.embargoes ?? [],
          alliances: dbRow.alliances ?? base.alliances ?? [],
          conscriptionActive: dbRow.conscriptionActive ?? dbRow.conscription_active ?? false,
          importTariff: dbRow.importTariff ?? dbRow.import_tariff ?? 0,
          minimumWage: dbRow.minimumWage ?? dbRow.minimum_wage ?? 0,
          militaryBudgetPercent: dbRow.militaryBudgetPercent ?? dbRow.military_budget_percent ?? 0,
          countryCode: iso,
        }
      }
      useGovernmentStore.setState({ governments: merged })
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

    // Hydrate Military Unit (Guild)
    if (state.mu?.unit) {
      const { useMUStore } = await import('../stores/muStore')
      const unit = state.mu.unit
      const members = unit.members || []
      const muForStore = {
        id: unit.id,
        name: unit.name,
        bannerUrl: unit.bannerUrl || '',
        avatarUrl: unit.avatarUrl || '',
        ownerId: unit.ownerId,
        ownerName: unit.ownerName || unit.ownerId,
        ownerCountry: unit.ownerCountry || '',
        countryCode: unit.countryCode || '',
        regionId: unit.regionId || '',
        locationRegion: unit.locationRegion || '',
        members: members.map((m: any) => ({
          playerId: m.playerId,
          name: m.playerName || m.playerId,
          level: m.level ?? 1,
          countryCode: m.countryCode || '',
          health: m.health ?? 10,
          maxHealth: m.maxHealth ?? 10,
          role: m.role || 'member',
          joinedAt: m.joinedAt ? new Date(m.joinedAt).getTime() : Date.now(),
          weeklyDamage: m.weeklyDamage ?? 0,
          totalDamage: m.totalDamage ?? 0,
          terrain: m.terrain ?? 0,
          wealth: m.wealth ?? 0,
          lastActive: m.lastActive ? new Date(m.lastActive).getTime() : Date.now(),
        })),
        applications: (unit.applications as any[]) || [],
        badges: (unit.badges as any[]) || [],
        transactions: (unit.transactions as any[]) || [],
        donations: (unit.donations as any[]) || [],
        contracts: (unit.contracts as any[]) || [],
        vault: (unit.vault as any) || { treasury: 0, resources: {} },
        upgrades: (unit.upgrades as any) || { barracks: 0, warDoctrine: 0, logistics: 0, intelligence: 0 },
        createdAt: unit.createdAt ? new Date(unit.createdAt).getTime() : Date.now(),
        weeklyDamageTotal: unit.weeklyDamageTotal ?? 0,
        totalDamageTotal: unit.totalDamageTotal ?? 0,
        cycleDamage: (unit.cycleDamage as any) || {},
        lastBudgetPayout: unit.lastBudgetPayout ?? 0,
        isStateOwned: unit.isStateOwned ?? false,
      }
      useMUStore.setState({
        units: { [unit.id]: muForStore as any },
        playerUnitId: unit.id,
      })
    }

    // Hydrate companies
    if (state.companies && state.companies.length > 0) {
      const { useCompanyStore } = await import('../stores/companyStore')
      useCompanyStore.setState((s: any) => ({
        ...s,
        companies: state.companies,
      }))
    }

    // Hydrate sea route disruptions from server
    if (state.tradeRoutes) {
      const { useLeyLineStore } = await import('../stores/leyLineStore')
      const disruptions = (state.tradeRoutes as any[])
        .filter((r: any) => r.disruptedUntil && new Date(r.disruptedUntil).getTime() > Date.now())
        .map((r: any) => ({
          routeId: r.routeId,
          activatesAt: r.disruptedActivatesAt ? new Date(r.disruptedActivatesAt).getTime() : Date.now(),
          expiryMs: new Date(r.disruptedUntil).getTime(),
          reason: r.disruptedReason ?? 'unknown',
          orderedBy: r.disruptedBy ?? 'unknown',
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

    // Note: Battles are already populated above from state.battles.
    // The socket-hooks boot hydration (initSocketHooks) also fetches /battle/active
    // as a secondary safety net, so no duplicate fetch needed here.

    // Hydrate occupation map — restore conquered territories into regionStore
    if (state.occupationMap && Object.keys(state.occupationMap).length > 0) {
      const { useRegionStore } = await import('../stores/regionStore')
      const occupationMap = state.occupationMap as Record<string, string> // { regionName: controllerCode }
      useRegionStore.setState(s => ({
        ...s,
        regions: s.regions.map(r => {
          const controller = occupationMap[r.name]
          if (controller && controller !== r.countryCode) {
            // This region is currently occupied by another country
            return { ...r, controlledBy: controller }
          }
          return r
        }),
      }))
      console.log(`[HYDRATE] 🗺️ Restored ${Object.keys(occupationMap).length} occupied region(s) from server`)
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
