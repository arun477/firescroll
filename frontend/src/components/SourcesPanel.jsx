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
  search: 'var(--blue)',
  scrape: 'var(--green)',
  crawl: 'var(--fc-heat)',
  agent: '#a855f7',
  extract: 'var(--yellow)',
}

export default function SourcesPanel({ sources, stats, topicId, onRefresh }) {
  const [expanded, setExpanded] = useState(false)
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
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <img src="/firecrawl-logo.svg" alt="" width="14" height="14" />
        <span>Knowledge Base</span>
        <span className="collapsible-count">{stats?.total || 0} sources</span>
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
              try { hostname = new URL(src.url).hostname } catch { hostname = src.url?.slice(0, 30) }

              return (
                <div key={src.id} className="source-row">
                  <TypeIcon size={14} style={{ color, flexShrink: 0 }} />
                  <div className="source-info">
                    <span className="source-host">{hostname}</span>
                    <span className="source-title">{src.title || 'Untitled'}</span>
                  </div>
                  <span className="source-words">{src.word_count?.toLocaleString()} words</span>
                  <span className="source-type-badge" style={{ color, borderColor: color }}>
                    {src.source_type}
                  </span>
                  {src.url && !src.url.startsWith('agent://') && (
                    <a href={src.url} target="_blank" rel="noreferrer" className="source-link-btn">
                      <ExternalLink size={12} />
                    </a>
                  )}
                  <button className="source-delete" onClick={() => handleDelete(src.id)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
