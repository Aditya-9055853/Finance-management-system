import React from 'react'
import { BarChart2, Target, Wallet, ArrowRight } from 'lucide-react'
import { useApp } from '../App'

const FEATURES = [
  { icon: Wallet, title: 'Track your money', desc: 'Keep income and expenses organized in one clear view.' },
  { icon: BarChart2, title: 'Understand your spending', desc: 'See where your money goes with simple monthly summaries.' },
  { icon: Target, title: 'Plan what matters', desc: 'Set budgets and savings goals that work for you.' },
]

export default function Landing() {
  const { setScreen } = useApp()

  return (
    <div className="landing">
      <nav className="landing-nav">
        <span className="landing-brand">Fin<em>Track</em></span>
        <div className="landing-nav-actions">
          <button className="btn-ghost" onClick={() => setScreen('auth')}>Sign in</button>
          <button className="btn-primary" onClick={() => setScreen('auth')}>Create account</button>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-copy">
          <span className="landing-eyebrow">PERSONAL FINANCE, MADE CLEAR</span>
          <h1>A clearer view of <span className="accent">your money.</span></h1>
          <p>Track spending, understand your habits, and plan your next steps—all in one place.</p>
          <div className="landing-hero-actions">
            <button className="btn-primary" onClick={() => setScreen('auth')}>
              Get started <ArrowRight size={16} />
            </button>
          </div>
        </div>

        <div className="landing-visual">
          <div className="wallet-scene" role="img" aria-label="A FinTrack wallet with coins">
            <div className="wallet-orbit wallet-orbit-one" />
            <div className="wallet-orbit wallet-orbit-two" />
            <span className="wallet-coin coin-one">₹</span>
            <span className="wallet-coin coin-two">₹</span>
            <span className="wallet-coin coin-three">₹</span>
            <span className="wallet-coin coin-four">₹</span>
            <span className="wallet-coin coin-five">₹</span>
            <div className="wallet-shadow" />
            <div className="wallet-back" />
            <div className="wallet-body">
              <span className="wallet-brand-mark">F</span>
              <span className="wallet-stitch" />
              <span className="wallet-pocket" />
              <span className="wallet-clasp"><i /></span>
            </div>
            <div className="wallet-caption"><strong>Money in motion</strong><span>Every choice adds up.</span></div>
          </div>
        </div>
      </section>

      <section className="landing-features" aria-label="FinTrack features">
        {FEATURES.map(({ icon: Icon, title, desc }) => (
          <article className="feature-card" key={title}>
            <div className="feature-icon"><Icon size={20} /></div>
            <h3>{title}</h3>
            <p>{desc}</p>
          </article>
        ))}
      </section>
    </div>
  )
}
