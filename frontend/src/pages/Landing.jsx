import { useNavigate } from 'react-router-dom'
import { useState, useMemo, memo } from 'react'
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

      {/* Features */}
      <section className="ln-feat">
        <h2 className="ln-h2">Everything under one roof</h2>

        {/* Row 1: Two big cards */}
        <div className="ln-feat-row ln-feat-row-2">
          <div className="ln-card ln-card-voices">
            <div className="ln-card-text">
              <h3>ElevenLabs Voices</h3>
              <p>50+ ultra-realistic AI voices with 5 style presets. Fine-tune stability, clarity, style, and speed per segment.</p>
            </div>
            <div className="ln-card-viz">
              <div className="ln-viz-voices">
                {['Bella', 'Roger', 'Sarah', 'Laura', 'Charlie', 'George', 'Callum'].map((n, i) => (
                  <div key={n} className={`ln-viz-voice ${i === 3 ? 'ln-viz-voice-on' : ''}`}>
                    <div className="ln-viz-voice-wave">
                      {[...Array(8)].map((_,j) => <div key={j} style={{height: `${20+Math.random()*60}%`, animationDelay: `${j*0.1+i*0.05}s`}} />)}
                    </div>
                    <span>{n}</span>
                  </div>
                ))}
              </div>
              <div className="ln-viz-presets">
                {['Natural', 'Dramatic', 'Energetic', 'Calm', 'Storyteller'].map((p, i) => (
                  <span key={p} className={`ln-viz-preset ${i === 1 ? 'ln-viz-preset-on' : ''}`}>{p}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="ln-card ln-card-music">
            <div className="ln-card-text">
              <h3>AI Music & SFX</h3>
              <p>Generate custom instrumentals with ElevenLabs or pick from 20+ built-in ambient tracks. AI sound effects for intros.</p>
            </div>
            <div className="ln-card-viz">
              <div className="ln-viz-eq-big">
                {[...Array(40)].map((_,i) => <div key={i} className="ln-viz-eq-bar" style={{animationDelay: `${i*0.06}s`}} />)}
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Full-width studio */}
        <div className="ln-feat-row ln-feat-row-1">
          <div className="ln-card ln-card-studio-full">
            <div className="ln-studio-top">
              <div>
                <h3>Video Studio</h3>
                <p>Pick voice, visuals, music, and captions for every segment. Preview in real-time. Generate with one click.</p>
              </div>
              <div className="ln-studio-modes">
                <span className="ln-studio-mode ln-studio-mode-on">AI Backgrounds</span>
                <span className="ln-studio-mode">Video BG</span>
                <span className="ln-studio-mode">Split Screen</span>
                <span className="ln-studio-mode">Karaoke</span>
              </div>
            </div>
            <div className="ln-studio-mock">
              <div className="ln-sm-left">
                {['The Blueprint of Life', 'DNA Structure', 'Gene Expression', 'Protein Synthesis', 'Mutations'].map((t, i) => (
                  <div key={i} className={`ln-sm-seg ${i===0 ? 'ln-sm-seg-on' : ''}`}>
                    <div className="ln-sm-n">{i+1}</div>
                    <div className="ln-sm-t">{t}</div>
                  </div>
                ))}
              </div>
              <div className="ln-sm-center">
                <div className="ln-sm-phone">
                  <img className="ln-sm-phone-gif" src={gifUrl(ALL_GIFS[24])} alt="" loading="lazy" />
                  <div className="ln-sm-phone-overlay">
                    <div className="ln-sm-phone-title">DNA: The Blueprint</div>
                    <div className="ln-sm-phone-sub">Part 1 of 5</div>
                  </div>
                </div>
              </div>
              <div className="ln-sm-right">
                <div className="ln-sm-section">Voice</div>
                <div className="ln-sm-row"><span className="ln-sm-chip ln-sm-chip-on">ElevenLabs</span><span className="ln-sm-chip">OpenAI</span></div>
                <div className="ln-sm-section">Style</div>
                <div className="ln-sm-row"><span className="ln-sm-chip">Natural</span><span className="ln-sm-chip ln-sm-chip-on">Dramatic</span><span className="ln-sm-chip">Calm</span></div>
                <div className="ln-sm-section">Music</div>
                <div className="ln-sm-row"><span className="ln-sm-chip ln-sm-chip-on">AI Generate</span><span className="ln-sm-chip">Library</span></div>
                <div className="ln-sm-btn" />
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: Two cards */}
        <div className="ln-feat-row ln-feat-row-2">
          <div className="ln-card">
            <h3>Deep Research</h3>
            <p>Firecrawl web scraping + AI synthesis. Accurate, sourced scripts generated automatically from the web.</p>
            <div className="ln-card-viz">
              <div className="ln-viz-research">
                {['Scraping arxiv.org...', 'Found 12 sources', 'Synthesizing scripts...', 'Generated 6 segments'].map((t, i) => (
                  <div key={i} className="ln-viz-step" style={{animationDelay: `${i*0.5}s`}}>
                    <div className={`ln-viz-step-dot ${i===3 ? 'ln-viz-step-done' : ''}`} />
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="ln-card">
            <h3>Media Library</h3>
            <p>Upload your own background videos. Audio stripped automatically. Canva-style shared library across all projects.</p>
            <div className="ln-card-viz">
              <div className="ln-viz-upload">
                <div className="ln-viz-upload-zone">Drop video or click to upload</div>
                <div className="ln-viz-upload-files">
                  {['sunset_timelapse.mp4', 'ocean_waves.mp4', 'city_night.mp4'].map(f => (
                    <div key={f} className="ln-viz-upload-file">
                      <div className="ln-viz-upload-thumb" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

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
