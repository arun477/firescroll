import { useEffect, useState } from 'react'
import {
  Loader2, Square, Search, ChevronRight, Film,
  CheckCircle2, AlertCircle,
} from 'lucide-react'
import ChatPanel from './ChatPanel'

function isActive(s) { return !['done', 'failed'].includes(s) }

const STATUS_META = {
  pending: 'Queued', audio: 'Generating Audio', composing: 'AI Composing Scenes',
  rendering: 'Rendering Video', encoding: 'Merging Audio', done: 'Complete', failed: 'Failed',
}

export default function RemotionStudio({ topicId, topic, segments, onRefresh, searchParams, setSearchParams }) {
  const [styles, setStyles] = useState([])
  const [voices, setVoices] = useState([])
  const [languages, setLanguages] = useState([])
  const [templates, setTemplates] = useState([])
  const [segStatus, setSegStatus] = useState({})

  const selectedSegId = searchParams?.get('seg') || null
  const setSelectedSegId = (id) => {
    const p = Object.fromEntries(searchParams.entries())
    if (id) p.seg = id; else delete p.seg
    p.tab = 'remotion'
    setSearchParams(p)
  }

  const [previewConfig, setPreviewConfig] = useState(null)
  const [chatSettings, setChatSettings] = useState({ style: 'cinematic', voice_id: '', language: '' })
  const [generating, setGenerating] = useState(false)
  const [segSearch, setSegSearch] = useState('')

  const readySegs = segments.filter(s => s.status === 'ready')
  const filteredSegs = segSearch
    ? readySegs.filter(s => s.title?.toLowerCase().includes(segSearch.toLowerCase()))
    : readySegs
  const selectedSeg = readySegs.find(s => s.id === selectedSegId) || readySegs[0] || null

  useEffect(() => {
    fetch('/api/remotion/styles').then(r => r.json()).then(d => setStyles(d.styles || []))
    fetch('/api/remotion/templates').then(r => r.json()).then(d => setTemplates(d.templates || []))
    fetch('/api/voices/elevenlabs').then(r => r.json()).then(d => setVoices(d.voices || [])).catch(() => {})
    fetch('/api/languages').then(r => r.json()).then(d => setLanguages(d || []))
  }, [])

  useEffect(() => {
    if (!selectedSegId && readySegs.length) setSelectedSegId(readySegs[0].id)
  }, [readySegs.length])

  useEffect(() => {
    const load = () => fetch(`/api/topics/${topicId}/remotion/jobs`).then(r => r.json()).then(d => setSegStatus(d.segments || {}))
    load()
    const hasActive = Object.values(segStatus).some(s => s?.active)
    const iv = setInterval(load, hasActive ? 2500 : 8000)
    return () => clearInterval(iv)
  }, [topicId])

  const ss = selectedSeg ? (segStatus[selectedSeg.segment_num] || {}) : {}
  const activeJob = ss.active
  const doneJob = ss.done
  const failedJob = !activeJob ? ss.failed : null

  const handleGenerate = async () => {
    if (!selectedSeg || generating) return
    setGenerating(true)
    await fetch(`/api/topics/${topicId}/remotion/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_prompt: '', style: chatSettings.style,
        voice_id: chatSettings.voice_id || null,
        language: chatSettings.language || null,
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

      {/* ══════ LEFT — AI Chat Agent ══════ */}
      {selectedSeg && (
        <div className="ve-left">
          <ChatPanel
            topicId={topicId}
            segment={selectedSeg}
            voices={voices}
            languages={languages}
            styles={styles}
            templates={templates}
            sceneConfig={previewConfig}
            settings={chatSettings}
            onSceneConfigUpdate={setPreviewConfig}
            onSettingsUpdate={setChatSettings}
            onGenerate={handleGenerate}
          />
        </div>
      )}

      {/* ══════ CENTER ══════ */}
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
                    <div className="ve-c-render-status">{STATUS_META[activeJob.status] || activeJob.status}</div>
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
                  <div className="ve-c-empty-bg" />
                  <Film size={48} strokeWidth={1} style={{ opacity: 0.2 }} />
                  <div className="ve-c-empty-title">Ready to create</div>
                  <div className="ve-c-empty-desc">
                    Chat with the Motion Director to compose your video scenes.
                  </div>
                </div>
              )}
            </div>

            {failedJob && (
              <div style={{ margin: '0 16px', padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444', fontSize: 11, display: 'flex', gap: 8 }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{failedJob.error?.slice(0, 150) || 'Generation failed'}</span>
              </div>
            )}

            <div className="ve-c-script">
              <div className="ve-c-script-text">{selectedSeg.script}</div>
            </div>
          </>
        )}
      </div>

      {/* ══════ RIGHT — Segments ══════ */}
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
            const s = segStatus[seg.segment_num] || {}
            const sel = seg.id === selectedSeg?.id
            return (
              <div key={seg.id}
                className={`ve-seg ${sel ? 've-seg-sel' : ''} ${s.active ? 've-seg-act' : ''}`}
                onClick={() => { setSelectedSegId(seg.id); setPreviewConfig(null) }}>
                <div className="ve-seg-n">{seg.segment_num}</div>
                <div className="ve-seg-info">
                  <div className="ve-seg-t">{seg.title}</div>
                  <div className="ve-seg-h">{seg.hook}</div>
                </div>
                <div className="ve-seg-st">
                  {s.active && <><Loader2 size={13} className="spin" /><span className="ve-seg-pct">{s.active.progress}%</span></>}
                  {!s.active && s.done && <CheckCircle2 size={14} className="c-green" />}
                  {!s.active && !s.done && <ChevronRight size={13} className="c-muted" />}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
