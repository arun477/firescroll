import { useState } from 'react'
import {
  Sparkles, Globe, Loader2, CheckCircle2, AlertCircle,
  Clock, Cpu, Search, FileText, RefreshCw,
} from 'lucide-react'

const STATUS_CONFIG = {
  draft: { icon: FileText, color: 'var(--text-muted)', label: 'Draft' },
  researching: { icon: Loader2, color: 'var(--blue)', label: 'Researching', spin: true },
  ready: { icon: CheckCircle2, color: 'var(--green)', label: 'Ready' },
  failed: { icon: AlertCircle, color: 'var(--accent)', label: 'Failed' },
}

function SegmentCard({ seg, topicId, onRefresh }) {
  const [loading, setLoading] = useState(null)
  const st = STATUS_CONFIG[seg.status] || STATUS_CONFIG.draft
  const StIcon = st.icon
  const isReady = seg.status === 'ready'
  const isBusy = seg.status === 'researching' || loading
  const sources = seg.source_urls ? JSON.parse(seg.source_urls) : []

  const handleResearch = async (method) => {
    if (isBusy) return
    setLoading(method)
    await fetch(`/api/topics/${topicId}/research/segment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segment_id: seg.id, method }),
    })
    setTimeout(() => { setLoading(null); onRefresh() }, 1000)
  }

  return (
    <div className={`research-seg ${isReady ? 'seg-ready' : ''} ${isBusy ? 'seg-busy' : ''}`}>
      <div className="seg-header">
        <div className="seg-num-title">
          <span className={`seg-circle ${isReady ? 'seg-circle-done' : ''}`}>
            {isReady ? <CheckCircle2 size={14} /> : seg.segment_num}
          </span>
          <div className="seg-title-block">
            <strong>{seg.title || `Segment ${seg.segment_num}`}</strong>
            <span className="seg-status-inline" style={{ color: st.color }}>
              <StIcon size={12} className={st.spin ? 'spin' : ''} />
              {st.label}
              {seg.source && isReady && (
                <span className="seg-source-tag">
                  {seg.source === 'firecrawl' ? <Globe size={9} /> : <Cpu size={9} />}
                  {seg.source}
                </span>
              )}
            </span>
          </div>
        </div>
        <div className="seg-actions">
          <button className={`seg-action-btn ${loading === 'ai' ? 'active' : ''}`}
            onClick={() => handleResearch('ai')} disabled={isBusy}
            title="Generate with AI">
            {loading === 'ai' ? <Loader2 size={14} className="spin" /> : <Cpu size={14} />}
            <span>AI</span>
          </button>
          <button className={`seg-action-btn seg-action-web ${loading === 'firecrawl' ? 'active' : ''}`}
            onClick={() => handleResearch('firecrawl')} disabled={isBusy}
            title="Research from web">
            {loading === 'firecrawl' ? <Loader2 size={14} className="spin" /> : <Globe size={14} />}
            <span>Web</span>
          </button>
        </div>
      </div>

      {isReady && (
        <div className="seg-content">
          <div className="seg-field">
            <span className="seg-label">Hook</span>
            <p className="seg-hook">{seg.hook}</p>
          </div>
          <div className="seg-field">
            <span className="seg-label">Script</span>
            <p>{seg.script}</p>
          </div>
          {seg.visual_cue && (
            <div className="seg-field">
              <span className="seg-label">Visual</span>
              <p className="seg-visual">{seg.visual_cue}</p>
            </div>
          )}
          {sources.length > 0 && (
            <div className="seg-field">
              <span className="seg-label">Sources</span>
              <div className="seg-sources">
                {sources.map((url, i) => {
                  try {
                    return (
                      <a key={i} href={url} target="_blank" rel="noreferrer"
                        className="seg-source-link">
                        <Globe size={10} /> {new URL(url).hostname}
                      </a>
                    )
                  } catch { return null }
                })}
              </div>
            </div>
          )}
          <button className="seg-regen-btn" onClick={() => handleResearch(seg.source || 'ai')}>
            <RefreshCw size={12} /> Regenerate
          </button>
        </div>
      )}

      {seg.status === 'failed' && (
        <div className="seg-failed">
          <AlertCircle size={12} /> Failed. Try again with AI or Web.
        </div>
      )}
    </div>
  )
}

export default function ResearchPanel({ topicId, topic, segments, research, onRefresh }) {
  const [generating, setGenerating] = useState(null)

  const handleGenerateAll = async (method) => {
    setGenerating(method)
    await fetch(`/api/topics/${topicId}/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, num_segments: topic.total_segments }),
    })
    setTimeout(() => { setGenerating(null); onRefresh() }, 1500)
  }

  const readyCount = segments.filter(s => s.status === 'ready').length
  const busyCount = segments.filter(s => s.status === 'researching').length
  const isRunning = topic.research_status === 'generating' || busyCount > 0

  return (
    <div className="research-panel">
      <div className="rp-header">
        <div>
          <h2>Information Gathering</h2>
          <div className="rp-stats">
            <span className={`rp-stat ${readyCount > 0 ? 'rp-stat-good' : ''}`}>
              <CheckCircle2 size={13} />
              {readyCount}/{segments.length || topic.total_segments} ready
            </span>
            {busyCount > 0 && (
              <span className="rp-stat rp-stat-active">
                <Loader2 size={13} className="spin" />
                {busyCount} in progress
              </span>
            )}
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-secondary"
            onClick={() => handleGenerateAll('ai')}
            disabled={isRunning || generating}>
            {generating === 'ai'
              ? <><Loader2 size={14} className="spin" /> Running...</>
              : <><Sparkles size={14} /> AI Generate All</>}
          </button>
          <button className="btn btn-primary"
            onClick={() => handleGenerateAll('firecrawl')}
            disabled={isRunning || generating}>
            {generating === 'firecrawl'
              ? <><Loader2 size={14} className="spin" /> Researching...</>
              : <><Globe size={14} /> Web Research All</>}
          </button>
        </div>
      </div>

      {segments.length > 0 ? (
        <div className="research-grid">
          {segments.map(seg => (
            <SegmentCard key={seg.id} seg={seg} topicId={topicId} onRefresh={onRefresh} />
          ))}
        </div>
      ) : (
        <div className="rp-empty">
          <Search size={32} style={{ opacity: 0.15, marginBottom: 12 }} />
          <h3>No segments yet</h3>
          <p>Choose a method above to start gathering information.</p>
        </div>
      )}

      {research.length > 0 && (
        <div className="rp-log">
          <h3>Activity Log</h3>
          <div className="rp-log-list">
            {research.slice(-12).reverse().map(task => {
              const isDone = task.status === 'done'
              const isFailed = task.status === 'failed'
              const isActive = !isDone && !isFailed && task.status !== 'pending'
              return (
                <div key={task.id} className="rp-log-item">
                  <span className={`rp-log-dot ${isDone ? 'dot-done' : ''} ${isFailed ? 'dot-fail' : ''} ${isActive ? 'dot-active' : ''}`} />
                  <span className="rp-log-type">{task.task_type.replace('_', ' ')}</span>
                  <span className="rp-log-query">{task.query}</span>
                  {isActive && <Loader2 size={12} className="spin" style={{ color: 'var(--blue)' }} />}
                  <span className="rp-log-time">
                    {new Date(task.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
