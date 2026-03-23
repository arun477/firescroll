import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Play, Shuffle, Flame, AlertCircle, Clock, CheckCircle2,
  Film, Mic, Type, Layers, Monitor, SplitSquareHorizontal,
  BookOpen, Video, Music, Volume2, ChevronDown, Loader2,
  Eye, Sparkles, X, Square, Search, Palette, ChevronRight, Zap,
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
   VIDEO STUDIO — Three-panel editor
   Left: collapsible segments | Center: preview | Right: controls
   ══════════════════════════════════════════════════════════════ */

function VideoStudio({ topicId, topic, segments, jobs, onRefresh }) {
  const [selectedSegId, setSelectedSegId] = useState(null)
  const [voiceProviders, setVoiceProviders] = useState([])
  const [voices, setVoices] = useState([])
  const [voicesLoading, setVoicesLoading] = useState(false)
  const [musicTracks, setMusicTracks] = useState([])
  const [voiceSearch, setVoiceSearch] = useState('')
  const [provider, setProvider] = useState('')
  const [voiceId, setVoiceId] = useState('')
  const [music, setMusic] = useState('')
  const [segSettings, setSegSettings] = useState({})

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
      const def = p.find(x => x.default) || p[0]
      if (def) setProvider(def.id)
    })
    fetch('/api/music').then(r => r.json()).then(d => setMusicTracks(d.tracks || []))
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

  const setSetting = (segId, key, val) =>
    setSegSettings(p => ({ ...p, [segId]: { ...(p[segId] || {}), [key]: val } }))

  const handleGenerate = async (seg) => {
    const s = segSettings[seg.id] || {}
    await fetch(`/api/topics/${topicId}/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: s.mode || 'full', caption: s.caption || 'default',
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
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voice_provider: provider || null, voice_id: voiceId || null,
        music_track: music || null,
      }),
    })
    onRefresh()
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

      {/* ══════ LEFT: Segment Bin ══════ */}
      <div className="ve-left">
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

      {/* ══════ CENTER: Preview ══════ */}
      <div className="ve-center">
        {selectedSeg && (
          <>
            {/* Header */}
            <div className="ve-c-head">
              <div className="ve-c-head-num">{selectedSeg.segment_num}</div>
              <div className="ve-c-head-info">
                <div className="ve-c-head-title">{selectedSeg.title}</div>
                <div className="ve-c-head-hook">{selectedSeg.hook}</div>
              </div>
            </div>

            {/* Preview area */}
            <div className="ve-c-preview">
              {activeJob && (
                <div className="ve-c-rendering">
                  <div className="ve-c-render-inner">
                    <Loader2 size={32} className="spin" />
                    <div className="ve-c-render-status">{activeJob.status}</div>
                    <div className="ve-c-render-pct">{activeJob.progress}%</div>
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
                <video
                  key={doneJob.id}
                  className="ve-c-video"
                  src={doneJob.video_url}
                  controls
                  preload="metadata"
                />
              )}

              {!activeJob && !doneJob && (
                <div className="ve-c-empty">
                  <Film size={40} />
                  <p>No video yet</p>
                  <button className="btn btn-primary btn-sm"
                    onClick={() => handleGenerate(selectedSeg)}>
                    <Play size={14} /> Generate
                  </button>
                </div>
              )}
            </div>

            {/* Script */}
            <div className="ve-c-script">
              <div className="ve-c-script-text">{selectedSeg.script}</div>
              {selectedSeg.visual_cue && (
                <div className="ve-c-cue">{selectedSeg.visual_cue}</div>
              )}
            </div>

            {/* Failed error */}
            {!activeJob && segJobs.find(j => j.status === 'failed') && (
              <div className="ve-c-error">
                <AlertCircle size={12} />
                {segJobs.find(j => j.status === 'failed').error}
              </div>
            )}
          </>
        )}
      </div>

      {/* ══════ RIGHT: Sticky Controls ══════ */}
      {selectedSeg && (
        <div className="ve-right">

          {/* ── Voice ── */}
          <Section icon={Volume2} title="Voice"
            value={voices.find(v => v.id === localVoice)?.name || 'Default'}>
            <div className="ve-toggles">
              {voiceProviders.map(p => (
                <button key={p.id}
                  className={`ve-tog ${(settings.voice_provider || provider) === p.id ? 've-tog-on' : ''}`}
                  onClick={() => { setSetting(selectedSeg.id, 'voice_provider', p.id); setProvider(p.id) }}>
                  {p.id === 'elevenlabs' && <Zap size={11} />}
                  {p.name}
                  {p.default && <span className="ve-tag">default</span>}
                </button>
              ))}
            </div>
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
                  onClick={() => { setSetting(selectedSeg.id, 'voice_id', '') }}>
                  <span className="ve-vc-name">Default</span>
                </button>
                {voices.filter(v => !voiceSearch || v.name.toLowerCase().includes(voiceSearch.toLowerCase())).map(v => (
                  <button key={v.id} className={`ve-vc ${localVoice === v.id ? 've-vc-on' : ''}`}
                    onClick={() => { setSetting(selectedSeg.id, 'voice_id', v.id) }}>
                    <span className="ve-vc-name">{v.name}</span>
                  </button>
                ))}
              </>)}
            </div>
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
          </Section>

          {/* ── Music ── */}
          <Section icon={Music} title="Music"
            value={localMusic ? fmtTrack(localMusic) : 'Random'}>
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
          </Section>

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
          </div>

          {/* ── History (completed only) ── */}
          {segJobs.filter(j => j.status === 'done' || j.status === 'failed').length > 0 && (
            <div className="ve-hist">
              <div className="ve-hist-title">History</div>
              {[...segJobs].filter(j => j.status === 'done' || j.status === 'failed').reverse().map(j => (
                <div key={j.id} className={`ve-hist-row ${j.status === 'done' ? 'c-green' : 'c-red'}`}>
                  <div className="ve-hist-l">
                    {j.status === 'done' ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                    <span>{j.mode}/{j.caption}</span>
                  </div>
                  <div className="ve-hist-r">
                    {j.duration_seconds && <span>{Math.round(j.duration_seconds)}s</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}


/* ── Reusable accordion section ── */
function Section({ icon: Icon, title, value, children }) {
  const [open, setOpen] = useState(false)
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
