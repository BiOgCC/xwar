import { usePlayerStore } from '../../stores/playerStore'

export default function AccountTab() {
  const player = usePlayerStore()

  return (
    <div className="acct-tab">
      <div className="acct-card">
        <div className="acct-card__title">⚙️ ACCOUNT INFO</div>
        <div className="acct-rows">
          <div className="acct-row">
            <span className="acct-row__label">Username</span>
            <span className="acct-row__value">{player.name}</span>
          </div>
          <div className="acct-row">
            <span className="acct-row__label">Country</span>
            <span className="acct-row__value">🏴 {player.country}</span>
          </div>
          <div className="acct-row">
            <span className="acct-row__label">Role</span>
            <span className="acct-row__value" style={{ textTransform: 'capitalize' }}>{player.role}</span>
          </div>
          <div className="acct-row">
            <span className="acct-row__label">Joined</span>
            <span className="acct-row__value">March 14, 2026</span>
          </div>
          <div className="acct-row">
            <span className="acct-row__label">Rank</span>
            <span className="acct-row__value">#{Math.floor(player.rank)}</span>
          </div>
        </div>
      </div>

      <div className="acct-card">
        <div className="acct-card__title">🔐 SECURITY</div>
        <div className="acct-rows">
          <div className="acct-row">
            <span className="acct-row__label">Email</span>
            <span className="acct-row__value acct-row__value--muted">commander@xwar.com</span>
          </div>
          <div className="acct-row">
            <span className="acct-row__label">2FA</span>
            <span className="acct-row__value acct-row__value--warn">Disabled</span>
          </div>
        </div>
        <button className="acct-btn">Change Password</button>
      </div>
    </div>
  )
}
