import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Wifi, WifiOff } from 'lucide-react'

export default function FirecrawlStatus() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    fetch('/api/fc/status')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="fc-status-widget">
        <Loader2 size={14} className="spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    )
  }

  if (!data || !data.connected) {
    return (
      <div className="fc-status-widget fc-status-disconnected">
        <WifiOff size={14} />
        <span>Not connected</span>
        <Link to="/settings" className="fc-status-link">Setup</Link>
      </div>
    )
  }

  const { credits, concurrency } = data
  const hasCredits = credits.total > 0
  const pct = hasCredits
    ? Math.round((credits.remaining / credits.total) * 100) : 100

  return (
    <div className="fc-status-widget">
      <img src="/firecrawl-logo.svg" alt="" width="14" height="14" />
      {hasCredits ? (
        <>
          <div className="fc-credit-section">
            <div className="fc-credit-bar">
              <div className="fc-credit-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="fc-credit-text">
              {credits.remaining?.toLocaleString()}
            </span>
          </div>
          {concurrency.max > 0 && (
            <span className="fc-concurrency">
              {concurrency.current}/{concurrency.max}
            </span>
          )}
        </>
      ) : (
        <span className="fc-credit-text">Connected</span>
      )}
    </div>
  )
}
