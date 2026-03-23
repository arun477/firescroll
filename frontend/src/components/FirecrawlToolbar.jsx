import { useState } from 'react'
import {
  Search, FileText, Database, Globe, Map, Bot,
  ChevronDown, Loader2, X,
} from 'lucide-react'

const TOOLS = [
  { id: 'search', label: 'Search', icon: Search, desc: 'Search the web' },
  { id: 'scrape', label: 'Scrape', icon: FileText, desc: 'Scrape a URL' },
  { id: 'extract', label: 'Extract', icon: Database, desc: 'Structured data' },
  { id: 'crawl', label: 'Crawl', icon: Globe, desc: 'Deep crawl a site' },
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
      body = { query: form.query, limit: parseInt(form.limit || '5'), segment_id: form.segment_id || null }
    } else if (active === 'scrape') {
      body = { url: form.url, segment_id: form.segment_id || null }
    } else if (active === 'extract') {
      body = { url: form.url, prompt: form.prompt, segment_id: form.segment_id || null }
    } else if (active === 'crawl') {
      body = { url: form.url, limit: parseInt(form.limit || '10'), max_depth: parseInt(form.depth || '2'), segment_id: form.segment_id || null }
    } else if (active === 'map') {
      body = { url: form.url }
    } else if (active === 'agent') {
      body = { prompt: form.prompt, segment_id: form.segment_id || null }
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
        setResult({ type: 'started' })
        setTimeout(onRefresh, 2000)
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
    setResult({ type: 'started' })
    setLoading(false)
    setTimeout(onRefresh, 2000)
  }

  return (
    <div className="fc-toolbar-container">
      <div className="fc-toolbar">
        {TOOLS.map(tool => {
          const Icon = tool.icon
          const isActive = active === tool.id
          return (
            <button
              key={tool.id}
              className={`fc-toolbar-btn ${isActive ? 'active' : ''} ${tool.id === 'agent' ? 'fc-agent-btn' : ''}`}
              onClick={() => toggle(tool.id)}
            >
              <Icon size={15} />
              <span>{tool.label}</span>
              {isActive && <ChevronDown size={12} />}
            </button>
          )
        })}
      </div>

      {active && (
        <div className="fc-toolbar-form">
          <div className="fc-form-header">
            <span className="fc-form-title">{TOOLS.find(t => t.id === active)?.desc}</span>
            <button className="fc-form-close" onClick={() => setActive(null)}><X size={14} /></button>
          </div>

          {(active === 'search') && (
            <div className="fc-form-fields">
              <input placeholder="Search query..." value={form.query || ''} onChange={e => update('query', e.target.value)} className="fc-input" autoFocus />
              <select value={form.limit || '5'} onChange={e => update('limit', e.target.value)} className="fc-select">
                <option value="3">3 results</option>
                <option value="5">5 results</option>
                <option value="10">10 results</option>
              </select>
              {segments?.length > 0 && (
                <select value={form.segment_id || ''} onChange={e => update('segment_id', e.target.value)} className="fc-select">
                  <option value="">Topic-wide</option>
                  {segments.map(s => <option key={s.id} value={s.id}>Seg {s.segment_num}: {s.title}</option>)}
                </select>
              )}
            </div>
          )}

          {(active === 'scrape') && (
            <div className="fc-form-fields">
              <input placeholder="https://..." value={form.url || ''} onChange={e => update('url', e.target.value)} className="fc-input" autoFocus />
              {segments?.length > 0 && (
                <select value={form.segment_id || ''} onChange={e => update('segment_id', e.target.value)} className="fc-select">
                  <option value="">Topic-wide</option>
                  {segments.map(s => <option key={s.id} value={s.id}>Seg {s.segment_num}: {s.title}</option>)}
                </select>
              )}
            </div>
          )}

          {(active === 'extract') && (
            <div className="fc-form-fields">
              <input placeholder="https://..." value={form.url || ''} onChange={e => update('url', e.target.value)} className="fc-input" autoFocus />
              <input placeholder="What to extract... e.g. key facts and statistics" value={form.prompt || ''} onChange={e => update('prompt', e.target.value)} className="fc-input" />
              {segments?.length > 0 && (
                <select value={form.segment_id || ''} onChange={e => update('segment_id', e.target.value)} className="fc-select">
                  <option value="">Topic-wide</option>
                  {segments.map(s => <option key={s.id} value={s.id}>Seg {s.segment_num}: {s.title}</option>)}
                </select>
              )}
            </div>
          )}

          {(active === 'crawl') && (
            <div className="fc-form-fields">
              <input placeholder="https://..." value={form.url || ''} onChange={e => update('url', e.target.value)} className="fc-input" autoFocus />
              <div className="fc-form-row">
                <label>Pages: <input type="range" min="1" max="50" value={form.limit || 10} onChange={e => update('limit', e.target.value)} /> {form.limit || 10}</label>
                <label>Depth: <input type="range" min="1" max="5" value={form.depth || 2} onChange={e => update('depth', e.target.value)} /> {form.depth || 2}</label>
              </div>
              {segments?.length > 0 && (
                <select value={form.segment_id || ''} onChange={e => update('segment_id', e.target.value)} className="fc-select">
                  <option value="">Topic-wide</option>
                  {segments.map(s => <option key={s.id} value={s.id}>Seg {s.segment_num}: {s.title}</option>)}
                </select>
              )}
            </div>
          )}

          {(active === 'map') && (
            <div className="fc-form-fields">
              <input placeholder="https://example.com" value={form.url || ''} onChange={e => update('url', e.target.value)} className="fc-input" autoFocus />
            </div>
          )}

          {(active === 'agent') && (
            <div className="fc-form-fields">
              <textarea placeholder="Describe what you want to find... e.g. 'Find the latest breakthroughs in quantum computing from 2025'" value={form.prompt || ''} onChange={e => update('prompt', e.target.value)} className="fc-textarea" rows={3} autoFocus />
              {segments?.length > 0 && (
                <select value={form.segment_id || ''} onChange={e => update('segment_id', e.target.value)} className="fc-select">
                  <option value="">Topic-wide</option>
                  {segments.map(s => <option key={s.id} value={s.id}>Seg {s.segment_num}: {s.title}</option>)}
                </select>
              )}
            </div>
          )}

          <div className="fc-form-actions">
            <button className="btn btn-firecrawl" onClick={submit} disabled={loading}>
              {loading ? <Loader2 size={14} className="spin" /> : <img src="/firecrawl-logo.svg" alt="" width="14" height="14" />}
              {loading ? 'Running...' : `Run ${TOOLS.find(t => t.id === active)?.label}`}
            </button>
          </div>

          {result?.type === 'started' && (
            <div className="fc-result-notice">Started. Results will appear in the knowledge base.</div>
          )}
          {result?.type === 'error' && (
            <div className="fc-result-error">{result.message}</div>
          )}
          {result?.type === 'map' && (
            <div className="fc-map-results">
              <div className="fc-map-header">
                Found {result.total} URLs
                <button className="btn btn-firecrawl btn-sm" onClick={() => batchScrape(result.links.slice(0, 10))} disabled={loading}>
                  Scrape top 10
                </button>
              </div>
              <div className="fc-map-list">
                {result.links.slice(0, 30).map((url, i) => (
                  <div key={i} className="fc-map-url">{url}</div>
                ))}
                {result.total > 30 && <div className="fc-map-more">+{result.total - 30} more</div>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
