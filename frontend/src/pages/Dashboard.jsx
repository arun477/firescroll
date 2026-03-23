import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ArrowRight } from 'lucide-react'

export default function Dashboard() {
  const [topics, setTopics] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/topics')
      .then(r => r.json())
      .then(setTopics)
  }, [])

  return (
    <>
      <div className="dash-header">
        <div>
          <h1 className="dash-h1">Dashboard</h1>
          <span className="dash-sub">{topics.length} {topics.length === 1 ? 'project' : 'projects'}</span>
        </div>
        <button className="dash-new" onClick={() => navigate('/create')}>
          <Plus size={15} /> New Topic
        </button>
      </div>

      {topics.length === 0 ? (
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
        <div className="dash-grid">
          {topics.map((topic, i) => {
            const pct = topic.total > 0 ? Math.round((topic.done / topic.total) * 100) : 0
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
                <span className="dash-card-series">{topic.series_title}</span>
                <div className="dash-card-bottom">
                  <div className="dash-card-progress">
                    <div className="dash-card-bar">
                      <div className="dash-card-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="dash-card-pct">{pct}%</span>
                  </div>
                  <div className="dash-card-stats">
                    <span>{topic.done}/{topic.total} done</span>
                    <span>{topic.total_segments} segments</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
