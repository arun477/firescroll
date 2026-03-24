import { useEffect, useState, useRef } from 'react'
import {
  Sparkles, Loader2, CheckCircle2, Database,
  Search, Plus, ChevronLeft, ChevronRight, Pencil, Check,
} from 'lucide-react'
import FirecrawlBadge from './FirecrawlBadge'
import FirecrawlStatus from './FirecrawlStatus'
import FirecrawlToolbar from './FirecrawlToolbar'
import SegmentDetailCard from './SegmentDetailCard'
import SourcesPanel from './SourcesPanel'
import ResearchTaskManager from './ResearchTaskManager'

export default function ResearchPanel({
  topicId, topic, segments, research, sources, sourceStats, fcJobs, onRefresh,
}) {
  const [generating, setGenerating] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [addingSegment, setAddingSegment] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [numSegments, setNumSegments] = useState(6)
  const [instruction, setInstruction] = useState('')
  const [researchForm, setResearchForm] = useState(null) // null | 'ai' | 'firecrawl'
  const [descDraft, setDescDraft] = useState(null) // null = not editing

  const [segData, setSegData] = useState(null)
  const perPage = 10

  const fetchSegments = async (q = searchQuery, p = page) => {
    const res = await fetch(
      `/api/topics/${topicId}/segments?q=${encodeURIComponent(q)}&page=${p}&per_page=${perPage}`
    )
    const data = await res.json()
    setSegData(data)
  }

  useEffect(() => { fetchSegments() }, [topicId, searchQuery, page])

  // Poll when anything is busy — clean up on unmount or state change
  const wasBusy = useRef(false)
  useEffect(() => {
    const isBusy = topic?.research_status === 'generating' ||
      segments.some(s => s.status === 'researching') ||
      fcJobs?.some(j => j.status === 'running')

    if (isBusy) {
      wasBusy.current = true
      const iv = setInterval(() => { fetchSegments(); onRefresh() }, 2500)
      return () => clearInterval(iv)
    }

    // Just finished — final refresh with cleanup
    if (wasBusy.current) {
      wasBusy.current = false
      const t1 = setTimeout(() => { fetchSegments(); onRefresh() }, 1000)
      const t2 = setTimeout(() => { fetchSegments(); onRefresh() }, 3000)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
  }, [topic?.research_status, segments, fcJobs])

  const refresh = () => { onRefresh(); fetchSegments() }

  const handleGenerateAll = async (method) => {
    setGenerating(method)
    setResearchForm(null)
    await fetch(`/api/topics/${topicId}/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, num_segments: numSegments, instruction }),
    })
    setInstruction('')
    setTimeout(() => { setGenerating(null); refresh() }, 1500)
  }

  const handleSaveDesc = async () => {
    await fetch(`/api/topics/${topicId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: descDraft }),
    })
    setDescDraft(null)
    onRefresh()
  }

  const handleAddSegment = async () => {
    if (!newTitle.trim()) return
    await fetch(`/api/topics/${topicId}/segments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim() }),
    })
    setNewTitle('')
    setAddingSegment(false)
    onRefresh()
  }

  const readyCount = segments.filter(s => s.status === 'ready').length
  const busyCount = segments.filter(s => s.status === 'researching').length
  const isRunning = topic.research_status === 'generating' || busyCount > 0
  const srcCount = sourceStats?.total || 0

  const paged = segData?.segments || segments.slice(0, perPage)
  const totalPages = segData?.pages || 1
  const totalSegs = segData?.total || segments.length

  useEffect(() => { setPage(1) }, [searchQuery])

  return (
    <div className="rp-split">
      <div className="rp-left">
        {/* Topic description */}
        {topic.description && descDraft === null && (
          <div className="rp-desc">
            <span className="rp-desc-text">{topic.description}</span>
            <button className="rp-desc-edit" onClick={() => setDescDraft(topic.description)}>
              <Pencil size={11} />
            </button>
          </div>
        )}
        {descDraft !== null && (
          <div className="rp-desc-form">
            <textarea className="rp-desc-input" value={descDraft} onChange={e => setDescDraft(e.target.value)} rows={2} autoFocus />
            <button className="rp-desc-save" onClick={handleSaveDesc}><Check size={12} /></button>
          </div>
        )}

        <div className="rp-controls">
          <div className="rp-controls-left">
            <div className="rp-chips">
              <span className={`rp-chip ${readyCount > 0 ? 'rp-chip-green' : ''}`}>
                <CheckCircle2 size={12} />
                {readyCount}/{segments.length || 0}
              </span>
              {srcCount > 0 && (
                <span className="rp-chip">
                  <Database size={12} /> {srcCount}
                </span>
              )}
              {busyCount > 0 && (
                <span className="rp-chip rp-chip-blue">
                  <Loader2 size={12} className="spin" /> {busyCount}
                </span>
              )}
            </div>
            <div className="rp-divider" />
            <button className="btn btn-secondary btn-sm"
              onClick={() => setResearchForm('ai')}
              disabled={isRunning || generating}>
              {generating === 'ai'
                ? <Loader2 size={13} className="spin" />
                : <><Sparkles size={13} /> AI All</>}
            </button>
            <button className="btn btn-firecrawl btn-sm"
              onClick={() => setResearchForm('firecrawl')}
              disabled={isRunning || generating}>
              {generating === 'firecrawl'
                ? <Loader2 size={13} className="spin" />
                : <><img src="/firecrawl-logo.svg" alt="" width="13" height="13" /> Web All</>}
            </button>
          </div>
          <FirecrawlStatus />
        </div>

        {/* Research form — segments + instruction */}
        {researchForm && (
          <div className="rp-research-form">
            <div className="rp-rf-row">
              <span className="rp-rf-label">Segments</span>
              <div className="rp-rf-pills">
                {[3, 4, 5, 6, 8, 10].map(n => (
                  <button key={n} type="button"
                    className={`rp-rf-pill ${n === numSegments ? 'rp-rf-pill-on' : ''}`}
                    onClick={() => setNumSegments(n)}>{n}</button>
                ))}
              </div>
            </div>
            <input
              className="rp-rf-input"
              placeholder="Optional instruction: e.g. Focus on recent discoveries, keep it beginner-friendly..."
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGenerateAll(researchForm)}
            />
            <div className="rp-rf-actions">
              <button className={researchForm === 'firecrawl' ? 'btn btn-firecrawl btn-sm' : 'btn btn-secondary btn-sm'}
                onClick={() => handleGenerateAll(researchForm)}>
                {researchForm === 'firecrawl'
                  ? <><img src="/firecrawl-logo.svg" alt="" width="13" height="13" /> Run Web Research</>
                  : <><Sparkles size={13} /> Run AI Generation</>}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setResearchForm(null)}>Cancel</button>
            </div>
          </div>
        )}

        <div className="rp-tools-row">
          <FirecrawlToolbar
            topicId={topicId}
            segments={segments}
            onRefresh={refresh}
          />
          <div className="rp-tools-right">
            <div className="rp-search">
              <Search size={13} />
              <input
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="rp-search-input"
              />
            </div>
            <button className="btn btn-secondary btn-sm"
              onClick={() => setAddingSegment(!addingSegment)}>
              <Plus size={13} />
            </button>
          </div>
        </div>

        {addingSegment && (
          <div className="rp-add-segment">
            <input
              placeholder="New segment title..."
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddSegment()}
              className="rp-add-input"
              autoFocus
            />
            <button className="btn btn-primary btn-sm" onClick={handleAddSegment}
              disabled={!newTitle.trim()}>
              Add
            </button>
            <button className="btn btn-secondary btn-sm"
              onClick={() => { setAddingSegment(false); setNewTitle('') }}>
              Cancel
            </button>
          </div>
        )}

        <div className="rp-seg-list">
          {paged.length > 0 ? (
            paged.map(seg => (
              <SegmentDetailCard
                key={seg.id}
                seg={seg}
                topicId={topicId}
                onRefresh={refresh}
              />
            ))
          ) : (
            <div className="rp-empty-msg">
              {searchQuery
                ? <p>No segments match "{searchQuery}"</p>
                : <p>Click AI All or Web All to start.</p>}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="rp-pagination">
            <button className="rp-page-btn" onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}>
              <ChevronLeft size={14} />
            </button>
            <span className="rp-page-info">{page} / {totalPages}</span>
            <button className="rp-page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}>
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        <FirecrawlBadge variant="footer" />
      </div>

      <div className="rp-right">
        <SourcesPanel
          sources={sources || []}
          stats={sourceStats}
          topicId={topicId}
          onRefresh={refresh}
        />
        <ResearchTaskManager
          tasks={research || []}
          fcJobs={fcJobs || []}
          topicId={topicId}
          onRefresh={refresh}
        />
      </div>
    </div>
  )
}
