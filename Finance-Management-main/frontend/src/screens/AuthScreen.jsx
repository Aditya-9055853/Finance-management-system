import React, { useEffect, useState } from 'react'
import { useApp } from '../App'

export default function AuthScreen() {
  const { setScreen, setUser, addToast, chooseWelcomeSlogan } = useApp()
  const [mode, setMode] = useState('login')
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
    const duration = reducedMotion ? 300 : 1900
    const leaveTimer = window.setTimeout(() => setIntroLeaving(true), duration - 550)
    const finishTimer = window.setTimeout(() => setIntroVisible(false), duration)
    return () => { window.clearTimeout(leaveTimer); window.clearTimeout(finishTimer) }
  }, [])

  const enterApp = (user, message) => {
    setUser(user)
    chooseWelcomeSlogan()
    addToast(message, 'success')
    setScreen('app')
  }

  const handleSubmit = async event => {
    event.preventDefault()
    setError('')
    if (mode === 'signup' && !name.trim()) { setError('Enter your name.'); return }
    if (!email.trim()) { setError('Enter your email address.'); return }
    if (password.length < (mode === 'signup' ? 8 : 1)) {
      setError(mode === 'signup' ? 'Use a password with at least 8 characters.' : 'Enter your password.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/${mode === 'signup' ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { setError(data.error || 'Could not sign in. Please try again.'); return }
      enterApp(data.user, mode === 'signup' ? `Welcome to FinTrack, ${data.user.name}!` : `Welcome back, ${data.user.name}!`)
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setLoading(false)
    }
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
      </div>}

      <aside className="auth-illustration">
        <div className="auth-scene-copy">
          <span className="auth-scene-kicker">YOUR MONEY, IN FOCUS</span>
          <h1>Make every<br /><em>move count.</em></h1>
          <p>One clear view for your spending, savings, and next steps.</p>
        </div>
        <div className="auth-illustration-footer"><span className="auth-footer-dot" />A clearer view of your finances</div>
      </aside>

      <section className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="auth-logo">
            <div className="auth-logo-icon" aria-hidden="true">F</div>
            <span className="auth-logo-name">Fin<em>Track</em></span>
          </div>

          <h2>{mode === 'login' ? 'Welcome back' : 'Create account'}</h2>
          <p>{mode === 'login' ? 'Sign in to continue' : 'Start managing your money with clarity'}</p>

          {error && <div className="auth-error" role="alert">{error}</div>}

          <form onSubmit={handleSubmit}>
            {mode === 'signup' && <div className="auth-form-group">
              <label htmlFor="auth-name">Name</label>
              <input id="auth-name" type="text" value={name} onChange={event => setName(event.target.value)} placeholder="Your name" autoComplete="name" />
            </div>}

            <div className="auth-form-group">
              <label htmlFor="auth-email">Email address</label>
              <input id="auth-email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" />
            </div>

            <div className="auth-form-group">
              <label htmlFor="auth-password">Password</label>
              <div className="auth-password-field">
                <input id="auth-password" type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
                <button type="button" className="auth-password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? 'Hide' : 'Show'}</button>
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', padding: '11px', marginTop: 4 }} disabled={loading}>
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="auth-switch">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <a href="#" onClick={event => { event.preventDefault(); setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}>{mode === 'login' ? 'Create account' : 'Sign in'}</a>
          </p>

          <button className="auth-back-button" onClick={() => setScreen('landing')}>← Back to home</button>
        </div>
      </section>
    </div>
  )
}
