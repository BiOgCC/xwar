import { usePlayerStore } from '../../stores/playerStore'
import ResourceIcon from './ResourceIcon'

/** Compact format: 5000000 → 5M, 500000 → 500K, 1234 → 1.2K */
function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'M'
  if (n >= 10_000)    return Math.round(n / 1_000) + 'K'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}

interface InventorySummaryProps {
  onOpenLootBox?: () => void
  onOpenMilitaryBox?: () => void
  onOpenSupplyBox?: () => void
}

export default function InventorySummary({ onOpenLootBox, onOpenMilitaryBox, onOpenSupplyBox }: InventorySummaryProps) {
  const player = usePlayerStore()

  const boxBtnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '4px',
    background: 'rgba(34,211,138,0.08)', border: '1px solid rgba(34,211,138,0.25)',
    borderRadius: '6px', padding: '4px 10px', cursor: 'pointer',
    color: '#e2e8f0', fontSize: '11px', fontFamily: 'var(--font-mono)',
    transition: 'all 0.15s ease',
  }

  const boxLabelStyle: React.CSSProperties = {
    fontSize: '8px', fontWeight: 700, fontFamily: 'var(--font-display)',
    letterSpacing: '0.1em', color: '#22d38a', marginLeft: '2px',
  }

  return (
    <div className="comp-inventory-summary" style={{ marginBottom: '16px' }}>
      <div className="comp-inv-row">
        <div className="comp-inv-item"><span title="Money"><ResourceIcon resourceKey="money" /></span>{fmt(player.money)}</div>
        <div className="comp-inv-item"><span title="Bitcoin"><ResourceIcon resourceKey="bitcoin" /></span>{fmt(player.bitcoin)}</div>
        <div className="comp-inv-item"><span title="Scrap"><ResourceIcon resourceKey="scrap" /></span>{fmt(player.scrap ?? 0)}</div>
        <div className="comp-inv-item"><span title="Oil"><ResourceIcon resourceKey="oil" /></span>{fmt(player.oil ?? 0)}</div>
        <div className="comp-inv-item"><span title="Material X"><ResourceIcon resourceKey="materialX" /></span>{fmt(player.materialX ?? 0)}</div>
        <div className="comp-inv-item"><span title="Badge of Honor"><ResourceIcon resourceKey="badgesOfHonor" /></span>{fmt(player.badgesOfHonor ?? 0)}</div>
      </div>
      <div className="comp-inv-row">
        <div className="comp-inv-item"><span title="Wheat"><ResourceIcon resourceKey="wheat" /></span>{fmt(player.wheat ?? 0)}</div>
        <div className="comp-inv-item"><span title="Fish"><ResourceIcon resourceKey="fish" /></span>{fmt(player.fish ?? 0)}</div>
        <div className="comp-inv-item"><span title="Steak"><ResourceIcon resourceKey="steak" /></span>{fmt(player.steak ?? 0)}</div>
        <div className="comp-inv-item"><span title="Bread"><ResourceIcon resourceKey="bread" /></span>{fmt(player.bread ?? 0)}</div>
        <div className="comp-inv-item"><span title="Sushi"><ResourceIcon resourceKey="sushi" /></span>{fmt(player.sushi ?? 0)}</div>
        <div className="comp-inv-item"><span title="Wagyu"><ResourceIcon resourceKey="wagyu" /></span>{fmt(player.wagyu ?? 0)}</div>
      </div>
      <div className="comp-inv-row">
        <div className="comp-inv-item"><span title="Green Bullets"><ResourceIcon resourceKey="greenBullets" /></span>{fmt(player.greenBullets ?? 0)}</div>
        <div className="comp-inv-item"><span title="Blue Bullets"><ResourceIcon resourceKey="blueBullets" /></span>{fmt(player.blueBullets ?? 0)}</div>
        <div className="comp-inv-item"><span title="Purple Bullets"><ResourceIcon resourceKey="purpleBullets" /></span>{fmt(player.purpleBullets ?? 0)}</div>
        <div className="comp-inv-item"><span title="Red Bullets"><ResourceIcon resourceKey="redBullets" /></span>{fmt(player.redBullets ?? 0)}</div>
      </div>
      <div className="comp-inv-row">
        <button
          title="Open Civilian Box"
          style={{ ...boxBtnStyle, opacity: (player.lootBoxes ?? 0) > 0 ? 1 : 0.4 }}
          disabled={(player.lootBoxes ?? 0) === 0}
          onClick={onOpenLootBox}
          onMouseOver={e => { if ((player.lootBoxes ?? 0) > 0) { e.currentTarget.style.background = 'rgba(34,211,138,0.18)'; e.currentTarget.style.borderColor = 'rgba(34,211,138,0.5)' } }}
          onMouseOut={e => { e.currentTarget.style.background = 'rgba(34,211,138,0.08)'; e.currentTarget.style.borderColor = 'rgba(34,211,138,0.25)' }}
        >
          <span>📦</span>{fmt(player.lootBoxes ?? 0)}
          {onOpenLootBox && (player.lootBoxes ?? 0) > 0 && <span style={boxLabelStyle}>OPEN</span>}
        </button>
        <button
          title="Open Military Box"
          style={{ ...boxBtnStyle, borderColor: 'rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)', opacity: (player.militaryBoxes ?? 0) > 0 ? 1 : 0.4 }}
          disabled={(player.militaryBoxes ?? 0) === 0}
          onClick={onOpenMilitaryBox}
          onMouseOver={e => { if ((player.militaryBoxes ?? 0) > 0) { e.currentTarget.style.background = 'rgba(239,68,68,0.18)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)' } }}
          onMouseOut={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)' }}
        >
          <span>🧰</span>{fmt(player.militaryBoxes ?? 0)}
          {onOpenMilitaryBox && (player.militaryBoxes ?? 0) > 0 && <span style={{ ...boxLabelStyle, color: '#ef4444' }}>OPEN</span>}
        </button>
        <button
          title="Open Supply Box"
          style={{ ...boxBtnStyle, borderColor: 'rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.08)', opacity: (player.supplyBoxes ?? 0) > 0 ? 1 : 0.4 }}
          disabled={(player.supplyBoxes ?? 0) === 0}
          onClick={onOpenSupplyBox}
          onMouseOver={e => { if ((player.supplyBoxes ?? 0) > 0) { e.currentTarget.style.background = 'rgba(99,102,241,0.18)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)' } }}
          onMouseOut={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.08)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)' }}
        >
          <span>📋</span>{fmt(player.supplyBoxes ?? 0)}
          {onOpenSupplyBox && (player.supplyBoxes ?? 0) > 0 && <span style={{ ...boxLabelStyle, color: '#6366f1' }}>OPEN</span>}
        </button>
      </div>
    </div>
  )
}
