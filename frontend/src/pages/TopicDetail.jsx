import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Play, Shuffle, Eye, AlertCircle } from 'lucide-react'

const STATUS_MAP = {
  done: 'status-done',
  failed: 'status-failed',
  pending: 'status-pending',
}

function statusClass(status) {
  return STATUS_MAP[status] || 'status-running'
}

export default function TopicDetail() {
  const { topicId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [generating, setGenerating] = useState(false)

  const load = () => {
    fetch(`/api/topics/${topicId}`)
      .then(r => r.json())
      .then(setData)
  }

  useEffect(() => { load() }, [topicId])

  useEffect(() => {
    if (!data) return
    const hasRunning = data.jobs?.some(j =>
      !['done', 'failed', 'pending'].includes(j.status)
    )
    if (hasRunning) {
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

  const { topic, jobs } = data

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{topic.title}</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: 13 }}>
            {topic.series_title} / {topic.total_segments} segments
          </p>
        </div>
        <div className="actions">
          <button
            className="btn btn-primary"
            onClick={handleGenerateAll}
            disabled={generating}
          >
            <Shuffle size={16} />
            {generating ? 'Running...' : 'Generate All'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => navigate(`/?topic=${topicId}`)}
          >
            <Eye size={16} /> View Feed
          </button>
        </div>
      </div>

      <div className="gen-options">
        {['full', 'video', 'split'].map(mode =>
          ['default', 'karaoke'].map(cap => (
            <button
              key={`${mode}-${cap}`}
              className="btn btn-secondary btn-sm"
              onClick={() => handleGenerate(mode, cap)}
              disabled={generating}
            >
              <Play size={12} /> {mode} / {cap}
            </button>
          ))
        )}
      </div>

      {jobs && jobs.length > 0 ? (
        <div className="job-grid">
          {jobs.map(job => (
            <div key={job.id} className="job-card">
              <div className="job-header">
                <strong>Segment {job.segment_id}</strong>
                <span className={`status ${statusClass(job.status)}`}>
                  {job.status}
                </span>
              </div>
              <div className="job-meta">
                <span>{job.mode}</span>
                <span>{job.caption}</span>
                {job.duration_seconds && (
                  <span>{Math.round(job.duration_seconds)}s</span>
                )}
              </div>
              {!['done', 'failed', 'pending'].includes(job.status) && (
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
              )}
              {job.status === 'failed' && (
                <div className="job-error">
                  <AlertCircle size={12} style={{ display: 'inline', verticalAlign: -2 }} />{' '}
                  {job.error}
                </div>
              )}
              {job.video_url && job.status === 'done' && (
                <video
                  className="job-video"
                  src={job.video_url}
                  controls
                  muted
                  preload="metadata"
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p>No jobs yet. Click a generate button above to start.</p>
        </div>
      )}
    </>
  )
}
