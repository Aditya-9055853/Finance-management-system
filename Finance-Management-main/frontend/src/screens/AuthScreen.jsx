import React, { useEffect, useState } from 'react'
import { useApp } from '../App'

export default function AuthScreen() {
  const { setScreen, setUser, addToast, chooseWelcomeSlogan } = useApp()
  const [mode, setMode] = useState('login') // login | signup
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [introVisible, setIntroVisible] = useState(true)
  const [introLeaving, setIntroLeaving] = useState(false)

  useEffect(() => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const introDuration = reducedMotion ? 300 : 1900
    const leaveTimer = window.setTimeout(() => setIntroLeaving(true), introDuration - 550)
    const finishTimer = window.setTimeout(() => setIntroVisible(false), introDuration)
    return () => {
      window.clearTimeout(leaveTimer)
      window.clearTimeout(finishTimer)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (mode === 'signup' && !name.trim()) { setError('Name is required.'); return }
    if (!email.trim()) { setError('Email is required.'); return }
    if (!password || password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true)
    try {
      const res = await fetch(mode === 'signup' ? '/api/register' : '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'Something went wrong. Please try again.'); return }
      setUser(data.user)
      chooseWelcomeSlogan()
      addToast(`Welcome, ${data.user.name}!`, 'success')
      setScreen('app')
    } catch {
      setError('Cannot reach the server. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  const handleGuest = async () => {
    try { await fetch('/api/logout', { method: 'POST' }) } catch {}
    setUser(null)
    setScreen('app')
  }

  return (
    <div className="auth-screen">
      {introVisible && <div className={`login-intro ${introLeaving ? 'is-leaving' : ''}`} role="status" aria-label="FinTrack is starting">
        <div className="login-intro-halo" />
        <div className="login-intro-content">
          <span className="login-intro-kicker">YOUR MONEY, IN FOCUS</span>
          <h1 className="login-intro-title"><span>FinTrack</span></h1>
          <p className="login-intro-subtitle">Make every move count.</p>
        </div>
        <div className="login-intro-coins" aria-hidden="true">
          <i className="intro-coin intro-coin-one">₹</i>
          <i className="intro-coin intro-coin-two">₹</i>
          <i className="intro-coin intro-coin-three">₹</i>
          <i className="intro-coin intro-coin-four">₹</i>
          <i className="intro-coin intro-coin-five">₹</i>
        </div>
        <div className="login-intro-floor" />
      </div>}
      <div className="auth-illustration">
        <div className="auth-scene-copy">
          <span className="auth-scene-kicker">YOUR MONEY, IN FOCUS</span>
          <h1>Make every<br /><em>move count.</em></h1>
          <p>One clear view for your spending, savings, and next steps.</p>
        </div>
        <div className="auth-3d-stage" aria-hidden="true">
          <div className="auth-stage-glow" />
          <div className="auth-orb"><span>₹</span><i /><b /></div>
          <div className="auth-coin auth-coin-a">₹</div>
          <div className="auth-coin auth-coin-b">₹</div>
          <div className="auth-coin auth-coin-c">₹</div>
          <div className="auth-float-card auth-float-card-back"><span>MONTHLY SAVINGS</span><strong>+12.8%</strong><i /></div>
          <div className="auth-float-card auth-float-card-front"><span className="auth-mini-icon">↗</span><span>Spending insight</span><strong>You're on track</strong><i><b /></i></div>
          <div className="auth-stage-ring auth-stage-ring-a" />
          <div className="auth-stage-ring auth-stage-ring-b" />
        </div>
        <div className="auth-illustration-footer"><span className="auth-footer-dot" />A smarter view of your finances</div>
      </div>

      <div className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="auth-logo">
            <div className="auth-logo-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
              </svg>
            </div>
            <span className="auth-logo-name">Fin<em>Track</em></span>
          </div>

          <h2>{mode === 'login' ? 'Welcome back' : 'Create account'}</h2>
          <p>{mode === 'login' ? 'Sign in to your account' : 'Start managing your personal finances'}</p>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <div className="auth-form-group">
                <label htmlFor="auth-name">Name</label>
                <input id="auth-name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
              </div>
            )}
            <div className="auth-form-group">
              <label htmlFor="auth-email">Email</label>
              <input id="auth-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
            </div>
            <div className="auth-form-group">
              <label htmlFor="auth-password">Password</label>
              <div className="auth-password-field">
                <input id="auth-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
                <button type="button" className="auth-password-toggle" onClick={() => setShowPassword(visible => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%', padding: '11px', marginTop: 4 }} disabled={loading}>
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="auth-divider"><span>or</span></div>
          <button type="button" className="btn-ghost" style={{ width: '100%', padding: '11px' }} onClick={handleGuest}>
            Continue as Guest (No Login)
          </button>

          <p className="auth-switch">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <a href="#" onClick={e => { e.preventDefault(); setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}>
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </a>
          </p>
          <p style={{ textAlign: 'center', marginTop: 10 }}>
            <button style={{ background: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }} onClick={() => setScreen('landing')}>
              ← Back to home
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
