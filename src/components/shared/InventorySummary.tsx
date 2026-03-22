import { usePlayerStore } from '../../stores/playerStore'
import ResourceIcon from './ResourceIcon'

/** Compact format: 5000000 → 5M, 500000 → 500K, 1234 → 1.2K */
function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'M'
  if (n >= 10_000)    return Math.round(n / 1_000) + 'K'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}

export default function InventorySummary() {
  const player = usePlayerStore()

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
    </div>
  )
}
