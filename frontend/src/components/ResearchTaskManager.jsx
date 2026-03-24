import { useState } from 'react'
import {
  ChevronDown, ChevronRight, Trash2, Loader2,
  CheckCircle2, AlertCircle, Clock, Search, FileText,
  Globe, Bot, Database, Cpu, Sparkles, Layers,
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
  source_to_segments: Sparkles,
  deep_search: Search,
  deep_scrape: FileText,
  deep_extract: Database,
  deep_synthesize: Sparkles,
  agent_research: Bot,
  agent_synthesize: Sparkles,
}

const PIPELINE_TYPES = new Set([
  'deep_search', 'deep_scrape', 'deep_extract', 'deep_synthesize',
  'agent_research', 'agent_synthesize',
])

const STEP_LABELS = {
  deep_search: 'Search',
  deep_scrape: 'Scrape',
  deep_extract: 'Extract',
  deep_synthesize: 'Synthesize',
  agent_research: 'Agent Research',
  agent_synthesize: 'Synthesize',
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
      segment_id: j.segment_id || null,
    })
  }

  items.sort((a, b) => (b.time || '').localeCompare(a.time || ''))
  return items
}

export default function ResearchTaskManager({ tasks, fcJobs, topicId, onRefresh, alwaysOpen = false }) {
  const [expanded, setExpanded] = useState(true)
  const [filter, setFilter] = useState('all')
  const [showAll, setShowAll] = useState(false)
  const VISIBLE_LIMIT = 8

  const isOpen = alwaysOpen || expanded
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
    <div className={`task-manager ${alwaysOpen ? 'tm-always-open' : ''}`}>
      {!alwaysOpen && (
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
      )}

      {alwaysOpen && (
        <div className="tm-header">
          <span className="tm-header-title">Activity</span>
          <span className="tm-header-count">
            {allItems.length}
            {runningCount > 0 && <span className="task-running-badge"> {runningCount} active</span>}
          </span>
          <button className="task-clear-btn" onClick={clearCompleted}>Clear</button>
        </div>
      )}

      {isOpen && (
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
            {(() => {
              // Group pipeline items by segment_id
              const visible = showAll ? filtered : filtered.slice(0, VISIBLE_LIMIT)
              const groups = []
              let i = 0
              while (i < visible.length) {
                const item = filtered[i]
                if (PIPELINE_TYPES.has(item.type) && item.segment_id) {
                  // Collect all pipeline items for this segment
                  const segId = item.segment_id
                  const steps = [item]
                  let j = i + 1
                  while (j < visible.length && visible[j].segment_id === segId && PIPELINE_TYPES.has(visible[j].type)) {
                    steps.push(visible[j])
                    j++
                  }
                  if (steps.length > 1) {
                    groups.push({ type: 'pipeline', steps, segId })
                    i = j
                    continue
                  }
                }
                groups.push({ type: 'single', item })
                i++
              }

              return groups.map((g, gi) => {
                if (g.type === 'pipeline') {
                  const isDeep = g.steps.some(s => s.type.startsWith('deep_'))
                  const label = isDeep ? 'Deep Research' : 'Agent Research'
                  const segName = g.steps[0]?.query?.split(': ').pop()?.slice(0, 40) || 'Segment'
                  const allDone = g.steps.every(s => s.status === 'done')
                  const anyFailed = g.steps.some(s => s.status === 'failed')
                  const anyActive = g.steps.some(s => !['done', 'failed', 'pending'].includes(s.status))

                  return (
                    <PipelineGroup key={`pipe-${gi}`}
                      label={label} segName={segName} steps={g.steps}
                      allDone={allDone} anyFailed={anyFailed} anyActive={anyActive}
                      isDeep={isDeep} />
                  )
                }

                const item = g.item
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
              })
            })()}
            {filtered.length === 0 && <div className="task-empty">No tasks</div>}
            {!showAll && filtered.length > VISIBLE_LIMIT && (
              <button className="tm-show-more" onClick={() => setShowAll(true)}>
                Show all ({filtered.length})
              </button>
            )}
            {showAll && filtered.length > VISIBLE_LIMIT && (
              <button className="tm-show-more" onClick={() => setShowAll(false)}>
                Show less
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function PipelineGroup({ label, segName, steps, allDone, anyFailed, anyActive, isDeep }) {
  const [open, setOpen] = useState(true)
  const accentColor = isDeep ? '#a855f7' : '#8b5cf6'

  return (
    <div className="tm-pipeline">
      <div className="tm-pipeline-header" onClick={() => setOpen(!open)}>
        <span className="task-icon">
          {allDone && <CheckCircle2 size={13} style={{ color: '#6bb88a' }} />}
          {anyFailed && !anyActive && <AlertCircle size={13} style={{ color: '#d97070' }} />}
          {anyActive && <Loader2 size={13} className="spin" style={{ color: accentColor }} />}
          {!allDone && !anyFailed && !anyActive && <Clock size={13} style={{ color: 'var(--text-muted)' }} />}
        </span>
        <span className="tm-pipeline-label" style={{ color: accentColor }}>
          {isDeep ? <Layers size={10} style={{ marginRight: 3 }} /> : <Bot size={10} style={{ marginRight: 3 }} />}
          {label}
        </span>
        <span className="tm-pipeline-seg">{segName}</span>
        <span className="tm-pipeline-progress">
          {steps.filter(s => s.status === 'done').length}/{steps.length}
        </span>
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </div>
      {open && (
        <div className="tm-pipeline-steps">
          {steps.map(step => {
            const isDone = step.status === 'done'
            const isFailed = step.status === 'failed'
            const isAct = !isDone && !isFailed && step.status !== 'pending'
            const StepIcon = TYPE_ICONS[step.type] || FileText

            return (
              <div key={step.id} className="tm-pipeline-step">
                <span className="tm-pipeline-line" />
                <span className="tm-pipeline-dot">
                  {isDone && <CheckCircle2 size={10} style={{ color: '#6bb88a' }} />}
                  {isFailed && <AlertCircle size={10} style={{ color: '#d97070' }} />}
                  {isAct && <Loader2 size={10} className="spin" style={{ color: accentColor }} />}
                  {step.status === 'pending' && <span className="tm-dot-empty" />}
                </span>
                <StepIcon size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span className="tm-pipeline-step-name">
                  {STEP_LABELS[step.type] || step.type}
                </span>
                {step.pages > 0 && (
                  <span className="tm-pipeline-step-meta">{step.pages}pg</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
