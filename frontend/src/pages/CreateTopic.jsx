import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Loader2 } from 'lucide-react'

export default function CreateTopic() {
  const navigate = useNavigate()
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!topic.trim()) return

    setLoading(true)
    const res = await fetch('/api/topics/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: topic.trim() }),
    })
    const data = await res.json()
    setLoading(false)

    if (data.topic_id) {
      navigate(`/topic/${data.topic_id}`)
    }
  }

  const suggestions = ['Black Holes', 'Quantum Computing', 'DNA Replication', 'Roman Empire', 'Neural Networks', 'Ocean Depths']

  return (
    <div className="create-page">
      <div className="create-center">
        <h1 className="create-h1">What should we<br /><span className="create-fire">make a video about?</span></h1>

        <form onSubmit={handleCreate} className="create-form">
          <div className="create-input-wrap">
            <input
              type="text"
              className="create-input"
              placeholder="Enter any topic..."
              value={topic}
              onChange={e => setTopic(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              className="create-submit"
              disabled={loading || !topic.trim()}
            >
              {loading ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} />}
            </button>
          </div>
        </form>

        <div className="create-suggestions">
          <span className="create-sug-label">Try</span>
          {suggestions.map(s => (
            <button key={s} className="create-sug" onClick={() => setTopic(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
