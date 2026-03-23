import { useState } from 'react'
import {
  CheckCircle2, Clock, FileText, Loader2, AlertCircle,
  Cpu, Globe, ChevronDown, ChevronRight, Save, Pencil, Trash2, RefreshCw,
  ExternalLink,
} from 'lucide-react'

const STATUS_CFG = {
  draft: { icon: FileText, color: 'var(--text-muted)', label: 'Draft' },
  researching: { icon: Loader2, color: '#7dacf0', label: 'Researching', spin: true },
  ready: { icon: CheckCircle2, color: '#6bb88a', label: 'Ready' },
  failed: { icon: AlertCircle, color: '#d97070', label: 'Failed' },
}

export default function SegmentDetailCard({ seg, topicId, onRefresh }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [edits, setEdits] = useState({})
  const [loading, setLoading] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const st = STATUS_CFG[seg.status] || STATUS_CFG.draft
  const StIcon = st.icon
  const isReady = seg.status === 'ready'
  const isBusy = seg.status === 'researching' || loading
  const sources = seg.source_urls ? JSON.parse(seg.source_urls) : []

  const handleResearch = async (method) => {
    if (isBusy) return
    setLoading(method)
    await fetch(`/api/topics/${topicId}/research/segment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segment_id: seg.id, method }),
    })
    setTimeout(() => { setLoading(null); onRefresh() }, 1500)
  }

  const handleSave = async () => {
    await fetch(`/api/topics/${topicId}/segments/${seg.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(edits),
    })
    setEditing(false)
    setEdits({})
    onRefresh()
  }

  const handleDelete = async () => {
    await fetch(`/api/topics/${topicId}/segments/${seg.id}`, { method: 'DELETE' })
    onRefresh()
  }

  const startEdit = () => {
    setEditing(true)
    setEdits({ title: seg.title, hook: seg.hook, script: seg.script, visual_cue: seg.visual_cue })
  }

  const cancelEdit = () => { setEditing(false); setEdits({}) }

  return (
    <div className={`seg-card ${isReady ? 'seg-ready' : ''} ${isBusy ? 'seg-busy' : ''} ${expanded ? 'seg-expanded' : ''}`}>
      <div className="seg-header" onClick={() => !editing && setExpanded(!expanded)}>
        <div className="seg-num-title">
          <span className={`seg-circle ${isReady ? 'seg-circle-done' : ''}`}>
            {isReady ? <CheckCircle2 size={14} /> : seg.segment_num}
          </span>
          <div className="seg-title-block">
            <strong>{seg.title || `Segment ${seg.segment_num}`}</strong>
            <span className="seg-status-inline" style={{ color: st.color }}>
              <StIcon size={12} className={st.spin ? 'spin' : ''} />
              {st.label}
              {seg.source && isReady && (
                <span className="seg-source-tag">
                  {seg.source === 'firecrawl' ? <img src="/firecrawl-logo.svg" alt="" width="10" height="10" /> : <Cpu size={10} />}
                  {seg.source}
                </span>
              )}
            </span>
          </div>
        </div>
        <div className="seg-right" onClick={e => e.stopPropagation()}>
          <button className={`seg-action-btn ${loading === 'ai' ? 'active' : ''}`}
            onClick={() => handleResearch('ai')} disabled={isBusy} title="AI Generate">
            {loading === 'ai' ? <Loader2 size={14} className="spin" /> : <Cpu size={14} />}
            <span>AI</span>
          </button>
          <button className={`seg-action-btn seg-action-fc ${loading === 'firecrawl' ? 'active' : ''}`}
            onClick={() => handleResearch('firecrawl')} disabled={isBusy} title="Web Research">
            {loading === 'firecrawl' ? <Loader2 size={14} className="spin" /> : <img src="/firecrawl-logo.svg" alt="" width="14" height="14" />}
            <span>Web</span>
          </button>
          <button className="seg-expand-btn" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}>
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="seg-detail">
          {editing ? (
            <div className="seg-edit-form">
              <div className="seg-edit-field">
                <label>Title</label>
                <input value={edits.title || ''} onChange={e => setEdits({ ...edits, title: e.target.value })} className="seg-edit-input" />
              </div>
              <div className="seg-edit-field">
                <label>Hook</label>
                <textarea value={edits.hook || ''} onChange={e => setEdits({ ...edits, hook: e.target.value })} className="seg-edit-textarea" rows={2} />
              </div>
              <div className="seg-edit-field">
                <label>Script</label>
                <textarea value={edits.script || ''} onChange={e => setEdits({ ...edits, script: e.target.value })} className="seg-edit-textarea" rows={4} />
              </div>
              <div className="seg-edit-field">
                <label>Visual Cue</label>
                <textarea value={edits.visual_cue || ''} onChange={e => setEdits({ ...edits, visual_cue: e.target.value })} className="seg-edit-textarea" rows={2} />
              </div>
              <div className="seg-edit-actions">
                <button className="btn btn-primary btn-sm" onClick={handleSave}><Save size={13} /> Save</button>
                <button className="btn btn-secondary btn-sm" onClick={cancelEdit}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              {isReady && (
                <div className="seg-content-fields">
                  <div className="seg-field">
                    <span className="seg-label">Hook</span>
                    <p className="seg-hook-text">{seg.hook}</p>
                  </div>
                  <div className="seg-field">
                    <span className="seg-label">Script</span>
                    <p>{seg.script}</p>
                  </div>
                  {seg.visual_cue && (
                    <div className="seg-field">
                      <span className="seg-label">Visual</span>
                      <p className="seg-visual-text">{seg.visual_cue}</p>
                    </div>
                  )}
                  {sources.length > 0 && (
                    <div className="seg-field">
                      <span className="seg-label">Sources ({sources.length})</span>
                      <div className="seg-sources">
                        {sources.map((url, i) => {
                          try {
                            return (
                              <a key={i} href={url} target="_blank" rel="noreferrer" className="seg-source-link">
                                <ExternalLink size={10} /> {new URL(url).hostname}
                              </a>
                            )
                          } catch { return null }
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="seg-detail-actions">
                {isReady && <button className="seg-mini-btn" onClick={startEdit}><Pencil size={12} /> Edit</button>}
                <button className="seg-mini-btn" onClick={() => handleResearch(seg.source || 'ai')}>
                  <RefreshCw size={12} /> Regenerate
                </button>
                {confirmDelete ? (
                  <span className="seg-delete-confirm">
                    Delete?
                    <button className="seg-confirm-yes" onClick={handleDelete}>Yes</button>
                    <button className="seg-confirm-no" onClick={() => setConfirmDelete(false)}>No</button>
                  </span>
                ) : (
                  <button className="seg-mini-btn seg-mini-danger" onClick={() => setConfirmDelete(true)}>
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </>
          )}

          {seg.status === 'failed' && (
            <div className="seg-failed-msg">
              <AlertCircle size={12} /> Failed. Click AI or Web to retry.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
