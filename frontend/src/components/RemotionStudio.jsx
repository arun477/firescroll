import { useEffect, useState } from 'react'
import {
  Play, Loader2, Square, Sparkles, Globe, Volume2,
  Search, X, ChevronDown, ChevronRight, Film, Eye,
  CheckCircle2, AlertCircle,
} from 'lucide-react'

function isActive(s) { return !['done', 'failed'].includes(s) }

const STATUS_META = {
  pending:   { label: 'Queued' },
  audio:     { label: 'Generating Audio' },
  composing: { label: 'AI Composing Scenes' },
  rendering: { label: 'Rendering Video' },
  encoding:  { label: 'Merging Audio' },
  done:      { label: 'Complete' },
  failed:    { label: 'Failed' },
}

/* Reuse same Section pattern as Studio (ve-sec classes) */
function Section({ icon: Icon, title, value, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="ve-sec">
      <button className="ve-sec-head" onClick={() => setOpen(!open)}>
        <Icon size={13} />
        <span className="ve-sec-title">{title}</span>
        <span className="ve-sec-val">{value}</span>
        <ChevronDown size={13} className={`ve-sec-chev ${open ? 've-sec-chev-open' : ''}`} />
      </button>
      {open && <div className="ve-sec-body">{children}</div>}
    </div>
  )
}

export default function RemotionStudio({ topicId, topic, segments, onRefresh }) {
  const [styles, setStyles] = useState([])
  const [voices, setVoices] = useState([])
  const [languages, setLanguages] = useState([])
  const [jobs, setJobs] = useState([])
  const [voicesLoading, setVoicesLoading] = useState(false)

  const [selectedSegId, setSelectedSegId] = useState(null)
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('cinematic')
  const [voiceId, setVoiceId] = useState('')
  const [language, setLanguage] = useState(null)
  const [voiceSearch, setVoiceSearch] = useState('')
  const [langSearch, setLangSearch] = useState('')
  const [previewConfig, setPreviewConfig] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [segSearch, setSegSearch] = useState('')

  const readySegs = segments.filter(s => s.status === 'ready')
  const filteredSegs = segSearch
    ? readySegs.filter(s => s.title?.toLowerCase().includes(segSearch.toLowerCase()))
    : readySegs
  const selectedSeg = readySegs.find(s => s.id === selectedSegId) || readySegs[0] || null

  useEffect(() => {
    fetch('/api/remotion/styles').then(r => r.json()).then(d => setStyles(d.styles || []))
    setVoicesLoading(true)
    fetch('/api/voices/elevenlabs').then(r => r.json()).then(d => {
      setVoices(d.voices || []); setVoicesLoading(false)
    }).catch(() => setVoicesLoading(false))
    fetch('/api/languages').then(r => r.json()).then(d => setLanguages(d || []))
  }, [])

  useEffect(() => {
    if (!selectedSegId && readySegs.length) setSelectedSegId(readySegs[0].id)
  }, [readySegs.length])

  useEffect(() => {
    const load = () => {
      fetch(`/api/topics/${topicId}/remotion/jobs`).then(r => r.json()).then(d => setJobs(d.jobs || []))
    }
    load()
    const iv = setInterval(load, 3000)
    return () => clearInterval(iv)
  }, [topicId])

  const segJobs = selectedSeg ? jobs.filter(j => j.segment_id === selectedSeg.segment_num) : []
  const activeJob = segJobs.find(j => isActive(j.status))
  const doneJob = [...segJobs].reverse().find(j => j.status === 'done' && j.video_url)
  const failedJob = !activeJob && segJobs.find(j => j.status === 'failed')

  const handlePreview = async () => {
    if (!selectedSeg) return
    setPreviewLoading(true)
    try {
      const res = await fetch(`/api/topics/${topicId}/remotion/preview-config`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_prompt: prompt, style, segment_id: selectedSeg.id }),
      })
      const data = await res.json()
      setPreviewConfig(data.scene_config || null)
    } catch { setPreviewConfig(null) }
    setPreviewLoading(false)
  }

  const handleGenerate = async () => {
    if (!selectedSeg) return
    setGenerating(true)
    await fetch(`/api/topics/${topicId}/remotion/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_prompt: prompt, style,
        voice_id: voiceId || null,
        language: language || null,
        segment_ids: [selectedSeg.segment_num],
      }),
    })
    setGenerating(false)
    onRefresh()
  }

  const handleCancel = async (jobId) => {
    await fetch(`/api/remotion/jobs/${jobId}/cancel`, { method: 'POST' })
  }

  return (
    <div className="ve">
      {/* ══════ LEFT: AI Agent Panel ══════ */}
      {selectedSeg && (
        <div className="ve-left">
          <div className="ve-left-head">
            <svg width="14" height="14" viewBox="0 0 64 64" fill="none" style={{ flexShrink: 0 }}>
              <defs>
                <linearGradient id="ms-fg" x1="0%" y1="100%" x2="50%" y2="0%">
                  <stop offset="0%" stopColor="#ef4444"/>
                  <stop offset="50%" stopColor="#f97316"/>
                  <stop offset="100%" stopColor="#fbbf24"/>
                </linearGradient>
              </defs>
              <path d="M32 4C24 16,14 22,14 36c0,11,8,20,18,20s18-9,18-20c0-8-5-15-10-20c0,10-5,15-8,15s-5-5-2-15z" fill="url(#ms-fg)"/>
            </svg>
            <span className="ve-left-label" style={{ textTransform: 'none', letterSpacing: '-0.1px', fontSize: 12, fontWeight: 700, color: '#a1a1aa', flex: 1 }}>
              Motion Studio
            </span>
          </div>

          <div className="ve-left-scroll">

          <Section icon={Sparkles} title="Creative Direction" defaultOpen
            value={prompt ? prompt.slice(0, 20) + '...' : ''}>
            <textarea className="rs-prompt" rows={4} value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="e.g. 'Dramatic opening with a big stat, then animated cards breaking down the science, end with a powerful CTA'" />
          </Section>

          <Section icon={Film} title="Style" value={style ? styles.find(s => s.id === style)?.name || style : 'Cinematic'}>
            <div className="ve-presets-row" style={{ flexWrap: 'wrap' }}>
              {styles.map(s => (
                <button key={s.id} className={`ve-preset ${style === s.id ? 've-preset-on' : ''}`}
                  onClick={() => setStyle(s.id)} title={s.description}>
                  {s.name}
                </button>
              ))}
            </div>
          </Section>

          <Section icon={Volume2} title="Voice"
            value={voices.find(v => v.id === voiceId)?.name || 'Default'}>
            <div className="ve-search">
              <Search size={12} className="ve-search-i" />
              <input className="ve-search-in" placeholder={`Search ${voices.length} voices...`}
                value={voiceSearch} onChange={e => setVoiceSearch(e.target.value)} />
              {voiceSearch && <button className="ve-search-x" onClick={() => setVoiceSearch('')}><X size={10} /></button>}
            </div>
            <div className="ve-voices">
              {voicesLoading ? (
                <div className="ve-voices-load"><Loader2 size={14} className="spin" /> Loading...</div>
              ) : (<>
                <button className={`ve-vc ${!voiceId ? 've-vc-on' : ''}`}
                  onClick={() => setVoiceId('')}>
                  <span className="ve-vc-name">Default</span>
                </button>
                {voices.filter(v => !voiceSearch || v.name.toLowerCase().includes(voiceSearch.toLowerCase())).map(v => (
                  <button key={v.id} className={`ve-vc ${voiceId === v.id ? 've-vc-on' : ''}`}
                    onClick={() => setVoiceId(v.id)}>
                    <span className="ve-vc-name">{v.name}</span>
                  </button>
                ))}
              </>)}
            </div>
          </Section>

          {languages.length > 0 && (
            <Section icon={Globe} title="Language"
              value={language ? languages.find(l => l.code === language)?.name || language : 'English'}>
              <div className="ve-search">
                <Search size={12} className="ve-search-i" />
                <input className="ve-search-in" placeholder={`Search ${languages.length} languages...`}
                  value={langSearch} onChange={e => setLangSearch(e.target.value)} />
                {langSearch && <button className="ve-search-x" onClick={() => setLangSearch('')}><X size={10} /></button>}
              </div>
              <div className="ve-voices">
                <button className={`ve-vc ${!language ? 've-vc-on' : ''}`}
                  onClick={() => setLanguage(null)}>
                  <span className="ve-vc-name">English (Original)</span>
                </button>
                {languages.filter(l => l.code !== 'en')
                  .filter(l => !langSearch || l.name.toLowerCase().includes(langSearch.toLowerCase()))
                  .map(l => (
                  <button key={l.code} className={`ve-vc ${language === l.code ? 've-vc-on' : ''}`}
                    onClick={() => setLanguage(l.code)}>
                    <span className="ve-vc-name">{l.name}</span>
                  </button>
                ))}
              </div>
            </Section>
          )}

          {/* Generate — inside scroll area like Studio */}
          <div className="ve-gen">
            <button className="ve-gen-btn"
              onClick={handleGenerate} disabled={generating || !!activeJob || !selectedSeg}>
              {activeJob
                ? <><Loader2 size={15} className="spin" /> {STATUS_META[activeJob.status]?.label || activeJob.status}</>
                : generating
                  ? <><Loader2 size={15} className="spin" /> Starting...</>
                  : <><Play size={15} /> Generate Motion Video</>}
            </button>
            <div className="ve-gen-meta">
              {style} · {voices.find(v => v.id === voiceId)?.name || 'Default'}{language ? ` · ${languages.find(l => l.code === language)?.name || language}` : ''}
            </div>
          </div>
          </div>{/* close ve-left-scroll */}
        </div>
      )}

      {/* ══════ CENTER: Preview ══════ */}
      <div className="ve-center">
        {selectedSeg && (
          <>
            <div className="ve-c-head">
              <div className="ve-c-head-num">{selectedSeg.segment_num}</div>
              <div className="ve-c-head-info">
                <div className="ve-c-head-title">{selectedSeg.title}</div>
                <div className="ve-c-head-hook">{selectedSeg.hook}</div>
              </div>
            </div>

            <div className="ve-c-preview">
              {activeJob && (
                <div className="ve-c-rendering">
                  <div className="ve-c-render-bg">
                    <div className="ve-c-render-orb ve-c-render-orb1" />
                    <div className="ve-c-render-orb ve-c-render-orb2" />
                  </div>
                  <div className="ve-c-render-inner">
                    <div className="ve-c-render-pct">
                      {activeJob.status === 'pending' ? '...' : `${activeJob.progress}%`}
                    </div>
                    <div className="ve-c-render-status">{STATUS_META[activeJob.status]?.label || activeJob.status}</div>
                    <div className="ve-c-render-bar">
                      <div className="ve-c-render-fill" style={{ width: `${activeJob.progress}%` }} />
                    </div>
                    <button className="ve-c-render-cancel" onClick={() => handleCancel(activeJob.id)}>
                      <Square size={12} /> Cancel
                    </button>
                  </div>
                </div>
              )}

              {!activeJob && doneJob && (
                <div className="ve-c-video-wrap">
                  <video key={doneJob.id} className="ve-c-video" src={doneJob.video_url} controls preload="metadata" />
                </div>
              )}

              {!activeJob && !doneJob && (
                <div className="ve-c-empty">
                  <div className="ve-c-empty-bg">
                    <Film size={48} strokeWidth={1} />
                  </div>
                  <div className="ve-c-empty-title">Ready to create</div>
                  <div className="ve-c-empty-desc">
                    Describe your creative vision and let AI compose cinema-quality animated scenes.
                  </div>
                  <button className="ve-c-empty-btn"
                    onClick={handleGenerate} disabled={generating}>
                    <Play size={14} /> Generate Motion Video
                  </button>
                </div>
              )}

              {failedJob && (
                <div style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444', fontSize: 11, marginTop: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{failedJob.error?.slice(0, 150) || 'Generation failed'}</span>
                </div>
              )}
            </div>

            {/* Scene config preview */}
            {previewConfig && !activeJob && (
              <div style={{ margin: '16px 20px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid var(--border-subtle)' }}>
                  <Wand2 size={12} /> AI Scene Composition
                  <button style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setPreviewConfig(null)}><X size={12} /></button>
                </div>
                <div style={{ padding: '6px 8px' }}>
                  {previewConfig.scenes?.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8 }}>
                      <div style={{ width: 8, height: 8, minWidth: 8, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px var(--accent-glow)' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{s.template.replace(/_/g, ' ')}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{Math.round(s.from / 30)}s – {Math.round((s.from + s.durationInFrames) / 30)}s</div>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 4 }}>
                        {Math.round(s.durationInFrames / 30)}s
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Script text below */}
            <div className="ve-c-script">
              <div className="ve-c-script-text">{selectedSeg.script}</div>
              <div className="ve-c-script-cue">{selectedSeg.visual_cue}</div>
            </div>
          </>
        )}
      </div>

      {/* ══════ RIGHT: Segments (exact same structure as Studio) ══════ */}
      <div className="ve-right">
        <div className="ve-left-head">
          <span className="ve-left-label">Segments</span>
          <div className="ve-left-head-actions">
            <span className="ve-seg-count">{readySegs.length}</span>
          </div>
        </div>
        <div className="ve-seg-search-wrap">
          <Search size={13} className="ve-seg-search-icon" />
          <input className="ve-seg-search" placeholder="Search segments..."
            value={segSearch} onChange={e => setSegSearch(e.target.value)} />
        </div>
        <div className="ve-seg-list">
          {filteredSegs.map(seg => {
            const sj = jobs.filter(j => j.segment_id === seg.segment_num)
            const latest = sj[sj.length - 1]
            const done = sj.find(j => j.status === 'done')
            const act = latest && isActive(latest?.status)
            const sel = seg.id === selectedSeg?.id
            return (
              <div key={seg.id}
                className={`ve-seg ${sel ? 've-seg-sel' : ''} ${act ? 've-seg-act' : ''}`}
                onClick={() => { setSelectedSegId(seg.id); setPreviewConfig(null) }}>
                <div className="ve-seg-n">{seg.segment_num}</div>
                <div className="ve-seg-info">
                  <div className="ve-seg-t">{seg.title}</div>
                  <div className="ve-seg-h">{seg.hook}</div>
                </div>
                <div className="ve-seg-st">
                  {act && <><Loader2 size={13} className="spin" /><span className="ve-seg-pct">{latest.progress}%</span></>}
                  {!act && done && <CheckCircle2 size={14} className="c-green" />}
                  {!act && !done && <ChevronRight size={13} className="c-muted" />}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
