import React from 'react'
import { ArrowRight, Lightbulb, Sparkles } from 'lucide-react'

export default function FeatureNote({ slogan, tip, actionLabel, onAction, tone = 'tip' }) {
  return (
    <aside className={`feature-note ${tone === 'slogan' ? 'feature-note-slogan' : ''}`}>
      <span className="feature-note-icon">{tone === 'slogan' ? <Sparkles size={17} /> : <Lightbulb size={17} />}</span>
      <div className="feature-note-copy">
        {slogan && <strong>{slogan}</strong>}
        {tip && <p>{tip}</p>}
      </div>
      {actionLabel && onAction && <button type="button" onClick={onAction}>{actionLabel}<ArrowRight size={14} /></button>}
    </aside>
  )
}
