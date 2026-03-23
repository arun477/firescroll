import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

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
          <div className="ln-showcase-cols">
            {[0, 1, 2, 3, 4, 5, 6].map(col => (
              <div key={col} className={`ln-showcase-col ln-showcase-col-${col % 2 === 0 ? 'up' : 'down'}`}>
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="ln-phone">
                    <div className="ln-phone-screen" style={{
                      background: `linear-gradient(${140 + col * 20 + i * 18}deg, ${
                        ['rgba(239,68,68,0.25)','rgba(139,92,246,0.25)','rgba(59,130,246,0.25)','rgba(249,115,22,0.25)','rgba(34,197,94,0.2)','rgba(236,72,153,0.2)','rgba(14,165,233,0.2)'][col]
                      }, ${
                        ['rgba(249,115,22,0.1)','rgba(59,130,246,0.1)','rgba(139,92,246,0.1)','rgba(239,68,68,0.1)','rgba(139,92,246,0.08)','rgba(249,115,22,0.08)','rgba(34,197,94,0.08)'][col]
                      })`,
                    }}>
                      <div className="ln-phone-title" style={{width: `${45+Math.random()*35}%`}} />
                      <div className="ln-phone-subtitle" style={{width: `${55+Math.random()*35}%`}} />
                      <div className="ln-phone-wave">
                        {[...Array(10)].map((_,j) => (
                          <div key={j} className="ln-phone-bar" style={{
                            height: `${15+Math.random()*65}%`,
                            animationDelay: `${j*0.12 + col*0.2}s`,
                          }} />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
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
