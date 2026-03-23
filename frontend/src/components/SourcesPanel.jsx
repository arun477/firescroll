import { useState } from 'react'
import {
  ChevronDown, ChevronRight, Trash2, Globe, Search,
  FileText, Bot, Database, ExternalLink,
} from 'lucide-react'

const TYPE_ICONS = {
  search: Search,
  scrape: FileText,
  crawl: Globe,
  agent: Bot,
  extract: Database,
}

const TYPE_COLORS = {
  search: 'var(--text-muted)',
  scrape: 'var(--text-muted)',
  crawl: 'var(--text-muted)',
  agent: 'var(--text-muted)',
  extract: 'var(--text-muted)',
}

export default function SourcesPanel({ sources, stats, topicId, onRefresh }) {
  const [expanded, setExpanded] = useState(true)
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all'
    ? sources
    : sources.filter(s => s.source_type === filter)

  const handleDelete = async (sourceId) => {
    await fetch(`/api/topics/${topicId}/sources/${sourceId}`, { method: 'DELETE' })
    onRefresh()
  }

  const types = ['all', 'search', 'scrape', 'crawl', 'agent', 'extract']

  return (
    <div className="sources-panel">
      <button className="collapsible-header" onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <img src="/firecrawl-logo.svg" alt="" width="13" height="13" />
        <span>Knowledge Base</span>
        <span className="collapsible-count">{stats?.total || 0}</span>
      </button>

      {expanded && (
        <div className="sources-content">
          <div className="sources-filters">
            {types.map(t => (
              <button key={t} className={`sources-filter ${filter === t ? 'active' : ''}`}
                onClick={() => setFilter(t)}>
                {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div className="sources-list">
            {filtered.length === 0 && (
              <div className="sources-empty">No sources yet</div>
            )}
            {filtered.map(src => {
              const TypeIcon = TYPE_ICONS[src.source_type] || FileText
              const color = TYPE_COLORS[src.source_type] || 'var(--text-muted)'
              let hostname = ''
              try { hostname = new URL(src.url).hostname } catch { hostname = src.url?.slice(0, 25) || '' }

              return (
                <div key={src.id} className="source-row">
                  <span className="source-icon">
                    <TypeIcon size={13} style={{ color }} />
                  </span>
                  <span className="source-text">
                    {hostname && <span className="source-host">{hostname}</span>}
                    {src.title && src.title !== 'Untitled' && (
                      <span className="source-title">{src.title}</span>
                    )}
                  </span>
                  <span className="source-meta">
                    {src.word_count > 0 && (
                      <span className="source-words">{src.word_count?.toLocaleString()}</span>
                    )}
                    <span className="source-type-badge" style={{ color, borderColor: color }}>
                      {(src.source_type || '').toUpperCase()}
                    </span>
                  </span>
                  <span className="source-actions">
                    {src.url && !src.url.startsWith('agent://') && (
                      <a href={src.url} target="_blank" rel="noreferrer" className="source-action-btn">
                        <ExternalLink size={10} />
                      </a>
                    )}
                    <button className="source-action-btn source-del" onClick={() => handleDelete(src.id)}>
                      <Trash2 size={10} />
                    </button>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
