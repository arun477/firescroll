import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Play, Shuffle, Flame, AlertCircle, Clock, CheckCircle2,
  Film, Mic, Type, Layers, Monitor, SplitSquareHorizontal,
  BookOpen, Video,
} from 'lucide-react'
import ResearchPanel from '../components/ResearchPanel'

const STATUS_MAP = {
  done: { cls: 'status-done', icon: CheckCircle2, label: 'Done' },
  failed: { cls: 'status-failed', icon: AlertCircle, label: 'Failed' },
  pending: { cls: 'status-pending', icon: Clock, label: 'Queued' },
}

const MODE_ICONS = { full: Layers, video: Monitor, split: SplitSquareHorizontal }

function getStatusInfo(status) {
  return STATUS_MAP[status] || { cls: 'status-running', icon: Film, label: status }
}

export default function TopicDetail() {
  const { topicId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [generating, setGenerating] = useState(false)

  const tab = searchParams.get('tab') || 'research'
  const setTab = (t) => setSearchParams({ tab: t })

  const load = () => {
    fetch(`/api/topics/${topicId}`)
      .then(r => r.json())
      .then(d => {
        setData(d)
        if (!searchParams.get('tab')) {
          const segs = d.segments || []
          const allReady = segs.length > 0 && segs.every(s => s.status === 'ready')
          if (allReady) setSearchParams({ tab: 'generate' })
        }
      })
  }

  useEffect(() => { load() }, [topicId])

  useEffect(() => {
    if (!data) return
    const hasRunning = data.jobs?.some(j =>
      !['done', 'failed', 'pending'].includes(j.status)
    )
    const hasResearch = data.research?.some(r =>
      !['done', 'failed'].includes(r.status)
    )
    if (hasRunning || hasResearch) {
      const interval = setInterval(load, 3000)
      return () => clearInterval(interval)
    }
  }, [data, topicId])

  const handleGenerate = async (mode, caption) => {
    setGenerating(true)
    await fetch(`/api/topics/${topicId}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, caption }),
    })
    setGenerating(false)
    load()
  }

  const handleGenerateAll = async () => {
    setGenerating(true)
    await fetch(`/api/topics/${topicId}/generate-all`, { method: 'POST' })
    setGenerating(false)
    load()
  }

  if (!data) return <div className="empty-state">Loading...</div>

  const { topic, jobs, segments, research, sources, source_stats, fc_jobs } = data
  const doneJobs = jobs?.filter(j => j.status === 'done').length || 0
  const readySegs = segments?.filter(s => s.status === 'ready').length || 0

  return (
    <div className="topic-detail">
      <div className="td-compact-header">
        <div className="td-title-row">
          <h1 className="td-title">{topic.title}</h1>
          <span className="td-subtitle">
            {topic.series_title && <>{topic.series_title} · </>}
            {topic.total_segments} seg
            {readySegs > 0 && <> · {readySegs} ready</>}
            {doneJobs > 0 && <> · {doneJobs} videos</>}
          </span>
        </div>
        <div className="td-header-actions">
          <div className="td-tabs-inline">
            <button className={`td-tab ${tab === 'research' ? 'active' : ''}`}
              onClick={() => setTab('research')}>
              <BookOpen size={14} /> Research
              {readySegs > 0 && <span className="td-tab-badge">{readySegs}/{segments?.length || 0}</span>}
            </button>
            <button className={`td-tab ${tab === 'generate' ? 'active' : ''}`}
              onClick={() => setTab('generate')}>
              <Video size={14} /> Videos
              {doneJobs > 0 && <span className="td-tab-badge">{doneJobs}</span>}
            </button>
          </div>
          <button className="btn btn-secondary btn-sm"
            onClick={() => navigate(`/?topic=${topicId}`)}>
            <Flame size={14} /> Feed
          </button>
        </div>
      </div>

      {tab === 'research' && (
        <ResearchPanel
          topicId={topicId}
          topic={topic}
          segments={segments || []}
          research={research || []}
          sources={sources || []}
          sourceStats={source_stats || {}}
          fcJobs={fc_jobs || []}
          onRefresh={load}
        />
      )}

      {tab === 'generate' && (
        <>
          <div className="td-modes">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="td-modes-label">Quick generate</span>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleGenerateAll}
                disabled={generating}
              >
                <Shuffle size={14} /> Generate All
              </button>
            </div>
            <div className="td-modes-grid">
              {['full', 'video', 'split'].map(mode => {
                const ModeIcon = MODE_ICONS[mode]
                return ['default', 'karaoke'].map(cap => (
                  <button
                    key={`${mode}-${cap}`}
                    className="td-mode-btn"
                    onClick={() => handleGenerate(mode, cap)}
                    disabled={generating}
                  >
                    <ModeIcon size={14} />
                    <span className="td-mode-name">{mode}</span>
                    <span className="td-mode-cap">
                      {cap === 'karaoke'
                        ? <><Mic size={11} /> karaoke</>
                        : <><Type size={11} /> default</>}
                    </span>
                  </button>
                ))
              })}
            </div>
          </div>

          {jobs && jobs.length > 0 ? (
            <div className="job-grid">
              {jobs.map(job => {
                const si = getStatusInfo(job.status)
                const StatusIcon = si.icon
                const ModeIcon = MODE_ICONS[job.mode] || Film
                const isActive = !['done', 'failed', 'pending'].includes(job.status)

                return (
                  <div key={job.id} className={`job-card ${isActive ? 'job-active' : ''}`}>
                    <div className="job-header">
                      <div className="job-seg-num">
                        <span className="job-seg-circle">{job.segment_id}</span>
                        <strong>Segment {job.segment_id}</strong>
                      </div>
                      <span className={`status ${si.cls}`}>
                        <StatusIcon size={12} /> {si.label}
                      </span>
                    </div>
                    <div className="job-meta">
                      <span><ModeIcon size={12} /> {job.mode}</span>
                      <span>
                        {job.caption === 'karaoke'
                          ? <><Mic size={12} /> karaoke</>
                          : <><Type size={12} /> default</>}
                      </span>
                      {job.duration_seconds && (
                        <span><Clock size={12} /> {Math.round(job.duration_seconds)}s</span>
                      )}
                    </div>
                    {isActive && (
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${job.progress}%` }} />
                      </div>
                    )}
                    {job.status === 'failed' && (
                      <div className="job-error">
                        <AlertCircle size={12} /> {job.error}
                      </div>
                    )}
                    {job.video_url && job.status === 'done' && (
                      <video className="job-video" src={job.video_url}
                        controls muted preload="metadata" />
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="empty-state">
              <h2>Ready to generate</h2>
              <p>Pick a mode above or hit Generate All.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
