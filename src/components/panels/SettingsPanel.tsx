import { useState } from 'react'

const SETTINGS_KEY = 'xwar-settings'

interface Settings {
  volume: number
  theme: 'dark' | 'midnight'
  mapQuality: 'low' | 'medium' | 'high'
  showDamageNumbers: boolean
  compactUI: boolean
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {}
  return DEFAULT_SETTINGS
}

const DEFAULT_SETTINGS: Settings = {
  volume: 70,
  theme: 'dark',
  mapQuality: 'high',
  showDamageNumbers: true,
  compactUI: false,
}

function SettingRow({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', letterSpacing: '0.03em' }}>{label}</div>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{desc}</div>
      </div>
      <div>{children}</div>
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: '40px', height: '22px', borderRadius: '11px', border: 'none', cursor: 'pointer',
        background: value ? 'rgba(34,211,138,0.6)' : 'rgba(255,255,255,0.15)',
        position: 'relative', transition: 'background 0.2s',
      }}
    >
      <div style={{
        width: '16px', height: '16px', borderRadius: '50%', background: '#fff',
        position: 'absolute', top: '3px', transition: 'left 0.2s',
        left: value ? '21px' : '3px',
      }} />
    </button>
  )
}

export default function SettingsPanel() {
  const [settings, setSettings] = useState<Settings>(loadSettings)

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const next = { ...settings, [key]: value }
    setSettings(next)
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  }

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Sound */}
      <div className="hud-card">
        <div className="hud-card__title">🔊 SOUND</div>
        <SettingRow label="Master Volume" desc="Adjust overall game volume">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="range" min="0" max="100" value={settings.volume}
              onChange={(e) => update('volume', Number(e.target.value))}
              style={{ width: '80px', accentColor: '#3b82f6' }}
            />
            <span style={{ fontSize: '11px', color: '#fff', minWidth: '28px', textAlign: 'right' }}>{settings.volume}%</span>
          </div>
        </SettingRow>
      </div>

      {/* Display */}
      <div className="hud-card">
        <div className="hud-card__title">🎨 DISPLAY</div>
        <SettingRow label="Theme" desc="Choose interface theme">
          <div style={{ display: 'flex', gap: '4px' }}>
            {(['dark', 'midnight'] as const).map((t) => (
              <button
                key={t}
                onClick={() => update('theme', t)}
                style={{
                  padding: '4px 12px', fontSize: '10px', cursor: 'pointer', borderRadius: '4px',
                  border: `1px solid ${settings.theme === t ? '#3b82f6' : 'rgba(255,255,255,0.1)'}`,
                  background: settings.theme === t ? 'rgba(59,130,246,0.15)' : 'transparent',
                  color: settings.theme === t ? '#60a5fa' : 'rgba(255,255,255,0.5)',
                  fontFamily: 'var(--font-display)', letterSpacing: '0.08em', textTransform: 'uppercase',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </SettingRow>
        <SettingRow label="Compact UI" desc="Reduce padding and font sizes">
          <Toggle value={settings.compactUI} onChange={(v) => update('compactUI', v)} />
        </SettingRow>
        <SettingRow label="Damage Numbers" desc="Show floating damage in combat">
          <Toggle value={settings.showDamageNumbers} onChange={(v) => update('showDamageNumbers', v)} />
        </SettingRow>
      </div>

      {/* Performance */}
      <div className="hud-card">
        <div className="hud-card__title">⚡ PERFORMANCE</div>
        <SettingRow label="Map Quality" desc="Lower = better FPS on slow devices">
          <div style={{ display: 'flex', gap: '4px' }}>
            {(['low', 'medium', 'high'] as const).map((q) => (
              <button
                key={q}
                onClick={() => update('mapQuality', q)}
                style={{
                  padding: '4px 10px', fontSize: '10px', cursor: 'pointer', borderRadius: '4px',
                  border: `1px solid ${settings.mapQuality === q ? '#f59e0b' : 'rgba(255,255,255,0.1)'}`,
                  background: settings.mapQuality === q ? 'rgba(245,158,11,0.15)' : 'transparent',
                  color: settings.mapQuality === q ? '#f59e0b' : 'rgba(255,255,255,0.5)',
                  fontFamily: 'var(--font-display)', letterSpacing: '0.08em', textTransform: 'uppercase',
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </SettingRow>
      </div>

      {/* Game */}
      <div className="hud-card">
        <div className="hud-card__title">🎮 GAMEPLAY</div>
        <SettingRow label="Auto-Collect" desc="Companies at level 5+ automatically collect every economy tick">
          <span style={{ fontSize: '10px', color: '#22d38a', fontWeight: 600, letterSpacing: '0.05em' }}>LVL 5+</span>
        </SettingRow>
      </div>
    </div>
  )
}
