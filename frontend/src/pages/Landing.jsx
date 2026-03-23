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
        <p className="ln-eyebrow">AI Video Creation Platform</p>
        <h1 className="ln-h1">
          Topic in.<br />
          <span className="ln-fire">Videos out.</span>
        </h1>
        <p className="ln-p">
          FireScroll researches any subject, writes scripts, and renders
          cinematic short-form videos with ElevenLabs voices and AI-generated music.
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

      {/* Bento grid */}
      <section className="ln-bento">
        <div className="ln-bento-item ln-bento-wide">
          <div className="ln-bento-label">Video Studio</div>
          <p>Three-panel editor. Choose voice, visuals, music per segment. Upload custom backgrounds. AI or stock. Full creative control.</p>
          <div className="ln-bento-art ln-bento-art-studio">
            <div className="ln-art-panels">
              <div className="ln-art-p ln-art-p1">
                {[1,2,3,4,5].map(i=><div key={i} className="ln-art-seg"><div className="ln-art-dot"/><div className="ln-art-lines"><div/><div/></div></div>)}
              </div>
              <div className="ln-art-p ln-art-p2">
                <div className="ln-art-screen" />
              </div>
              <div className="ln-art-p ln-art-p3">
                <div className="ln-art-ctrl"/><div className="ln-art-ctrl"/><div className="ln-art-ctrl"/>
                <div className="ln-art-btn" />
              </div>
            </div>
          </div>
        </div>

        <div className="ln-bento-item">
          <div className="ln-bento-label">ElevenLabs Voices</div>
          <p>50+ ultra-realistic voices. Style presets: dramatic, calm, energetic. Fine-tune stability and speed.</p>
          <div className="ln-bento-art">
            <div className="ln-art-wave">
              {[...Array(32)].map((_,i)=><div key={i} className="ln-wave-bar" style={{animationDelay:`${i*0.06}s`}}/>)}
            </div>
          </div>
        </div>

        <div className="ln-bento-item">
          <div className="ln-bento-label">AI Music</div>
          <p>Generate custom instrumentals with ElevenLabs. Or pick from 20+ built-in ambient tracks.</p>
          <div className="ln-bento-art">
            <div className="ln-art-music">
              {[...Array(16)].map((_,i)=><div key={i} className="ln-music-dot" style={{animationDelay:`${i*0.15}s`}}/>)}
            </div>
          </div>
        </div>

        <div className="ln-bento-item">
          <div className="ln-bento-label">Deep Research</div>
          <p>Firecrawl web scraping + AI synthesis. Accurate, sourced scripts generated automatically.</p>
        </div>

        <div className="ln-bento-item">
          <div className="ln-bento-label">Media Library</div>
          <p>Upload your own videos. Audio stripped automatically. Canva-style library shared across all projects.</p>
        </div>

        <div className="ln-bento-item">
          <div className="ln-bento-label">Sound Effects</div>
          <p>AI-generated intro sounds. Describe what you want — cinematic whoosh, bass hit, ambient pad.</p>
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
