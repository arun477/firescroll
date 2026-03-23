import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Loader2 } from 'lucide-react'

export default function CreateTopic() {
  const navigate = useNavigate()
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [segments, setSegments] = useState(6)

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!topic.trim()) return

    setLoading(true)
    const res = await fetch('/api/topics/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: topic.trim(), segments }),
    })
    const data = await res.json()
    setLoading(false)

    if (data.topic_id) {
      navigate(`/topic/${data.topic_id}`)
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Create Topic</h1>
      </div>

      <div className="card" style={{ maxWidth: 480 }}>
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label>Topic</label>
            <input
              type="text"
              placeholder="Black Holes, Quantum Physics, DNA..."
              value={topic}
              onChange={e => setTopic(e.target.value)}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Segments</label>
            <select
              value={segments}
              onChange={e => setSegments(Number(e.target.value))}
            >
              {[3, 4, 5, 6, 7, 8].map(n => (
                <option key={n} value={n}>{n} segments</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !topic.trim()}
            style={{ width: '100%' }}
          >
            {loading ? (
              <><Loader2 size={16} className="spin" /> Generating with AI...</>
            ) : (
              <><Sparkles size={16} /> Create Topic</>
            )}
          </button>
        </form>
      </div>
    </>
  )
}
