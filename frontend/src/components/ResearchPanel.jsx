import { useState } from 'react'
import {
  Sparkles, Globe, Loader2, CheckCircle2, AlertCircle,
  Clock, Cpu, Search, FileText, RefreshCw, Mic,
} from 'lucide-react'

const SOURCE_ICON = { ai: Cpu, firecrawl: Globe }

function SegmentCard({ seg, topicId, onRefresh }) {
  const [loading, setLoading] = useState(false)

  const handleResearch = async (method) => {
    setLoading(true)
    await fetch(`/api/topics/${topicId}/research/segment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segment_id: seg.id, method }),
    })
    setLoading(false)
    onRefresh()
  }

  const isReady = seg.status === 'ready'
  const SourceIcon = SOURCE_ICON[seg.source] || FileText
  const sources = seg.source_urls ? JSON.parse(seg.source_urls) : []

  return (
    <div className={`research-seg ${isReady ? 'seg-ready' : ''}`}>
      <div className="seg-header">
        <div className="seg-num-title">
          <span className="seg-circle">{seg.segment_num}</span>
          <div>
            <strong>{seg.title || `Segment ${seg.segment_num}`}</strong>
            {isReady && (
              <span className="seg-source-tag">
                <SourceIcon size={10} /> {seg.source}
              </span>
            )}
          </div>
        </div>
        <div className="seg-actions">
          {!loading && !isReady && (
            <>
              <button className="btn btn-sm btn-secondary"
                onClick={() => handleResearch('ai')}>
                <Cpu size={12} /> AI
              </button>
              <button className="btn btn-sm btn-secondary"
                onClick={() => handleResearch('firecrawl')}>
                <Globe size={12} /> Web
              </button>
            </>
          )}
          {isReady && (
            <button className="btn btn-sm btn-ghost"
              onClick={() => handleResearch('firecrawl')}>
              <RefreshCw size={12} />
            </button>
          )}
          {loading && <Loader2 size={16} className="spin" style={{ color: 'var(--blue)' }} />}
        </div>
      </div>

      {isReady && (
        <div className="seg-content">
          <div className="seg-field">
            <span className="seg-label">Hook</span>
            <p>{seg.hook}</p>
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
                {sources.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer"
                    className="seg-source-link">
                    <Globe size={10} /> {new URL(url).hostname}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ResearchPanel({ topicId, topic, segments, research, onRefresh }) {
  const [generating, setGenerating] = useState(false)

  const handleGenerateAll = async (method) => {
    setGenerating(true)
    await fetch(`/api/topics/${topicId}/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, num_segments: topic.total_segments }),
    })
    setGenerating(false)
    onRefresh()
  }

  const readyCount = segments.filter(s => s.status === 'ready').length
  const isResearching = topic.research_status === 'generating'
  const runningTasks = research.filter(r => !['done', 'failed'].includes(r.status))

  return (
    <div className="research-panel">
      <div className="rp-header">
        <div>
          <h2>Information Gathering</h2>
          <p className="rp-sub">
            {readyCount}/{segments.length || topic.total_segments} segments ready
            {runningTasks.length > 0 && (
              <span className="rp-active">
                <Loader2 size={12} className="spin" /> {runningTasks.length} tasks running
              </span>
            )}
          </p>
        </div>
        <div className="actions">
          <button className="btn btn-secondary"
            onClick={() => handleGenerateAll('ai')}
            disabled={generating || isResearching}>
            <Sparkles size={15} /> AI Generate All
          </button>
          <button className="btn btn-primary"
            onClick={() => handleGenerateAll('firecrawl')}
            disabled={generating || isResearching}>
            <Globe size={15} /> Web Research All
          </button>
        </div>
      </div>

      {segments.length > 0 ? (
        <div className="research-grid">
          {segments.map(seg => (
            <SegmentCard
              key={seg.id}
              seg={seg}
              topicId={topicId}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      ) : (
        <div className="rp-empty">
          <Search size={32} style={{ opacity: 0.2, marginBottom: 12 }} />
          <h3>No segments yet</h3>
          <p>Choose a method above to start gathering information for your video series.</p>
        </div>
      )}

      {research.length > 0 && (
        <div className="rp-log">
          <h3>Research Log</h3>
          <div className="rp-log-list">
            {research.slice(-10).reverse().map(task => (
              <div key={task.id} className="rp-log-item">
                <span className={`rp-log-status ${task.status}`}>
                  {task.status === 'done' && <CheckCircle2 size={12} />}
                  {task.status === 'failed' && <AlertCircle size={12} />}
                  {['running', 'searching', 'processing'].includes(task.status) &&
                    <Loader2 size={12} className="spin" />}
                  {task.status === 'pending' && <Clock size={12} />}
                </span>
                <span className="rp-log-type">{task.task_type}</span>
                <span className="rp-log-query">{task.query}</span>
                <span className="rp-log-time">
                  {new Date(task.updated_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
