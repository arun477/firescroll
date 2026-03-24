import { useState } from 'react'
import {
  Search, FileText, Database, Globe, Map, Bot,
  ChevronRight, Loader2, X,
} from 'lucide-react'

const TOOLS = [
  { id: 'search', label: 'Search', icon: Search, desc: 'Search the web' },
  { id: 'scrape', label: 'Scrape', icon: FileText, desc: 'Extract a URL' },
  { id: 'crawl', label: 'Crawl', icon: Globe, desc: 'Deep crawl a site' },
  { id: 'extract', label: 'Extract', icon: Database, desc: 'Structured data' },
  { id: 'map', label: 'Map', icon: Map, desc: 'Discover URLs' },
  { id: 'agent', label: 'Agent', icon: Bot, desc: 'AI-powered research' },
]

export default function FirecrawlToolbar({ topicId, segments, onRefresh }) {
  const [active, setActive] = useState(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({})
  const [result, setResult] = useState(null)

  const toggle = (id) => {
    setActive(active === id ? null : id)
    setForm({})
    setResult(null)
  }

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const submit = async () => {
    setLoading(true)
    setResult(null)
    const endpoint = `/api/topics/${topicId}/fc/${active}`
    let body = {}

    if (active === 'search') {
      body = { query: form.query, limit: parseInt(form.limit || '5') }
    } else if (active === 'scrape') {
      body = { url: form.url }
    } else if (active === 'extract') {
      body = { url: form.url, prompt: form.prompt }
    } else if (active === 'crawl') {
      body = { url: form.url, limit: parseInt(form.limit || '10'), max_depth: parseInt(form.depth || '2') }
    } else if (active === 'map') {
      body = { url: form.url }
    } else if (active === 'agent') {
      body = { prompt: form.prompt }
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (active === 'map' && data.links) {
        setResult({ type: 'map', links: data.links, total: data.total })
      } else {
        setActive(null)
        setForm({})
        setTimeout(onRefresh, 1500)
      }
    } catch (err) {
      setResult({ type: 'error', message: err.message })
    }
    setLoading(false)
  }

  const batchScrape = async (urls) => {
    setLoading(true)
    await fetch(`/api/topics/${topicId}/fc/batch-scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls }),
    })
    setActive(null)
    setForm({})
    setLoading(false)
    setTimeout(onRefresh, 1500)
  }

  return (
    <div className="fc-tool-grid">
      {TOOLS.map(tool => {
        const Icon = tool.icon
        const isActive = active === tool.id
        return (
          <div key={tool.id}>
            <div
              className={`fc-tool-card ${isActive ? 'fc-tool-card-active' : ''}`}
              onClick={() => toggle(tool.id)}
            >
              <div className="fc-tool-card-icon">
                <Icon size={15} />
              </div>
              <div className="fc-tool-card-text">
                <span className="fc-tool-card-name">{tool.label}</span>
                <span className="fc-tool-card-desc">{tool.desc}</span>
              </div>
              <ChevronRight size={12} className="fc-tool-card-chevron" />
            </div>

            {isActive && (
              <div className="fc-tool-form">
                <div className="fc-tool-form-header">
                  <span className="fc-tool-form-title">{tool.desc}</span>
                  <button className="fc-tool-form-close" onClick={() => setActive(null)}><X size={12} /></button>
                </div>

                {active === 'search' && (
                  <>
                    <input placeholder="Search query..." value={form.query || ''} onChange={e => update('query', e.target.value)} className="fc-tool-input" autoFocus
                      onKeyDown={e => e.key === 'Enter' && submit()} />
                    <select value={form.limit || '5'} onChange={e => update('limit', e.target.value)} className="fc-tool-select">
                      <option value="3">3 results</option>
                      <option value="5">5 results</option>
                      <option value="10">10 results</option>
                    </select>
                  </>
                )}

                {active === 'scrape' && (
                  <input placeholder="https://..." value={form.url || ''} onChange={e => update('url', e.target.value)} className="fc-tool-input" autoFocus
                    onKeyDown={e => e.key === 'Enter' && submit()} />
                )}

                {active === 'extract' && (
                  <>
                    <input placeholder="https://..." value={form.url || ''} onChange={e => update('url', e.target.value)} className="fc-tool-input" autoFocus />
                    <input placeholder="What to extract..." value={form.prompt || ''} onChange={e => update('prompt', e.target.value)} className="fc-tool-input"
                      onKeyDown={e => e.key === 'Enter' && submit()} />
                  </>
                )}

                {active === 'crawl' && (
                  <>
                    <input placeholder="https://..." value={form.url || ''} onChange={e => update('url', e.target.value)} className="fc-tool-input" autoFocus />
                    <div className="fc-tool-form-row">
                      <label>Pages: <input type="range" min="1" max="50" value={form.limit || 10} onChange={e => update('limit', e.target.value)} /> {form.limit || 10}</label>
                      <label>Depth: <input type="range" min="1" max="5" value={form.depth || 2} onChange={e => update('depth', e.target.value)} /> {form.depth || 2}</label>
                    </div>
                  </>
                )}

                {active === 'map' && (
                  <input placeholder="https://example.com" value={form.url || ''} onChange={e => update('url', e.target.value)} className="fc-tool-input" autoFocus
                    onKeyDown={e => e.key === 'Enter' && submit()} />
                )}

                {active === 'agent' && (
                  <textarea placeholder="Describe what you want to find..." value={form.prompt || ''} onChange={e => update('prompt', e.target.value)} className="fc-tool-textarea" rows={3} autoFocus />
                )}

                <button className="fc-tool-form-submit" onClick={submit} disabled={loading}>
                  {loading ? <Loader2 size={13} className="spin" /> : <img src="/firecrawl-logo.svg" alt="" width="13" height="13" />}
                  {loading ? 'Running...' : `Run ${tool.label}`}
                </button>

                {result?.type === 'error' && (
                  <div style={{ fontSize: 11, color: '#d97070', padding: '4px 0' }}>{result.message}</div>
                )}

                {result?.type === 'map' && (
                  <div className="fc-tool-map-results">
                    <div className="fc-tool-map-header">
                      Found {result.total} URLs
                      <button className="fc-tool-form-submit" style={{ padding: '4px 10px', fontSize: 10 }}
                        onClick={() => batchScrape(result.links.slice(0, 10))} disabled={loading}>
                        Scrape top 10
                      </button>
                    </div>
                    <div className="fc-tool-map-list">
                      {result.links.slice(0, 20).map((url, i) => (
                        <div key={i} className="fc-tool-map-url">{url}</div>
                      ))}
                      {result.total > 20 && <div className="fc-tool-map-more">+{result.total - 20} more</div>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
