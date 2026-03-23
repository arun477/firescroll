import { useState } from 'react'
import {
  ChevronDown, ChevronRight, Trash2, Loader2,
  CheckCircle2, AlertCircle, Clock, Search, FileText,
  Globe, Bot, Database, Cpu,
} from 'lucide-react'

const TYPE_ICONS = {
  outline: Cpu,
  ai_generate: Cpu,
  web_search: Search,
  research_to_segment: Search,
  search: Search,
  scrape: FileText,
  crawl: Globe,
  map: Globe,
  agent: Bot,
  extract: Database,
  batch_scrape: FileText,
}

function normalizeItems(tasks, fcJobs) {
  const items = []

  for (const t of (tasks || [])) {
    items.push({
      id: t.id,
      kind: 'research',
      type: t.task_type,
      query: t.query || '',
      status: t.status,
      error: t.error,
      time: t.updated_at,
      pages: null,
    })
  }

  for (const j of (fcJobs || [])) {
    items.push({
      id: j.id,
      kind: 'firecrawl',
      type: j.job_type,
      query: j.target || '',
      status: j.status,
      error: j.error,
      time: j.updated_at,
      pages: j.pages_found,
      preview: j.result_preview,
    })
  }

  items.sort((a, b) => (b.time || '').localeCompare(a.time || ''))
  return items
}

export default function ResearchTaskManager({ tasks, fcJobs, topicId, onRefresh }) {
  const [expanded, setExpanded] = useState(true)
  const [filter, setFilter] = useState('all')

  const allItems = normalizeItems(tasks, fcJobs)

  const filtered = filter === 'all'
    ? allItems
    : allItems.filter(t => {
      if (filter === 'running') return !['done', 'failed', 'pending'].includes(t.status)
      return t.status === filter
    })

  const handleDelete = async (item) => {
    if (item.kind === 'research') {
      await fetch(`/api/topics/${topicId}/research/${item.id}`, { method: 'DELETE' })
    }
    onRefresh()
  }

  const clearCompleted = async () => {
    const done = allItems.filter(t => t.status === 'done' && t.kind === 'research')
    for (const t of done) {
      await fetch(`/api/topics/${topicId}/research/${t.id}`, { method: 'DELETE' })
    }
    onRefresh()
  }

  const filters = ['all', 'running', 'done', 'failed']
  const runningCount = allItems.filter(
    t => !['done', 'failed', 'pending'].includes(t.status)
  ).length

  return (
    <div className="task-manager">
      <div className="collapsible-header" onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>Activity</span>
        <span className="collapsible-count">
          {allItems.length}
          {runningCount > 0 && <span className="task-running-badge"> {runningCount} active</span>}
        </span>
        <button className="task-clear-btn" onClick={e => { e.stopPropagation(); clearCompleted() }}>
          Clear
        </button>
      </div>

      {expanded && (
        <div className="task-content">
          <div className="task-filters">
            {filters.map(f => (
              <button key={f} className={`task-filter ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <div className="task-list">
            {filtered.map(item => {
              const isDone = item.status === 'done'
              const isFailed = item.status === 'failed'
              const isActive = !isDone && !isFailed && item.status !== 'pending'
              const TypeIcon = TYPE_ICONS[item.type] || FileText
              const isFc = item.kind === 'firecrawl'

              return (
                <div key={`${item.kind}-${item.id}`} className="task-row">
                  <span className="task-icon">
                    {isDone && <CheckCircle2 size={13} style={{ color: '#6bb88a' }} />}
                    {isFailed && <AlertCircle size={13} style={{ color: '#d97070' }} />}
                    {isActive && <Loader2 size={13} className="spin" style={{ color: '#7dacf0' }} />}
                    {item.status === 'pending' && <Clock size={13} style={{ color: 'var(--text-muted)' }} />}
                  </span>
                  <span className="task-query">
                    {isFc && <img src="/firecrawl-logo.svg" alt="" width="10" height="10" style={{ marginRight: 4, verticalAlign: -1 }} />}
                    <TypeIcon size={11} style={{ marginRight: 3, opacity: 0.5, verticalAlign: -1 }} />
                    {item.query?.slice(0, 50) || item.type}
                    {item.pages > 0 && <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>({item.pages}pg)</span>}
                  </span>
                  <span className="task-actions-cell">
                    {(isDone || isFailed) && item.kind === 'research' && (
                      <button className="task-action" onClick={() => handleDelete(item)} title="Delete">
                        <Trash2 size={10} />
                      </button>
                    )}
                  </span>
                  <span className="task-time">
                    {item.time && new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )
            })}
            {filtered.length === 0 && <div className="task-empty">No tasks</div>}
          </div>
        </div>
      )}
    </div>
  )
}
