import { useState, useEffect, useRef, useMemo, memo } from 'react'

const GITHUB_URL = 'https://github.com/arun477/firescroll'
const openGithub = () => window.open(GITHUB_URL, '_blank')

// Inline SVG arrow to replace lucide-react ArrowRight
function ArrowRight({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
    </svg>
  )
}

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
          <a href={GITHUB_URL} target="_blank" rel="noopener" className="ln-nav-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          </a>
          <button className="ln-nav-btn" onClick={openGithub}>Dashboard</button>
          <button className="ln-nav-go" onClick={openGithub}>
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
          <button className="ln-go" onClick={openGithub}>
            Start Creating <ArrowRight size={15} />
          </button>
          <button className="ln-ghost" onClick={openGithub}>
            Watch Examples
          </button>
        </div>
        </div>
      </section>

      {/* Demo Videos */}
      <section className="ln-demos">
        <h2>See it in action</h2>
        <div className="ln-demos-grid">
          <div className="ln-demo-card">
            <video controls preload="metadata" poster="https://img.youtube.com/vi/485MsI5a450/maxresdefault.jpg">
              <source src="/videos/firescroll_marketing_intro.mp4" type="video/mp4" />
            </video>
            <div className="ln-demo-info">
              <div>
                <div className="ln-demo-title">Overview</div>
                <div className="ln-demo-sub">What FireScroll can do</div>
              </div>
              <a href="https://www.youtube.com/watch?v=485MsI5a450" target="_blank" rel="noopener" className="ln-demo-yt">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.4-1.9.5-5.8.5-5.8s0-3.9-.5-5.8ZM9.5 15.6V8.4l6.3 3.6-6.3 3.6Z"/></svg>
                YouTube
              </a>
            </div>
          </div>
          <div className="ln-demo-card">
            <video controls preload="metadata" poster="https://img.youtube.com/vi/vs4SbNTQTww/maxresdefault.jpg">
              <source src="/videos/firescroll_working_site_demo.mp4" type="video/mp4" />
            </video>
            <div className="ln-demo-info">
              <div>
                <div className="ln-demo-title">Live Demo</div>
                <div className="ln-demo-sub">Full walkthrough of the app</div>
              </div>
              <a href="https://www.youtube.com/watch?v=vs4SbNTQTww" target="_blank" rel="noopener" className="ln-demo-yt">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.4-1.9.5-5.8.5-5.8s0-3.9-.5-5.8ZM9.5 15.6V8.4l6.3 3.6-6.3 3.6Z"/></svg>
                YouTube
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Features — scroll reveal */}
      <FeaturesSection />

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
          <div className="ln-flow-step"><span>04</span> Generate & scroll</div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="ln-cta">
        <h2 className="ln-h2">
          Make something<br /><span className="ln-fire">extraordinary</span>
        </h2>
        <button className="ln-go ln-go-lg" onClick={openGithub}>
          Start Creating <ArrowRight size={16} />
        </button>
        <p className="ln-fine">Bring your own API keys. Free and open source.</p>
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="ln-cta-github">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          GitHub
        </a>
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
    { name: 'AI Backgrounds', tag: 'FULL' },
    { name: 'Split Screen', tag: 'SPLIT' },
    { name: 'Video BG', tag: 'VIDEO' },
  ]
  return (
    <div className="ln-vp">
      {/* Big phone — center hero */}
      <div className="ln-vp-phone">
        {/* AI BG scene */}
        <div className={`ln-vp-scene ${activeMode === 0 ? 'ln-vp-scene-on' : ''}`}>
          <div className="ln-vp-scene-ai">
            <div className="ln-vp-shimmer" />
            <div className="ln-vp-ai-dots">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="ln-vp-ai-dot" style={{ animationDelay: `${i * 0.4}s` }} />
              ))}
            </div>
          </div>
          <div className="ln-vp-cap">
            <div className="ln-vp-cap-line" />
            <div className="ln-vp-cap-line ln-vp-cap-short" />
          </div>
        </div>
        {/* Split scene */}
        <div className={`ln-vp-scene ${activeMode === 1 ? 'ln-vp-scene-on' : ''}`}>
          <div className="ln-vp-split-top">
            <div className="ln-vp-split-face" />
          </div>
          <div className="ln-vp-split-div" />
          <div className="ln-vp-split-bot">
            <div className="ln-vp-cap">
              <div className="ln-vp-cap-line" />
              <div className="ln-vp-cap-line ln-vp-cap-short" />
            </div>
          </div>
        </div>
        {/* Video BG scene */}
        <div className={`ln-vp-scene ${activeMode === 2 ? 'ln-vp-scene-on' : ''}`}>
          <div className="ln-vp-vid-bg">
            <div className="ln-vp-vid-grain" />
          </div>
          <div className="ln-vp-cap">
            <div className="ln-vp-cap-line" />
          </div>
        </div>
        {/* Progress bar at bottom */}
        <div className="ln-vp-progress"><div className="ln-vp-progress-fill" /></div>
      </div>

      {/* Floating mode tabs — left side */}
      <div className="ln-vp-modes">
        {modes.map((m, i) => (
          <div key={m.tag} className={`ln-vp-mode ${i === activeMode ? 'ln-vp-mode-on' : ''}`}>
            <span className="ln-vp-mode-tag">{m.tag}</span>
            <span className="ln-vp-mode-name">{m.name}</span>
          </div>
        ))}
      </div>

      {/* Hook badge — top right */}
      <div className="ln-vp-hook-badge">
        <div className="ln-vp-hook-bar">
          <div className="ln-vp-hook-seg-h">Hook 3s</div>
          <div className="ln-vp-hook-seg-s">SFX</div>
          <div className="ln-vp-hook-seg-m">Script</div>
        </div>
        <div className="ln-vp-hook-scan" />
      </div>

      {/* Caption styles — bottom left */}
      <div className="ln-vp-caps">
        <span className="ln-vp-cap-bold">IMPACT</span>
        <span className="ln-vp-cap-glow">Neon</span>
        <span className="ln-vp-cap-type">Type_</span>
        <span className="ln-vp-cap-outline">Clean</span>
      </div>

      {/* Stats — bottom right */}
      <div className="ln-vp-stats">
        <div className="ln-vp-stat">
          <span className="ln-vp-stat-num">94%</span>
          <span className="ln-vp-stat-label">watch</span>
        </div>
        <div className="ln-vp-stat">
          <span className="ln-vp-stat-num">2.4x</span>
          <span className="ln-vp-stat-label">retain</span>
        </div>
        <div className="ln-vp-stat">
          <span className="ln-vp-stat-num">↑67%</span>
          <span className="ln-vp-stat-label">finish</span>
        </div>
      </div>
    </div>
  )
}

function MediaLibraryViz() {
  return (
    <div className="ln-ml">
      {/* Stacked video cards */}
      <div className="ln-ml-stack">
        <div className="ln-ml-scard ln-ml-scard-4" style={{ background: 'linear-gradient(160deg, #0c0c0e, #18181b)' }} />
        <div className="ln-ml-scard ln-ml-scard-3" style={{ background: 'linear-gradient(160deg, #0f0f12, #1c1c20)' }} />
        <div className="ln-ml-scard ln-ml-scard-2" style={{ background: 'linear-gradient(160deg, #111114, #222228)' }} />
        <div className="ln-ml-scard ln-ml-scard-1" style={{ background: 'linear-gradient(160deg, #141418, #27272a)' }}>
          <div className="ln-ml-scard-play">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
          <div className="ln-ml-scard-bottom">
            <span className="ln-ml-scard-name">ocean_waves.mp4</span>
            <span className="ln-ml-scard-dur">0:45</span>
          </div>
        </div>

        {/* Uploading card floating down */}
        <div className="ln-ml-uploading">
          <div className="ln-ml-uploading-inner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
            <span>Uploading...</span>
            <div className="ln-ml-uploading-bar"><div className="ln-ml-uploading-fill" /></div>
          </div>
        </div>
      </div>

      {/* Floating info badges */}
      <div className="ln-ml-badge ln-ml-badge-tl">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m2 2 20 20"/><path d="M11 5L6 9H2v6h4l5 4V5Z"/></svg>
        Audio auto-stripped
      </div>
      <div className="ln-ml-badge ln-ml-badge-tr">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" x2="15.4" y1="13.5" y2="17.5"/><line x1="15.4" x2="8.6" y1="6.5" y2="10.5"/></svg>
        Shared across projects
      </div>
      <div className="ln-ml-badge ln-ml-badge-bl">
        MP4 · MOV · AVI · WebM
      </div>
      <div className="ln-ml-badge ln-ml-badge-br">
        <div className="ln-ml-dots">
          {[...Array(4)].map((_, i) => <div key={i} className="ln-ml-dot" style={{ animationDelay: `${i * 0.2}s` }} />)}
        </div>
        12 videos ready
      </div>
    </div>
  )
}

function FeaturesSection() {
  const [active, setActive] = useState(0)
  const containerRef = useRef(null)
  const stepRefs = useRef([])

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

            {/* Mobile-only inline visual — premium reveal */}
            <div className="ln-mob-viz">
              {f.key === 'voices' && (
                <div className="ln-mob-card ln-mob-card-voices">
                  <div className="ln-mob-header">
                    <div className="ln-mob-row">
                      <svg width="18" height="18" viewBox="0 0 32 32" fill="none"><rect x="8" y="2" width="5" height="28" rx="2.5" fill="#fafafa"/><rect x="19" y="2" width="5" height="28" rx="2.5" fill="#fafafa"/></svg>
                      <span className="ln-mob-brand">ElevenLabs</span>
                    </div>
                    <span className="ln-mob-tag">50+ voices</span>
                  </div>
                  <div className="ln-mob-voices">
                    {[
                      { name: 'Laura', desc: 'Warm & expressive' },
                      { name: 'Aria', desc: 'Clear & professional' },
                      { name: 'Roger', desc: 'Deep & authoritative' },
                    ].map((v, vi) => (
                      <div key={v.name} className={`ln-mob-voice ${vi === 0 ? 'ln-mob-voice-on' : ''}`}>
                        <div className="ln-mob-voice-play">
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        </div>
                        <div className="ln-mob-wave">
                          {[...Array(24)].map((_, j) => (
                            <div key={j} className="ln-mob-wave-bar" style={{
                              height: `${12 + ((j * 31 + vi * 19) % 76)}%`,
                              animationDelay: `${j * 0.05}s`,
                              animationDuration: `${0.8 + (j % 3) * 0.3}s`,
                            }} />
                          ))}
                        </div>
                        <div className="ln-mob-voice-info">
                          <span className="ln-mob-voice-name">{v.name}</span>
                          <span className="ln-mob-voice-desc">{v.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="ln-mob-section">
                    <span className="ln-mob-sub">Style presets</span>
                    <div className="ln-mob-pills ln-mob-pills-scroll">
                      {['Natural', 'Dramatic', 'Energetic', 'Calm', 'Storyteller'].map((p, pi) => (
                        <span key={p} className={`ln-mob-pill ${pi === 1 ? 'ln-mob-pill-accent' : ''}`}>{p}</span>
                      ))}
                    </div>
                  </div>
                  <div className="ln-mob-section">
                    <span className="ln-mob-sub">AI Music</span>
                    <div className="ln-mob-player">
                      <div className="ln-mob-player-play">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      </div>
                      <div className="ln-mob-player-viz">
                        {[...Array(32)].map((_, j) => (
                          <div key={j} className="ln-mob-player-bar" style={{
                            height: `${10 + Math.sin(j * 0.5) * 30 + ((j * 23) % 40)}%`,
                            animationDelay: `${j * 0.04}s`,
                          }} />
                        ))}
                      </div>
                      <span className="ln-mob-player-time">0:45</span>
                    </div>
                    <div className="ln-mob-pills">
                      <span className="ln-mob-pill ln-mob-pill-on">Valley Sunset</span>
                      <span className="ln-mob-pill">Digital Clouds</span>
                      <span className="ln-mob-pill">Cyberpunk City</span>
                      <span className="ln-mob-pill ln-mob-pill-dim">+16</span>
                    </div>
                  </div>
                  <div className="ln-mob-section">
                    <span className="ln-mob-sub">Sound Effects</span>
                    <div className="ln-mob-pills">
                      <span className="ln-mob-pill ln-mob-pill-on">Cinematic Whoosh</span>
                      <span className="ln-mob-pill">Bass Drop</span>
                      <span className="ln-mob-pill">Riser</span>
                    </div>
                  </div>
                </div>
              )}

              {f.key === 'research' && (
                <div className="ln-mob-card ln-mob-card-research">
                  <div className="ln-mob-header">
                    <div className="ln-mob-row">
                      <img src="/firecrawl-light-logo.svg" alt="" style={{ height: 18 }} />
                      <span className="ln-mob-brand">Firecrawl</span>
                    </div>
                    <span className="ln-mob-tag ln-mob-tag-green">
                      <span className="ln-mob-tag-dot" />Connected
                    </span>
                  </div>
                  <div className="ln-mob-tools">
                    {['Search', 'Scrape', 'Crawl', 'Extract', 'Map', 'Agent'].map((t, ti) => (
                      <div key={t} className={`ln-mob-tool ${ti === 5 ? 'ln-mob-tool-on' : ''}`}>
                        <span className="ln-mob-tool-name">{t}</span>
                      </div>
                    ))}
                  </div>
                  <div className="ln-mob-section">
                    <span className="ln-mob-sub">Live pipeline</span>
                    <div className="ln-mob-pipeline">
                      {[
                        { label: 'Search "quantum computing"', count: '12 results', status: 'done' },
                        { label: 'Scraping 8 sources', count: '42 pages', status: 'done' },
                        { label: 'AI synthesizing...', status: 'active' },
                        { label: 'Generate 6 segments', status: 'pending' },
                      ].map((step, si) => (
                        <div key={si}>
                          {si > 0 && <div className={`ln-mob-pipe-line ${step.status === 'pending' ? 'ln-mob-pipe-line-dim' : ''}`} />}
                          <div className={`ln-mob-pipe ln-mob-pipe-${step.status}`}>
                            <div className={`ln-mob-pipe-dot ${step.status === 'active' ? 'ln-mob-pipe-pulse' : ''}`} />
                            <span className="ln-mob-pipe-label">{step.label}</span>
                            {step.count && <span className="ln-mob-pipe-count">{step.count}</span>}
                            {step.status === 'active' && (
                              <div className="ln-mob-pipe-bar"><div className="ln-mob-pipe-bar-fill" /></div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="ln-mob-section">
                    <span className="ln-mob-sub">Sources extracted</span>
                    <div className="ln-mob-sources">
                      {[
                        { d: 'arxiv.org', t: 'Quantum Computing: A Survey', b: 'markdown', c: '#6bb88a' },
                        { d: 'nature.com', t: 'Advances in Qubit Architecture', b: 'extracted', c: '#7dacf0' },
                        { d: 'mit.edu', t: 'Error Correction Breakthroughs', b: 'crawled', c: '#f97316' },
                      ].map((s, si) => (
                        <div key={s.d} className="ln-mob-src" style={{ animationDelay: `${si * 0.15}s` }}>
                          <div className="ln-mob-src-dot" style={{ background: s.c }} />
                          <div className="ln-mob-src-info">
                            <span className="ln-mob-src-d">{s.d}</span>
                            <span className="ln-mob-src-t">{s.t}</span>
                          </div>
                          <span className="ln-mob-src-b">{s.b}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {f.key === 'studio' && (
                <div className="ln-mob-card ln-mob-card-studio">
                  <div className="ln-mob-section">
                    <span className="ln-mob-sub">Voice</span>
                    <div className="ln-mob-voice-sel">
                      {[
                        { n: 'Aria', d: 'Clear' },
                        { n: 'Laura', d: 'Warm', on: true },
                        { n: 'Roger', d: 'Deep' },
                      ].map(v => (
                        <div key={v.n} className={`ln-mob-vsel ${v.on ? 'ln-mob-vsel-on' : ''}`}>
                          <div className="ln-mob-vsel-avatar">{v.n[0]}</div>
                          <span className="ln-mob-vsel-name">{v.n}</span>
                          <span className="ln-mob-vsel-desc">{v.d}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="ln-mob-section">
                    <span className="ln-mob-sub">Visual Mode</span>
                    <div className="ln-mob-modes">
                      {[
                        { n: 'AI Backgrounds', on: true, icon: 'M3 3h18v18H3z' },
                        { n: 'Split Screen', icon: 'M12 3v18' },
                        { n: 'Video BG', icon: 'M23 7l-7 5 7 5V7z' },
                        { n: 'Karaoke', icon: 'M9 18V5l12-2v13' },
                      ].map(m => (
                        <div key={m.n} className={`ln-mob-mode ${m.on ? 'ln-mob-mode-on' : ''}`}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d={m.icon}/></svg>
                          <span>{m.n}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="ln-mob-section">
                    <span className="ln-mob-sub">Audio</span>
                    <div className="ln-mob-pills">
                      <span className="ln-mob-pill ln-mob-pill-accent">AI Music</span>
                      <span className="ln-mob-pill ln-mob-pill-on">Captions</span>
                      <span className="ln-mob-pill">Sound FX</span>
                    </div>
                  </div>
                  <div className="ln-mob-gen">
                    <div className="ln-mob-gen-glow" />
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    Generate Video
                  </div>
                </div>
              )}

              {f.key === 'tiktok' && (
                <div className="ln-mob-card ln-mob-card-viral">
                  <div className="ln-mob-section">
                    <span className="ln-mob-sub">Scroll-stopping formats</span>
                    <div className="ln-mob-formats">
                      {[
                        { n: 'Hook Intro', d: '3-second attention grab opening' },
                        { n: 'Split Screen', d: 'Face-cam + educational content' },
                        { n: 'Karaoke Lyrics', d: 'Highlighted sing-along captions' },
                        { n: 'Caption Overlay', d: 'Bold text-driven storytelling' },
                      ].map((fmt, fi) => (
                        <div key={fmt.n} className={`ln-mob-format ${fi === 0 ? 'ln-mob-format-on' : ''}`}>
                          <div className="ln-mob-format-body">
                            <span className="ln-mob-format-name">{fmt.n}</span>
                            <span className="ln-mob-format-desc">{fmt.d}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="ln-mob-section">
                    <span className="ln-mob-sub">Performance</span>
                    <div className="ln-mob-stats">
                      <div className="ln-mob-stat">
                        <span className="ln-mob-stat-val">94%</span>
                        <span className="ln-mob-stat-lbl">Watch rate</span>
                      </div>
                      <div className="ln-mob-stat">
                        <span className="ln-mob-stat-val">2.4x</span>
                        <span className="ln-mob-stat-lbl">Retention</span>
                      </div>
                      <div className="ln-mob-stat">
                        <span className="ln-mob-stat-val">+67%</span>
                        <span className="ln-mob-stat-lbl">Completion</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {f.key === 'media' && (
                <div className="ln-mob-card ln-mob-card-media">
                  <div className="ln-mob-section">
                    <span className="ln-mob-sub">Your video library</span>
                    <div className="ln-mob-media-grid">
                      {[
                        { name: 'ocean_waves.mp4', dur: '0:45', g1: '#0c1220', g2: '#1a3050' },
                        { name: 'city_night.mp4', dur: '1:12', g1: '#1a0a2e', g2: '#3d1a6e' },
                        { name: 'abstract.mp4', dur: '0:30', g1: '#0a1a0a', g2: '#1a3a20' },
                      ].map(v => (
                        <div key={v.name} className="ln-mob-media-item">
                          <div className="ln-mob-media-thumb" style={{ background: `linear-gradient(160deg, ${v.g1}, ${v.g2})` }}>
                            <div className="ln-mob-media-play">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            </div>
                            <span className="ln-mob-media-dur">{v.dur}</span>
                          </div>
                          <span className="ln-mob-media-name">{v.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="ln-mob-upload">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                    <span>Drop videos here</span>
                    <div className="ln-mob-upload-formats">MP4 / MOV / AVI / WebM</div>
                  </div>
                  <div className="ln-mob-row" style={{ gap: 6 }}>
                    <div className="ln-mob-feat-pill">Audio auto-stripped</div>
                    <div className="ln-mob-feat-pill">Shared across projects</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        <div className="ln-fs-spacer" />
      </div>

      {/* Right: sticky visual that swaps — desktop */}
      <div className="ln-fs-sticky ln-fs-sticky-desk">
        <div className="ln-fs-visuals">
          {/* Voices — ElevenLabs branded */}
          <div className={`ln-fs-viz ln-fs-viz-voices ${active === 0 ? 'ln-fs-viz-on' : ''}`}>
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
            <div className="ln-v-sec">
              <span className="ln-v-sec-label">Style presets</span>
              <div className="ln-v-styles-row">
                {['Natural', 'Dramatic', 'Energetic', 'Calm', 'Storyteller'].map((p, i) => (
                  <span key={p} className={`ln-v-style ${i === 1 ? 'ln-v-style-on' : ''}`}>{p}</span>
                ))}
              </div>
            </div>
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
            <ResearchToolGrid />
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

          {/* Studio — hero phone with GIF fallback (no API call) */}
          <div className={`ln-fs-viz ln-fs-viz-studio ${active === 2 ? 'ln-fs-viz-on' : ''}`}>
            <div className="ln-ft-hero-phone">
              <StudioPreviewPhone />
            </div>
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

          {/* Viral Patterns — open layout */}
          <div className={`ln-fs-viz ln-fs-viz-viral ${active === 3 ? 'ln-fs-viz-on' : ''}`}>
            <ViralPatternsViz />
          </div>

          {/* Media Library — visual grid */}
          <div className={`ln-fs-viz ln-fs-viz-media ${active === 4 ? 'ln-fs-viz-on' : ''}`}>
            <MediaLibraryViz />
          </div>
        </div>
      </div>
    </section>
  )
}

// Studio preview phone — GIF fallback only (no API call)
function StudioPreviewPhone() {
  return (
    <div className="ln-sm-phone">
      <img className="ln-sm-phone-gif" src={gifUrl(ALL_GIFS[24])} alt="" loading="lazy" />
      <div className="ln-sm-phone-overlay">
        <div className="ln-sm-phone-title">DNA: The Blueprint</div>
        <div className="ln-sm-phone-sub">Part 1 of 5</div>
      </div>
    </div>
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
