import React, { useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, Clock3, Globe2, Loader, RefreshCw, Sparkles } from 'lucide-react'
import FeatureNote from '../components/FeatureNote'

const POPULAR = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AED', 'SGD', 'CAD', 'AUD', 'CHF']
const QUICK_AMOUNTS = [100, 500, 1000, 5000]
const cacheKey = base => `finai-fx-rates-${base}`

function readCache(base) {
  try {
    const value = JSON.parse(localStorage.getItem(cacheKey(base)) || 'null')
    return value?.rates ? value : null
  } catch { return null }
}

function formatRateDate(rate) {
  if (!rate?.time_last_update_unix) return ''
  return new Date(rate.time_last_update_unix * 1000).toLocaleString('en-IN', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata',
  })
}

export default function CurrencyConverter() {
  const [from, setFrom] = useState('INR')
  const [to, setTo] = useState('USD')
  const [amount, setAmount] = useState('1000')
  const [feeRate, setFeeRate] = useState('0')
  const [rateData, setRateData] = useState(null)
  const [currencies, setCurrencies] = useState(POPULAR)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true
    const cached = readCache(from)
    const fresh = cached && Number(cached.time_next_update_unix) * 1000 > Date.now()
    if (cached) {
      setRateData(cached)
      setCurrencies(Object.keys(cached.rates).sort())
    }
    if (fresh && refreshKey === 0) return () => { active = false }

    const controller = new AbortController()
    setLoading(true)
    setError('')
    fetch(`https://open.er-api.com/v6/latest/${from}`, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`Rate service returned ${response.status}.`)
        return response.json()
      })
      .then(data => {
        if (!active) return
        if (data.result !== 'success' || !data.rates) throw new Error('The rate service did not return a valid quote.')
        setRateData(data)
        setCurrencies(Object.keys(data.rates).sort())
        try { localStorage.setItem(cacheKey(from), JSON.stringify(data)) } catch {}
      })
      .catch(err => {
        if (err.name !== 'AbortError' && active) setError(cached ? 'Could not refresh. Showing the last saved reference rate.' : 'Could not load rates. Check your internet connection and retry.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false; controller.abort() }
  }, [from, refreshKey])

  const rate = Number(rateData?.rates?.[to])
  const parsedAmount = Number(amount)
  const converted = Number.isFinite(parsedAmount) && parsedAmount >= 0 && rate > 0 ? parsedAmount * rate : null
  const estimatedTotal = converted == null ? null : converted * (1 + Number(feeRate) / 100)
  const updatedAt = formatRateDate(rateData)
  const isStale = rateData?.time_next_update_unix && Number(rateData.time_next_update_unix) * 1000 <= Date.now()
  const alternatePairs = useMemo(() => {
    const popular = ['USD', 'EUR', 'GBP', 'AED'].filter(code => code !== from && code !== to && rateData?.rates?.[code])
    return popular.slice(0, 3).map(code => ({ code, rate: Number(rateData.rates[code]) }))
  }, [from, to, rateData])

  const swap = () => { setFrom(to); setTo(from) }

  return (
    <div className="view-panel fx-page">
      <div className="view-header fx-heading">
        <div>
          <span className="fx-eyebrow"><Globe2 size={13} /> CURRENCY DESK</span>
          <h1>Currency converter</h1>
          <p>Check the latest published exchange-rate reference for a transfer, trip, or purchase.</p>
        </div>
        <button className="btn-ghost fx-refresh" onClick={() => setRefreshKey(key => key + 1)} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'fx-spinning' : ''} /> {loading ? 'Updating rates' : 'Refresh rates'}
        </button>
      </div>

      <div className="fx-layout">
        <section className="fx-converter-card">
          <div className="fx-card-top"><div><span className="fx-label">CONVERT AN AMOUNT</span><h2>Plan across currencies</h2></div><span className="fx-live-tag"><i /> Latest rate</span></div>
          <label className="fx-amount-field"><span>You send</span><div><input type="number" min="0" step="any" value={amount} onChange={e => setAmount(e.target.value)} aria-label="Amount to convert" /><span>{from}</span></div></label>
          <div className="fx-pair-row">
            <label><span>From</span><select value={from} onChange={e => setFrom(e.target.value)}>{currencies.map(code => <option key={code}>{code}</option>)}</select></label>
            <button className="converter-swap" onClick={swap} title="Swap currencies" aria-label="Swap currencies"><ArrowLeftRight size={17} /></button>
            <label><span>To</span><select value={to} onChange={e => setTo(e.target.value)}>{currencies.map(code => <option key={code}>{code}</option>)}</select></label>
          </div>
          <div className="fx-quick-amounts"><span>Quick amount</span>{QUICK_AMOUNTS.map(value => <button key={value} className={Number(amount) === value ? 'selected' : ''} onClick={() => setAmount(String(value))}>{value.toLocaleString('en-IN')}</button>)}</div>
          <div className="fx-quote-block" aria-live="polite">
            <span className="fx-label">ESTIMATED CONVERSION</span>
            {converted == null ? <strong className="fx-placeholder">Enter an amount to see the conversion</strong> : <><strong>{estimatedTotal?.toLocaleString('en-IN', { maximumFractionDigits: 2 })} <small>{to}</small></strong><p>{Number(amount || 0).toLocaleString('en-IN')} {from} × {rate.toLocaleString('en-IN', { maximumFractionDigits: 6 })}</p></>}
          </div>
          <label className="fx-fee-field"><span>Optional estimated card / transfer markup</span><select value={feeRate} onChange={e => setFeeRate(e.target.value)}><option value="0">No markup (0%)</option><option value="2">Example 2% markup</option><option value="3">Example 3% markup</option><option value="5">Example 5% markup</option></select></label>
          {converted != null && Number(feeRate) > 0 && <div className="fx-fee-estimate"><span>With {feeRate}% assumed markup</span><strong>{estimatedTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })} {to}</strong></div>}
          {error && <p className="fx-error" role="status">{error}</p>}
        </section>

        <aside className="fx-side-column">
          <section className="fx-rate-card">
            <div className="fx-rate-card-head"><div><span className="fx-label">REFERENCE RATE</span><h3>Rate details</h3></div><Clock3 size={17} /></div>
            {rate > 0 ? <><strong className="fx-rate-number">1 {from} <span>=</span> {rate.toLocaleString('en-IN', { maximumFractionDigits: 6 })} {to}</strong><div className="fx-updated"><i className={isStale ? 'stale' : ''} />{isStale ? 'Saved rate · ' : 'Published · '}{updatedAt}</div></> : <div className="fx-rate-loading">{loading ? <><Loader size={15} className="fx-spinning" /> Loading latest reference rate…</> : 'Rate is not available yet.'}</div>}
            {alternatePairs.length > 0 && <div className="fx-other-rates"><span>Other reference rates per {from}</span>{alternatePairs.map(({ code, rate: otherRate }) => <div key={code}><span>{code}</span><strong>{otherRate.toLocaleString('en-IN', { maximumFractionDigits: 5 })}</strong></div>)}</div>}
          </section>
          <FeatureNote tone="slogan" slogan="A little planning goes a long way." tip="Compare the reference rate with your bank or card provider’s final quote. Their exchange spread and fees can change what you pay." />
          <div className="fx-disclaimer">Reference rates update once a day on this free feed. They are not live trading prices or a guaranteed payout. <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">Rates by ExchangeRate-API</a>.</div>
        </aside>
      </div>
    </div>
  )
}
