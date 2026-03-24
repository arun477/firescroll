import { useState, useEffect, useRef } from 'react'
import {
  ChevronLeft, ChevronRight, Trash2, Globe, Search,
  FileText, Bot, Database, ExternalLink, Sparkles, Loader2,
  CheckSquare, Square, Eye,
} from 'lucide-react'
import SourcePreview from './SourcePreview'

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

function getHost(url) {
  if (!url) return 'source'
  if (url.startsWith('agent://')) return 'Firecrawl Agent'
  try { return new URL(url).hostname } catch { return url.slice(0, 30) }
}

export default function SourcesPanel({ topicId, onRefresh, alwaysOpen = false }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(new Set())
  const [generating, setGenerating] = useState(false)
  const [previewSources, setPreviewSources] = useState(null)
  const perPage = 8

  const fetchSources = async (p = page, f = filter) => {
    setLoading(true)
    try {
      const typeParam = f === 'all' ? 'all' : f
      const res = await fetch(
        `/api/topics/${topicId}/sources?page=${p}&per_page=${perPage}&type=${typeParam}`
      )
      const d = await res.json()
      setData(d)
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { fetchSources() }, [topicId, page, filter])

  // Poll when parent refreshes
  const prevRefresh = useRef(0)
  useEffect(() => {
    prevRefresh.current++
    if (prevRefresh.current > 1) fetchSources()
  }, [onRefresh])

  const handleFilterChange = (f) => {
    setFilter(f)
    setPage(1)
  }

  const toggleSelect = (id) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const handleDelete = async (sourceId) => {
    await fetch(`/api/topics/${topicId}/sources/${sourceId}`, { method: 'DELETE' })
    selected.delete(sourceId)
    setSelected(new Set(selected))
    fetchSources()
    onRefresh()
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
    fetchSources()
    onRefresh()
  }

  const handleViewSource = (src) => {
    setPreviewSources([src])
  }

  const stats = data?.stats || {}
  const sources = data?.sources || []
  const totalPages = data?.pages || 1
  const totalSources = data?.total || 0
  const typeCounts = stats.type_counts || {}
  const totalWords = stats.total_words || 0

  const types = ['all', ...Object.keys(typeCounts).sort()]

  return (
    <div className={`sources-panel ${alwaysOpen ? 'sp-always-open' : ''}`}>
      {/* Stats */}
      {stats.total > 0 && (
        <div className="sp-stats">
          <span className="sp-stat">{stats.total} sources</span>
          <span className="sp-stat-dot" />
          <span className="sp-stat">{totalWords.toLocaleString()} words</span>
          {Object.entries(typeCounts).map(([type, count]) => (
            <span key={type} className="sp-type-count" style={{ color: TYPE_COLORS[type] || '#52525b' }}>
              {count} {type}
            </span>
          ))}
        </div>
      )}

      {/* Filters */}
      {stats.total > 0 && (
        <div className="sp-filters">
          <div className="sp-filter-row">
            {types.map(t => {
              const count = t === 'all' ? stats.total : (typeCounts[t] || 0)
              if (t !== 'all' && !count) return null
              return (
                <button key={t} className={`sp-filter ${filter === t ? 'sp-filter-on' : ''}`}
                  onClick={() => handleFilterChange(t)}>
                  {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
                  {count > 0 && <span className="sp-filter-count">{count}</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Action bar for selected */}
      {selected.size > 0 && (
        <div className="sp-action-bar">
          <span className="sp-action-count">
            {selected.size} selected
            <button className="sp-action-clear" onClick={() => setSelected(new Set())}>×</button>
          </span>
          <button className="sp-gen-btn" onClick={handleGenerate} disabled={generating}>
            {generating
              ? <><Loader2 size={11} className="spin" /> Creating...</>
              : <><Sparkles size={11} /> Generate Segments</>}
          </button>
        </div>
      )}

      {/* Source cards */}
      <div className="sp-cards">
        {loading && sources.length === 0 && (
          <div className="sp-loading"><Loader2 size={14} className="spin" /></div>
        )}
        {!loading && sources.length === 0 && (
          <div className="sp-empty">
            {filter !== 'all'
              ? `No ${filter} sources yet.`
              : 'Use the research tools to gather sources.'}
          </div>
        )}
        {sources.map(src => {
          const TypeIcon = TYPE_ICONS[src.source_type] || FileText
          const isSelected = selected.has(src.id)
          const hostname = getHost(src.url)

          return (
            <div key={src.id} className={`sp-card ${isSelected ? 'sp-card-sel' : ''}`}>
              <div className="sp-card-main" onClick={() => handleViewSource(src)}>
                <div className="sp-card-icon" style={{ color: TYPE_COLORS[src.source_type] || '#52525b' }}>
                  <TypeIcon size={13} />
                </div>
                <div className="sp-card-body">
                  <span className="sp-card-host">{hostname}</span>
                  {src.title && src.title !== 'Untitled' && (
                    <span className="sp-card-title">{src.title}</span>
                  )}
                  {src.content_preview && (
                    <span className="sp-card-snippet">{src.content_preview.slice(0, 80)}</span>
                  )}
                </div>
                <div className="sp-card-meta">
                  {src.word_count > 0 && <span className="sp-card-words">{src.word_count.toLocaleString()}w</span>}
                  <span className="sp-card-time">{timeAgo(src.created_at)}</span>
                </div>
              </div>
              <div className="sp-card-actions">
                <button className="sp-card-btn sp-card-check"
                  onClick={(e) => { e.stopPropagation(); toggleSelect(src.id) }}>
                  {isSelected ? <CheckSquare size={12} /> : <Square size={12} />}
                </button>
                {src.url && !src.url.startsWith('agent://') && (
                  <a href={src.url} target="_blank" rel="noreferrer" className="sp-card-btn"
                    onClick={e => e.stopPropagation()}>
                    <ExternalLink size={10} />
                  </a>
                )}
                <button className="sp-card-btn sp-card-del"
                  onClick={(e) => { e.stopPropagation(); handleDelete(src.id) }}>
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="sp-pagination">
          <button className="sp-page-btn" onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}>
            <ChevronLeft size={12} />
          </button>
          <span className="sp-page-info">{page} / {totalPages}</span>
          <button className="sp-page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}>
            <ChevronRight size={12} />
          </button>
        </div>
      )}

      {/* Source Preview Slide-out */}
      {previewSources && (
        <SourcePreview
          topicId={topicId}
          sources={previewSources}
          onClose={() => setPreviewSources(null)}
        />
      )}
    </div>
  )
}
