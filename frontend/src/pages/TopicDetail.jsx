import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Play, Shuffle, Flame, AlertCircle, Clock, CheckCircle2,
  Film, Mic, Type, Layers, Monitor, SplitSquareHorizontal,
  BookOpen, Video, Music, Volume2, ChevronDown, Loader2,
  Eye, Sparkles, X, Square, Search, Palette, ChevronRight, Zap, Download,
} from 'lucide-react'
import ResearchPanel from '../components/ResearchPanel'

const MODE_META = {
  full:  { icon: Layers,                label: 'AI Backgrounds',  desc: 'AI-generated cinematic backgrounds' },
  video: { icon: Monitor,               label: 'Video BG',        desc: 'Fullscreen stock video' },
  split: { icon: SplitSquareHorizontal, label: 'Split Screen',    desc: 'Video top + AI bottom' },
}
const CAPTION_META = {
  default: { icon: Type, label: 'Standard' },
  karaoke: { icon: Mic,  label: 'Karaoke' },
}

function isActive(s) { return !['done', 'failed', 'pending'].includes(s) }
function fmtTrack(f) { return f.replace('.mp3', '').replace(/_/g, ' ') }
function fmtError(err) {
  if (!err) return 'Unknown error'
  if (err.includes('payment_required') || err.includes('paid_plan'))
    return 'ElevenLabs paid plan required for this feature'
  if (err.includes('rate_limit') || err.includes('429'))
    return 'Rate limit reached — try again in a moment'
  if (err.includes('api_key') || err.includes('unauthorized') || err.includes('401'))
    return 'API key invalid or expired — check Settings'
  if (err.includes('Cancelled'))
    return 'Cancelled by user'
  if (err.includes('FFmpeg'))
    return 'Video encoding failed — check FFmpeg installation'
  if (err.length > 120) return err.substring(0, 120) + '...'
  return err
}

export default function TopicDetail() {
  const { topicId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [data, setData] = useState(null)

  const tab = searchParams.get('tab') || 'research'
  const setTab = t => setSearchParams({ tab: t })

  const load = useCallback(() => {
    fetch(`/api/topics/${topicId}`).then(r => r.json()).then(d => {
      setData(d)
    })
  }, [topicId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!data) return
    const running = data.jobs?.some(j => isActive(j.status))
    const researching = data.research?.some(r => !['done','failed'].includes(r.status))
    const segBusy = data.segments?.some(s => s.status === 'researching')
    const fcBusy = data.fc_jobs?.some(j => j.status === 'running')
    const topicBusy = data.topic?.research_status === 'generating'
    if (running || researching || segBusy || fcBusy || topicBusy) {
      const iv = setInterval(load, 2500)
      return () => clearInterval(iv)
    }
  }, [data, topicId, load])

  if (!data) return <div className="empty-state"><Loader2 size={24} className="spin" /></div>
  const { topic, jobs, segments, research, sources, source_stats, fc_jobs, segment_configs } = data
  const doneJobs = jobs?.filter(j => j.status === 'done').length || 0
  const readyCount = segments?.filter(s => s.status === 'ready').length || 0

  return (
    <div className="topic-detail">
      <div className="td-compact-header">
        <div className="td-title-row">
          <h1 className="td-title">{topic.title}</h1>
          <span className="td-subtitle">
            {topic.series_title && <>{topic.series_title} · </>}
            {topic.total_segments} seg
            {readyCount > 0 && <> · {readyCount} ready</>}
            {doneJobs > 0 && <> · {doneJobs} videos</>}
          </span>
        </div>
        <div className="td-header-actions">
          <div className="td-tabs-inline">
            <button className={`td-tab ${tab === 'research' ? 'active' : ''}`}
              onClick={() => setTab('research')}>
              <BookOpen size={14} /> Research
              {readyCount > 0 && <span className="td-tab-badge">{readyCount}/{segments?.length || 0}</span>}
            </button>
            <button className={`td-tab ${tab === 'generate' ? 'active' : ''}`}
              onClick={() => setTab('generate')}>
              <Video size={14} /> Studio
              {doneJobs > 0 && <span className="td-tab-badge">{doneJobs}</span>}
            </button>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/feed?topic=${topicId}`)}>
            <Flame size={14} /> Feed
          </button>
        </div>
      </div>

      {tab === 'research' && (
        <ResearchPanel topicId={topicId} topic={topic}
          segments={segments || []} research={research || []}
          sources={sources || []} sourceStats={source_stats || {}}
          fcJobs={fc_jobs || []} onRefresh={load} />
      )}
      {tab === 'generate' && (
        <VideoStudio topicId={topicId} topic={topic}
          segments={segments || []} jobs={jobs || []} onRefresh={load}
          searchParams={searchParams} setSearchParams={setSearchParams}
          initialConfigs={segment_configs || {}} />
      )}
    </div>
  )
}


/* ══════════════════════════════════════════════════════════════
   VIDEO STUDIO — Three-panel editor
   Left: collapsible segments | Center: preview | Right: controls
   ══════════════════════════════════════════════════════════════ */

function VideoStudio({ topicId, topic, segments, jobs, onRefresh, searchParams, setSearchParams, initialConfigs }) {
  const selectedSegId = searchParams.get('seg') || null
  const setSelectedSegId = (id) => {
    const p = Object.fromEntries(searchParams.entries())
    if (id) p.seg = id; else delete p.seg
    setSearchParams(p)
  }
  const [voiceProviders, setVoiceProviders] = useState([])
  const [voices, setVoices] = useState([])
  const [voicesLoading, setVoicesLoading] = useState(false)
  const [voicePresets, setVoicePresets] = useState({})
  const [musicTracks, setMusicTracks] = useState([])
  const [voiceSearch, setVoiceSearch] = useState('')
  const [previewingVoice, setPreviewingVoice] = useState(null)
  const [mediaLibrary, setMediaLibrary] = useState([])
  const [uploading, setUploading] = useState(false)
  const [mediaDrawerOpen, setMediaDrawerOpen] = useState(false)
  const uploadPollRef = useRef(null)

  // Cleanup upload poll on unmount
  useEffect(() => () => { clearInterval(uploadPollRef.current) }, [])
  const previewAudioRef = useRef(null)
  const [provider, setProvider] = useState('')
  const [voiceId, setVoiceId] = useState('')
  const [music, setMusic] = useState('')
  const [segSettings, setSegSettings] = useState(initialConfigs || {})

  const readySegs = segments.filter(s => s.status === 'ready')
  const selectedSeg = readySegs.find(s => s.id === selectedSegId) || readySegs[0] || null

  const jobMap = {}
  for (const j of jobs) {
    if (!jobMap[j.segment_id]) jobMap[j.segment_id] = []
    jobMap[j.segment_id].push(j)
  }

  useEffect(() => {
    fetch('/api/voice-providers').then(r => r.json()).then(d => {
      const p = d.providers || []
      setVoiceProviders(p)
      if (!provider) {
        const eleven = p.find(x => x.id === 'elevenlabs')
        const def = eleven || p.find(x => x.default) || p[0]
        if (def) setProvider(def.id)
      }
    })
    fetch('/api/music').then(r => r.json()).then(d => setMusicTracks(d.tracks || []))
    fetch('/api/voice-presets').then(r => r.json()).then(d => setVoicePresets(d.presets || {}))
    fetch('/api/media').then(r => r.json()).then(d => setMediaLibrary(d.media || []))
  }, [])

  useEffect(() => {
    if (!provider) return
    setVoicesLoading(true); setVoices([]); setVoiceId('')
    fetch(`/api/voices/${provider}`).then(r => r.json()).then(d => {
      setVoices(d.voices || []); setVoicesLoading(false)
    }).catch(() => setVoicesLoading(false))
  }, [provider])

  useEffect(() => {
    if (!selectedSegId && readySegs.length) setSelectedSegId(readySegs[0].id)
  }, [readySegs.length])

  const saveTimers = useRef({})
  const setSetting = (segId, key, val) => {
    setSegSettings(p => {
      const updated = { ...p, [segId]: { ...(p[segId] || {}), [key]: val } }
      // Debounced persist to backend (500ms)
      clearTimeout(saveTimers.current[segId])
      saveTimers.current[segId] = setTimeout(() => {
        fetch(`/api/topics/${topicId}/segments/${segId}/config`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: updated[segId] }),
        }).catch(() => {})
      }, 500)
      return updated
    })
  }

  const handleGenerate = async (seg) => {
    const s = segSettings[seg.id] || {}
    await fetch(`/api/topics/${topicId}/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: s.mode || 'full', caption: s.caption || 'default',
        voice_provider: s.voice_provider || provider || null,
        voice_id: s.voice_id || voiceId || null,
        music_track: s.music_track || music || null,
        music_source: s.music_source || null,
        music_prompt: s.music_prompt || null,
        voice_style: s.voice_style || null,
        voice_settings: s.voice_settings || null,
        intro_sfx_prompt: s.intro_sfx_prompt || null,
        bg_video_id: s.bg_video_id || null,
        segment_ids: [seg.segment_num],
      }),
    })
    onRefresh()
  }

  const handleGenerateAll = async () => {
    await fetch(`/api/topics/${topicId}/generate-all`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voice_provider: provider || null, voice_id: voiceId || null,
        music_track: music || null,
      }),
    })
    onRefresh()
  }

  const handleUploadVideo = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/media/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (data.error) {
        alert(data.error)
        setUploading(false)
        e.target.value = ''
        return
      }
      // Poll until processed (max 60 attempts = 2 min)
      let attempts = 0
      uploadPollRef.current = setInterval(async () => {
        attempts++
        if (attempts > 60) {
          clearInterval(uploadPollRef.current)
          setUploading(false)
          return
        }
        const status = await fetch(`/api/media/${data.id}/status`).then(r => r.json())
        if (status.status !== 'processing') {
          clearInterval(uploadPollRef.current)
          setUploading(false)
          const list = await fetch('/api/media').then(r => r.json())
          setMediaLibrary(list.media || [])
        }
      }, 2000)
    } catch {
      setUploading(false)
    }
    e.target.value = ''
  }

  const handleDeleteMedia = async (mediaId) => {
    await fetch(`/api/media/${mediaId}`, { method: 'DELETE' })
    setMediaLibrary(prev => prev.filter(m => m.id !== mediaId))
  }

  const handlePreviewVoice = async (voiceIdToPreview) => {
    // Stop any playing preview
    if (previewAudioRef.current) {
      previewAudioRef.current.pause()
      previewAudioRef.current = null
    }
    if (previewingVoice === voiceIdToPreview) {
      setPreviewingVoice(null)
      return
    }
    setPreviewingVoice(voiceIdToPreview)
    try {
      const res = await fetch('/api/voice-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voice_id: voiceIdToPreview,
          provider: provider || 'elevenlabs',
          voice_style: segSettings[selectedSeg?.id]?.voice_style || null,
        }),
      })
      if (!res.ok) { setPreviewingVoice(null); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      previewAudioRef.current = audio
      audio.onended = () => { setPreviewingVoice(null); URL.revokeObjectURL(url) }
      audio.play()
    } catch {
      setPreviewingVoice(null)
    }
  }

  const handleCancel = async (jobId) => {
    await fetch(`/api/jobs/${jobId}/cancel`, { method: 'POST' })
    onRefresh()
  }

  if (!readySegs.length) {
    return (
      <div className="empty-state">
        <Sparkles size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
        <h2>No segments ready</h2>
        <p>Research your segments first, then come back to generate.</p>
      </div>
    )
  }

  const segJobs = selectedSeg ? (jobMap[selectedSeg.segment_num] || []) : []
  const activeJob = segJobs.find(j => isActive(j.status))
  const doneJob = [...segJobs].reverse().find(j => j.status === 'done' && j.video_url)
  const settings = selectedSeg ? (segSettings[selectedSeg.id] || {}) : {}
  const mode = settings.mode || 'full'
  const caption = settings.caption || 'default'
  const localVoice = settings.voice_id || voiceId
  const localMusic = settings.music_track || music

  return (
    <div className="ve">

      {/* ══════ LEFT: Controls ══════ */}
      {selectedSeg && (
        <div className="ve-left">
          <div className="ve-left-head">
            <svg width="14" height="14" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
              <rect x="8" y="2" width="5" height="28" rx="2.5" fill="currentColor"/>
              <rect x="19" y="2" width="5" height="28" rx="2.5" fill="currentColor"/>
            </svg>
            <span className="ve-left-label" style={{ textTransform: 'none', letterSpacing: '-0.1px', fontSize: 12, fontWeight: 700, color: '#a1a1aa', flex: 1 }}>
              ElevenLabs Studio
            </span>
          </div>

          <div className="ve-left-scroll">
          {/* ── Voice ── */}
          <Section icon={Volume2} title="Voice" defaultOpen
            value={voices.find(v => v.id === localVoice)?.name || 'Default'}>
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
                <button className={`ve-vc ${!localVoice ? 've-vc-on' : ''}`}
                  onClick={() => setSetting(selectedSeg.id, 'voice_id', '')}>
                  <span className="ve-vc-name">Default</span>
                </button>
                {voices.filter(v => !voiceSearch || v.name.toLowerCase().includes(voiceSearch.toLowerCase())).map(v => (
                  <div key={v.id} className={`ve-vc ${localVoice === v.id ? 've-vc-on' : ''}`}
                    onClick={() => setSetting(selectedSeg.id, 'voice_id', v.id)}>
                    <span className="ve-vc-name">{v.name}</span>
                    <button className={`ve-vc-preview ${previewingVoice === v.id ? 've-vc-previewing' : ''}`}
                      onClick={e => { e.stopPropagation(); handlePreviewVoice(v.id) }}
                      title="Preview voice">
                      {previewingVoice === v.id ? <Square size={9} /> : <Play size={9} />}
                    </button>
                  </div>
                ))}
              </>)}
            </div>

            {/* Voice Style Presets (ElevenLabs only) */}
            {(settings.voice_provider || provider) === 'elevenlabs' && Object.keys(voicePresets).length > 0 && (
              <div className="ve-presets">
                <div className="ve-presets-label">Style</div>
                <div className="ve-presets-row">
                  <button
                    className={`ve-preset ${!settings.voice_style ? 've-preset-on' : ''}`}
                    onClick={() => { setSetting(selectedSeg.id, 'voice_style', ''); setSetting(selectedSeg.id, 'voice_settings', null) }}>
                    None
                  </button>
                  {Object.keys(voicePresets).map(name => (
                    <button key={name}
                      className={`ve-preset ${settings.voice_style === name ? 've-preset-on' : ''}`}
                      onClick={() => { setSetting(selectedSeg.id, 'voice_style', name); setSetting(selectedSeg.id, 'voice_settings', null) }}>
                      {name}
                    </button>
                  ))}
                  <button
                    className={`ve-preset ${settings.voice_style === 'custom' ? 've-preset-on' : ''}`}
                    onClick={() => setSetting(selectedSeg.id, 'voice_style', 'custom')}>
                    Custom
                  </button>
                </div>

                {/* Custom sliders */}
                {settings.voice_style === 'custom' && (
                  <div className="ve-sliders">
                    {[
                      { key: 'stability', label: 'Stability', min: 0, max: 1, step: 0.05, def: 0.5 },
                      { key: 'similarity_boost', label: 'Clarity', min: 0, max: 1, step: 0.05, def: 0.75 },
                      { key: 'style', label: 'Style', min: 0, max: 1, step: 0.05, def: 0 },
                      { key: 'speed', label: 'Speed', min: 0.7, max: 1.3, step: 0.05, def: 1.0 },
                    ].map(s => {
                      const vs = settings.voice_settings || {}
                      const val = vs[s.key] ?? s.def
                      return (
                        <div key={s.key} className="ve-slider-row">
                          <label className="ve-slider-label">{s.label}</label>
                          <input type="range" className="ve-slider"
                            min={s.min} max={s.max} step={s.step} value={val}
                            onChange={e => {
                              const newVs = { ...(settings.voice_settings || {}), [s.key]: parseFloat(e.target.value) }
                              setSetting(selectedSeg.id, 'voice_settings', newVs)
                            }} />
                          <span className="ve-slider-val">{val.toFixed(2)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Show preset values */}
                {settings.voice_style && settings.voice_style !== 'custom' && voicePresets[settings.voice_style] && (
                  <div className="ve-preset-info">
                    {Object.entries(voicePresets[settings.voice_style]).map(([k, v]) => (
                      <span key={k}>{k.replace('similarity_boost', 'clarity').replace('_', ' ')}: {v}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* ── Visual Mode ── */}
          <Section icon={Palette} title="Visual Mode" value={MODE_META[mode].label}>
            <div className="ve-modes">
              {Object.entries(MODE_META).map(([k, m]) => {
                const I = m.icon
                return (
                  <button key={k} className={`ve-mode ${mode === k ? 've-mode-on' : ''}`}
                    onClick={() => setSetting(selectedSeg.id, 'mode', k)}>
                    <I size={18} />
                    <span className="ve-mode-l">{m.label}</span>
                    <span className="ve-mode-d">{m.desc}</span>
                  </button>
                )
              })}
            </div>
            <div className="ve-cap-row">
              <span className="ve-cap-label">Captions</span>
              <div className="ve-toggles">
                {Object.entries(CAPTION_META).map(([k, c]) => {
                  const I = c.icon
                  return (
                    <button key={k} className={`ve-tog ${caption === k ? 've-tog-on' : ''}`}
                      onClick={() => setSetting(selectedSeg.id, 'caption', k)}>
                      <I size={11} /> {c.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Background video (for video/split modes) */}
            {(mode === 'video' || mode === 'split') && (
              <div className="ve-bg-pick">
                <span className="ve-bg-pick-label">Background</span>
                <button className="ve-bg-pick-btn"
                  onClick={() => setMediaDrawerOpen(true)}>
                  {settings.bg_video_id
                    ? <><Film size={11} /> {mediaLibrary.find(m => m.id === settings.bg_video_id)?.original_name || 'Custom video'}</>
                    : <><Shuffle size={11} /> Random stock</>}
                  <ChevronRight size={12} />
                </button>
              </div>
            )}
          </Section>

          {/* ── Music ── */}
          <Section icon={Music} title="Music"
            value={settings.music_source === 'elevenlabs' ? 'AI Generated' : localMusic ? fmtTrack(localMusic) : 'Random'}>

            {/* Music source tabs */}
            <div className="ve-toggles" style={{ marginBottom: 10 }}>
              <button className={`ve-tog ${(settings.music_source || '') !== 'elevenlabs' ? 've-tog-on' : ''}`}
                onClick={() => setSetting(selectedSeg.id, 'music_source', '')}>
                Library
              </button>
              <button className={`ve-tog ${settings.music_source === 'elevenlabs' ? 've-tog-on' : ''}`}
                onClick={() => setSetting(selectedSeg.id, 'music_source', 'elevenlabs')}>
                <svg width="11" height="11" viewBox="0 0 32 32" fill="none"><rect x="8" y="2" width="5" height="28" rx="2.5" fill="currentColor"/><rect x="19" y="2" width="5" height="28" rx="2.5" fill="currentColor"/></svg>
                ElevenLabs
              </button>
            </div>

            {(settings.music_source || '') !== 'elevenlabs' ? (
              <div className="ve-music">
                <button className={`ve-mu ${!localMusic ? 've-mu-on' : ''}`}
                  onClick={() => setSetting(selectedSeg.id, 'music_track', '')}>
                  <Shuffle size={12} /> Random
                </button>
                {musicTracks.map(t => (
                  <button key={t} className={`ve-mu ${localMusic === t ? 've-mu-on' : ''}`}
                    onClick={() => setSetting(selectedSeg.id, 'music_track', t)}>
                    <Music size={12} /> {fmtTrack(t)}
                  </button>
                ))}
              </div>
            ) : (
              <div className="ve-ai-music">
                <textarea
                  className="ve-ai-music-input"
                  placeholder={`e.g. Calm ambient instrumental for educational video about ${topic?.title || 'science'}...`}
                  value={settings.music_prompt || ''}
                  onChange={e => setSetting(selectedSeg.id, 'music_prompt', e.target.value)}
                  rows={3}
                />
                <div className="ve-ai-music-hint">
                  Leave empty for auto-generated prompt based on topic
                </div>
              </div>
            )}
          </Section>

          {/* ── Intro Sound Effect ── */}
          {(settings.voice_provider || provider) === 'elevenlabs' && (
            <Section icon={Sparkles} title="Intro SFX"
              value={settings.intro_sfx_prompt ? 'On' : 'Off'}>
              <div className="ve-sfx">
                <textarea
                  className="ve-ai-music-input"
                  placeholder="e.g. Dramatic whoosh with bass hit, cinematic reveal..."
                  value={settings.intro_sfx_prompt || ''}
                  onChange={e => setSetting(selectedSeg.id, 'intro_sfx_prompt', e.target.value)}
                  rows={2}
                />
                <div className="ve-ai-music-hint">
                  3-second sound effect prepended before the voice. Leave empty to skip.
                </div>
                {settings.intro_sfx_prompt && (
                  <SfxPreviewButton prompt={settings.intro_sfx_prompt} />
                )}
              </div>
            </Section>
          )}
          </div>

          {/* ── Generate ── */}
          <div className="ve-gen">
            <button className="ve-gen-btn"
              onClick={() => handleGenerate(selectedSeg)} disabled={!!activeJob}>
              {activeJob
                ? <><Loader2 size={15} className="spin" /> Generating...</>
                : <><Play size={15} /> Generate Segment {selectedSeg.segment_num}</>}
            </button>
            <div className="ve-gen-meta">
              {MODE_META[mode].label} · {CAPTION_META[caption].label} · {voices.find(v => v.id === localVoice)?.name || 'Default'}
            </div>
            {!activeJob && segJobs.find(j => j.status === 'failed') && (
              <div className="ve-gen-error">
                <AlertCircle size={11} />
                {fmtError(segJobs.find(j => j.status === 'failed').error)}
              </div>
            )}
          </div>

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
                    <div className="ve-c-render-ring">
                      <svg viewBox="0 0 120 120" className="ve-c-render-svg">
                        <defs>
                          <linearGradient id="veRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#a78bfa" />
                          </linearGradient>
                        </defs>
                        <circle cx="60" cy="60" r="52" className="ve-c-ring-track" />
                        <circle cx="60" cy="60" r="52" className="ve-c-ring-fill"
                          style={{ strokeDashoffset: 327 - (327 * (activeJob.progress || 0) / 100) }} />
                      </svg>
                      <div className="ve-c-render-pct">{activeJob.progress}%</div>
                    </div>
                    <div className="ve-c-render-status">{activeJob.status}</div>
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
                  <a className="ve-c-download" href={doneJob.video_url}
                    download={`segment_${selectedSeg.segment_num}.mp4`} title="Download video">
                    <Download size={16} />
                  </a>
                </div>
              )}
              {!activeJob && !doneJob && (
                <div className="ve-c-empty">
                  <div className="ve-c-empty-bg">
                    <div className="ve-c-empty-orb ve-c-empty-orb1" />
                    <div className="ve-c-empty-orb ve-c-empty-orb2" />
                    <div className="ve-c-empty-orb ve-c-empty-orb3" />
                  </div>
                  <div className="ve-c-empty-icon">
                    <Film size={32} />
                  </div>
                  <div className="ve-c-empty-text">
                    <h3>Ready to create</h3>
                    <p>Generate a short-form video with AI backgrounds, voice, and music</p>
                  </div>
                  <button className="ve-c-empty-btn"
                    onClick={() => handleGenerate(selectedSeg)} disabled={!!activeJob}>
                    <Play size={14} /> Generate Segment {selectedSeg.segment_num}
                  </button>
                  <div className="ve-c-empty-meta">
                    {MODE_META[mode].label} · {CAPTION_META[caption].label} · {voices.find(v => v.id === localVoice)?.name || 'Default'}
                  </div>
                </div>
              )}
            </div>

            <div className="ve-c-script">
              <div className="ve-c-script-text">{selectedSeg.script}</div>
              {selectedSeg.visual_cue && <div className="ve-c-cue">{selectedSeg.visual_cue}</div>}
            </div>

          </>
        )}
      </div>

      {/* ══════ RIGHT: Segments + History ══════ */}
      <div className="ve-right">
        <div className="ve-left-head">
          <span className="ve-left-label">Segments</span>
          <div className="ve-left-head-actions">
            <button className="btn btn-primary btn-xs" onClick={handleGenerateAll}>
              <Sparkles size={11} /> All
            </button>
          </div>
        </div>
        <div className="ve-seg-list">
          {readySegs.map(seg => {
            const sj = jobMap[seg.segment_num] || []
            const latest = sj[sj.length - 1]
            const act = latest && isActive(latest.status)
            const done = sj.find(j => j.status === 'done')
            const sel = seg.id === selectedSeg?.id
            return (
              <div key={seg.id}
                className={`ve-seg ${sel ? 've-seg-sel' : ''} ${act ? 've-seg-act' : ''}`}
                onClick={() => setSelectedSegId(seg.id)}>
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

      {/* ══════ MEDIA LIBRARY DRAWER ══════ */}
      {mediaDrawerOpen && (
        <>
          <div className="ml-overlay" onClick={() => setMediaDrawerOpen(false)} />
          <div className="ml-drawer">
            <div className="ml-head">
              <h3 className="ml-title">Media Library</h3>
              <button className="ml-close" onClick={() => setMediaDrawerOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="ml-upload-zone">
              <label className="ml-upload-label">
                {uploading
                  ? <><Loader2 size={18} className="spin" /><span>Processing upload...</span></>
                  : <><Download size={18} style={{ transform: 'rotate(180deg)' }} /><span>Drop video or click to upload</span><span className="ml-upload-hint">MP4, MOV, AVI, MKV, WebM — max 500MB</span></>}
                <input type="file" accept="video/*" onChange={handleUploadVideo}
                  style={{ display: 'none' }} disabled={uploading} />
              </label>
            </div>

            <div className="ml-items">
              {/* Random stock option */}
              <div className={`ml-item ${!settings.bg_video_id ? 'ml-item-on' : ''}`}
                onClick={() => { setSetting(selectedSeg.id, 'bg_video_id', ''); setMediaDrawerOpen(false) }}>
                <div className="ml-item-thumb ml-item-thumb-stock">
                  <Shuffle size={20} />
                </div>
                <div className="ml-item-info">
                  <div className="ml-item-name">Random Stock Video</div>
                  <div className="ml-item-meta">From built-in library</div>
                </div>
              </div>

              {mediaLibrary.map(m => (
                <MediaItem key={m.id} media={m}
                  selected={settings.bg_video_id === m.id}
                  onSelect={() => {
                    if (m.status === 'ready') {
                      setSetting(selectedSeg.id, 'bg_video_id', m.id)
                      setMediaDrawerOpen(false)
                    }
                  }}
                  onDelete={() => handleDeleteMedia(m.id)}
                />
              ))}

              {mediaLibrary.length === 0 && (
                <div className="ml-empty">
                  No uploaded videos yet. Upload your first video above.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}


/* ── Reusable accordion section ── */
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

function SfxPreviewButton({ prompt }) {
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef(null)

  const handlePreview = async () => {
    if (playing && audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
      setPlaying(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/sfx/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, duration_seconds: 3 }),
      })
      if (!res.ok) { setLoading(false); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => { setPlaying(false); URL.revokeObjectURL(url) }
      audio.play()
      setPlaying(true)
    } catch { /* ignore */ }
    setLoading(false)
  }

  return (
    <button className="ve-sfx-preview" onClick={handlePreview} disabled={loading}>
      {loading ? <><Loader2 size={11} className="spin" /> Generating...</>
        : playing ? <><Square size={11} /> Stop</>
        : <><Play size={11} /> Preview SFX</>}
    </button>
  )
}

function MediaItem({ media: m, selected, onSelect, onDelete }) {
  const [playing, setPlaying] = useState(false)
  const videoRef = useRef(null)

  const handlePlay = (e) => {
    e.stopPropagation()
    if (playing) {
      videoRef.current?.pause()
      setPlaying(false)
    } else {
      videoRef.current?.play().catch(() => {})
      setPlaying(true)
    }
  }

  return (
    <div
      className={`ml-item ${selected ? 'ml-item-on' : ''} ${m.status !== 'ready' ? 'ml-item-disabled' : ''}`}
      onClick={onSelect}
    >
      <div className="ml-item-thumb">
        {m.status === 'processing'
          ? <Loader2 size={18} className="spin" />
          : m.status === 'failed'
            ? <AlertCircle size={18} />
            : m.video_url
              ? <>
                  <video ref={videoRef} src={m.video_url} muted loop
                    poster={m.thumb_url || ''} preload="none"
                    className="ml-item-video"
                    onEnded={() => setPlaying(false)} />
                  <button className="ml-item-play" onClick={handlePlay}>
                    {playing ? <Square size={10} /> : <Play size={10} />}
                  </button>
                </>
              : <Film size={18} />}
      </div>
      <div className="ml-item-info">
        <div className="ml-item-name">{m.original_name || m.filename}</div>
        <div className="ml-item-meta">
          {m.status === 'processing' && 'Processing...'}
          {m.status === 'failed' && 'Failed to process'}
          {m.status === 'ready' && <>
            {m.duration_seconds > 0 && `${Math.round(m.duration_seconds)}s`}
            {m.width > 0 && ` · ${m.width}×${m.height}`}
            {m.file_size > 0 && ` · ${(m.file_size / (1024*1024)).toFixed(1)}MB`}
          </>}
        </div>
      </div>
      <button className="ml-item-del" onClick={e => { e.stopPropagation(); onDelete() }}>
        <X size={12} />
      </button>
    </div>
  )
}
