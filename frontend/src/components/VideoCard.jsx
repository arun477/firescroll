import { useEffect, useRef, useState } from 'react'
import { Heart, MessageCircle, Share2 } from 'lucide-react'

export default function VideoCard({ item, idx, totalCount, feedRef }) {
  const videoRef = useRef(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.currentTime = 0
          video.muted = false
          video.play().catch(() => {})
        } else {
          video.pause()
        }
      },
      { threshold: 0.6 }
    )

    observer.observe(video)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onTime = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100)
      }
    }

    const onEnded = () => {
      if (idx < totalCount - 1) {
        const cards = feedRef.current?.querySelectorAll('.video-card')
        cards?.[idx + 1]?.scrollIntoView({ behavior: 'smooth' })
      }
    }

    video.addEventListener('timeupdate', onTime)
    video.addEventListener('ended', onEnded)
    return () => {
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('ended', onEnded)
    }
  }, [idx, totalCount, feedRef])

  const likes = Math.floor(Math.random() * 50 + 10)
  const comments = Math.floor(Math.random() * 5 + 1)

  return (
    <div className="video-card">
      <div className="video-progress" style={{ width: `${progress}%` }} />
      <video
        ref={videoRef}
        src={item.video_url}
        playsInline
        muted
        preload={idx < 3 ? 'auto' : 'metadata'}
        poster={item.thumb_url || undefined}
      />
      <div className="video-sidebar">
        <div className="action-group">
          <button className="action-btn"><Heart size={20} /></button>
          <span className="action-label">{likes}K</span>
        </div>
        <div className="action-group">
          <button className="action-btn"><MessageCircle size={20} /></button>
          <span className="action-label">{comments}K</span>
        </div>
        <div className="action-group">
          <button className="action-btn"><Share2 size={20} /></button>
          <span className="action-label">Share</span>
        </div>
      </div>
      <div className="video-overlay">
        <h3>{item.series} - Part {item.segment_id}</h3>
        <p>{item.mode} / {item.caption} / {Math.round(item.duration)}s</p>
      </div>
    </div>
  )
}
