import React, { useState, useEffect } from 'react'
import { useBattleStore } from '../../stores/battleStore'
import { usePlayerStore } from '../../stores/playerStore'
import BattleListView from './battles/BattleListView'
import BattleDetailView from './battles/BattleDetailView'
import '../../styles/battles.css'

export default function CombatTab({ panelFullscreen, setPanelFullscreen }: { panelFullscreen?: boolean; setPanelFullscreen?: (v: boolean) => void }) {
  const battleStore = useBattleStore()
  const player = usePlayerStore()

  const [selectedBattleId, setSelectedBattleId] = useState<string | null>(null)

  // Adrenaline decay interval — runs per active battle
  const activeBattleIds = Object.values(battleStore.battles).filter(b => b.status === 'active').map(b => b.id)
  useEffect(() => {
    if (activeBattleIds.length === 0) return
    const iv = setInterval(() => {
      const pName = usePlayerStore.getState().name
      activeBattleIds.forEach(bid => {
        useBattleStore.getState().tickAdrenalineDecay(bid, pName)
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [activeBattleIds.join(',')])

  // If selected battle was removed or remapped, handle gracefully
  useEffect(() => {
    if (selectedBattleId && !battleStore.battles[selectedBattleId]) {
      // Check if the battle was remapped (local ID → server ID)
      // by finding an active battle with the same region name
      const remapped = Object.values(battleStore.battles).find(
        b => b.status === 'active'
      )
      if (remapped) {
        setSelectedBattleId(remapped.id)
      } else {
        setSelectedBattleId(null)
      }
    }
  }, [selectedBattleId, battleStore.battles])

  if (selectedBattleId) {
    return (
      <BattleDetailView
        battleId={selectedBattleId}
        onBack={() => setSelectedBattleId(null)}
      />
    )
  }

  return (
    <BattleListView
      onSelectBattle={(id) => setSelectedBattleId(id)}
    />
  )
}
