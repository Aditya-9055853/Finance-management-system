import React from 'react'
import { Search, Bell } from 'lucide-react'
import { useApp } from '../App'

export default function Topbar() {
  const { views, activeView, setActiveView, aiStatus, dataSource, user } = useApp()
  const statusColor = aiStatus === 'connected' ? 'connected' : aiStatus === 'fallback' ? 'fallback' : 'offline'
  const statusLabel = aiStatus === 'connected' ? 'Gemini AI' : aiStatus === 'fallback' ? 'AI fallback' : 'Checking AI'
  const activeLabel = views.find(view => view.id === activeView)?.label || 'Dashboard'

  return (
    <header className="topbar">
      <div className="topbar-heading">
        <span className="topbar-kicker">YOUR FINANCES</span>
        <strong>{activeLabel}</strong>
      </div>
      <div className="topbar-right">
        <button className="topbar-search" onClick={() => setActiveView('transactions')} aria-label="Open transactions">
          <Search size={16} /><span>Search transactions</span><kbd>/</kbd>
        </button>
        <span className="topbar-chip hide-md">{dataSource === 'uploaded' ? 'CSV imported' : dataSource === 'bank' ? 'Bank statement' : dataSource === 'manual' ? 'Your data' : 'No data yet'}</span>
        <span className="topbar-chip"><span className={`status-dot ${statusColor}`} />{statusLabel}</span>
        <button className="btn-icon topbar-notification" title="AI insights" aria-label="Open AI insights" onClick={() => setActiveView('insights')}><Bell size={18} /></button>
        <span className="user-avatar" title={user?.name || 'Guest'}>{user?.name?.[0]?.toUpperCase() || 'G'}</span>
      </div>
    </header>
  )
}
