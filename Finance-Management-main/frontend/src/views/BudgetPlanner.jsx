import React, { useEffect, useState } from 'react'
import { CalendarDays, Gauge, Wallet } from 'lucide-react'
import { useApp } from '../App'
import FeatureNote from '../components/FeatureNote'

const fmt = value => `₹${(Number(value) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
const pct = value => `${(Number(value) || 0).toFixed(1)}%`
const DEFAULT_CATS = ['Food', 'Transport', 'Shopping', 'Entertainment', 'Groceries', 'Bills']
const currentMonth = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).format(new Date())
  return parts
}

export default function BudgetPlanner() {
  const { categories, monthly } = useApp()
  const cats = Object.keys(categories).length ? Object.keys(categories).sort() : DEFAULT_CATS
  const [budgets, setBudgets] = useState({})
  const [month, setMonth] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setBudgets(previous => Object.fromEntries(cats.map(category => [category, previous[category] || ''])))
  }, [categories])

  useEffect(() => {
    let active = true
    fetch('/api/budget')
      .then(response => response.ok ? response.json() : Promise.reject(new Error('Could not load saved budgets.')))
      .then(data => {
        if (active && data.budgets) setBudgets(previous => ({ ...previous, ...data.budgets }))
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  const period = month || monthly.at(-1)?.month || currentMonth()
  const historicalAverage = category => monthly.length ? (Number(categories[category]) || 0) / monthly.length : 0

  const setBudget = (category, value) => {
    setBudgets(previous => ({ ...previous, [category]: value }))
    setResult(null)
  }

  const checkBudgets = async () => {
    const filled = Object.fromEntries(Object.entries(budgets).filter(([, value]) => value !== '' && Number(value) > 0).map(([category, value]) => [category, Number(value)]))
    if (!Object.keys(filled).length) { setError('Enter at least one positive monthly budget.'); return }
    setError(''); setLoading(true)
    try {
      const response = await fetch('/api/budget', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budgets: filled, month: period }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Budget check failed.')
      setResult(data.results)
    } catch (err) { setError(err.message || 'Network error.') }
    finally { setLoading(false) }
  }

  const over = result?.filter(row => row.status === 'Over budget') || []
  return (
    <div className="view-panel budget-page">
      <div className="view-header">
        <div><span className="investment-eyebrow">Build a plan you can revisit</span><h1>Budget Planner</h1><p>Choose a month, set category limits, and compare them with that month’s actual spending.</p></div>
      </div>

      <FeatureNote tone="slogan" slogan="A useful budget gives every dollar a job." tip="Start with your recurring essentials, then set flexible limits for the categories you can adjust. Historical averages are just a reference, not a recommended target." />

      <section className="panel budget-builder">
        <div className="budget-builder-heading"><div><span className="transactions-eyebrow"><Gauge size={13} /> MONTHLY PLAN</span><h2>Set your spending limits</h2><p>Budgets are saved for your next visit.</p></div><label className="budget-month-label"><span><CalendarDays size={14} /> Month to review</span><input type="month" value={period} onChange={event => { setMonth(event.target.value); setResult(null) }} /></label></div>
        {error && <div className="auth-error budget-error" role="alert">{error}</div>}
        <div className="budget-input-grid">
          {cats.map(category => {
            const average = historicalAverage(category)
            const suggestion = Math.round(average / 100) * 100
            return <label className="budget-input-card" key={category}>
              <span className="budget-input-label"><span>{category}</span><Wallet size={15} /></span>
              <span className="budget-input-control"><span>₹</span><input type="number" min="0" step="100" placeholder="Monthly limit" value={budgets[category] || ''} onChange={event => setBudget(category, event.target.value)} aria-label={`${category} monthly budget`} /></span>
              <span className="budget-history-hint">{average > 0 ? <>Recorded average: <strong>{fmt(average)}</strong><button type="button" onClick={() => setBudget(category, String(suggestion))}>Use as starting point</button></> : 'Add records to see a historical average.'}</span>
            </label>
          })}
        </div>
        <div className="budget-submit-row"><p>Actuals are calculated from the selected month only.</p><button className="btn-primary" onClick={checkBudgets} disabled={loading}>{loading ? 'Checking month…' : 'Review this month'}</button></div>
      </section>

      {result && <section className="result-box budget-results">
        <div className="budget-results-head"><div><span className="transactions-eyebrow">{period}</span><h2>Monthly budget review</h2></div><span className="badge badge-orange">{result.length} categories</span></div>
        {result.map(row => <article className="budget-result-row" key={row.category}>
          <div className="budget-result-top"><strong>{row.category}</strong><span className={`budget-status ${row.status === 'Over budget' ? 'over' : row.status === 'Within budget' ? 'within' : ''}`}>{row.status}</span></div>
          <div className="budget-result-numbers"><span>Spent <strong>{fmt(row.actual)}</strong></span><span>Limit <strong>{fmt(row.budget)}</strong></span><span>{row.remaining >= 0 ? 'Remaining' : 'Over by'} <strong>{fmt(Math.abs(row.remaining))}</strong></span><span>Used <strong>{pct(row.pct_used)}</strong></span></div>
          <div className="budget-progress"><i className={row.status === 'Over budget' ? 'over' : ''} style={{ width: `${Math.min(Math.max(Number(row.pct_used) || 0, 0), 100)}%` }} /></div>
        </article>)}
        <FeatureNote slogan={over.length ? 'Pick one category to adjust first.' : 'Consistency beats a perfect spreadsheet.'} tip={over.length ? `${over.map(row => row.category).join(', ')} ${over.length === 1 ? 'is' : 'are'} over the limit this month. Check those transactions and decide whether the limit or the plan needs adjusting.` : 'Keep the limits realistic and review them after the month closes. This compares only transactions currently loaded in the app.'} />
      </section>}
    </div>
  )
}
