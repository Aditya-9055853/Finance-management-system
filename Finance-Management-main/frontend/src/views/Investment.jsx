import React, { useMemo, useState } from 'react'
import { ArrowUpRight, BookOpen, ChartNoAxesColumnIncreasing, CircleHelp, Landmark, ShieldCheck, TrendingUp, Upload } from 'lucide-react'
import { useApp } from '../App'

function fmt(v) { return '₹' + (Number(v) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }) }

const RESEARCH_AREAS = [
  { icon: TrendingUp, title: 'Company shares', risk: 'Higher volatility', tone: 'risk-high', text: 'Research business health, debt, cash flow, valuation, and how a company performs across market cycles.' },
  { icon: ChartNoAxesColumnIncreasing, title: 'Diversified equity funds', risk: 'Market risk', tone: 'risk-medium', text: 'Compare the fund objective, diversification, fees, tracking difference, and long-term downside periods.' },
  { icon: Landmark, title: 'Bonds & debt funds', risk: 'Issuer & rate risk', tone: 'risk-medium', text: 'Check who owes the money, credit quality, maturity, interest-rate sensitivity, liquidity, and fees.' },
  { icon: ShieldCheck, title: 'Deposits & cash options', risk: 'Terms vary', tone: 'risk-low', text: 'Compare access, withdrawal rules, inflation impact, tax treatment, and any applicable protection limits.' },
]

export default function Investment() {
  const { monthly, summary, setUploadOpen } = useApp()
  const [mode, setMode] = useState('sip')
  const [amount, setAmount] = useState('')
  const [rate, setRate] = useState('')
  const [years, setYears] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const history = useMemo(() => {
    const rows = (monthly || []).slice(-6).map(row => ({
      ...row,
      surplus: (Number(row.income) || 0) - (Number(row.expenses) || 0),
    }))
    const positive = rows.filter(row => row.surplus > 0).map(row => row.surplus).sort((a, b) => a - b)
    const median = positive.length
      ? positive.length % 2
        ? positive[(positive.length - 1) / 2]
        : (positive[positive.length / 2 - 1] + positive[positive.length / 2]) / 2
      : 0
    return { rows, positiveCount: rows.filter(row => row.surplus > 0).length, medianPositive: median }
  }, [monthly])

  const calcGrowth = () => {
    setError('')
    const principal = Number(amount), annualRate = Number(rate) / 100, duration = Number(years)
    if (!principal || rate === '' || years === '' || principal <= 0 || Number(rate) < 0 || duration <= 0) {
      setError('Enter a positive amount and duration, and a hypothetical return of zero or more.'); return
    }
    if (mode === 'sip') {
      const monthlyRate = annualRate / 12
      const installments = duration * 12
      const invested = principal * installments
      const maturity = monthlyRate === 0
        ? invested
        : principal * (Math.pow(1 + monthlyRate, installments) - 1) / monthlyRate * (1 + monthlyRate)
      setResult({ maturity, invested, gains: maturity - invested })
    } else {
      const maturity = principal * Math.pow(1 + annualRate, duration)
      setResult({ maturity, invested: principal, gains: maturity - principal })
    }
  }

  const maxSurplus = Math.max(1, ...history.rows.map(row => Math.abs(row.surplus)))
  const hasHistory = history.rows.length > 0

  return (
    <div className="view-panel investment-page">
      <div className="view-header">
        <div>
          <span className="investment-eyebrow">Plan with context</span>
          <h1>Investing &amp; SIP planner</h1>
          <p>Review your cash flow, explore investment types, and model hypothetical growth.</p>
        </div>
      </div>

      <section className="investment-history panel">
        <div className="investment-section-head">
          <div><span className="investment-eyebrow">Your transaction history</span><h2>Cash flow snapshot</h2></div>
          {!hasHistory && <button className="btn-ghost" onClick={() => setUploadOpen(true)}><Upload size={15} /> Import transactions</button>}
        </div>
        {hasHistory ? (
          <>
            <div className="cashflow-stats">
              <div><span>Typical positive-month surplus*</span><strong>{fmt(history.medianPositive)}</strong></div>
              <div><span>Positive months</span><strong>{history.positiveCount} <small>of {history.rows.length}</small></strong></div>
              <div><span>Current recorded balance</span><strong>{fmt(summary?.balance)}</strong></div>
            </div>
            <div className="cashflow-bars" aria-label="Monthly income minus expenses for recent months">
              {history.rows.map(row => (
                <div className="cashflow-month" key={row.month} title={`${row.month}: ${fmt(row.surplus)} net cash flow`}>
                  <div className="cashflow-bar-track"><span className={row.surplus < 0 ? 'negative' : ''} style={{ height: `${Math.max(5, Math.abs(row.surplus) / maxSurplus * 100)}%` }} /></div>
                  <small>{row.month}</small>
                </div>
              ))}
            </div>
            <p className="investment-footnote">*Median surplus among positive months, using up to the latest 6 months of transactions. This describes cash flow only; it is not an investment budget or a prediction.</p>
          </>
        ) : (
          <div className="investment-no-data"><span className="empty-chart-icon"><ChartNoAxesColumnIncreasing size={19} /></span><div><strong>Add transaction history for a cash-flow review</strong><p>FinAI can summarize income and expenses here. It does not have stock, bond, or portfolio price history.</p></div></div>
        )}
      </section>

      <section className="investment-research">
        <div className="investment-section-head">
          <div><span className="investment-eyebrow">Learn what to compare</span><h2>Investment research guide</h2></div>
          <span className="investment-info"><CircleHelp size={15} /> Education, not picks</span>
        </div>
        <div className="research-grid">
          {RESEARCH_AREAS.map(({ icon: Icon, title, risk, tone, text }) => (
            <article className="research-card" key={title}>
              <div className="research-card-top"><span className="research-icon"><Icon size={18} /></span><span className={`risk-tag ${tone}`}>{risk}</span></div>
              <h3>{title}</h3><p>{text}</p>
              <span className="research-link"><BookOpen size={14} /> What to evaluate</span>
            </article>
          ))}
        </div>
        <p className="investment-disclaimer">This app does not recommend specific stocks, bonds, or funds. Your transaction history is not investment-performance data. Past performance does not predict future results; investment values can fall as well as rise. <a href="https://investor.sebi.gov.in/pdf/reference-material/MFunds.pdf" target="_blank" rel="noreferrer">SEBI investor guidance</a></p>
      </section>

      <section className="panel sip-calculator">
        <div className="panel-header"><div><h3>Growth scenario calculator</h3><p>Explore a hypothetical rate; it is not a forecast.</p></div></div>
        <div className="panel-body">
          {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}
          <div style={{ marginBottom: 14 }}>
            <label>Contribution type
              <select value={mode} onChange={e => { setMode(e.target.value); setResult(null) }} style={{ maxWidth: 260 }}>
                <option value="sip">Monthly contribution (SIP-style)</option>
                <option value="lumpsum">One-time amount</option>
              </select>
            </label>
          </div>
          <div className="goal-form">
            <label>{mode === 'sip' ? 'Monthly contribution (₹)' : 'One-time amount (₹)'}
              <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder={mode === 'sip' ? '5000' : '100000'} />
            </label>
            <label>Hypothetical annual return (%)<input type="number" min="0" value={rate} onChange={e => setRate(e.target.value)} placeholder="8" step="0.1" /></label>
            <label>Duration (years)<input type="number" min="0.5" value={years} onChange={e => setYears(e.target.value)} placeholder="10" step="0.5" /></label>
          </div>
          <button className="btn-primary" onClick={calcGrowth}>Calculate scenario <ArrowUpRight size={15} /></button>
          <p className="investment-footnote">The calculator assumes the same return every period and excludes fees, taxes, and inflation. Real returns vary and can be negative.</p>
        </div>
      </section>

      {result && (
        <div className="result-box">
          <h4>Illustrative scenario</h4>
          <div className="result-row"><span>Projected value</span><strong style={{ color: 'var(--accent)', fontSize: 18 }}>{fmt(result.maturity)}</strong></div>
          <div className="result-row"><span>Total contributions</span><strong style={{ color: 'var(--green)' }}>{fmt(result.invested)}</strong></div>
          <div className="result-row"><span>Illustrative growth</span><strong style={{ color: 'var(--blue)' }}>{fmt(result.gains)}</strong></div>
          <div className="investment-disclaimer">A mathematical illustration only. It does not identify suitable investments or estimate what a real investment will earn.</div>
        </div>
      )}
    </div>
  )
}
