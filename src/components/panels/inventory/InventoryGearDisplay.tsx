import { usePlayerStore } from '../../../stores/playerStore'
import { useInventoryStore, getItemImagePath, TIER_COLORS, TIER_LABELS } from '../../../stores/inventoryStore'
import { usePrestigeStore, getPrestigeItemImage } from '../../../stores/prestigeStore'
import { useUIStore } from '../../../stores/uiStore'
import type { EquipSlot } from '../../../stores/inventoryStore'

interface Props { onPickSlot: (s: EquipSlot) => void; onPickAmmo: () => void }

export default function InventoryGearDisplay({ onPickSlot, onPickAmmo }: Props) {
  const player = usePlayerStore()
  const inv = useInventoryStore()
  const pStore = usePrestigeStore()
  const ui = useUIStore()
  const eq = inv.items.filter(i => i.location === 'inventory' && i.equipped)
  const eqPrestige = pStore.items.find((i: any) => i.equipped && i.craftedBy === player.name)
  const ammoMul: Record<string,{dmg:number}> = { none:{dmg:1},green:{dmg:1.1},blue:{dmg:1.2},purple:{dmg:1.4},red:{dmg:1.4} }
  const aBon = ammoMul[player.equippedAmmo] || ammoMul.none

  const renderSlot = (slot: EquipSlot) => {
    const item = eq.find(i => i.slot === slot)
    if (!item) return (
      <div key={slot} className="ptab-gear-card" style={{ borderColor:'rgba(255,255,255,0.05)',opacity:0.5 }}>
        <div className="ptab-gear-card__top"><span className="ptab-gear-card__slot">{slot.toUpperCase()}</span></div>
        <div className="ptab-gear-card__img-wrap"><div style={{fontSize:'28px',opacity:0.2}}>
          <img src={getItemImagePath('t1',slot,slot==='weapon'?'weapon':'armor')||''} alt={slot} style={{width:'36px',height:'36px',objectFit:'contain',opacity:0.25,filter:'grayscale(100%)'}} />
        </div></div>
      </div>
    )
    const tc = TIER_COLORS[item.tier as keyof typeof TIER_COLORS]||'#94a3b8'
    const tl = TIER_LABELS[item.tier as keyof typeof TIER_LABELS]||item.tier.toUpperCase()
    const img = getItemImagePath(item.tier,item.slot,item.category,item.weaponSubtype,item.superforged)
    const dur = Number(item.durability??100), dc = dur<30?'#ef4444':dur<60?'#f59e0b':'#22d38a'
    const se:{label:string;val:string;color:string}[] = []
    if(item.stats.damage) se.push({label:'DMG',val:String(item.stats.damage),color:'#f87171'})
    if(item.stats.critRate) se.push({label:'CRIT',val:`${item.stats.critRate}%`,color:'#fb923c'})
    if(item.stats.critDamage) se.push({label:'C.DMG',val:`${item.stats.critDamage}%`,color:'#fb923c'})
    if(item.stats.armor) se.push({label:'ARM',val:`${item.stats.armor}%`,color:'#94a3b8'})
    if(item.stats.dodge) se.push({label:'EVA',val:`${item.stats.dodge}%`,color:'#34d399'})
    if(item.stats.precision) se.push({label:'ACC',val:`${item.stats.precision}%`,color:'#38bdf8'})
    return (
      <div key={item.id} className="ptab-gear-card" style={{borderColor:`${tc}30`,'--card-tier-color':tc} as React.CSSProperties} onClick={()=>onPickSlot(item.slot)}>
        <div className="ptab-gear-card__top"><span className="ptab-gear-card__slot">{item.slot.toUpperCase()}</span><span className="ptab-gear-card__tier" style={{color:tc}}>{tl.split(' ')[0]}</span></div>
        <div className="ptab-gear-card__img-wrap">{img?<img src={img} alt={item.name} className="ptab-gear-card__img" onError={e=>{e.currentTarget.style.display='none'}} />:<div style={{fontSize:'28px',opacity:0.4,filter:`drop-shadow(0 0 4px ${tc})`}}>?</div>}</div>
        {se.length>0&&<div className="ptab-gear-card__stats">{se.map(s=><div key={s.label} className="ptab-gear-stat"><span className="ptab-gear-stat__label">{s.label}</span><span className="ptab-gear-stat__val" style={{color:s.color}}>{s.val}</span></div>)}</div>}
        <div className="ptab-gear-card__footer"><div className="ptab-gear-card__dur-bar"><div className="ptab-gear-card__dur-fill" style={{width:`${dur}%`,background:dc}} /></div><div className="ptab-gear-card__dur-lbl" style={{color:dc}}>{dur.toFixed(0)}%</div></div>
      </div>
    )
  }

  const best = () => {
    const allItems = useInventoryStore.getState().items.filter(i => i.location === 'inventory')
    ;(['helmet','chest','legs','gloves','boots'] as const).forEach(slot => {
      const c = allItems.filter(i=>i.slot===slot&&Number(i.durability)>0)
      if(!c.length) return
      const b = c.reduce((a,b)=>{const aT=(a.stats.damage||0)+(a.stats.armor||0)+(a.stats.critRate||0)+(a.stats.critDamage||0)+(a.stats.dodge||0)+(a.stats.precision||0);const bT=(b.stats.damage||0)+(b.stats.armor||0)+(b.stats.critRate||0)+(b.stats.critDamage||0)+(b.stats.dodge||0)+(b.stats.precision||0);return bT>aT?b:a})
      useInventoryStore.getState().equipItem(b.id)
    })
    const w = allItems.filter(i=>i.location === 'inventory' && i.slot==='weapon'&&Number(i.durability)>0)
    if(w.length) { const bw=w.reduce((a,b)=>{const aT=(a.stats.damage||0)+(a.stats.critRate||0)+(a.stats.critDamage||0);const bT=(b.stats.damage||0)+(b.stats.critRate||0)+(b.stats.critDamage||0);return bT>aT?b:a}); useInventoryStore.getState().equipItem(bw.id) }
    const p=usePlayerStore.getState(); if(p.redBullets>0) p.equipAmmo('red'); else if(p.purpleBullets>0) p.equipAmmo('purple'); else if(p.blueBullets>0) p.equipAmmo('blue'); else if(p.greenBullets>0) p.equipAmmo('green')
  }

  const remove = () => { const i=useInventoryStore.getState(); i.items.filter(x=>x.equipped).forEach(x=>i.unequipItem(x.id)); usePlayerStore.getState().equipAmmo('none') }

  return (
    <div className="inv-section">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'6px'}}>
        <div className="inv-section__title" style={{color:'#ffffff',margin:0}}>ARMOR & PRESTIGE</div>
        <div style={{display:'flex',gap:'4px'}}>
          <button style={{padding:'3px 10px',fontSize:'8px',fontWeight:800,letterSpacing:'0.08em',fontFamily:'var(--font-display)',color:'#fbbf24',background:'rgba(251,191,36,0.1)',border:'1px solid rgba(251,191,36,0.3)',borderRadius:'4px',cursor:'pointer',transition:'all 150ms ease'}} onClick={best}>BEST</button>
          <button style={{padding:'3px 10px',fontSize:'8px',fontWeight:800,letterSpacing:'0.08em',fontFamily:'var(--font-display)',color:'#ef4444',background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'4px',cursor:'pointer',transition:'all 150ms ease'}} onClick={remove}>REMOVE</button>
        </div>
      </div>
      <div className="ptab-gear-grid">
        {(['helmet','chest','legs','gloves','boots'] as EquipSlot[]).map(renderSlot)}
        {eqPrestige ? (()=>{ const p=eqPrestige,pc=p.category==='military'?'#ef4444':'#38bdf8',ps:{label:string;val:string;color:string}[]=[]; if(p.bonusStats.damage)ps.push({label:'DMG',val:`${p.bonusStats.damage}%`,color:'#f87171'}); if(p.bonusStats.crit_damage)ps.push({label:'C.DMG',val:`${p.bonusStats.crit_damage}%`,color:'#fb923c'}); if(p.bonusStats.prospection)ps.push({label:'PROS',val:`+${p.bonusStats.prospection}`,color:'#38bdf8'}); if(p.bonusStats.industrialist)ps.push({label:'IND',val:`${p.bonusStats.industrialist}%`,color:'#fbbf24'})
          return (<div key="prestige" className="ptab-gear-card" style={{borderColor:`${pc}50`,'--card-tier-color':pc,background:`linear-gradient(to bottom, ${pc}10, transparent)`} as React.CSSProperties} onClick={()=>ui.setActivePanel('prestige')}>
            <div className="ptab-gear-card__top"><span className="ptab-gear-card__slot">PRESTIGE</span><span className="ptab-gear-card__tier" style={{color:pc}}>{p.category.toUpperCase()}</span></div>
            <div className="ptab-gear-card__img-wrap"><img src={getPrestigeItemImage(p.category)} alt="Prestige" style={{width:'40px',height:'40px',objectFit:'contain',filter:`drop-shadow(0 0 8px ${pc}66)`}} /></div>
            {ps.length>0&&<div className="ptab-gear-card__stats">{ps.slice(0,3).map(s=><div key={s.label} className="ptab-gear-stat"><span className="ptab-gear-stat__label">{s.label}</span><span className="ptab-gear-stat__val" style={{color:s.color}}>{s.val}</span></div>)}</div>}
            <div className="ptab-gear-card__footer" style={{justifyContent:'center'}}><div className="ptab-gear-card__dur-lbl" style={{color:'#eab308'}}>INFINITE</div></div>
          </div>)
        })() : <div key="prestige_empty" className="ptab-gear-card" style={{borderColor:'rgba(234,179,8,0.2)',opacity:0.6}} onClick={()=>ui.setActivePanel('prestige')}><div className="ptab-gear-card__top"><span className="ptab-gear-card__slot" style={{color:'#eab308'}}>PRESTIGE</span></div><div className="ptab-gear-card__img-wrap"><img src="/assets/items/prestige_crown.png" alt="Prestige" style={{width:'36px',height:'36px',objectFit:'contain',opacity:0.3}} /></div></div>}
      </div>

      <div className="inv-section__title" style={{marginTop:'16px',color:'#ffffff'}}>WEAPONRY & AMMO</div>
      <div className="ptab-gear-grid">
        {renderSlot('weapon')}
        {(()=>{const ammo=player.equippedAmmo; if(ammo==='none') return <div key="ammo_empty" className="ptab-gear-card" style={{borderColor:'rgba(255,255,255,0.1)',opacity:0.6,cursor:'pointer'}} onClick={onPickAmmo}><div className="ptab-gear-card__top"><span className="ptab-gear-card__slot">AMMO</span></div><div className="ptab-gear-card__img-wrap"><img src="/assets/items/ammo_green.png" alt="Ammo" style={{width:'36px',height:'36px',objectFit:'contain',opacity:0.25,filter:'grayscale(100%)'}} /></div><div className="ptab-gear-card__footer" style={{justifyContent:'center'}}><div className="ptab-gear-card__dur-lbl" style={{color:'#64748b',fontSize:'7px'}}>CLICK TO EQUIP</div></div></div>
          const ac:Record<string,string>={green:'#10b981',blue:'#3b82f6',purple:'#a855f7',red:'#ef4444'},clr=ac[ammo]||'#fff',cnt=player[`${ammo}Bullets` as keyof typeof player] as number
          return <div key="ammo" className="ptab-gear-card" style={{borderColor:`${clr}30`,'--card-tier-color':clr,cursor:'pointer'} as React.CSSProperties} onClick={onPickAmmo}>
            <div className="ptab-gear-card__top"><span className="ptab-gear-card__slot">AMMO</span><span className="ptab-gear-card__tier" style={{color:clr}}>{ammo.toUpperCase()}</span></div>
            <div className="ptab-gear-card__img-wrap"><img src={`/assets/items/ammo_${ammo}.png`} alt={ammo} className="ptab-gear-card__img" style={{filter:`drop-shadow(0 0 8px ${clr}66)`}} /></div>
            <div className="ptab-gear-card__stats"><div className="ptab-gear-stat"><span className="ptab-gear-stat__label">AMNT</span><span className="ptab-gear-stat__val" style={{color:clr}}>{cnt?.toLocaleString()}</span></div><div className="ptab-gear-stat"><span className="ptab-gear-stat__label">MULT</span><span className="ptab-gear-stat__val" style={{color:clr}}>×{aBon.dmg}</span></div></div>
            <div className="ptab-gear-card__footer" style={{justifyContent:'center'}}><div className="ptab-gear-card__dur-lbl" style={{color:clr}}>EQUIPPED</div></div>
          </div>
        })()}
      </div>
    </div>
  )
}
