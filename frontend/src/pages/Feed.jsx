import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, Flame } from 'lucide-react'
import VideoCard from '../components/VideoCard'

export default function Feed() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeIdx, setActiveIdx] = useState(0)
  const [searchParams] = useSearchParams()
  const feedRef = useRef(null)
  const topicId = searchParams.get('topic')

  useEffect(() => {
    const url = topicId ? `/api/feed?topic_id=${topicId}` : '/api/feed'
    fetch(url)
      .then(r => r.json())
      .then(d => setItems(d || []))
      .finally(() => setLoading(false))
  }, [topicId])

  // Track which card is active via IntersectionObserver on the container
  const handleActiveChange = useCallback((idx) => {
    setActiveIdx(idx)
  }, [])

  const goTo = useCallback((idx) => {
    const cards = feedRef.current?.querySelectorAll('.vc')
    if (cards?.[idx]) {
      cards[idx].scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  if (loading) {
    return (
      <div className="feed-loading">
        <Loader2 size={20} className="spin" />
        <span>Loading feed...</span>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="feed-empty">
        <Flame size={28} strokeWidth={1.5} />
        <h2>No videos yet</h2>
        <p>Create a topic and generate videos to see them here.</p>
      </div>
    )
  }

  return (
    <div className="feed-container" ref={feedRef}>
      {items.map((item, idx) => (
        <VideoCard
          key={item.id}
          item={item}
          idx={idx}
          totalCount={items.length}
          isActive={idx === activeIdx}
          onActive={handleActiveChange}
          onNext={() => goTo(idx + 1)}
        />
      ))}

      {/* Position indicator */}
      <div className="feed-counter">
        {activeIdx + 1} / {items.length}
      </div>
    </div>
  )
}
