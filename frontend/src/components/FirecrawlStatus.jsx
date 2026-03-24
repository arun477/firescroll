import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, WifiOff } from 'lucide-react'

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
      <div className="fc-status-chip">
        <Loader2 size={10} className="spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    )
  }

  if (!data || !data.connected) {
    return (
      <Link to="/settings" className="fc-status-chip fc-status-off">
        <span className="fc-status-dot fc-status-dot-off" />
        <span>Disconnected</span>
      </Link>
    )
  }

  const { credits } = data
  const hasCredits = credits.total > 0

  return (
    <div className="fc-status-chip">
      <span className="fc-status-dot fc-status-dot-on" />
      <span>Connected</span>
      {hasCredits && (
        <span className="fc-status-credits">{credits.remaining?.toLocaleString()}</span>
      )}
    </div>
  )
}
