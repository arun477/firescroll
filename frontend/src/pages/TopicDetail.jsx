import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Play, Shuffle, Flame, AlertCircle, Clock, CheckCircle2,
  Film, Mic, Type, Layers, Monitor, SplitSquareHorizontal,
  BookOpen, Video, Music, Volume2, ChevronDown, Loader2,
  Eye, Sparkles, X, Square, Search, Waveform,
  Image, Palette, ChevronRight, RotateCcw, Zap,
} from 'lucide-react'
import ResearchPanel from '../components/ResearchPanel'

/* ─── constants ─── */
const STATUS_MAP = {
  done:    { cls: 'st-done',    icon: CheckCircle2, label: 'Done' },
  failed:  { cls: 'st-failed',  icon: AlertCircle,  label: 'Failed' },
  pending: { cls: 'st-pending', icon: Clock,         label: 'Queued' },
}
const MODE_META = {
  full:  { icon: Layers,                label: 'AI Backgrounds',  desc: 'AI-generated cinematic backgrounds' },
  video: { icon: Monitor,               label: 'Video BG',        desc: 'Full-screen stock video background' },
  split: { icon: SplitSquareHorizontal, label: 'Split Screen',    desc: 'Video top + AI background bottom' },
}
const CAPTION_META = {
  default: { icon: Type, label: 'Standard',  desc: 'Clean text overlay captions' },
  karaoke: { icon: Mic,  label: 'Karaoke',   desc: 'Word-by-word highlight sync' },
}

function si(status) {
  return STATUS_MAP[status] || { cls: 'st-running', icon: Film, label: status }
}
function fmtTrack(f) { return f.replace('.mp3', '').replace(/_/g, ' ') }
function isActive(s) { return !['done', 'failed', 'pending'].includes(s) }

export default function TopicDetail() {
  const { topicId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [data, setData] = useState(null)

  const tab = searchParams.get('tab') || 'research'
  const setTab = t => setSearchParams({ tab: t })

  /* ─── data loading ─── */
  const load = useCallback(() => {
    fetch(`/api/topics/${topicId}`).then(r => r.json()).then(d => {
      setData(d)
      if (!searchParams.get('tab')) {
        const segs = d.segments || []
        if (segs.length > 0 && segs.every(s => s.status === 'ready'))
          setSearchParams({ tab: 'generate' })
      }
    })
  }, [topicId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!data) return
    const running = data.jobs?.some(j => isActive(j.status))
    const researching = data.research?.some(r => !['done','failed'].includes(r.status))
    if (running || researching) {
      const iv = setInterval(load, 2500)
      return () => clearInterval(iv)
    }
  }, [data, topicId, load])

  if (!data) return <div className="empty-state"><Loader2 size={24} className="spin" /></div>

  const { topic, jobs, segments, research, sources, source_stats, fc_jobs } = data
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
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/?topic=${topicId}`)}>
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
          segments={segments || []} jobs={jobs || []} onRefresh={load} />
      )}
    </div>
  )
}


/* ══════════════════════════════════════════════════════════════
   VIDEO STUDIO — the two-panel editor
   ══════════════════════════════════════════════════════════════ */

function VideoStudio({ topicId, topic, segments, jobs, onRefresh }) {
  /* ─── editor state ─── */
  const [selectedSegId, setSelectedSegId] = useState(null)
  const [voiceProviders, setVoiceProviders] = useState([])
  const [voices, setVoices] = useState([])
  const [voicesLoading, setVoicesLoading] = useState(false)
  const [musicTracks, setMusicTracks] = useState([])
  const [voiceSearch, setVoiceSearch] = useState('')

  // Global defaults
  const [provider, setProvider] = useState('')
  const [voiceId, setVoiceId] = useState('')
  const [music, setMusic] = useState('')

  // Per-segment settings
  const [segSettings, setSegSettings] = useState({})

  const readySegs = segments.filter(s => s.status === 'ready')
  const selectedSeg = readySegs.find(s => s.id === selectedSegId) || readySegs[0] || null

  // Jobs indexed by segment
  const jobMap = {}
  for (const j of jobs) {
    if (!jobMap[j.segment_id]) jobMap[j.segment_id] = []
    jobMap[j.segment_id].push(j)
  }

  /* ─── fetch voice providers + music ─── */
  useEffect(() => {
    fetch('/api/voice-providers').then(r => r.json()).then(d => {
      const p = d.providers || []
      setVoiceProviders(p)
      const def = p.find(x => x.default) || p[0]
      if (def) setProvider(def.id)
    })
    fetch('/api/music').then(r => r.json()).then(d => setMusicTracks(d.tracks || []))
  }, [])

  /* ─── fetch voices on provider change ─── */
  useEffect(() => {
    if (!provider) return
    setVoicesLoading(true)
    setVoices([])
    setVoiceId('')
    fetch(`/api/voices/${provider}`).then(r => r.json()).then(d => {
      setVoices(d.voices || [])
      setVoicesLoading(false)
    }).catch(() => setVoicesLoading(false))
  }, [provider])

  /* ─── auto-select first ready seg ─── */
  useEffect(() => {
    if (!selectedSegId && readySegs.length) setSelectedSegId(readySegs[0].id)
  }, [readySegs.length])

  /* ─── helpers ─── */
  const getSetting = (segId, key) => segSettings[segId]?.[key]
  const setSetting = (segId, key, val) =>
    setSegSettings(p => ({ ...p, [segId]: { ...(p[segId] || {}), [key]: val } }))

  const handleGenerate = async (seg) => {
    const s = segSettings[seg.id] || {}
    await fetch(`/api/topics/${topicId}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: s.mode || 'full',
        caption: s.caption || 'default',
        voice_provider: s.voice_provider || provider || null,
        voice_id: s.voice_id || voiceId || null,
        music_track: s.music_track || music || null,
        segment_ids: [seg.segment_num],
      }),
    })
    onRefresh()
  }

  const handleGenerateAll = async () => {
    await fetch(`/api/topics/${topicId}/generate-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voice_provider: provider || null,
        voice_id: voiceId || null,
        music_track: music || null,
      }),
    })
    onRefresh()
  }

  const handleCancel = async (jobId) => {
    await fetch(`/api/jobs/${jobId}/cancel`, { method: 'POST' })
    onRefresh()
  }

  const filteredVoices = voices.filter(v =>
    !voiceSearch || v.name.toLowerCase().includes(voiceSearch.toLowerCase())
  )

  if (!readySegs.length) {
    return (
      <div className="empty-state">
        <Sparkles size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
        <h2>No segments ready</h2>
        <p>Research your segments first, then come back to generate.</p>
      </div>
    )
  }

  return (
    <div className="ve">
      {/* ══════════ LEFT: Segment List ══════════ */}
      <div className="ve-left">
        <div className="ve-left-header">
          <span className="ve-left-title">Segments</span>
          <button className="btn btn-primary btn-sm" onClick={handleGenerateAll}>
            <Sparkles size={13} /> Generate All
          </button>
        </div>

        <div className="ve-seg-list">
          {readySegs.map(seg => {
            const segJobs = jobMap[seg.segment_num] || []
            const latest = segJobs[segJobs.length - 1]
            const active = latest && isActive(latest.status)
            const done = segJobs.find(j => j.status === 'done')
            const selected = seg.id === (selectedSeg?.id)

            return (
              <div
                key={seg.id}
                className={`ve-seg-item ${selected ? 've-seg-selected' : ''} ${active ? 've-seg-active' : ''}`}
                onClick={() => setSelectedSegId(seg.id)}
              >
                <div className="ve-seg-num">{seg.segment_num}</div>
                <div className="ve-seg-info">
                  <div className="ve-seg-title">{seg.title}</div>
                  <div className="ve-seg-hook">{seg.hook}</div>
                </div>
                <div className="ve-seg-status">
                  {active && (
                    <div className="ve-seg-progress-ring">
                      <Loader2 size={16} className="spin" />
                      <span>{latest.progress}%</span>
                    </div>
                  )}
                  {!active && done && <CheckCircle2 size={16} className="ve-icon-done" />}
                  {!active && !done && <ChevronRight size={14} className="ve-icon-chevron" />}
                </div>
              </div>
            )
          })}
        </div>

        {/* Active jobs summary */}
        {jobs.filter(j => isActive(j.status)).length > 0 && (
          <div className="ve-active-jobs">
            <div className="ve-active-jobs-title">
              <Loader2 size={12} className="spin" /> Active Jobs
            </div>
            {jobs.filter(j => isActive(j.status)).map(j => (
              <div key={j.id} className="ve-active-job">
                <div className="ve-aj-info">
                  <span className="ve-aj-seg">Seg {j.segment_id}</span>
                  <span className="ve-aj-status">{j.status}</span>
                </div>
                <div className="ve-aj-bar">
                  <div className="ve-aj-fill" style={{ width: `${j.progress}%` }} />
                </div>
                <button className="ve-aj-cancel" onClick={() => handleCancel(j.id)} title="Cancel">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══════════ RIGHT: Control Panel ══════════ */}
      {selectedSeg && (
        <div className="ve-right">
          <SegmentEditor
            key={selectedSeg.id}
            seg={selectedSeg}
            segJobs={jobMap[selectedSeg.segment_num] || []}
            settings={segSettings[selectedSeg.id] || {}}
            setSetting={(k, v) => setSetting(selectedSeg.id, k, v)}
            globalProvider={provider}
            globalVoiceId={voiceId}
            globalMusic={music}
            voiceProviders={voiceProviders}
            voices={filteredVoices}
            voicesLoading={voicesLoading}
            voiceSearch={voiceSearch}
            setVoiceSearch={setVoiceSearch}
            musicTracks={musicTracks}
            provider={provider}
            setProvider={setProvider}
            voiceId={voiceId}
            setVoiceId={setVoiceId}
            music={music}
            setMusic={setMusic}
            onGenerate={() => handleGenerate(selectedSeg)}
            onCancel={handleCancel}
            onRefresh={onRefresh}
          />
        </div>
      )}
    </div>
  )
}


/* ══════════════════════════════════════════════════════════════
   SEGMENT EDITOR — right panel
   ══════════════════════════════════════════════════════════════ */

function SegmentEditor({
  seg, segJobs, settings, setSetting,
  voiceProviders, voices, voicesLoading, voiceSearch, setVoiceSearch,
  musicTracks, provider, setProvider, voiceId, setVoiceId,
  music, setMusic, onGenerate, onCancel,
}) {
  const [expandedSection, setExpandedSection] = useState('voice')
  const mode = settings.mode || 'full'
  const caption = settings.caption || 'default'
  const localProvider = settings.voice_provider || provider
  const localVoice = settings.voice_id || voiceId
  const localMusic = settings.music_track || music

  const activeJob = segJobs.find(j => isActive(j.status))
  const doneJob = segJobs.find(j => j.status === 'done' && j.video_url)
  const failedJob = segJobs.find(j => j.status === 'failed')

  const toggleSection = (s) => setExpandedSection(expandedSection === s ? null : s)

  return (
    <div className="ve-editor">
      {/* ── Segment header ── */}
      <div className="ve-editor-header">
        <div className="ve-editor-seg-num">{seg.segment_num}</div>
        <div>
          <div className="ve-editor-title">{seg.title}</div>
          <div className="ve-editor-hook">{seg.hook}</div>
        </div>
      </div>

      {/* ── Script preview ── */}
      <div className="ve-section ve-script-section">
        <div className="ve-script-text">{seg.script}</div>
        {seg.visual_cue && (
          <div className="ve-visual-cue"><Eye size={11} /> {seg.visual_cue}</div>
        )}
      </div>

      {/* ── Video preview if done ── */}
      {doneJob && (
        <div className="ve-preview-section">
          <video className="ve-preview-video" src={doneJob.video_url}
            controls preload="metadata" />
        </div>
      )}

      {/* ── Active job status ── */}
      {activeJob && (
        <div className="ve-job-active-card">
          <div className="ve-jac-header">
            <div className="ve-jac-info">
              <Loader2 size={14} className="spin" />
              <span>{activeJob.status}</span>
              <span className="ve-jac-pct">{activeJob.progress}%</span>
            </div>
            <button className="ve-jac-cancel" onClick={() => onCancel(activeJob.id)}>
              <Square size={12} /> Stop
            </button>
          </div>
          <div className="ve-jac-bar">
            <div className="ve-jac-fill" style={{ width: `${activeJob.progress}%` }} />
          </div>
        </div>
      )}

      {failedJob && !activeJob && (
        <div className="ve-error-card">
          <AlertCircle size={13} />
          <span>{failedJob.error}</span>
        </div>
      )}

      {/* ─────── VOICE SECTION ─────── */}
      <div className="ve-panel-section">
        <button className="ve-panel-toggle" onClick={() => toggleSection('voice')}>
          <Volume2 size={14} />
          <span>Voice</span>
          <span className="ve-panel-value">
            {voices.find(v => v.id === localVoice)?.name || 'Default'}
          </span>
          <ChevronDown size={14} className={`ve-panel-chevron ${expandedSection === 'voice' ? 've-chevron-open' : ''}`} />
        </button>

        {expandedSection === 'voice' && (
          <div className="ve-panel-body">
            {/* Provider toggle */}
            <div className="ve-toggle-row">
              {voiceProviders.map(p => (
                <button
                  key={p.id}
                  className={`ve-toggle-btn ${localProvider === p.id ? 've-toggle-active' : ''}`}
                  onClick={() => {
                    setSetting('voice_provider', p.id)
                    setProvider(p.id)
                  }}
                >
                  {p.id === 'elevenlabs' && <Zap size={12} />}
                  {p.name}
                  {p.default && <span className="ve-badge-default">default</span>}
                </button>
              ))}
            </div>

            {/* Voice search */}
            <div className="ve-search-wrap">
              <Search size={13} className="ve-search-icon" />
              <input
                className="ve-search-input"
                placeholder={`Search ${voices.length} voices...`}
                value={voiceSearch}
                onChange={e => setVoiceSearch(e.target.value)}
              />
              {voiceSearch && (
                <button className="ve-search-clear" onClick={() => setVoiceSearch('')}>
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Voice grid */}
            <div className="ve-voice-grid">
              {voicesLoading ? (
                <div className="ve-voice-loading"><Loader2 size={16} className="spin" /> Loading voices...</div>
              ) : (
                <>
                  <button
                    className={`ve-voice-card ${!localVoice ? 've-voice-selected' : ''}`}
                    onClick={() => { setSetting('voice_id', ''); setVoiceId('') }}
                  >
                    <div className="ve-vc-name">Default</div>
                    <div className="ve-vc-desc">Provider default voice</div>
                  </button>
                  {voices.filter(v => !voiceSearch || v.name.toLowerCase().includes(voiceSearch.toLowerCase())).map(v => (
                    <button
                      key={v.id}
                      className={`ve-voice-card ${localVoice === v.id ? 've-voice-selected' : ''}`}
                      onClick={() => { setSetting('voice_id', v.id); setVoiceId(v.id) }}
                    >
                      <div className="ve-vc-name">{v.name}</div>
                      <div className="ve-vc-id">{v.id.substring(0, 12)}</div>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─────── VISUAL MODE SECTION ─────── */}
      <div className="ve-panel-section">
        <button className="ve-panel-toggle" onClick={() => toggleSection('mode')}>
          <Palette size={14} />
          <span>Visual Mode</span>
          <span className="ve-panel-value">{MODE_META[mode].label}</span>
          <ChevronDown size={14} className={`ve-panel-chevron ${expandedSection === 'mode' ? 've-chevron-open' : ''}`} />
        </button>

        {expandedSection === 'mode' && (
          <div className="ve-panel-body">
            <div className="ve-mode-grid">
              {Object.entries(MODE_META).map(([k, m]) => {
                const Icon = m.icon
                return (
                  <button
                    key={k}
                    className={`ve-mode-card ${mode === k ? 've-mode-active' : ''}`}
                    onClick={() => setSetting('mode', k)}
                  >
                    <Icon size={20} />
                    <div className="ve-mc-label">{m.label}</div>
                    <div className="ve-mc-desc">{m.desc}</div>
                  </button>
                )
              })}
            </div>

            <div className="ve-caption-row">
              <span className="ve-caption-label">Caption Style</span>
              <div className="ve-toggle-row">
                {Object.entries(CAPTION_META).map(([k, c]) => {
                  const Icon = c.icon
                  return (
                    <button
                      key={k}
                      className={`ve-toggle-btn ${caption === k ? 've-toggle-active' : ''}`}
                      onClick={() => setSetting('caption', k)}
                    >
                      <Icon size={12} /> {c.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─────── MUSIC SECTION ─────── */}
      <div className="ve-panel-section">
        <button className="ve-panel-toggle" onClick={() => toggleSection('music')}>
          <Music size={14} />
          <span>Music</span>
          <span className="ve-panel-value">{localMusic ? fmtTrack(localMusic) : 'Random'}</span>
          <ChevronDown size={14} className={`ve-panel-chevron ${expandedSection === 'music' ? 've-chevron-open' : ''}`} />
        </button>

        {expandedSection === 'music' && (
          <div className="ve-panel-body">
            <div className="ve-music-list">
              <button
                className={`ve-music-item ${!localMusic ? 've-music-active' : ''}`}
                onClick={() => { setSetting('music_track', ''); setMusic('') }}
              >
                <Shuffle size={13} />
                <span>Random</span>
              </button>
              {musicTracks.map(t => (
                <button
                  key={t}
                  className={`ve-music-item ${localMusic === t ? 've-music-active' : ''}`}
                  onClick={() => { setSetting('music_track', t); setMusic(t) }}
                >
                  <Music size={13} />
                  <span>{fmtTrack(t)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─────── GENERATE BUTTON ─────── */}
      <div className="ve-generate-section">
        <button
          className="ve-generate-btn"
          onClick={onGenerate}
          disabled={!!activeJob}
        >
          {activeJob
            ? <><Loader2 size={16} className="spin" /> Generating...</>
            : <><Play size={16} /> Generate Segment {seg.segment_num}</>}
        </button>
        <div className="ve-gen-summary">
          {MODE_META[mode].label} · {CAPTION_META[caption].label} · {voices.find(v => v.id === localVoice)?.name || 'Default voice'}
        </div>
      </div>

      {/* ─────── PAST JOBS ─────── */}
      {segJobs.length > 0 && (
        <div className="ve-history-section">
          <div className="ve-history-title">History</div>
          {[...segJobs].reverse().map(j => {
            const s = si(j.status)
            const Icon = s.icon
            return (
              <div key={j.id} className={`ve-history-item ${s.cls}`}>
                <div className="ve-hi-left">
                  {isActive(j.status) ? <Loader2 size={12} className="spin" /> : <Icon size={12} />}
                  <span className="ve-hi-status">{s.label}</span>
                  <span className="ve-hi-mode">{j.mode}/{j.caption}</span>
                </div>
                <div className="ve-hi-right">
                  {j.duration_seconds && <span>{Math.round(j.duration_seconds)}s</span>}
                  {isActive(j.status) && (
                    <button className="ve-hi-cancel" onClick={() => onCancel(j.id)}>
                      <X size={11} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
