import { useState } from 'react'
import {
  ChevronDown, ChevronRight, Trash2, Globe, Search,
  FileText, Bot, Database, ExternalLink, Sparkles, Loader2,
  CheckSquare, Square,
} from 'lucide-react'

const TYPE_ICONS = {
  search: Search,
  scrape: FileText,
  crawl: Globe,
  agent: Bot,
  extract: Database,
}

export default function SourcesPanel({ sources, stats, topicId, onRefresh }) {
  const [expanded, setExpanded] = useState(true)
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(new Set())
  const [generating, setGenerating] = useState(false)

  const filtered = filter === 'all'
    ? sources
    : sources.filter(s => s.source_type === filter)

  const handleDelete = async (sourceId) => {
    await fetch(`/api/topics/${topicId}/sources/${sourceId}`, { method: 'DELETE' })
    selected.delete(sourceId)
    setSelected(new Set(selected))
    onRefresh()
  }

  const toggleSelect = (id) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(s => s.id)))
    }
  }

  const handleGenerate = async () => {
    if (selected.size === 0) return
    setGenerating(true)
    await fetch(`/api/topics/${topicId}/generate-from-sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_ids: [...selected] }),
    })
    setSelected(new Set())
    setGenerating(false)
    onRefresh()
    setTimeout(onRefresh, 3000)
  }

  const types = ['all', 'search', 'scrape', 'crawl', 'agent', 'extract']
  const allSelected = filtered.length > 0 && selected.size === filtered.length

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
          <div className="sources-toolbar">
            <div className="sources-filters">
              {types.map(t => (
                <button key={t} className={`sources-filter ${filter === t ? 'active' : ''}`}
                  onClick={() => setFilter(t)}>
                  {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            {filtered.length > 0 && (
              <button className="src-select-all" onClick={selectAll}>
                {allSelected ? <CheckSquare size={12} /> : <Square size={12} />}
              </button>
            )}
          </div>

          {selected.size > 0 && (
            <div className="src-action-bar">
              <span className="src-action-count">{selected.size} selected</span>
              <button className="btn btn-primary btn-sm" onClick={handleGenerate}
                disabled={generating}>
                {generating
                  ? <><Loader2 size={12} className="spin" /> Creating...</>
                  : <><Sparkles size={12} /> Generate Segments</>}
              </button>
            </div>
          )}

          <div className="sources-list">
            {filtered.length === 0 && (
              <div className="sources-empty">No sources yet</div>
            )}
            {filtered.map(src => {
              const TypeIcon = TYPE_ICONS[src.source_type] || FileText
              const isSelected = selected.has(src.id)
              let hostname = ''
              try { hostname = new URL(src.url).hostname } catch { hostname = src.url?.slice(0, 25) || '' }

              return (
                <div key={src.id} className={`source-row ${isSelected ? 'source-selected' : ''}`}
                  onClick={() => toggleSelect(src.id)}>
                  <span className="source-check">
                    {isSelected ? <CheckSquare size={13} /> : <Square size={13} />}
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
                    <span className="source-type-badge">
                      {(src.source_type || '').toUpperCase()}
                    </span>
                  </span>
                  <span className="source-actions" onClick={e => e.stopPropagation()}>
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
