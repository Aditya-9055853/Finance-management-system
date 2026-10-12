import React from 'react'
import { TrendingUp, Zap, BarChart2, DollarSign, ArrowRight } from 'lucide-react'
import { useApp } from '../App'

const FEATURES = [
  { icon: BarChart2, title: 'Real Analytics', desc: 'Category spending, savings rate, and monthly cashflow trends in interactive charts.' },
  { icon: Zap, title: 'FinTrack Assistant', desc: 'Ask anything about your finances. Powered by Gemini AI with deterministic Python tools.' },
  { icon: DollarSign, title: 'Budget & Goal Planners', desc: 'Set targets per category and calculate your path to savings milestones.' },
  { icon: TrendingUp, title: 'EMI & SIP Calculators', desc: 'Reducing-balance EMI, SIP compound growth, and live currency converter.' },
]

export default function Landing() {
  const { setScreen } = useApp()

  return (
    <div className="landing">
      <nav className="landing-nav">
        <span className="landing-brand">Fin<em>Track</em></span>
        <div className="landing-nav-actions">
          <button className="btn-ghost" onClick={() => setScreen('auth')}>Log In</button>
          <button className="btn-primary" onClick={() => setScreen('auth')}>Get started</button>
        </div>
      </nav>

      <section className="landing-hero">
        <div>
          <span className="landing-eyebrow">✦ Smart personal finance</span>
          <h1>Accelerate your <span className="accent">financial clarity.</span></h1>
          <p>Track income and expenses, set monthly budgets, monitor trends, and converse with an intelligent AI assistant grounded in your real financial data.</p>
          <div className="landing-hero-actions">
            <button className="btn-primary" style={{ padding: '12px 28px', fontSize: 15 }} onClick={() => setScreen('auth')}>
              Get Started Free
              <ArrowRight size={16} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 6 }} />
            </button>
            <button className="btn-ghost" style={{ padding: '12px 24px' }} onClick={() => setScreen('app')}>
              Skip login & launch
            </button>
          </div>
          <div className="landing-stats">
            <div className="landing-stat"><strong>100%</strong><span>Grounded data</span></div>
            <div className="landing-stat"><strong>₹0</strong><span>Free & private</span></div>
            <div className="landing-stat"><strong>AI</strong><span>Gemini + RAG</span></div>
          </div>
        </div>

        <div className="landing-visual">
          <div className="wallet-scene" role="img" aria-label="An animated wallet tossing coins">
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
          <div className="landing-float-row">
            <div className="float-card">
              <div className="float-card-dot" style={{ background: 'var(--green)' }} />
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>↑ Monthly Income</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>₹50,000</div>
              </div>
            </div>
            <div className="float-card">
              <div className="float-card-dot" style={{ background: 'var(--accent)' }} />
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>↓ Savings Rate</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>24.5%</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-features">
        {FEATURES.map(f => (
          <div className="feature-card" key={f.title}>
            <div className="feature-icon"><f.icon size={20} /></div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
