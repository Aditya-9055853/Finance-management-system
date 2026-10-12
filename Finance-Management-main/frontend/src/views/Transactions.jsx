import React, { useMemo, useState } from 'react'
import {
  ArrowDownLeft, ArrowDownToLine, ArrowUpRight, CalendarDays, CirclePlus,
  CreditCard, Pencil, Search, ShieldCheck, SlidersHorizontal, Sparkles, Trash2, Wallet,
} from 'lucide-react'
import { useApp } from '../App'
import BankImportModal from '../components/BankImportModal'
import FeatureNote from '../components/FeatureNote'

const today = () => new Date().toISOString().slice(0, 10)
const fmt = value => `₹${(Number(value) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

export default function Transactions() {
  const { transactions, refreshData, addToast } = useApp()
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [sortCol, setSortCol] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [editId, setEditId] = useState(null)
  const [bankModalOpen, setBankModalOpen] = useState(false)
  const [statementMonth, setStatementMonth] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [date, setDate] = useState(today())
  const [desc, setDesc] = useState('')
  const [cat, setCat] = useState('')
  const [type, setType] = useState('expense')
  const [amount, setAmount] = useState('')
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  const totals = useMemo(() => transactions.reduce((acc, t) => {
    const value = Number(t.amount) || 0
    if (t.type === 'income') acc.income += value
    else acc.expenses += value
    return acc
  }, { income: 0, expenses: 0 }), [transactions])
  const defaultStatementMonth = transactions[0]?.date?.slice(0, 7) || new Date().toISOString().slice(0, 7)
  const selectedStatementMonth = statementMonth || defaultStatementMonth
  const statementRows = useMemo(() => transactions.filter(t => t.date?.slice(0, 7) === selectedStatementMonth), [transactions, selectedStatementMonth])
  const statementStats = useMemo(() => {
    const byCategory = {}
    const byDay = new Set()
    const data = statementRows.reduce((acc, row) => {
      const value = Number(row.amount) || 0
      byDay.add(row.date)
      if (row.type === 'income') acc.income += value
      else {
        acc.expenses += value
        byCategory[row.category] = (byCategory[row.category] || 0) + value
        if (!acc.largest || value > Number(acc.largest.amount)) acc.largest = row
      }
      return acc
    }, { income: 0, expenses: 0, largest: null })
    const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]
    return { ...data, activeDays: byDay.size, topCategory, count: statementRows.length }
  }, [statementRows])
  const categories = [...new Set(transactions.map(t => t.category).filter(Boolean))].sort()
  const filtered = useMemo(() => transactions.filter(t => {
    const query = search.trim().toLowerCase()
    if (query && !t.description?.toLowerCase().includes(query) && !t.category?.toLowerCase().includes(query)) return false
    if (catFilter && t.category !== catFilter) return false
    if (typeFilter && t.type !== typeFilter) return false
    return true
  }).sort((a, b) => {
    let av = a[sortCol], bv = b[sortCol]
    if (sortCol === 'amount') { av = Number(av); bv = Number(bv) }
    return (av < bv ? -1 : av > bv ? 1 : 0) * (sortDir === 'asc' ? 1 : -1)
  }), [transactions, search, catFilter, typeFilter, sortCol, sortDir])

  const resetForm = () => {
    setDate(today()); setDesc(''); setCat(''); setType('expense'); setAmount('')
    setFormError(''); setEditId(null); setFormOpen(false)
  }

  const editTransaction = transaction => {
    setEditId(transaction.id); setDate(transaction.date); setDesc(transaction.description)
    setCat(transaction.category); setType(transaction.type); setAmount(String(transaction.amount));
    setFormError(''); setFormOpen(true)
  }

  const deleteTransaction = async id => {
    if (!window.confirm('Delete this transaction?')) return
    try {
      const response = await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error()
      addToast('Transaction deleted', 'success')
      await refreshData()
    } catch { addToast('Could not delete transaction', 'error') }
  }

  const submitTransaction = async event => {
    event.preventDefault()
    setFormError('')
    if (!date || !desc.trim() || !cat.trim() || !amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      setFormError('Add a date, description, category, and positive amount.')
      return
    }
    setFormLoading(true)
    try {
      if (editId !== null) {
        const removed = await fetch(`/api/transactions/${editId}`, { method: 'DELETE' })
        if (!removed.ok) throw new Error('Could not update this transaction.')
      }
      const response = await fetch('/api/transactions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, description: desc.trim(), category: cat.trim(), type, amount: Number(amount) }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not save transaction.')
      addToast(editId === null ? 'Transaction added' : 'Transaction updated', 'success')
      resetForm()
      await refreshData()
    } catch (error) { setFormError(error.message || 'Network error. Please try again.') }
    finally { setFormLoading(false) }
  }

  const sortBy = column => {
    if (sortCol === column) setSortDir(current => current === 'asc' ? 'desc' : 'asc')
    else { setSortCol(column); setSortDir('asc') }
  }
  const sortMark = column => sortCol === column ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  return (
    <div className="view-panel transactions-page">
      <header className="transactions-heading txn-enter" style={{ '--enter-order': 0 }}>
        <div>
          <span className="transactions-eyebrow"><Sparkles size={13} /> MONEY ACTIVITY</span>
          <h1>Your transactions</h1>
          <p>Every deposit and purchase, together in one clear view.</p>
        </div>
        <div className="transactions-actions">
          <button className="btn-ghost txn-action-secondary" onClick={() => setBankModalOpen(true)}><CreditCard size={16} /> Import bank statement</button>
          <button className="btn-primary txn-action-primary" onClick={() => { resetForm(); setFormOpen(true) }}><CirclePlus size={17} /> Add transaction</button>
        </div>
      </header>

      <section className="txn-summary-grid" aria-label="Transaction totals">
        <article className="txn-summary-card txn-summary-total txn-enter" style={{ '--enter-order': 1 }}>
          <div className="txn-summary-top"><span>Money in</span><span className="txn-summary-icon positive"><ArrowDownLeft size={18} /></span></div>
          <strong>{fmt(totals.income)}</strong><small>Across {transactions.filter(t => t.type === 'income').length} deposits</small>
          <span className="txn-summary-orbit" />
        </article>
        <article className="txn-summary-card txn-enter" style={{ '--enter-order': 2 }}>
          <div className="txn-summary-top"><span>Money out</span><span className="txn-summary-icon negative"><ArrowUpRight size={18} /></span></div>
          <strong>{fmt(totals.expenses)}</strong><small>Across {transactions.filter(t => t.type === 'expense').length} payments</small>
        </article>
        <article className="txn-summary-card txn-enter" style={{ '--enter-order': 3 }}>
          <div className="txn-summary-top"><span>Net activity</span><span className="txn-summary-icon neutral"><Wallet size={18} /></span></div>
          <strong className={totals.income - totals.expenses < 0 ? 'txn-negative-value' : ''}>{fmt(totals.income - totals.expenses)}</strong>
          <small>Income minus expenses</small>
        </article>
      </section>

      <section className="statement-card txn-enter" style={{ '--enter-order': 3 }}>
        <div className="statement-heading">
          <div><span className="transactions-eyebrow">MONTHLY STATEMENT</span><h2>Statement overview</h2><p>A quick read of the transactions recorded for one month.</p></div>
          <label className="statement-month">Statement month<input type="month" value={selectedStatementMonth} onChange={e => setStatementMonth(e.target.value)} /></label>
        </div>
        {statementStats.count ? <>
          <div className="statement-metrics">
            <div><span>Money received</span><strong className="positive">{fmt(statementStats.income)}</strong><small>{statementRows.filter(t => t.type === 'income').length} credits</small></div>
            <div><span>Money spent</span><strong>{fmt(statementStats.expenses)}</strong><small>{statementRows.filter(t => t.type === 'expense').length} debits</small></div>
            <div><span>Net for month</span><strong className={statementStats.income - statementStats.expenses < 0 ? 'negative' : 'positive'}>{fmt(statementStats.income - statementStats.expenses)}</strong><small>{statementStats.count} transactions</small></div>
            <div><span>Largest debit</span><strong>{statementStats.largest ? fmt(statementStats.largest.amount) : '—'}</strong><small className="statement-truncate">{statementStats.largest?.description || 'No expense recorded'}</small></div>
          </div>
          <div className="statement-footer">
            <span>{statementStats.topCategory ? `Top category: ${statementStats.topCategory[0]} (${fmt(statementStats.topCategory[1])})` : 'No expense categories recorded'}</span>
            <span>{statementStats.activeDays} active transaction {statementStats.activeDays === 1 ? 'day' : 'days'}</span>
          </div>
        </> : <div className="statement-empty">No records for {selectedStatementMonth}. Choose another month or import a bank statement CSV.</div>}
        <FeatureNote tone="tip" slogan="Read the pattern, then choose one next step." tip={statementStats.largest ? `Review “${statementStats.largest.description}” if you do not recognize it. This view summarizes your uploaded records; it cannot verify activity with your bank.` : 'Use the monthly view to compare credits, debits, and the largest expense after importing a statement.'} />
      </section>

      <section className="txn-toolbar txn-enter" style={{ '--enter-order': 4 }}>
        <div className="txn-search-wrap"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search merchants, notes, categories…" aria-label="Search transactions" /></div>
        <span className="txn-toolbar-divider" />
        <label className="txn-select-wrap"><SlidersHorizontal size={15} /><select value={catFilter} onChange={e => setCatFilter(e.target.value)} aria-label="Filter by category"><option value="">All categories</option>{categories.map(category => <option key={category}>{category}</option>)}</select></label>
        <label className="txn-select-wrap"><select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} aria-label="Filter by transaction type"><option value="">All activity</option><option value="income">Income</option><option value="expense">Expenses</option></select></label>
        <span className="txn-result-count">{filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}</span>
      </section>

      {formOpen && <section className="txn-form-card txn-enter" style={{ '--enter-order': 1 }}>
        <div className="txn-form-heading"><div><span className="transactions-eyebrow">{editId === null ? 'QUICK ENTRY' : 'UPDATE ENTRY'}</span><h2>{editId === null ? 'Add a transaction' : 'Edit transaction'}</h2></div><button type="button" className="btn-ghost" onClick={resetForm}>Cancel</button></div>
        {formError && <div className="auth-error" role="alert">{formError}</div>}
        <form className="txn-form-grid" onSubmit={submitTransaction}>
          <label><span>Date</span><input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
          <label><span>Description</span><input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Grocery store" /></label>
          <label><span>Category</span><input type="text" value={cat} onChange={e => setCat(e.target.value)} placeholder="e.g. Groceries" /></label>
          <label><span>Type</span><select value={type} onChange={e => setType(e.target.value)}><option value="expense">Expense</option><option value="income">Income</option></select></label>
          <label><span>Amount (₹)</span><input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" min="0.01" step="0.01" /></label>
          <button type="submit" className="btn-primary txn-save-button" disabled={formLoading}>{formLoading ? 'Saving…' : editId === null ? 'Save transaction' : 'Update transaction'}</button>
        </form>
      </section>}

      <section className="txn-table-card txn-enter" style={{ '--enter-order': 5 }}>
        <div className="txn-table-heading"><div><h2>Recent activity</h2><p>Review and manage your full transaction history.</p></div><span className="txn-date-chip"><CalendarDays size={14} /> Sorted by date</span></div>
        <div className="txn-table-scroll"><table className="txn-table">
          <thead><tr>
            <th><button onClick={() => sortBy('date')}>Date{sortMark('date')}</button></th>
            <th><button onClick={() => sortBy('description')}>Description{sortMark('description')}</button></th>
            <th><button onClick={() => sortBy('category')}>Category{sortMark('category')}</button></th>
            <th><button onClick={() => sortBy('type')}>Type{sortMark('type')}</button></th>
            <th className="txn-amount-head"><button onClick={() => sortBy('amount')}>Amount{sortMark('amount')}</button></th><th aria-label="Actions" />
          </tr></thead>
          <tbody>{filtered.length ? filtered.map((transaction, index) => (
            <tr key={transaction.id ?? `${transaction.date}-${transaction.description}`} style={{ '--row-order': Math.min(index, 12) }}>
              <td className="txn-date-cell">{transaction.date}</td>
              <td><div className="txn-description-cell"><span className={`txn-merchant-icon ${transaction.type}`}><CreditCard size={15} /></span><strong title={transaction.description}>{transaction.description}</strong></div></td>
              <td><span className="txn-category-tag">{transaction.category}</span></td>
              <td><span className={`txn-type-tag ${transaction.type}`}>{transaction.type === 'income' ? 'Received' : 'Paid'}</span></td>
              <td className={`txn-amount-cell ${transaction.type}`}>{transaction.type === 'income' ? '+' : '−'}{fmt(transaction.amount)}</td>
              <td><div className="txn-row-actions"><button className="btn-icon" onClick={() => editTransaction(transaction)} title="Edit transaction" aria-label={`Edit ${transaction.description}`}><Pencil size={14} /></button><button className="btn-icon txn-delete-button" onClick={() => deleteTransaction(transaction.id)} title="Delete transaction" aria-label={`Delete ${transaction.description}`}><Trash2 size={14} /></button></div></td>
            </tr>
          )) : <tr><td colSpan={6}><div className="txn-empty-state"><span><ArrowDownToLine size={21} /></span><strong>{transactions.length ? 'No matches found' : 'Your activity starts here'}</strong><p>{transactions.length ? 'Try changing your search or filters.' : 'Import a bank statement or add your first transaction.'}</p>{!transactions.length && <button className="btn-ghost" onClick={() => setBankModalOpen(true)}><CreditCard size={15} /> Import a statement</button>}</div></td></tr>}</tbody>
        </table></div>
      </section>
      <div className="txn-privacy-note"><ShieldCheck size={15} /><span>Bank statement imports append to your history. No bank login or account credentials are requested.</span></div>
      {bankModalOpen && <BankImportModal onClose={() => setBankModalOpen(false)} />}
    </div>
  )
}
