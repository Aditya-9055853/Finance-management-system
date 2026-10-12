import React from 'react'
import {
  LayoutGrid, MessageSquare, List, TrendingUp, Wallet, Target, Percent,
  ArrowUpRight, RefreshCw, Lightbulb, Upload, LogOut, Sun, Moon,
} from 'lucide-react'
import { useApp } from '../App'

const ICON_MAP = {
  grid: LayoutGrid,
  message: MessageSquare,
  list: List,
  trending: TrendingUp,
  wallet: Wallet,
  target: Target,
  percent: Percent,
  'arrow-up-right': ArrowUpRight,
  'refresh-cw': RefreshCw,
  lightbulb: Lightbulb,
}

const CORE_VIEWS = ['dashboard', 'chat', 'transactions', 'analytics']

export default function Sidebar() {
  const { views, activeView, setActiveView, logout, setUploadOpen, theme, setTheme, user, transactions } = useApp()
  const coreViews = views.filter(view => CORE_VIEWS.includes(view.id))
  const tools = views.filter(view => !CORE_VIEWS.includes(view.id))

  const renderView = view => {
    const Icon = ICON_MAP[view.icon] || LayoutGrid
    return (
      <button
        key={view.id}
        className={`rail-btn ${activeView === view.id ? 'active' : ''}`}
        onClick={() => setActiveView(view.id)}
        aria-current={activeView === view.id ? 'page' : undefined}
      >
        <Icon size={18} />
        <span>{view.label}</span>
        {view.badge && <span className="rail-badge">{view.badge}</span>}
        {view.id === 'transactions' && transactions.length > 0 && <span className="rail-count">{transactions.length}</span>}
      </button>
    )
  }

  return (
    <aside className="rail">
      <div className="rail-brand"><span className="rail-brand-mark">F</span><span>Fin<em>Track</em></span></div>
      <div className="rail-user">
        <span className="rail-user-avatar">{user?.name?.[0]?.toUpperCase() || 'G'}</span>
        <span className="rail-user-copy"><strong>{user?.name || 'Guest account'}</strong><small>Personal workspace</small></span>
      </div>

      <nav className="rail-nav" aria-label="Main navigation">
        <span className="rail-section-label">Workspace</span>
        {coreViews.map(renderView)}
        <span className="rail-section-label rail-section-tools">Money tools</span>
        {tools.map(renderView)}
      </nav>

      <div className="rail-footer">
        <div className="rail-theme-toggle" aria-label="Color theme">
          <button className={theme === 'light' ? 'selected' : ''} onClick={() => setTheme('light')} aria-label="Light theme" title="Light theme"><Sun size={16} /></button>
          <button className={theme === 'dark' ? 'selected' : ''} onClick={() => setTheme('dark')} aria-label="Dark theme" title="Dark theme"><Moon size={16} /></button>
        </div>
        <button className="rail-footer-action" onClick={() => setUploadOpen(true)}><Upload size={16} /><span>Import transactions</span></button>
        <button className="rail-footer-action" onClick={logout}><LogOut size={16} /><span>Sign out</span></button>
      </div>
    </aside>
  )
}
