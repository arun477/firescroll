import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, Flame } from 'lucide-react'
import VideoCard from '../components/VideoCard'

const BATCH = 6

export default function Feed() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [cursor, setCursor] = useState(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [searchParams] = useSearchParams()
  const feedRef = useRef(null)
  const sentinelRef = useRef(null)
  const topicId = searchParams.get('topic')

  const fetchPage = useCallback(async (cur = null, append = false) => {
    if (!append) setLoading(true)
    else setLoadingMore(true)
    try {
      const params = new URLSearchParams({ limit: BATCH })
      if (topicId) params.set('topic_id', topicId)
      if (cur) params.set('cursor', cur)
      const res = await fetch(`/api/feed?${params}`)
      const data = await res.json()
      setItems(prev => append ? [...prev, ...data.items] : data.items)
      setTotal(data.total)
      setHasMore(data.has_more)
      setCursor(data.next_cursor)
    } catch { /* ignore */ }
    setLoading(false)
    setLoadingMore(false)
  }, [topicId])

  // Initial load
  useEffect(() => { fetchPage() }, [fetchPage])

  // Infinite scroll — observe sentinel element near the bottom
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingMore && cursor) {
          fetchPage(cursor, true)
        }
      },
      { rootMargin: '200%' }  // trigger 2 screens before reaching end
    )
    obs.observe(sentinel)
    return () => obs.disconnect()
  }, [hasMore, loadingMore, cursor, fetchPage])

  const handleActiveChange = useCallback((idx) => {
    setActiveIdx(idx)
  }, [])

  const goTo = useCallback((idx) => {
    const cards = feedRef.current?.querySelectorAll('.vc')
    if (cards?.[idx]) {
      cards[idx].scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  const handleDelete = useCallback(async (item) => {
    if (!confirm(`Delete this video?`)) return
    const endpoint = item.pipeline === 'motion'
      ? `/api/remotion/jobs/${item.id}`
      : `/api/jobs/${item.id}`
    try {
      await fetch(endpoint, { method: 'DELETE' })
      setItems(prev => prev.filter(v => v.id !== item.id))
      setTotal(prev => Math.max(0, prev - 1))
    } catch {}
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
          onDelete={handleDelete}
        />
      ))}

      {/* Sentinel for infinite scroll — triggers next page load */}
      <div ref={sentinelRef} className="feed-sentinel">
        {loadingMore && (
          <div className="feed-loading-more">
            <Loader2 size={16} className="spin" />
          </div>
        )}
      </div>

      {/* Total count badge */}
      {total > 0 && (
        <div className="feed-counter">
          {total} video{total !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
