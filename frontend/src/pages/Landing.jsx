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
    title: 'ElevenLabs Audio Suite',
    desc: '50+ ultra-realistic voices with five style presets. AI-generated music and cinematic sound effects. Every audio element powered by ElevenLabs.',
    key: 'voices',
  },
  {
    num: '02',
    title: 'Deep Research Engine',
    desc: 'Powered by Firecrawl. Search, scrape, crawl, and extract from any website. AI agent synthesizes sources into accurate, citation-backed scripts automatically.',
    key: 'research',
  },
  {
    num: '03',
    title: 'Complete Video Studio',
    desc: 'Configure voice, visuals, music, and captions for every segment. Four visual modes. Real-time preview. One-click generation.',
    key: 'studio',
  },
  {
    num: '04',
    title: 'Viral Short-Form Patterns',
    desc: 'Proven scroll-stopping formats — hook intros, split-screen debates, karaoke lyrics, caption overlays. Every template designed for maximum watch time.',
    key: 'tiktok',
  },
  {
    num: '05',
    title: 'Media Library',
    desc: 'Upload your own background videos. Audio stripped automatically. Shared library across all your projects.',
    key: 'media',
  },
]

const RESEARCH_TOOLS = [
  { icon: 'search', name: 'Search', desc: 'Web search' },
  { icon: 'scrape', name: 'Scrape', desc: 'Extract URLs' },
  { icon: 'crawl', name: 'Crawl', desc: 'Deep crawl' },
  { icon: 'extract', name: 'Extract', desc: 'Structured data' },
  { icon: 'map', name: 'Map', desc: 'Discover URLs' },
  { icon: 'agent', name: 'Agent', desc: 'AI research' },
]

const TOOL_ICONS = {
  search: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  scrape: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>,
  crawl: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  extract: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>,
  map: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" x2="8" y1="2" y2="18"/><line x1="16" x2="16" y1="6" y2="22"/></svg>,
  agent: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>,
}

function ResearchToolGrid() {
  const [activeIdx, setActiveIdx] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setActiveIdx(p => (p + 1) % RESEARCH_TOOLS.length), 2800)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="ln-r-tools">
      {RESEARCH_TOOLS.map((t, i) => {
        const isActive = i === activeIdx
        return (
          <div key={t.name} className={`ln-r-tool ${isActive ? 'ln-r-tool-on' : ''}`}
            style={{ opacity: isActive ? 1 : 0.55, transform: isActive ? 'scale(1.03)' : 'scale(1)' }}>
            <div className="ln-r-tool-icon">{TOOL_ICONS[t.icon]}</div>
            <div className="ln-r-tool-text">
              <span className="ln-r-tool-name">{t.name}</span>
              <span className="ln-r-tool-desc">{t.desc}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ViralPatternsViz() {
  const [activeMode, setActiveMode] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setActiveMode(p => (p + 1) % 3), 3500)
    return () => clearInterval(id)
  }, [])
  const modes = [
    { name: 'AI Backgrounds', key: 'full', desc: 'AI-generated scene per sentence' },
    { name: 'Split Screen', key: 'split', desc: 'Top video + bottom captions' },
    { name: 'Video Background', key: 'video', desc: 'Your own footage as backdrop' },
  ]
  return (
    <>
      {/* Visual Modes — cycling phone preview */}
      <div className="ln-tk-sec">
        <span className="ln-tk-sec-label">Visual modes</span>
        <div className="ln-tk-modes">
          <div className="ln-tk-preview">
            {/* Full/AI BG */}
            <div className={`ln-tk-scene ${activeMode === 0 ? 'ln-tk-scene-on' : ''}`}>
              <div className="ln-tk-scene-bg ln-tk-scene-ai">
                <div className="ln-tk-scene-shimmer" />
              </div>
              <div className="ln-tk-scene-caption">
                <div className="ln-tk-scene-cap-line" />
                <div className="ln-tk-scene-cap-line ln-tk-scene-cap-short" />
              </div>
            </div>
            {/* Split */}
            <div className={`ln-tk-scene ${activeMode === 1 ? 'ln-tk-scene-on' : ''}`}>
              <div className="ln-tk-scene-split-top" />
              <div className="ln-tk-scene-split-mid" />
              <div className="ln-tk-scene-split-bot">
                <div className="ln-tk-scene-cap-line" />
                <div className="ln-tk-scene-cap-line ln-tk-scene-cap-short" />
              </div>
            </div>
            {/* Video BG */}
            <div className={`ln-tk-scene ${activeMode === 2 ? 'ln-tk-scene-on' : ''}`}>
              <div className="ln-tk-scene-bg ln-tk-scene-vid">
                <div className="ln-tk-scene-vid-play">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </div>
              </div>
              <div className="ln-tk-scene-caption">
                <div className="ln-tk-scene-cap-line" />
              </div>
            </div>
          </div>
          <div className="ln-tk-mode-pills">
            {modes.map((m, i) => (
              <div key={m.key} className={`ln-tk-mode ${i === activeMode ? 'ln-tk-mode-on' : ''}`}
                style={{ opacity: i === activeMode ? 1 : 0.5, transition: 'all 0.6s cubic-bezier(0.4,0,0.2,1)' }}>
                <span className="ln-tk-mode-name">{m.name}</span>
                <span className="ln-tk-mode-desc">{m.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hook system */}
      <div className="ln-tk-sec">
        <span className="ln-tk-sec-label">Hook system</span>
        <div className="ln-tk-hook">
          <div className="ln-tk-hook-timeline">
            <div className="ln-tk-hook-seg ln-tk-hook-seg-hook">
              <span>Hook</span>
              <span className="ln-tk-hook-dur">3s</span>
            </div>
            <div className="ln-tk-hook-seg ln-tk-hook-seg-sfx">
              <span>SFX</span>
            </div>
            <div className="ln-tk-hook-seg ln-tk-hook-seg-script">
              <span>Main Script</span>
              <span className="ln-tk-hook-dur">42s</span>
            </div>
          </div>
          <div className="ln-tk-hook-scan" />
        </div>
      </div>

      {/* Captions */}
      <div className="ln-tk-sec">
        <span className="ln-tk-sec-label">Caption styles</span>
        <div className="ln-tk-cap-row">
          {[
            { text: 'BOLD', cls: 'ln-tk-cap-bold', name: 'Impact', on: true },
            { text: 'Glow', cls: 'ln-tk-cap-glow', name: 'Neon' },
            { text: 'Type_', cls: 'ln-tk-cap-type', name: 'Reveal' },
            { text: 'Outline', cls: 'ln-tk-cap-outline', name: 'Clean' },
          ].map(c => (
            <div key={c.name} className={`ln-tk-cap ${c.on ? 'ln-tk-cap-on' : ''}`}>
              <span className={`ln-tk-cap-preview ${c.cls}`}>{c.text}</span>
              <span className="ln-tk-cap-name">{c.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Engagement stats */}
      <div className="ln-tk-sec ln-tk-stats">
        <div className="ln-tk-stat">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
          <span className="ln-tk-stat-val">94%</span>
          <span className="ln-tk-stat-name">Watch rate</span>
        </div>
        <div className="ln-tk-stat">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 2-7 20-4-9-9-4Z"/></svg>
          <span className="ln-tk-stat-val">2.4x</span>
          <span className="ln-tk-stat-name">Retention</span>
        </div>
        <div className="ln-tk-stat">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
          <span className="ln-tk-stat-val">↑67%</span>
          <span className="ln-tk-stat-name">Completion</span>
        </div>
      </div>
    </>
  )
}

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
          <h2 className="ln-fs-title">All you need to<br /><span className="ln-fire">fuel the scroll.</span></h2>
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
          {/* Voices — ElevenLabs branded */}
          <div className={`ln-fs-viz ln-fs-viz-voices ${active === 0 ? 'ln-fs-viz-on' : ''}`}>
            {/* Header */}
            <div className="ln-v-header">
              <div className="ln-v-brand">
                <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                  <rect x="8" y="2" width="5" height="28" rx="2.5" fill="#fafafa"/>
                  <rect x="19" y="2" width="5" height="28" rx="2.5" fill="#fafafa"/>
                </svg>
                <span>ElevenLabs</span>
              </div>
              <span className="ln-v-count">50+ voices</span>
            </div>

            {/* Voice cards */}
            <div className="ln-v-list">
              {[
                { name: 'Laura', desc: 'Warm & expressive', active: true },
                { name: 'Aria', desc: 'Clear & professional' },
                { name: 'Roger', desc: 'Deep & authoritative' },
              ].map((v, i) => (
                <div key={v.name} className={`ln-v-card ${v.active ? 'ln-v-card-on' : ''}`}>
                  <div className="ln-v-card-play">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  </div>
                  <div className="ln-v-card-wave">
                    {[...Array(16)].map((_, j) => (
                      <div key={j} className="ln-v-bar" style={{ height: `${20 + Math.random() * 60}%`, animationDelay: `${j * 0.07 + i * 0.05}s` }} />
                    ))}
                  </div>
                  <div className="ln-v-card-info">
                    <span className="ln-v-card-name">{v.name}</span>
                    <span className="ln-v-card-desc">{v.desc}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Style presets */}
            <div className="ln-v-sec">
              <span className="ln-v-sec-label">Style presets</span>
              <div className="ln-v-styles-row">
                {['Natural', 'Dramatic', 'Energetic', 'Calm', 'Storyteller'].map((p, i) => (
                  <span key={p} className={`ln-v-style ${i === 1 ? 'ln-v-style-on' : ''}`}>{p}</span>
                ))}
              </div>
            </div>

            {/* AI Music */}
            <div className="ln-v-sec">
              <span className="ln-v-sec-label">AI Music</span>
              <div className="ln-v-music-player">
                <div className="ln-v-music-play">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </div>
                <div className="ln-v-music-wave">
                  {[...Array(40)].map((_, i) => (
                    <div key={i} className="ln-v-music-bar" style={{
                      height: `${20 + Math.sin(i * 0.5) * 30 + Math.random() * 25}%`,
                      animationDelay: `${i * 0.06}s`,
                    }} />
                  ))}
                </div>
                <span className="ln-v-music-dur">0:45</span>
              </div>
              <div className="ln-v-music-tracks">
                {['Valley Sunset', 'Digital Clouds', 'Cyberpunk City', 'Forest Mist'].map((t, i) => (
                  <span key={t} className={`ln-v-music-track ${i === 0 ? 'ln-v-music-track-on' : ''}`}>{t}</span>
                ))}
                <span className="ln-v-music-more">+16</span>
              </div>
            </div>

            {/* Sound Effects */}
            <div className="ln-v-sec">
              <span className="ln-v-sec-label">Sound Effects</span>
              <div className="ln-v-sfx-row">
                <div className="ln-v-sfx ln-v-sfx-on">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>
                  Cinematic Whoosh
                </div>
                <div className="ln-v-sfx">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
                  Bass Drop
                </div>
                <div className="ln-v-sfx">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2"/></svg>
                  Riser
                </div>
              </div>
            </div>
          </div>

          {/* Research — Firecrawl branded */}
          <div className={`ln-fs-viz ln-fs-viz-research ${active === 1 ? 'ln-fs-viz-on' : ''}`}>
            {/* Firecrawl header */}
            <div className="ln-r-header">
              <div className="ln-r-brand">
                <img src="/firecrawl-light-logo.svg" alt="" className="ln-r-logo" />
                <span>Firecrawl</span>
              </div>
              <div className="ln-r-status">
                <span className="ln-r-status-dot" />
                <span className="ln-r-status-text">Connected</span>
              </div>
            </div>

            {/* Tool grid — cycles active highlight */}
            <ResearchToolGrid />

            {/* Live research flow */}
            <div className="ln-r-flow">
              <div className="ln-r-flow-label">Live pipeline</div>
              <div className="ln-r-pipeline">
                <div className="ln-r-pipe-step ln-r-pipe-done">
                  <div className="ln-r-pipe-icon">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  </div>
                  <span>Search "quantum computing"</span>
                  <span className="ln-r-pipe-count">12 results</span>
                </div>
                <div className="ln-r-pipe-line" />
                <div className="ln-r-pipe-step ln-r-pipe-done">
                  <div className="ln-r-pipe-icon">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>
                  </div>
                  <span>Scraping 8 sources</span>
                  <span className="ln-r-pipe-count">42 pages</span>
                </div>
                <div className="ln-r-pipe-line" />
                <div className="ln-r-pipe-step ln-r-pipe-active">
                  <div className="ln-r-pipe-icon ln-r-pipe-icon-pulse">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/></svg>
                  </div>
                  <span>AI synthesizing</span>
                  <div className="ln-r-pipe-progress">
                    <div className="ln-r-pipe-progress-bar" />
                  </div>
                </div>
                <div className="ln-r-pipe-line ln-r-pipe-line-dim" />
                <div className="ln-r-pipe-step ln-r-pipe-pending">
                  <div className="ln-r-pipe-icon">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                  </div>
                  <span>Generate 6 segments</span>
                </div>
              </div>
            </div>

            {/* Source cards — staggered slide-in animation */}
            <div className="ln-r-sources">
              {[
                { domain: 'arxiv.org', title: 'Quantum Computing: A Survey', badge: 'markdown' },
                { domain: 'nature.com', title: 'Advances in Qubit Architecture', badge: 'extracted' },
                { domain: 'mit.edu', title: 'Error Correction Breakthroughs', badge: 'crawled' },
              ].map((s, i) => (
                <div key={s.domain} className="ln-r-src" style={{ animationDelay: `${i * 0.4}s` }}>
                  <div className="ln-r-src-favicon">
                    <div className="ln-r-src-scan" />
                  </div>
                  <div className="ln-r-src-info">
                    <span className="ln-r-src-domain">{s.domain}</span>
                    <span className="ln-r-src-title">{s.title}</span>
                  </div>
                  <span className="ln-r-src-badge">{s.badge}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Studio — hero phone with grouped floating controls */}
          <div className={`ln-fs-viz ln-fs-viz-studio ${active === 2 ? 'ln-fs-viz-on' : ''}`}>
            <div className="ln-ft-hero-phone">
              <StudioPreviewPhone videoRefOut={studioVideoRef} />
              <PhoneMicButton videoRef={studioVideoRef} show={active === 2} />
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
              <path d="M79,16 C68,16 62,48 58,48" stroke="rgba(255,255,255,0.13)" strokeWidth="0.25" fill="none"/>
              <path d="M79,48 C72,48 64,48 58,48" stroke="rgba(255,255,255,0.13)" strokeWidth="0.25" fill="none"/>
              <path d="M79,80 C68,80 62,48 58,48" stroke="rgba(255,255,255,0.13)" strokeWidth="0.25" fill="none"/>
              <path d="M52,48 L38,48" stroke="rgba(255,255,255,0.16)" strokeWidth="0.25" fill="none"/>
              <polygon points="38,48 39.5,47 39.5,49" fill="rgba(255,255,255,0.35)"/>
              <circle r="0.5" fill="rgba(255,255,255,0.6)">
                <animateMotion dur="2.5s" repeatCount="indefinite" path="M79,16 C68,16 62,48 58,48"/>
              </circle>
              <circle r="0.5" fill="rgba(255,255,255,0.6)">
                <animateMotion dur="2s" repeatCount="indefinite" begin="0.7s" path="M79,48 C72,48 64,48 58,48"/>
              </circle>
              <circle r="0.5" fill="rgba(255,255,255,0.6)">
                <animateMotion dur="2.5s" repeatCount="indefinite" begin="1.4s" path="M79,80 C68,80 62,48 58,48"/>
              </circle>
              <circle r="0.7" fill="rgba(255,255,255,0.8)">
                <animateMotion dur="1.2s" repeatCount="indefinite" path="M58,48 L38,48"/>
              </circle>
            </svg>
            <div className="ln-gen-btn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Generate
            </div>
          </div>

          {/* Viral Patterns */}
          <div className={`ln-fs-viz ln-fs-viz-tiktok ${active === 3 ? 'ln-fs-viz-on' : ''}`}>
            <div className="ln-tk-header">
              <span className="ln-tk-title">Viral Formats</span>
              <span className="ln-tk-badge">3 modes</span>
            </div>
            <ViralPatternsViz />
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
