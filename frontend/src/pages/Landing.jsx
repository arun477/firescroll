import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef, useMemo, memo } from 'react'
import { ArrowRight } from 'lucide-react'

// 70 unique GIFs across 9 categories — mixed for TikTok FYP randomness
const ALL_GIFS = [
  // animals & cute
  'ihbWUcwZ5MVLHk3OW2', 'fvzzTw4GevP2g', 'yXBqba0Zx8S4', '3lH05gVzcd8CocN08E',
  '26BRzj53E0YclHilG', 'mXTYe6d2GozORrmiJR', 'jdNv8nxNMRa61mOsVq',
  // food & cooking
  'CP5Yar5Tc8asXAWdiJ', 'O0fU5QCjPjOWgZ6787', 'TkCdSQKx9HXoXbU6kU',
  '0iIDiDhE5dAxXkbRXx', '8iJXzhtGs4bicJrLGI', 'rhomAxEIX4quMVjymu', 'UGeqGXZafMY2coQmq9',
  // sunset & beach
  'Jb90XJYZbZGvK', 'B5WYfBKkhSXLwBoRSO', 'kHyMZMDwgX8m0gyO6e', 'Jpuck5ozFThRjfsE0Y',
  '1JsSOW3M1y8xefYZAD', 'dZP8UDOCnchq8C7dfc', '1ZjaN6QSGGCj5m1FiL', 'l4FGxWle5DTKaT4Hu',
  // space & galaxy
  'sJvz8Qnfly3BOuotGx', '4ydWTcMBjimLbT1CHi', '3ov9k1173PdfJWRsoE', 'Tj4jjaCxXRVSARsUzN',
  'D35fOVm9gSQ91icJeR', 'GTJFIAnmAdrnsmXcO7', 'JQpH25Y6TrRQwtF0KY', '26n6G8lRMOrYC6rFS',
  // nature & flowers
  'bPT3I3JkTBUb2b5WjE', '76is5s2Px02NYK2wBY', 'ACA0cicaOzCUg', '1DkmhEV6j62K3205aP',
  'U7z2Sfv7kXuzTbSVYI', '6Vxe4B8HqF82C9BtQm', 'YI3AQoxgLaC6RssyGx',
  // aurora & night
  'bPDzcb6OADZ9m', 'PGhgbrTPAqFQTeKUMb', 'QJUfI8QHc3DKbbmwPu', 'sEU384ODAcnSg',
  // neon & city
  'CvzUA900mgXSPIVtvO', 'A9Lbvgza45YFgY3DM0', 'ehcPwlCW2xmy6ZqoU9',
  // ocean & underwater
  'ZTAojHK9IHsSQ', 'oOrRt0rIDNtPa', 'l2QE7T5qsKPDhWQkU',
  // gaming
  'I2zNgXkq9U0m1R8JQw', 'CSRGZCZjxWNxlELtf6', 'si0Bv6N7c5wLuPLG2A',
  'FhKuScBgdPf5EgY37e', 'GhcET7EBlVvGHzzDhI', 't7bTvMkyTz2q78OTyU',
  'tx7EW72lH4Lh1leiXE', 'IB2IVgLi7eo0fgMWiL',
  // anime & digital art
  'C8gkEYivtQDlGzyAwp', 'Fbox1ygIqnga5dLinz', 'eJmUEoeU1K4d4IUbpS',
  'nyEFXSvfHbIzoVccUd', 'usOikM00Flk139pNEv', 'q4KDyjMkgitFnBt2k8',
  'i2Rcn45tJjqcnh3Qcl', '26ufo4EIIEdB8tX3y', 'rzMswsYn8WuCFItORN',
  'tLz54ylpDi9NMzLH07',
]

// Pre-compute columns once — interleave so adjacent cards are always different
const COLUMNS = Array.from({ length: 7 }, (_, c) =>
  Array.from({ length: 8 }, (_, r) => ALL_GIFS[(r * 7 + c) % ALL_GIFS.length])
)

function gifUrl(id) {
  return `https://media.giphy.com/media/${id}/200w.gif`
}

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="ln">
      {/* Ambient background */}
      <div className="ln-bg">
        <div className="ln-bg-orb ln-bg-orb1" />
        <div className="ln-bg-orb ln-bg-orb2" />
        <div className="ln-bg-orb ln-bg-orb3" />
        <div className="ln-bg-noise" />
      </div>

      {/* Nav */}
      <nav className="ln-nav">
        <div className="ln-nav-left">
          <svg className="ln-nav-flame" width="20" height="20" viewBox="0 0 64 64" fill="none">
            <defs>
              <linearGradient id="fg" x1="0%" y1="100%" x2="50%" y2="0%">
                <stop offset="0%" stopColor="#ef4444"/><stop offset="50%" stopColor="#f97316"/><stop offset="100%" stopColor="#fbbf24"/>
              </linearGradient>
            </defs>
            <path d="M32 4C24 16,14 22,14 36c0,11,8,20,18,20s18-9,18-20c0-8-5-15-10-20c0,10-5,15-8,15s-5-5-2-15z" fill="url(#fg)"/>
          </svg>
          <span className="ln-nav-name">FireScroll</span>
        </div>
        <div className="ln-nav-right">
          <a href="https://github.com/arun477/firescroll" target="_blank" rel="noopener" className="ln-nav-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          </a>
          <button className="ln-nav-btn" onClick={() => navigate('/dashboard')}>Dashboard</button>
          <button className="ln-nav-go" onClick={() => navigate('/create')}>
            Get Started <ArrowRight size={13} />
          </button>
        </div>
      </nav>

      {/* Hero + scrolling background */}
      <section className="ln-hero">
        {/* Scrolling phones behind hero */}
        <div className="ln-showcase">
          <ShowcaseGrid />
        </div>

        <div className="ln-hero-content">

        {/* Partner branding */}
        <div className="ln-partners">
          <span className="ln-partners-built">Built with</span>
          <div className="ln-partners-logos">
            <a href="https://elevenlabs.io" target="_blank" rel="noopener" className="ln-partner">
              <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
                <rect x="8" y="2" width="5" height="28" rx="2.5" fill="currentColor"/>
                <rect x="19" y="2" width="5" height="28" rx="2.5" fill="currentColor"/>
              </svg>
              ElevenLabs
            </a>
            <span className="ln-partners-x">+</span>
            <a href="https://firecrawl.dev" target="_blank" rel="noopener" className="ln-partner">
              <img src="/firecrawl-light-logo.svg" alt="" className="ln-partner-img" />
              Firecrawl
            </a>
          </div>
        </div>

        <h1 className="ln-h1">
          Brain rot,<br />
          <span className="ln-fire">but educational.</span>
        </h1>
        <p className="ln-tagline">Short video creation platform</p>
        <p className="ln-p">
          Type any topic. AI researches, writes, and renders addictive
          short-form videos with ultra-realistic voices and custom music.
          The scroll that actually teaches you something.
        </p>
        <div className="ln-actions">
          <button className="ln-go" onClick={() => navigate('/create')}>
            Start Creating <ArrowRight size={15} />
          </button>
          <button className="ln-ghost" onClick={() => navigate('/feed')}>
            Watch Examples
          </button>
        </div>
        </div>
      </section>

      {/* Features — scroll reveal */}
      <FeaturesSection navigate={navigate} />

      {/* How it works */}
      <section className="ln-flow">
        <h2 className="ln-h2">Topic to video in minutes</h2>
        <div className="ln-flow-steps">
          <div className="ln-flow-step"><span>01</span> Enter any topic</div>
          <div className="ln-flow-arrow"><ArrowRight size={16} /></div>
          <div className="ln-flow-step"><span>02</span> AI researches & writes</div>
          <div className="ln-flow-arrow"><ArrowRight size={16} /></div>
          <div className="ln-flow-step"><span>03</span> Configure in Studio</div>
          <div className="ln-flow-arrow"><ArrowRight size={16} /></div>
          <div className="ln-flow-step"><span>04</span> Generate & export</div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="ln-cta">
        <h2 className="ln-h2">
          Make something<br /><span className="ln-fire">extraordinary</span>
        </h2>
        <button className="ln-go ln-go-lg" onClick={() => navigate('/create')}>
          Start Creating <ArrowRight size={16} />
        </button>
        <p className="ln-fine">Bring your own API keys. Free and open source.</p>
      </section>
    </div>
  )
}

// Features data
const FEATURES = [
  {
    num: '01',
    title: '50+ Ultra-Realistic Voices',
    desc: 'Powered by ElevenLabs. Five style presets — natural, dramatic, energetic, calm, storyteller. Fine-tune stability, clarity, and speed per segment.',
    key: 'voices',
  },
  {
    num: '02',
    title: 'Complete Video Studio',
    desc: 'Configure voice, visuals, music, and captions for every segment. Four visual modes. Real-time preview. One-click generation.',
    key: 'studio',
  },
  {
    num: '03',
    title: 'AI Music & Sound Effects',
    desc: 'Generate custom instrumentals with ElevenLabs or choose from 20+ built-in ambient tracks. AI sound effects for cinematic intros.',
    key: 'music',
  },
  {
    num: '04',
    title: 'Deep Research',
    desc: 'Firecrawl web scraping + AI synthesis. Accurate, sourced scripts generated automatically from the web.',
    key: 'research',
  },
  {
    num: '05',
    title: 'Media Library',
    desc: 'Upload your own background videos. Audio stripped automatically. Shared library across all your projects.',
    key: 'media',
  },
]

function FeaturesSection() {
  const [active, setActive] = useState(0)
  const containerRef = useRef(null)
  const stepRefs = useRef([])
  const studioVideoRef = useRef(null)

  useEffect(() => {
    const onScroll = () => {
      const trigger = window.innerHeight * 0.55
      let best = 0
      for (let i = stepRefs.current.length - 1; i >= 0; i--) {
        const el = stepRefs.current[i]
        if (!el) continue
        if (el.getBoundingClientRect().top <= trigger) { best = i; break }
      }
      setActive(prev => prev === best ? prev : best)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <section className="ln-fs" ref={containerRef}>
      {/* Left: scrolling text steps */}
      <div className="ln-fs-text">
        <div className="ln-fs-intro">
          <span className="ln-fs-label">The Platform</span>
          <h2 className="ln-fs-title">Everything you need.<br /><span className="ln-fire">Nothing you don't.</span></h2>
        </div>
        {FEATURES.map((f, i) => (
          <div
            key={f.key}
            ref={el => stepRefs.current[i] = el}
            className={`ln-fs-step ${active === i ? 'ln-fs-step-active' : ''}`}
          >
            <span className="ln-fs-num">{f.num}</span>
            <h3 className="ln-fs-h3">{f.title}</h3>
            <p className="ln-fs-desc">{f.desc}</p>
          </div>
        ))}
        {/* Spacer so last item can reach center */}
        <div className="ln-fs-spacer" />
      </div>

      {/* Right: sticky visual that swaps */}
      <div className="ln-fs-sticky">
        <div className="ln-fs-visuals">
          {/* Voices */}
          <div className={`ln-fs-viz ${active === 0 ? 'ln-fs-viz-on' : ''}`}>
            <div className="ln-ft-voices-grid">
              {['Aria', 'Roger', 'Sarah', 'Laura', 'Charlie', 'George', 'Lily', 'Chris'].map((name, i) => (
                <div key={name} className={`ln-ft-voice ${i === 3 ? 'ln-ft-voice-active' : ''}`}>
                  <div className="ln-ft-voice-bars">
                    {[...Array(12)].map((_, j) => (
                      <div key={j} className="ln-ft-voice-bar" style={{ height: `${15 + Math.random() * 70}%`, animationDelay: `${j * 0.08 + i * 0.04}s` }} />
                    ))}
                  </div>
                  <span className="ln-ft-voice-name">{name}</span>
                </div>
              ))}
            </div>
            <div className="ln-ft-presets">
              {['Natural', 'Dramatic', 'Energetic', 'Calm', 'Storyteller'].map((p, i) => (
                <span key={p} className={`ln-ft-preset ${i === 1 ? 'ln-ft-preset-active' : ''}`}>{p}</span>
              ))}
            </div>
          </div>

          {/* Studio — hero phone with grouped floating controls */}
          <div className={`ln-fs-viz ln-fs-viz-studio ${active === 1 ? 'ln-fs-viz-on' : ''}`}>
            <div className="ln-ft-hero-phone">
              <StudioPreviewPhone videoRefOut={studioVideoRef} />
              <PhoneMicButton videoRef={studioVideoRef} show={active === 1} />
            </div>

            {/* Voice group — top right */}
            <div className="ln-grp ln-grp-voice">
              <div className="ln-grp-label">Voice</div>
              <div className="ln-grp-row">
                <div className="ln-pill">Aria</div>
                <div className="ln-pill ln-pill-sel">Laura</div>
                <div className="ln-pill">Roger</div>
              </div>
              <div className="ln-grp-label">Style</div>
              <div className="ln-grp-row">
                <div className="ln-pill">Natural</div>
                <div className="ln-pill ln-pill-sel">Dramatic</div>
                <div className="ln-pill">Calm</div>
              </div>
            </div>

            {/* Visual mode — right center */}
            <div className="ln-grp ln-grp-mode">
              <div className="ln-grp-label">Visual</div>
              <div className="ln-grp-row">
                <div className="ln-pill ln-pill-sel">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>
                  AI Backgrounds
                </div>
                <div className="ln-pill">Split Screen</div>
              </div>
              <div className="ln-grp-row">
                <div className="ln-pill">Video BG</div>
                <div className="ln-pill">Karaoke</div>
              </div>
            </div>

            {/* Audio — bottom right */}
            <div className="ln-grp ln-grp-audio">
              <div className="ln-grp-label">Audio</div>
              <div className="ln-grp-row">
                <div className="ln-pill ln-pill-on">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                  AI Music
                </div>
                <div className="ln-pill">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  Captions
                </div>
              </div>
            </div>

            {/* Flow: 3 config boxes → converge → Generate → arrow → video */}
            <svg className="ln-flow-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
              {/* Voice (left-center of voice box) → Generate */}
              <path d="M79,16 C68,16 62,48 58,48" stroke="rgba(255,255,255,0.13)" strokeWidth="0.25" fill="none"/>
              {/* Visual (left-center of visual box) → Generate */}
              <path d="M79,48 C72,48 64,48 58,48" stroke="rgba(255,255,255,0.13)" strokeWidth="0.25" fill="none"/>
              {/* Audio (left-center of audio box) → Generate */}
              <path d="M79,80 C68,80 62,48 58,48" stroke="rgba(255,255,255,0.13)" strokeWidth="0.25" fill="none"/>
              {/* Generate → Video phone */}
              <path d="M52,48 L38,48" stroke="rgba(255,255,255,0.16)" strokeWidth="0.25" fill="none"/>
              {/* Arrow tip */}
              <polygon points="38,48 39.5,47 39.5,49" fill="rgba(255,255,255,0.35)"/>
              {/* Pulse: Voice → Generate */}
              <circle r="0.5" fill="rgba(255,255,255,0.6)">
                <animateMotion dur="2.5s" repeatCount="indefinite" path="M79,16 C68,16 62,48 58,48"/>
              </circle>
              {/* Pulse: Visual → Generate */}
              <circle r="0.5" fill="rgba(255,255,255,0.6)">
                <animateMotion dur="2s" repeatCount="indefinite" begin="0.7s" path="M79,48 C72,48 64,48 58,48"/>
              </circle>
              {/* Pulse: Audio → Generate */}
              <circle r="0.5" fill="rgba(255,255,255,0.6)">
                <animateMotion dur="2.5s" repeatCount="indefinite" begin="1.4s" path="M79,80 C68,80 62,48 58,48"/>
              </circle>
              {/* Pulse: Generate → Video */}
              <circle r="0.7" fill="rgba(255,255,255,0.8)">
                <animateMotion dur="1.2s" repeatCount="indefinite" path="M58,48 L38,48"/>
              </circle>
            </svg>
            <div className="ln-gen-btn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Generate
            </div>
          </div>

          {/* Music */}
          <div className={`ln-fs-viz ${active === 2 ? 'ln-fs-viz-on' : ''}`}>
            <div className="ln-ft-eq">
              {[...Array(48)].map((_, i) => (
                <div key={i} className="ln-ft-eq-bar" style={{ animationDelay: `${i * 0.05}s` }} />
              ))}
            </div>
            <div className="ln-ft-eq-meta">
              <span className="ln-ft-eq-tag">AI Generated</span>
              <span className="ln-ft-eq-dur">0:45</span>
            </div>
          </div>

          {/* Research */}
          <div className={`ln-fs-viz ${active === 3 ? 'ln-fs-viz-on' : ''}`}>
            <div className="ln-ft-research">
              {[
                { text: 'Scraping arxiv.org...', done: false },
                { text: 'Found 12 sources', done: false },
                { text: 'Synthesizing scripts...', done: false },
                { text: 'Generated 6 segments', done: true },
              ].map((s, i) => (
                <div key={i} className="ln-ft-step" style={{ animationDelay: `${i * 0.6}s` }}>
                  <div className={`ln-ft-step-dot ${s.done ? 'ln-ft-step-done' : ''}`} />
                  <span>{s.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Media Library */}
          <div className={`ln-fs-viz ${active === 4 ? 'ln-fs-viz-on' : ''}`}>
            <div className="ln-ft-media">
              <div className="ln-ft-media-drop">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16"/></svg>
                <span>Drop video or click to upload</span>
              </div>
              {['sunset_timelapse.mp4', 'ocean_waves.mp4', 'city_night.mp4'].map(f => (
                <div key={f} className="ln-ft-media-file">
                  <div className="ln-ft-media-thumb" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// Studio preview phone — loads real video from feed, falls back to GIF
function StudioPreviewPhone({ videoRefOut }) {
  const [video, setVideo] = useState(null)
  const videoRef = useRef(null)

  useState(() => {
    fetch('/api/feed').then(r => r.json()).then(items => {
      if (items.length > 0) setVideo(items[0])
    }).catch(() => {})
  })

  // Share ref with parent
  useEffect(() => {
    if (videoRefOut) videoRefOut.current = videoRef.current
  })

  return (
    <div className="ln-sm-phone">
      {video?.video_url ? (
        <video ref={videoRef} className="ln-sm-phone-gif" src={video.video_url}
          autoPlay muted loop playsInline preload="metadata" />
      ) : (
        <img className="ln-sm-phone-gif" src={gifUrl(ALL_GIFS[24])} alt="" loading="lazy" />
      )}
      <div className="ln-sm-phone-overlay">
        <div className="ln-sm-phone-title">{video?.topic || 'DNA: The Blueprint'}</div>
        <div className="ln-sm-phone-sub">{video ? `Part ${video.segment_id}` : 'Part 1 of 5'}</div>
      </div>
    </div>
  )
}

// Mic button rendered outside phone to avoid overflow clip
function PhoneMicButton({ videoRef, show }) {
  const [muted, setMuted] = useState(true)
  if (!show) return null
  const toggle = () => {
    setMuted(prev => {
      const next = !prev
      if (videoRef.current) videoRef.current.muted = next
      return next
    })
  }
  return (
    <button className={`ln-mic-btn ${!muted ? 'ln-mic-on' : ''}`} onClick={toggle}>
      {muted ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
      )}
    </button>
  )
}

// Memoized showcase grid — never re-renders from parent state changes
const ShowcaseGrid = memo(function ShowcaseGrid() {
  // Stable random widths computed once
  const titleWidths = useMemo(() => COLUMNS.flat().map(() => 40 + Math.random() * 40), [])
  const subWidths = useMemo(() => COLUMNS.flat().map(() => 50 + Math.random() * 35), [])
  let idx = 0

  return (
    <div className="ln-showcase-cols">
      {COLUMNS.map((col, ci) => (
        <div key={ci} className={`ln-showcase-col ln-showcase-col-${ci % 2 === 0 ? 'up' : 'down'}`}
          style={{ animationDuration: `${22 + ci * 3}s` }}>
          {col.map((gid, i) => {
            const k = idx++
            return (
              <PhoneCard key={`${ci}-${i}`} gid={gid}
                titleW={titleWidths[k]} subW={subWidths[k]} />
            )
          })}
        </div>
      ))}
    </div>
  )
})

// Individual phone card — fades in smoothly when GIF loads
const PhoneCard = memo(function PhoneCard({ gid, titleW, subW }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className={`ln-phone ${loaded ? 'ln-phone-loaded' : ''}`}>
      <img className="ln-phone-gif" src={gifUrl(gid)} alt=""
        loading="lazy" onLoad={() => setLoaded(true)} />
      <div className="ln-phone-overlay">
        <div className="ln-phone-title" style={{ width: `${titleW}%` }} />
        <div className="ln-phone-subtitle" style={{ width: `${subW}%` }} />
      </div>
    </div>
  )
})
