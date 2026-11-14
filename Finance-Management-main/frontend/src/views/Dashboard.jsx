import React from 'react'
import {
  TrendingUp, TrendingDown, Percent, Wallet, ArrowUpRight, ArrowDownRight,
  Plus, Upload,
} from 'lucide-react'
import { Doughnut, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, PointElement, LineElement, Filler,
} from 'chart.js'
import { useApp } from '../App'
import { PALETTE, chartColors, alpha } from '../theme'
import useCountUp from '../useCountUp'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Filler)

function fmt(value) {
  return '₹' + (Number(value) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function fmtPct(value) {
  return (Number(value) || 0).toFixed(1) + '%'
}

function monthDelta(monthly, pick) {
  if (!monthly || monthly.length < 2) return null
  const current = Number(pick(monthly[monthly.length - 1])) || 0
  const previous = Number(pick(monthly[monthly.length - 2])) || 0
  if (!previous) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

function CountUp({ value, format }) {
  return <>{format(useCountUp(value))}</>
}

function Delta({ value, invert = false, suffix }) {
  if (value == null) return <span>{suffix}</span>
  const up = value >= 0
  const isGood = invert ? !up : up
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`delta ${isGood ? 'up' : 'down'}`}>
      <Icon size={12} /> {Math.abs(value).toFixed(0)}% {suffix}
    </span>
  )
}

export default function Dashboard() {
  const { summary, transactions, categories, monthly, user, theme, welcomeSlogan, setUploadOpen, setActiveView } = useApp()
  const colors = chartColors(theme)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.name?.split(' ')[0] || 'there'
  const topCategories = Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const incomeDelta = monthDelta(monthly, item => item.income)
  const expenseDelta = monthDelta(monthly, item => item.expenses)
  const balanceDelta = monthDelta(monthly, item => (Number(item.income) || 0) - (Number(item.expenses) || 0))

  const doughnutData = {
    labels: topCategories.map(([name]) => name),
    datasets: [{
      data: topCategories.map(([, amount]) => amount),
      backgroundColor: PALETTE.slice(0, topCategories.length),
      borderWidth: 0,
      hoverOffset: 5,
    }],
  }
  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '74%',
    plugins: {
      legend: {
        position: 'right',
        labels: { color: colors.legend, font: { size: 11 }, boxWidth: 8, usePointStyle: true, pointStyle: 'circle', padding: 12 },
      },
      tooltip: { callbacks: { label: context => ` ${context.label}: ${fmt(context.raw)}` } },
    },
  }

  const lineData = {
    labels: monthly.map(item => item.month),
    datasets: [
      {
        label: 'Income', data: monthly.map(item => item.income),
        borderColor: colors.income, backgroundColor: alpha(colors.income, 0.08),
        fill: true, tension: 0.35, pointRadius: 2, borderWidth: 2,
      },
      {
        label: 'Expenses', data: monthly.map(item => item.expenses),
        borderColor: colors.expense, backgroundColor: alpha(colors.expense, 0.06),
        fill: true, tension: 0.35, pointRadius: 2, borderWidth: 2,
      },
    ],
  }
  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: colors.legend, font: { size: 11 }, boxWidth: 8, usePointStyle: true, pointStyle: 'circle' } },
      tooltip: { callbacks: { label: context => ` ${context.dataset.label}: ${fmt(context.raw)}` } },
    },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: colors.tick, font: { size: 10 } } },
      y: { grid: { color: colors.grid }, border: { display: false }, ticks: { color: colors.tick, font: { size: 10 }, callback: value => fmt(value) } },
    },
  }
  const recentTransactions = transactions.slice(0, 6)

  return (
    <div className="view-panel dashboard-clean">
      <header className="dash-hello">
        <div>
          <span className="dashboard-eyebrow">FINANCIAL OVERVIEW</span>
          <h1>{greeting}, {firstName}</h1>
          <p>{welcomeSlogan || 'A clear picture of your money, all in one place.'}</p>
        </div>
        <div className="dashboard-actions">
          <button className="btn-ghost" onClick={() => setUploadOpen(true)}><Upload size={16} /> Import</button>
          <button className="btn-primary" onClick={() => setActiveView('transactions')}><Plus size={16} /> Add transaction</button>
        </div>
      </header>

      <section className="dashboard-overview" aria-label="Account overview">
        <article className="balance-card">
          <span className="balance-label">Net balance</span>
          <div className="balance-amount"><CountUp value={summary.balance} format={fmt} /></div>
          <div className="delta-row">
            <Delta value={balanceDelta} suffix="vs. last month" />
            {balanceDelta == null && <span>Income minus expenses</span>}
          </div>
        </article>

        <article className="kpi">
          <div className="kpi-top"><span className="kpi-label">Income</span><span className="kpi-icon"><Wallet size={17} /></span></div>
          <div className="kpi-value"><CountUp value={summary.total_income} format={fmt} /></div>
          <div className="kpi-foot"><Delta value={incomeDelta} suffix="this month" />{incomeDelta == null && <span>{summary.transaction_count || 0} entries</span>}</div>
        </article>

        <article className="kpi">
          <div className="kpi-top"><span className="kpi-label">Expenses</span><span className="kpi-icon"><TrendingDown size={17} /></span></div>
          <div className="kpi-value"><CountUp value={summary.total_expenses} format={fmt} /></div>
          <div className="kpi-foot"><Delta value={expenseDelta} invert suffix="this month" />{expenseDelta == null && <span>{Object.keys(categories).length} categories</span>}</div>
        </article>

        <article className="kpi">
          <div className="kpi-top"><span className="kpi-label">Savings rate</span><span className="kpi-icon"><Percent size={17} /></span></div>
          <div className="kpi-value"><CountUp value={summary.savings_rate} format={fmtPct} /></div>
          <div className="kpi-foot">
            <span className={`delta ${(Number(summary.savings_rate) || 0) >= 20 ? 'up' : 'down'}`}>
              {(Number(summary.savings_rate) || 0) >= 20 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {(Number(summary.savings_rate) || 0) >= 20 ? 'On track' : 'Below 20% target'}
            </span>
          </div>
        </article>
      </section>

      <section className="chart-grid dashboard-charts" aria-label="Spending charts">
        <article className="chart-card">
          <div className="chart-card-header"><div><h3>Spending breakdown</h3><p>Where your expenses go</p></div></div>
          <div className="chart-wrapper">
            {topCategories.length ? <Doughnut data={doughnutData} options={doughnutOptions} /> : <EmptyChart onUpload={() => setUploadOpen(true)} />}
          </div>
        </article>
        <article className="chart-card">
          <div className="chart-card-header"><div><h3>Monthly cash flow</h3><p>Income compared with expenses</p></div></div>
          <div className="chart-wrapper">
            {monthly.length ? <Line data={lineData} options={lineOptions} /> : <EmptyChart onUpload={() => setUploadOpen(true)} />}
          </div>
        </article>
      </section>

      <section className="panel recent-panel">
        <div className="panel-header">
          <div><h3>Recent transactions</h3><p>Your latest activity</p></div>
          <button className="btn-ghost" onClick={() => setActiveView('transactions')}>View all <span>{transactions.length}</span></button>
        </div>
        <div className="recent-table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th></tr></thead>
            <tbody>
              {recentTransactions.length ? recentTransactions.map(transaction => (
                <tr key={transaction.id ?? transaction.date + transaction.description}>
                  <td className="recent-date">{transaction.date}</td>
                  <td className="recent-description">{transaction.description}</td>
                  <td><span className="badge badge-blue">{transaction.category}</span></td>
                  <td><span className={`recent-amount ${transaction.type === 'income' ? 'income' : 'expense'}`}>{transaction.type === 'income' ? '+' : '−'}{fmt(transaction.amount)}</span></td>
                </tr>
              )) : <tr><td colSpan={4} className="recent-empty">No transactions yet. Import a CSV or add your first transaction.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function EmptyChart({ onUpload }) {
  return (
    <div className="empty-chart">
      <span className="empty-chart-icon"><TrendingUp size={19} /></span>
      <strong>Your chart starts with a transaction</strong>
      <span>Import a CSV to see your trends.</span>
      <button className="empty-chart-action" onClick={onUpload}><Upload size={14} /> Import CSV</button>
    </div>
  )
}
