import React, { useEffect, useState } from 'react'
import { useApp } from '../App'
import {
  createFirebaseAccount,
  getFirebaseEmailVerified,
  openFinTrackSession,
  sendFirebaseVerification,
  signInWithFirebase,
} from '../firebaseAuth'

export default function AuthScreen() {
  const { setScreen, setUser, addToast, chooseWelcomeSlogan } = useApp()
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pendingIdToken, setPendingIdToken] = useState('')
  const [verificationRequired, setVerificationRequired] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
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

  const enterApp = (user, message = `Welcome, ${user.name}!`) => {
    setUser(user)
    chooseWelcomeSlogan()
    addToast(message, 'success')
    setScreen('app')
  }

  const handleSubmit = async event => {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!email.trim()) { setError('Email is required.'); return }
    if (!password || (mode === 'signup' && password.length < 8)) {
      setError('Passwords must be at least 8 characters.')
      return
    }
    if (mode === 'signup' && !name.trim()) { setError('Name is required.'); return }

    setLoading(true)
    try {
      if (mode === 'signup') {
        const account = await createFirebaseAccount(email.trim(), password, name.trim())
        await sendFirebaseVerification(account.idToken)
        setPendingIdToken(account.idToken)
        setVerificationRequired(true)
        setNotice(`We sent a verification link to ${email.trim()}. Open that email, click the link, then return here and sign in.`)
        return
      }

      const account = await signInWithFirebase(email.trim(), password)
      const verified = await getFirebaseEmailVerified(account.idToken)
      if (!verified) {
        await sendFirebaseVerification(account.idToken)
        setPendingIdToken(account.idToken)
        setVerificationRequired(true)
        setNotice(`Your email is not verified yet. We sent a verification link to ${email.trim()}.`)
        return
      }

      const user = await openFinTrackSession(account.idToken)
      enterApp(user)
    } catch (requestError) {
      setError(requestError.message || 'Could not complete sign-in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const resendVerification = async () => {
    if (!pendingIdToken) {
      setVerificationRequired(false)
      setMode('login')
      setNotice('Sign in again to request a new verification link.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await sendFirebaseVerification(pendingIdToken)
      setNotice(`A new verification link was sent to ${email.trim()}.`)
    } catch (requestError) {
      setError(requestError.message || 'Could not send the verification link.')
    } finally {
      setLoading(false)
    }
  }

  const returnToSignIn = () => {
    setVerificationRequired(false)
    setPendingIdToken('')
    setMode('login')
    setError('')
    setNotice('After you click the verification link, sign in here with your email and password.')
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
        <div className="auth-illustration-footer"><span className="auth-footer-dot" />A smarter view of your finances</div>
      </aside>

      <section className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="auth-logo">
            <div className="auth-logo-icon" aria-hidden="true">F</div>
            <span className="auth-logo-name">Fin<em>Track</em></span>
          </div>

          <h2>{verificationRequired ? 'Check your email' : mode === 'login' ? 'Welcome back' : 'Create account'}</h2>
          <p>{verificationRequired ? 'Verify your email address using the link we sent.' : mode === 'login' ? 'Sign in to your account' : 'Create an account with a verified email address'}</p>

          {error && <div className="auth-error" role="alert">{error}</div>}
          {notice && <div className="auth-notice" role="status">{notice}</div>}

          {!verificationRequired && <form onSubmit={handleSubmit}>
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
                <input id="auth-password" type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
                <button type="button" className="auth-password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? 'Hide' : 'Show'}</button>
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', padding: '11px', marginTop: 4 }} disabled={loading}>
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>}

          {verificationRequired ? <div className="auth-verification-actions">
            <button type="button" className="auth-link-button" onClick={resendVerification} disabled={loading}>Send another link</button>
            <button type="button" className="auth-link-button muted" onClick={returnToSignIn}>Back to sign in</button>
          </div> : <p className="auth-switch">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <a href="#" onClick={event => { event.preventDefault(); setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setNotice('') }}>{mode === 'login' ? 'Sign up' : 'Sign in'}</a>
          </p>}

          <p className="auth-security-note">Email verification is handled securely by Firebase. Never share your banking PIN or OTP.</p>
          <button className="auth-back-button" onClick={() => setScreen('landing')}>← Back to home</button>
        </div>
      </section>
    </div>
  )
}
