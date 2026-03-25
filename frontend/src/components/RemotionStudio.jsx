import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Play, Loader2, Square, Zap, Sparkles, Globe, Volume2,
  Search, X, ChevronDown, ChevronRight, Film, Eye, Code,
  Wand2, CheckCircle2, AlertCircle,
} from 'lucide-react'

function isActive(s) { return !['done', 'failed'].includes(s) }

const STATUS_META = {
  pending:   { label: 'Queued',            icon: Loader2, color: '#a1a1aa', spin: false },
  audio:     { label: 'Generating Audio',  icon: Volume2, color: '#3b82f6', spin: false },
  composing: { label: 'AI Composing',      icon: Wand2,   color: '#a855f7', spin: false },
  rendering: { label: 'Rendering',         icon: Film,    color: '#f59e0b', spin: false },
  encoding:  { label: 'Encoding',          icon: Zap,     color: '#22c55e', spin: false },
  done:      { label: 'Complete',          icon: CheckCircle2, color: '#22c55e', spin: false },
  failed:    { label: 'Failed',            icon: AlertCircle,  color: '#ef4444', spin: false },
}

function Section({ icon: Icon, title, value, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rs-sec">
      <button className="rs-sec-head" onClick={() => setOpen(!open)}>
        <Icon size={13} style={{ opacity: 0.5 }} />
        <span className="rs-sec-title">{title}</span>
        {value && <span className="rs-sec-value">{value}</span>}
        <ChevronDown size={12} style={{ opacity: 0.3, transform: open ? 'rotate(180deg)' : '', transition: '0.15s' }} />
      </button>
      {open && <div className="rs-sec-body">{children}</div>}
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

  // Poll jobs
  useEffect(() => {
    const load = () => {
      fetch(`/api/topics/${topicId}/remotion/jobs`).then(r => r.json()).then(d => setJobs(d.jobs || []))
    }
    load()
    const running = jobs.some(j => isActive(j.status))
    const iv = setInterval(load, running ? 2500 : 8000)
    return () => clearInterval(iv)
  }, [topicId, jobs.some?.(j => isActive(j?.status))])

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
    <div className="rs">
      {/* ══════ LEFT: AI Agent Panel ══════ */}
      {selectedSeg && (
        <div className="rs-left">
          <div className="rs-head">
            <Wand2 size={14} />
            <span className="rs-head-label">AI Motion Studio</span>
          </div>

          <div className="rs-scroll">
            <Section icon={Sparkles} title="Creative Direction" defaultOpen
              value={prompt ? prompt.slice(0, 20) + '...' : 'Describe your vision'}>
              <textarea className="rs-prompt" rows={4} value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="e.g. 'Dramatic opening with a big stat, then break down the science with animated cards, end with a powerful CTA'" />
            </Section>

            <Section icon={Film} title="Style" value={style ? styles.find(s => s.id === style)?.name || style : 'Cinematic'}>
              <div className="rs-style-grid">
                {styles.map(s => (
                  <button key={s.id} className={`rs-style ${style === s.id ? 'rs-style-on' : ''}`}
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

            <div className="rs-actions">
              <button className="rs-btn rs-btn-preview" onClick={handlePreview}
                disabled={previewLoading || !selectedSeg}>
                {previewLoading
                  ? <><Loader2 size={14} className="spin" /> Composing...</>
                  : <><Eye size={14} /> Preview Scenes</>}
              </button>
              <button className="rs-btn rs-btn-generate" onClick={handleGenerate}
                disabled={generating || !!activeJob || !selectedSeg}>
                {activeJob
                  ? <><Loader2 size={14} className="spin" /> {STATUS_META[activeJob.status]?.label || activeJob.status}</>
                  : generating
                    ? <><Loader2 size={14} className="spin" /> Starting...</>
                    : <><Zap size={14} /> Generate Motion Video</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ CENTER: Preview + Content ══════ */}
      <div className="rs-center">
        <div className="rs-center-inner">
          {/* Segment header */}
          {selectedSeg && (
            <div className="rs-seg-header">
              <div className="rs-seg-header-num">{selectedSeg.segment_num}</div>
              <div>
                <div className="rs-seg-header-title">{selectedSeg.title}</div>
                <div className="rs-seg-header-hook">{selectedSeg.hook}</div>
              </div>
            </div>
          )}

          {/* Active job progress */}
          {activeJob && (
            <div className="rs-progress-card">
              <div className="rs-progress-orbs">
                <div className="rs-orb rs-orb-1" />
                <div className="rs-orb rs-orb-2" />
              </div>
              <div className="rs-progress-inner">
                <div className="rs-progress-pct">{activeJob.status === 'pending' ? '...' : `${activeJob.progress}%`}</div>
                <div className="rs-progress-status">{STATUS_META[activeJob.status]?.label || activeJob.status}</div>
                <div className="rs-progress-bar">
                  <div className="rs-progress-fill" style={{ width: `${activeJob.progress}%` }} />
                </div>
                <button className="rs-progress-cancel" onClick={() => handleCancel(activeJob.id)}>
                  <Square size={12} /> Cancel
                </button>
              </div>
            </div>
          )}

          {/* Done — video player */}
          {!activeJob && doneJob && (
            <div className="rs-video-card">
              <video key={doneJob.id} className="rs-video" src={doneJob.video_url} controls preload="metadata" />
            </div>
          )}

          {/* Failed job error */}
          {failedJob && (
            <div className="rs-error-card">
              <AlertCircle size={14} />
              <span>{failedJob.error?.slice(0, 120) || 'Generation failed'}</span>
            </div>
          )}

          {/* Empty state */}
          {!activeJob && !doneJob && selectedSeg && (
            <div className="rs-empty-state">
              <div className="rs-empty-icon">
                <Wand2 size={48} strokeWidth={1} />
              </div>
              <div className="rs-empty-title">AI Motion Studio</div>
              <div className="rs-empty-desc">
                Describe your creative vision, pick a style, and let AI compose
                cinema-quality animated scenes from your research content.
              </div>
              <button className="rs-btn rs-btn-generate" style={{ maxWidth: 240 }}
                onClick={handleGenerate} disabled={generating}>
                <Zap size={14} /> Generate Motion Video
              </button>
            </div>
          )}

          {/* Scene config preview */}
          {previewConfig && !activeJob && (
            <div className="rs-scenes-card">
              <div className="rs-scenes-head">
                <Wand2 size={12} /> AI Scene Composition
                <button className="rs-scenes-close" onClick={() => setPreviewConfig(null)}><X size={12} /></button>
              </div>
              <div className="rs-scenes-timeline">
                {previewConfig.scenes?.map((s, i) => (
                  <div key={i} className="rs-scene-item">
                    <div className="rs-scene-dot" />
                    <div className="rs-scene-info">
                      <div className="rs-scene-name">{s.template.replace(/_/g, ' ')}</div>
                      <div className="rs-scene-time">
                        {Math.round(s.from / 30)}s – {Math.round((s.from + s.durationInFrames) / 30)}s
                      </div>
                    </div>
                    <div className="rs-scene-dur">{Math.round(s.durationInFrames / 30)}s</div>
                  </div>
                ))}
              </div>
              <details className="rs-scenes-raw">
                <summary>View JSON</summary>
                <pre>{JSON.stringify(previewConfig, null, 2)}</pre>
              </details>
            </div>
          )}
        </div>
      </div>

      {/* ══════ RIGHT: Segments ══════ */}
      <div className="rs-right">
        <div className="rs-right-head">
          <span>Segments</span>
          <span className="rs-right-count">{readySegs.length}</span>
        </div>
        {readySegs.length > 8 && (
          <div className="ve-search" style={{ margin: '0 10px 8px' }}>
            <Search size={12} className="ve-search-i" />
            <input className="ve-search-in" placeholder="Search segments..."
              value={segSearch} onChange={e => setSegSearch(e.target.value)} />
          </div>
        )}
        <div className="rs-seg-list">
          {filteredSegs.map(seg => {
            const sj = jobs.filter(j => j.segment_id === seg.segment_num)
            const done = sj.find(j => j.status === 'done')
            const act = sj.find(j => isActive(j.status))
            const sel = seg.id === selectedSeg?.id
            return (
              <div key={seg.id}
                className={`rs-seg ${sel ? 'rs-seg-sel' : ''} ${act ? 'rs-seg-act' : ''}`}
                onClick={() => { setSelectedSegId(seg.id); setPreviewConfig(null) }}>
                <div className="rs-seg-n">{seg.segment_num}</div>
                <div className="rs-seg-info">
                  <div className="rs-seg-t">{seg.title}</div>
                  <div className="rs-seg-h">{seg.hook?.slice(0, 60)}</div>
                </div>
                {done && <CheckCircle2 size={12} className="rs-seg-check" />}
                {act && <Loader2 size={12} className="spin" style={{ color: '#a855f7', flexShrink: 0 }} />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
