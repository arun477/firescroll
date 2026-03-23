import { useState } from 'react'
import {
  ChevronDown, ChevronRight, Trash2, RefreshCw, Loader2,
  CheckCircle2, AlertCircle, Clock,
} from 'lucide-react'

export default function ResearchTaskManager({ tasks, topicId, onRefresh }) {
  const [expanded, setExpanded] = useState(true)
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all'
    ? tasks
    : tasks.filter(t => {
      if (filter === 'running') return !['done', 'failed', 'pending'].includes(t.status)
      return t.status === filter
    })

  const handleDelete = async (taskId) => {
    await fetch(`/api/topics/${topicId}/research/${taskId}`, { method: 'DELETE' })
    onRefresh()
  }

  const clearCompleted = async () => {
    const done = tasks.filter(t => t.status === 'done')
    for (const t of done) {
      await fetch(`/api/topics/${topicId}/research/${t.id}`, { method: 'DELETE' })
    }
    onRefresh()
  }

  const filters = ['all', 'running', 'done', 'failed']
  const runningCount = tasks.filter(t => !['done', 'failed', 'pending'].includes(t.status)).length

  return (
    <div className="task-manager">
      <button className="collapsible-header" onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span>Activity</span>
        <span className="collapsible-count">
          {tasks.length} tasks
          {runningCount > 0 && <span className="task-running-badge">{runningCount} active</span>}
        </span>
      </button>

      {expanded && (
        <div className="task-content">
          <div className="task-toolbar">
            <div className="task-filters">
              {filters.map(f => (
                <button key={f} className={`task-filter ${filter === f ? 'active' : ''}`}
                  onClick={() => setFilter(f)}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <button className="task-clear-btn" onClick={clearCompleted}>
              Clear
            </button>
          </div>

          <div className="task-list">
            {filtered.slice().reverse().map(task => {
              const isDone = task.status === 'done'
              const isFailed = task.status === 'failed'
              const isActive = !isDone && !isFailed && task.status !== 'pending'
              return (
                <div key={task.id} className="task-row">
                  <span className="task-icon">
                    {isDone && <CheckCircle2 size={13} style={{ color: 'var(--green)' }} />}
                    {isFailed && <AlertCircle size={13} style={{ color: 'var(--accent)' }} />}
                    {isActive && <Loader2 size={13} className="spin" style={{ color: 'var(--blue)' }} />}
                    {task.status === 'pending' && <Clock size={13} style={{ color: 'var(--text-muted)' }} />}
                  </span>
                  <span className="task-query">{task.query}</span>
                  <span className="task-actions-cell">
                    {isFailed && (
                      <button className="task-action" title="Retry"><RefreshCw size={10} /></button>
                    )}
                    {(isDone || isFailed) && (
                      <button className="task-action" onClick={() => handleDelete(task.id)} title="Delete">
                        <Trash2 size={10} />
                      </button>
                    )}
                  </span>
                  <span className="task-time">
                    {new Date(task.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
