import { useState } from 'react'
import { register, login } from '../../api/client'
import { useAuthStore } from '../../stores/authStore'
import { usePlayerStore } from '../../stores/playerStore'

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [country, setCountry] = useState('US')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated)
  const player = usePlayerStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !password) {
      setError('Please enter both name and password.')
      return
    }

    setError('')
    setIsLoading(true)

    try {
      if (isLogin) {
        const res = await login(name, password)
        usePlayerStore.setState({ name: res.player.name })
        await usePlayerStore.getState().fetchPlayer()
        setAuthenticated(true)
      } else {
        const res = await register(name, password, country)
        usePlayerStore.setState({ name: res.player.name, countryCode: country })
        await usePlayerStore.getState().fetchPlayer()
        setAuthenticated(true)
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Authentication failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-container">
        <div className="auth-header">
          <h1 className="auth-title">
            <span style={{ color: '#3b82f6' }}>⬡</span> XWAR
          </h1>
          <div className="auth-subtitle">GLOBAL DOMINATION</div>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-input-group">
            <label>COMMANDER NAME</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your alias"
              maxLength={20}
              required
            />
          </div>

          <div className="auth-input-group">
            <label>SECURITY CLEARANCE (PASSWORD)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>

          {!isLogin && (
            <div className="auth-input-group">
              <label>FACTION / COUNTRY CODE</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase())}
                placeholder="Ex: US, RU, CN"
                maxLength={2}
                required
              />
            </div>
          )}

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={isLoading || !name || !password}
          >
            {isLoading ? 'AUTHENTICATING...' : isLogin ? 'INITIATE UPLINK' : 'REGISTER COMMANDER'}
          </button>
        </form>

        <div className="auth-toggle">
          {isLogin ? (
            <>
              New commander? <button type="button" onClick={() => setIsLogin(false)}>Request Access</button>
            </>
          ) : (
            <>
              Already authorized? <button type="button" onClick={() => setIsLogin(true)}>Sign In</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
