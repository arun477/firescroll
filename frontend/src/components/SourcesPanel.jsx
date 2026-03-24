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

const TYPE_COLORS = {
  search: '#3b82f6',
  scrape: '#22c55e',
  crawl: '#f97316',
  agent: '#8b5cf6',
  extract: '#eab308',
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function SourcesPanel({ sources, stats, topicId, onRefresh, alwaysOpen = false }) {
  const [expanded, setExpanded] = useState(true)
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(new Set())
  const [generating, setGenerating] = useState(false)
  const [expandedSrc, setExpandedSrc] = useState(null)

  const isOpen = alwaysOpen || expanded

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
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(s => s.id)))
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

  const typeCounts = {}
  sources.forEach(s => { typeCounts[s.source_type] = (typeCounts[s.source_type] || 0) + 1 })
  const totalWords = sources.reduce((sum, s) => sum + (s.word_count || 0), 0)

  const types = ['all', 'search', 'scrape', 'crawl', 'agent', 'extract']
  const allSelected = filtered.length > 0 && selected.size === filtered.length

  return (
    <div className={`sources-panel ${alwaysOpen ? 'sp-always-open' : ''}`}>
      {!alwaysOpen && (
        <button className="sp-header" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <img src="/firecrawl-logo.svg" alt="" width="12" height="12" />
          <span className="sp-header-title">Knowledge Base</span>
          <span className="sp-header-count">{stats?.total || 0}</span>
        </button>
      )}

      {isOpen && (
        <div className="sp-body">
          {sources.length > 0 && (
            <div className="sp-stats">
              <span className="sp-stat">{sources.length} sources</span>
              <span className="sp-stat-dot" />
              <span className="sp-stat">{totalWords.toLocaleString()} words</span>
              {Object.entries(typeCounts).map(([type, count]) => (
                <span key={type} className="sp-type-count" style={{ color: TYPE_COLORS[type] || '#52525b' }}>
                  {count} {type}
                </span>
              ))}
            </div>
          )}

          <div className="sp-filters">
            <div className="sp-filter-row">
              {types.map(t => {
                const count = t === 'all' ? sources.length : (typeCounts[t] || 0)
                if (t !== 'all' && count === 0) return null
                return (
                  <button key={t} className={`sp-filter ${filter === t ? 'sp-filter-on' : ''}`}
                    onClick={() => setFilter(t)}>
                    {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
                    {count > 0 && <span className="sp-filter-count">{count}</span>}
                  </button>
                )
              })}
            </div>
            {filtered.length > 0 && (
              <button className="sp-select-all" onClick={selectAll}>
                {allSelected ? <CheckSquare size={12} /> : <Square size={12} />}
              </button>
            )}
          </div>

          {selected.size > 0 && (
            <div className="sp-action-bar">
              <span className="sp-action-count">{selected.size} selected</span>
              <button className="sp-gen-btn" onClick={handleGenerate} disabled={generating}>
                {generating
                  ? <><Loader2 size={11} className="spin" /> Creating...</>
                  : <><Sparkles size={11} /> Generate Segments</>}
              </button>
            </div>
          )}

          <div className="sp-list">
            {filtered.length === 0 && (
              <div className="sp-empty">
                {alwaysOpen
                  ? 'Use the research tools on the left to gather sources.'
                  : 'No sources yet'}
              </div>
            )}
            {filtered.map(src => {
              const TypeIcon = TYPE_ICONS[src.source_type] || FileText
              const isSelected = selected.has(src.id)
              const isExpanded = expandedSrc === src.id
              let hostname = ''
              try { hostname = new URL(src.url).hostname } catch { hostname = src.url?.slice(0, 30) || '' }

              return (
                <div key={src.id} className={`sp-src ${isSelected ? 'sp-src-sel' : ''}`}>
                  <div className="sp-src-row" onClick={() => toggleSelect(src.id)}>
                    <span className="sp-src-check">
                      {isSelected ? <CheckSquare size={12} /> : <Square size={12} />}
                    </span>
                    <span className="sp-src-icon" style={{ color: TYPE_COLORS[src.source_type] || '#52525b' }}>
                      <TypeIcon size={12} />
                    </span>
                    <div className="sp-src-info">
                      <span className="sp-src-host">{hostname}</span>
                      {src.title && src.title !== 'Untitled' && (
                        <span className="sp-src-title">{src.title}</span>
                      )}
                    </div>
                    <div className="sp-src-meta">
                      {src.word_count > 0 && (
                        <span className="sp-src-words">{src.word_count.toLocaleString()}w</span>
                      )}
                      <span className="sp-src-time">{timeAgo(src.created_at)}</span>
                    </div>
                    <div className="sp-src-actions" onClick={e => e.stopPropagation()}>
                      {src.content_preview && (
                        <button className="sp-src-btn" onClick={() => setExpandedSrc(isExpanded ? null : src.id)}>
                          {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                        </button>
                      )}
                      {src.url && !src.url.startsWith('agent://') && (
                        <a href={src.url} target="_blank" rel="noreferrer" className="sp-src-btn">
                          <ExternalLink size={10} />
                        </a>
                      )}
                      <button className="sp-src-btn sp-src-del" onClick={() => handleDelete(src.id)}>
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                  {isExpanded && src.content_preview && (
                    <div className="sp-src-preview">
                      {src.content_preview}
                      {src.content_preview.length >= 200 && '...'}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
