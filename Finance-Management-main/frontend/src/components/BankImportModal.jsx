import React, { useRef, useState } from 'react'
import { ArrowDownToLine, FileSpreadsheet, ShieldCheck, X } from 'lucide-react'
import { useApp } from '../App'

export default function BankImportModal({ onClose }) {
  const { addToast, refreshData } = useApp()
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)

  async function importFile(file) {
    if (!file) return
    setMessage('')
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setMessage('Choose a CSV file exported from your bank.')
      setError(true)
      return
    }
    const body = new FormData()
    body.append('file', file)
    setBusy(true)
    setError(false)
    try {
      const response = await fetch('/api/import-bank-statement', { method: 'POST', body })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Import failed.')
      const summary = `Added ${result.added} transaction${result.added === 1 ? '' : 's'}${result.duplicates ? ` · skipped ${result.duplicates} duplicate${result.duplicates === 1 ? '' : 's'}` : ''}${result.skipped ? ` · ${result.skipped} invalid row${result.skipped === 1 ? '' : 's'}` : ''}`
      setMessage(summary)
      addToast(summary, 'success')
      await refreshData()
      if (result.added > 0) setTimeout(onClose, 1100)
    } catch (err) {
      setMessage(err.message || 'Could not import this statement.')
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay bank-import-overlay" onClick={e => e.target === e.currentTarget && !busy && onClose()}>
      <section className="modal bank-import-modal" role="dialog" aria-modal="true" aria-labelledby="bank-import-title">
        <header className="modal-header">
          <div className="bank-modal-title">
            <span className="bank-modal-icon"><FileSpreadsheet size={19} /></span>
            <div><h3 id="bank-import-title">Import bank transactions</h3><p>Add a statement to your transaction history</p></div>
          </div>
          <button className="btn-icon" onClick={onClose} disabled={busy} aria-label="Close"><X size={17} /></button>
        </header>
        <div className="modal-body">
          <div
            className={`bank-dropzone ${dragging ? 'is-dragging' : ''} ${busy ? 'is-busy' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); importFile(e.dataTransfer.files[0]) }}
            onClick={() => !busy && inputRef.current?.click()}
            role="button" tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
          >
            <span className="bank-upload-icon"><ArrowDownToLine size={21} /></span>
            <strong>{busy ? 'Reading your statement…' : 'Drop your bank CSV here'}</strong>
            <span>or browse files on your device</span>
            <button type="button" className="btn-primary" disabled={busy}>Choose CSV file</button>
            <small>CSV exports only · Your file stays in this app</small>
            <input ref={inputRef} type="file" accept=".csv,text/csv" hidden onChange={e => importFile(e.target.files?.[0])} />
          </div>
          {message && <div className={`bank-import-message ${error ? 'error' : 'success'}`} role="status">{message}</div>}
          <div className="bank-import-note"><ShieldCheck size={16} /><span>Imports are appended to your history. Matching transactions already in your account are skipped.</span></div>
          <div className="bank-format"><strong>Supported columns</strong><span>Date + Description/Narration + Amount, or separate Debit and Credit columns. Dates and amounts are detected automatically.</span></div>
        </div>
      </section>
    </div>
  )
}
