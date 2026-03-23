import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Video, CheckCircle2 } from 'lucide-react'

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
      <div className="page-header">
        <h1>Dashboard</h1>
        <div className="actions">
          <button className="btn btn-primary" onClick={() => navigate('/create')}>
            <Plus size={16} /> New Topic
          </button>
        </div>
      </div>

      {topics.length === 0 ? (
        <div className="empty-state">
          <h2>No topics yet</h2>
          <p>Create your first topic to start generating educational short-form videos.</p>
        </div>
      ) : (
        <div className="topic-grid">
          {topics.map(topic => (
            <div
              key={topic.id}
              className="topic-card"
              onClick={() => navigate(`/topic/${topic.id}`)}
            >
              <h3>{topic.title}</h3>
              <div className="sub">{topic.series_title}</div>
              <div className="stats">
                <span>
                  <CheckCircle2 size={12} style={{ display: 'inline', verticalAlign: -2 }} />{' '}
                  <span className="stat-value">{topic.done}</span>/{topic.total} done
                </span>
                <span>
                  <Video size={12} style={{ display: 'inline', verticalAlign: -2 }} />{' '}
                  <span className="stat-value">{topic.total_segments}</span> segments
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
