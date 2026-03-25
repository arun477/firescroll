import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, ArrowRight, ChevronLeft, ChevronRight,
  FileText, Video, Globe, Loader2, BookOpen,
} from 'lucide-react'

const PAGE_SIZE = 12

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/topics?page=${page}&page_size=${PAGE_SIZE}`)
      setData(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }, [page])

  useEffect(() => { setLoading(true); load() }, [load])

  const topics = data?.topics || []
  const totalPages = data?.pages || 1
  const totalCount = data?.total || 0

  if (loading && !data) {
    return (
      <div className="dash-loading">
        <Loader2 size={20} className="spin" />
        <span>Loading projects...</span>
      </div>
    )
  }

  return (
    <div className="dash-wrap">
      <div className="dash-header">
        <div>
          <h1 className="dash-h1">Dashboard</h1>
          <span className="dash-sub">{totalCount} {totalCount === 1 ? 'project' : 'projects'}</span>
        </div>
        <button className="dash-new" onClick={() => navigate('/create')}>
          <Plus size={15} /> New Topic
        </button>
      </div>

      {topics.length === 0 && !loading ? (
        <div className="dash-empty">
          <div className="dash-empty-icon">
            <svg width="28" height="28" viewBox="0 0 64 64" fill="none">
              <defs>
                <linearGradient id="ef" x1="0%" y1="100%" x2="50%" y2="0%">
                  <stop offset="0%" stopColor="#ef4444"/><stop offset="50%" stopColor="#f97316"/><stop offset="100%" stopColor="#fbbf24"/>
                </linearGradient>
              </defs>
              <path d="M32 4C24 16,14 22,14 36c0,11,8,20,18,20s18-9,18-20c0-8-5-15-10-20c0,10-5,15-8,15s-5-5-2-15z" fill="url(#ef)" opacity="0.3"/>
            </svg>
          </div>
          <h2>No topics yet</h2>
          <p>Create your first topic to start generating videos.</p>
          <button className="dash-empty-btn" onClick={() => navigate('/create')}>
            Get Started <ArrowRight size={14} />
          </button>
        </div>
      ) : (
        <>
          <div className="dash-grid">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="dash-card dash-card-skeleton" />
              ))
            ) : (
              topics.map((topic, i) => {
                const hasResearch = topic.segments_ready > 0
                const hasVideos = topic.videos_done > 0
                const isResearching = topic.research_status === 'generating'

                return (
                  <div
                    key={topic.id}
                    className="dash-card"
                    onClick={() => navigate(`/topic/${topic.id}`)}
                    style={{ animationDelay: `${i * 0.04}s` }}
                  >
                    <div className="dash-card-top">
                      <h3 className="dash-card-title">{topic.title}</h3>
                      <ArrowRight size={14} className="dash-card-arrow" />
                    </div>
                    {topic.series_title && (
                      <span className="dash-card-series">{topic.series_title}</span>
                    )}

                    <div className="dash-card-chips">
                      <span className={`dash-chip ${hasResearch ? 'dash-chip-good' : isResearching ? 'dash-chip-active' : ''}`}>
                        <BookOpen size={10} />
                        {topic.segments_ready}/{topic.segments_total || topic.total_segments} segments
                      </span>
                      {topic.source_count > 0 && (
                        <span className="dash-chip">
                          <Globe size={10} />
                          {topic.source_count} sources
                        </span>
                      )}
                      {topic.videos_total > 0 && (
                        <span className={`dash-chip ${hasVideos ? 'dash-chip-good' : ''}`}>
                          <Video size={10} />
                          {topic.videos_done}/{topic.videos_total} videos
                        </span>
                      )}
                    </div>

                    <div className="dash-card-footer">
                      <span className="dash-card-date">
                        {new Date(topic.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      {isResearching && (
                        <span className="dash-card-status">
                          <Loader2 size={10} className="spin" /> Researching
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {totalPages > 1 && (
            <div className="dash-pagination">
              <button className="dash-page-btn" disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={14} />
              </button>
              <span className="dash-page-info">{page} / {totalPages}</span>
              <button className="dash-page-btn" disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
