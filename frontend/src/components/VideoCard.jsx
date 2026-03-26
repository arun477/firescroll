import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Play, Pause, Volume2, VolumeX,
  SkipForward, RotateCcw, Maximize2, Trash2,
} from 'lucide-react'

export default function VideoCard({ item, idx, totalCount, isActive, onActive, onNext, onDelete }) {
  const videoRef = useRef(null)
  const cardRef = useRef(null)
  const [progress, setProgress] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [showControls, setShowControls] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const hideTimer = useRef(null)

  // IntersectionObserver — auto-play/pause
  useEffect(() => {
    const card = cardRef.current
    const video = videoRef.current
    if (!card || !video) return

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onActive(idx)
          video.currentTime = 0
          video.muted = false
          setMuted(false)
          video.play().then(() => {
            // Autoplay with sound succeeded
          }).catch(() => {
            // Browser blocked unmuted autoplay — fall back to muted
            video.muted = true
            setMuted(true)
            video.play().catch(() => {})
          })
        } else {
          video.pause()
        }
      },
      { threshold: 0.65 }
    )
    obs.observe(card)
    return () => obs.disconnect()
  }, [idx, onActive])

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onTimeUpdate = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100)
        setCurrentTime(video.currentTime)
      }
    }
    const onProgress = () => {
      if (video.buffered.length > 0 && video.duration) {
        setBuffered((video.buffered.end(video.buffered.length - 1) / video.duration) * 100)
      }
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onLoaded = () => setDuration(video.duration || 0)
    const onVolumeChange = () => setMuted(video.muted)
    const onEnded = () => {
      setPlaying(false)
      if (idx < totalCount - 1) {
        setTimeout(() => onNext(), 600)
      }
    }

    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('progress', onProgress)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('loadedmetadata', onLoaded)
    video.addEventListener('volumechange', onVolumeChange)
    video.addEventListener('ended', onEnded)
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('progress', onProgress)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('volumechange', onVolumeChange)
      video.removeEventListener('ended', onEnded)
    }
  }, [idx, totalCount, onNext])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play().catch(() => {})
    } else {
      video.pause()
    }
  }, [])

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const next = !video.muted
    video.muted = next
    setMuted(next)
  }, [])

  const replay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = 0
    video.play().catch(() => {})
  }, [])

  const seekTo = useCallback((e) => {
    const video = videoRef.current
    const bar = e.currentTarget
    if (!video || !bar) return
    const rect = bar.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    video.currentTime = pct * video.duration
  }, [])

  const toggleFullscreen = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.requestFullscreen) video.requestFullscreen()
    else if (video.webkitRequestFullscreen) video.webkitRequestFullscreen()
    else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen()
  }, [])

  // Show/hide controls on hover/tap
  const showCtrl = useCallback(() => {
    setShowControls(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setShowControls(false), 3000)
  }, [])

  const handleCardClick = useCallback((e) => {
    // Don't toggle play if clicking on controls
    if (e.target.closest('.vc-controls') || e.target.closest('.vc-seek')) return
    togglePlay()
    showCtrl()
  }, [togglePlay, showCtrl])

  const fmt = (s) => {
    if (!s || !isFinite(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div
      ref={cardRef}
      className={`vc ${isActive ? 'vc-active' : ''}`}
      onClick={handleCardClick}
      onMouseMove={showCtrl}
      onMouseEnter={showCtrl}
    >
      {/* Progress bar — top */}
      <div className="vc-progress-track">
        <div className="vc-progress-buffer" style={{ width: `${buffered}%` }} />
        <div className="vc-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Video */}
      <video
        ref={videoRef}
        src={item.video_url}
        playsInline
        preload={idx < 2 ? 'auto' : 'metadata'}
        poster={item.thumb_url || undefined}
      />

      {/* Center play/pause indicator */}
      {!playing && isActive && (
        <div className="vc-center-play">
          <Play size={40} fill="white" />
        </div>
      )}

      {/* Bottom overlay — info + controls */}
      <div className={`vc-bottom ${showControls ? 'vc-bottom-show' : ''}`}>
        {/* Info */}
        <div className="vc-info">
          <h3 className="vc-title">{item.topic || item.series}</h3>
          <p className="vc-subtitle">
            {item.series && item.series !== item.topic ? `${item.series} · ` : ''}
            Part {item.segment_id}
          </p>
        </div>

        {/* Seek bar */}
        <div className="vc-seek" onClick={seekTo}>
          <div className="vc-seek-track">
            <div className="vc-seek-buffer" style={{ width: `${buffered}%` }} />
            <div className="vc-seek-fill" style={{ width: `${progress}%` }}>
              <div className="vc-seek-thumb" />
            </div>
          </div>
          <div className="vc-time">
            <span>{fmt(currentTime)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>

        {/* Control buttons */}
        <div className="vc-controls">
          <div className="vc-controls-left">
            <button className="vc-btn" onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
              {playing ? <Pause size={18} /> : <Play size={18} fill="white" />}
            </button>
            <button className="vc-btn" onClick={replay} title="Replay">
              <RotateCcw size={16} />
            </button>
            {idx < totalCount - 1 && (
              <button className="vc-btn" onClick={onNext} title="Next">
                <SkipForward size={16} />
              </button>
            )}
          </div>
          <div className="vc-controls-right">
            <button className="vc-btn" onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <button className="vc-btn" onClick={toggleFullscreen} title="Fullscreen">
              <Maximize2 size={15} />
            </button>
            {onDelete && (
              <button className="vc-btn vc-btn-delete" onClick={(e) => { e.stopPropagation(); onDelete(item) }} title="Delete video">
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
