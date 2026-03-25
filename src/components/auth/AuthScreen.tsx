import { useState } from 'react'
import { register, login } from '../../api/client'
import { useAuthStore } from '../../stores/authStore'
import { usePlayerStore } from '../../stores/playerStore'

interface FieldError { path: string; message: string }

export default function AuthScreen() {
  const [isLogin, setIsLogin]       = useState(true)
  const [name, setName]             = useState('')
  const [password, setPassword]     = useState('')
  const [country, setCountry]       = useState('US')
  const [error, setError]           = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([])
  const [isLoading, setIsLoading]   = useState(false)
  const [showPass, setShowPass]     = useState(false)
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setFieldErrors([])

    // Client-side pre-checks
    if (!name.trim()) { setError('Commander name is required.'); return }
    if (!isLogin && name.trim().length < 3) { setError('Name must be at least 3 characters.'); return }
    if (!isLogin && !/^[a-zA-Z0-9_]+$/.test(name)) { setError('Name may only contain letters, numbers, and underscores.'); return }
    if (!password) { setError('Password is required.'); return }
    if (!isLogin && password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (!isLogin && country.length !== 2) { setError('Country code must be exactly 2 letters (e.g. US).'); return }

    setIsLoading(true)
    try {
      if (isLogin) {
        const res = await login(name.trim(), password)
        usePlayerStore.setState({ name: res.player.name })
        await usePlayerStore.getState().fetchPlayer()
        setAuthenticated(true)
      } else {
        const res = await register(name.trim(), password, country.toUpperCase())
        usePlayerStore.setState({ name: res.player.name, countryCode: country.toUpperCase() })
        await usePlayerStore.getState().fetchPlayer()
        setAuthenticated(true)
      }
    } catch (err: any) {
      // Parse server validation details if available
      if (err?.details && Array.isArray(err.details) && err.details.length > 0) {
        setFieldErrors(err.details as FieldError[])
        setError('Please fix the errors below.')
      } else {
        setError(err.message || 'Authentication failed. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const switchMode = () => {
    setIsLogin(v => !v)
    setError('')
    setFieldErrors([])
  }

  const getFieldError = (field: string) =>
    fieldErrors.find(e => e.path === field)?.message

  return (
    <div className="auth-screen">
      <div className="auth-container">

        {/* Logo */}
        <div className="auth-header">
          <h1 className="auth-title">
            <span style={{ color: '#3b82f6' }}>⬡</span> XWAR
          </h1>
          <div className="auth-subtitle">GLOBAL DOMINATION</div>
        </div>

        {/* General error */}
        {error && (
          <div className="auth-error">
            <span style={{ marginRight: 6 }}>⚠</span>{error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>

          {/* Name */}
          <div className="auth-input-group">
            <label>COMMANDER NAME</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); setFieldErrors([]) }}
              placeholder="Enter your alias"
              maxLength={32}
              autoComplete="username"
              style={getFieldError('name') ? { borderColor: '#ef4444' } : {}}
            />
            {getFieldError('name') && (
              <div className="auth-field-error">{getFieldError('name')}</div>
            )}
            {!isLogin && (
              <div className="auth-hint">3–32 chars, letters / numbers / underscores only</div>
            )}
          </div>

          {/* Password */}
          <div className="auth-input-group">
            <label>SECURITY CLEARANCE (PASSWORD)</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); setFieldErrors([]) }}
                placeholder={isLogin ? 'Enter password' : 'Min 6 characters'}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                style={{ paddingRight: 40, ...(getFieldError('password') ? { borderColor: '#ef4444' } : {}) }}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'transparent', border:'none', color:'#64748b', cursor:'pointer', fontSize:14, padding:0 }}
                tabIndex={-1}
              >
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
            {getFieldError('password') && (
              <div className="auth-field-error">{getFieldError('password')}</div>
            )}
            {!isLogin && (
              <div className="auth-hint">At least 6 characters</div>
            )}
          </div>

          {/* Country (register only) */}
          {!isLogin && (
            <div className="auth-input-group">
              <label>FACTION / COUNTRY CODE</label>
              <input
                type="text"
                value={country}
                onChange={(e) => { setCountry(e.target.value.toUpperCase().slice(0,2)); setError(''); setFieldErrors([]) }}
                placeholder="e.g. US, DE, JP"
                maxLength={2}
                style={getFieldError('countryCode') ? { borderColor: '#ef4444' } : {}}
              />
              {getFieldError('countryCode') && (
                <div className="auth-field-error">{getFieldError('countryCode')}</div>
              )}
              <div className="auth-hint">2-letter ISO code — your starting nation</div>
            </div>
          )}

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={isLoading}
          >
            {isLoading
              ? 'AUTHENTICATING…'
              : isLogin
                ? 'INITIATE UPLINK'
                : 'REGISTER COMMANDER'}
          </button>
        </form>

        <div className="auth-toggle">
          {isLogin ? (
            <>New commander? <button type="button" onClick={switchMode}>Request Access</button></>
          ) : (
            <>Already authorized? <button type="button" onClick={switchMode}>Sign In</button></>
          )}
        </div>

      </div>
    </div>
  )
}
