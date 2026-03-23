import { useEffect, useRef, useState } from 'react'
import VideoCard from '../components/VideoCard'

export default function Feed() {
  const [items, setItems] = useState([])
  const feedRef = useRef(null)

  useEffect(() => {
    fetch('/api/feed')
      .then(r => r.json())
      .then(setItems)
  }, [])

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <h2>No videos yet</h2>
        <p>Create a topic and generate videos to see them here.</p>
      </div>
    )
  }

  return (
    <div className="feed-container" ref={feedRef} style={{ padding: 0 }}>
      {items.map((item, idx) => (
        <VideoCard
          key={item.id}
          item={item}
          idx={idx}
          totalCount={items.length}
          feedRef={feedRef}
        />
      ))}
    </div>
  )
}
