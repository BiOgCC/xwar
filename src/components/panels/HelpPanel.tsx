export default function HelpPanel() {
  return (
    <div style={{ padding: '4px 0' }}>
      {/* Quick Start */}
      <div className="hud-card">
        <div className="hud-card__title">🚀 QUICK START</div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
          <p style={{ margin: '0 0 8px' }}>Welcome to <b>XWAR</b> — a global domination strategy game. Build your economy, train your army, and conquer territories.</p>
          <p style={{ margin: '0 0 8px' }}><b>1.</b> Work &amp; earn money via the Action Bar</p>
          <p style={{ margin: '0 0 8px' }}><b>2.</b> Buy companies to produce resources</p>
          <p style={{ margin: '0 0 8px' }}><b>3.</b> Train divisions in the Military panel</p>
          <p style={{ margin: '0' }}><b>4.</b> Declare war and capture enemy regions</p>
        </div>
      </div>

      {/* Keybindings */}
      <div className="hud-card">
        <div className="hud-card__title">⌨️ KEYBOARD SHORTCUTS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {[
            ['/', 'Search / Locate'],
            ['1-9', 'Action Bar slots'],
            ['Backspace', 'Go back (panel history)'],
            ['ESC', 'Close panel / Exit fullscreen'],
            ['F', 'Toggle panel fullscreen'],
          ].map(([key, desc]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <kbd style={{
                padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff', fontFamily: 'monospace',
              }}>{key}</kbd>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Game Systems */}
      <div className="hud-card">
        <div className="hud-card__title">📖 GAME SYSTEMS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            ['⚔️ War & Combat', 'Declare wars, deploy divisions, fight in real-time battles with tactical orders.'],
            ['🏭 Economy', 'Work, own companies, produce resources, trade on the market.'],
            ['🎖️ Military', 'Recruit infantry, tanks, jets, warships. Organize into armies and deploy.'],
            ['🖥️ Cyberwarfare', 'Hack enemies with the Breach Protocol minigame. Steal resources and intel.'],
            ['🏛️ Government', 'Manage your country\'s treasury, infrastructure, and armed forces.'],
            ['🎰 Casino', 'Play slots, blackjack, and crash for quick profit — or losses.'],
            ['🌊 Naval', 'Control ocean blocks for trade route income and strategic advantage.'],
            ['⭐ Prestige', 'Craft legendary items from rare materials and blueprints.'],
            ['🤝 Alliance', 'Join or create alliances for cooperative warfare and shared benefits.'],
            ['🎯 Bounty Board', 'Hunt bounties on enemy players for Bitcoin rewards.'],
          ].map(([title, desc]) => (
            <div key={title}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#fff' }}>{title}</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '1px' }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Version */}
      <div className="hud-card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em' }}>
          XWAR v0.1.0 — ALPHA BUILD
        </div>
      </div>
    </div>
  )
}
