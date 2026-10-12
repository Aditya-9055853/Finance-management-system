import React, { useMemo, useState } from 'react'
import { Activity, CalendarDays, Heart, Lightbulb, Repeat2, Target } from 'lucide-react'
import { useApp } from '../App'
import FeatureNote from '../components/FeatureNote'

const REPORTS = [
  { id: 'health', icon: Heart, title: 'Financial health', text: 'Strengths, pressure points, and the data behind them.', query: 'Give me a comprehensive financial health analysis based on my transactions. State which figures are from my records, identify strengths and pressure points, and give three practical next steps.' },
  { id: 'spending', icon: Lightbulb, title: 'Spending patterns', text: 'Find category changes and explain what may be driving them.', query: 'Analyze my spending patterns in detail. Compare categories across available months, identify the largest changes, and suggest practical questions I should review. Do not call a category wasteful without evidence.' },
  { id: 'recurring', icon: Repeat2, title: 'Recurring charges', text: 'Look for repeated descriptions that may be subscriptions or bills.', query: 'Review my recent transactions for descriptions that repeat across dates. List the repeated records with dates and amounts, and label them as possible recurring charges, not confirmed subscriptions.' },
  { id: 'cashflow', icon: Activity, title: 'Monthly cash flow', text: 'Compare recorded income, expenses, and net cash flow by month.', query: 'Summarize my monthly cash flow from the transaction records. Compare the latest available months, calculate the net amounts, and clearly state when the data is incomplete.' },
  { id: 'goal', icon: Target, title: 'Savings pace', text: 'Turn your recorded income and spending into a goal-planning discussion.', query: 'Based on my recorded income and expenses, explain my average savings capacity and what information is missing before I set a savings goal. Avoid guaranteeing that this pace will continue.' },
  { id: 'statement', icon: CalendarDays, title: 'Statement summary', text: 'Summarize the latest month and call out the largest recorded debit.', query: 'Summarize my latest month of transactions: total income, expenses, net cash flow, number of records, largest expense, and top expense categories. Use only available transaction data.' },
]

export default function AIInsights() {
  const { transactions, categories } = useApp()
  const [result, setResult] = useState('')
  const [activeReport, setActiveReport] = useState('')
  const [error, setError] = useState('')
  const topCategory = useMemo(() => Object.entries(categories).sort((a, b) => b[1] - a[1])[0], [categories])

  const load = async report => {
    setError(''); setActiveReport(report.id); setResult('')
    try {
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: report.query }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Insight generation failed.')
      setResult(data.answer || 'No insight generated.')
    } catch (err) { setError(err.message || 'Network error.') }
    finally { setActiveReport('') }
  }

  return (
    <div className="view-panel insights-page">
      <div className="view-header"><div><span className="investment-eyebrow">Your records, explained</span><h1>Financial Health & Insights</h1><p>Choose a focused report and get the facts and follow-up questions that matter.</p></div></div>
      <FeatureNote slogan="Good insight starts with a specific question." tip={topCategory ? `Your largest recorded spending category is ${topCategory[0]} (${transactions.length} transactions loaded). Start there if you want to review spending patterns.` : 'Import a statement or add transactions to get reports grounded in your financial activity.'} />

      <section className="insight-report-grid" aria-label="Available financial reports">
        {REPORTS.map(({ id, icon: Icon, title, text, query }) => (
          <button className={`insight-report-card ${activeReport === id ? 'selected' : ''}`} key={id} onClick={() => load({ id, query })} disabled={!!activeReport}>
            <span className="insight-report-icon"><Icon size={18} /></span><strong>{title}</strong><p>{text}</p><span className="insight-report-cta">{activeReport === id ? 'Building report…' : 'Generate report'}</span>
          </button>
        ))}
      </section>

      {error && <div className="auth-error insight-error" role="alert">{error}</div>}
      <section className="panel insight-result-panel">
        <div className="panel-header"><div><span className="transactions-eyebrow">PERSONALIZED REVIEW</span><h2>{activeReport ? 'Preparing your report' : result ? 'Your report' : 'Your insights will appear here'}</h2></div></div>
        <div className="panel-body">
          {activeReport ? <div className="insight-loading"><div className="spinner" /><span>Checking the available transaction data…</span></div> : result ? <div className="insights-result">{result}</div> : <div className="insight-empty"><Lightbulb size={19} /><span>Choose one of the reports above to get started.</span></div>}
          {result && !activeReport && <p className="insight-source-note">Reports use transactions currently loaded in this app. Repeated merchants are only possible recurring charges until you verify them.</p>}
        </div>
      </section>
      <div className="insight-data-footnote">AI-generated explanations can be incomplete. Verify the underlying statement and figures before making financial decisions.</div>
    </div>
  )
}
