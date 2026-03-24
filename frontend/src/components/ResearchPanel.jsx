import { useEffect, useState, useRef } from 'react'
import {
  Sparkles, Loader2, CheckCircle2, Database, Bot, Layers,
  Search, Plus, ChevronLeft, ChevronRight, Pencil, Check,
} from 'lucide-react'
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
  const [researchForm, setResearchForm] = useState(null)
  const [descDraft, setDescDraft] = useState(null)

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
    <div className="rp-platform">
      {/* ═══ LEFT: Firecrawl Command Center ═══ */}
      <div className="rp-col-left">
        <div className="fc-cmd">
          {/* Header */}
          <div className="fc-cmd-header">
            <img src="/firecrawl-logo.svg" alt="" />
            <span className="fc-cmd-title">Research <span>Tools</span></span>
            <FirecrawlStatus />
          </div>

          {/* Topic description */}
          {descDraft === null && (
            <div className="rp-desc" onClick={() => setDescDraft(topic.description || '')}>
              {topic.description
                ? <span className="rp-desc-text">{topic.description}</span>
                : <span className="rp-desc-placeholder">Add a description to guide research...</span>
              }
              <Pencil size={11} className="rp-desc-icon" />
            </div>
          )}
          {descDraft !== null && (
            <div className="rp-desc-form">
              <textarea className="rp-desc-input" value={descDraft} onChange={e => setDescDraft(e.target.value)} rows={2} autoFocus
                placeholder="Describe what the video series should cover..." />
              <button className="rp-desc-save" onClick={handleSaveDesc}><Check size={12} /></button>
            </div>
          )}

          {/* Research Modes */}
          <div className="fc-quick-actions">
            {[
              { id: 'ai', icon: <Sparkles size={12} />, label: 'AI' },
              { id: 'firecrawl', icon: <img src="/firecrawl-logo.svg" alt="" width="12" height="12" />, label: 'Web', cls: 'fc-quick-btn-fc' },
              { id: 'deep', icon: <Layers size={12} />, label: 'Deep', cls: 'fc-quick-btn-deep' },
              { id: 'agent', icon: <Bot size={12} />, label: 'Agent', cls: 'fc-quick-btn-agent' },
            ].map(m => (
              <button key={m.id}
                className={`fc-quick-btn ${m.cls || ''} ${researchForm === m.id ? 'fc-quick-btn-on' : ''}`}
                onClick={() => setResearchForm(researchForm === m.id ? null : m.id)}
                disabled={isRunning || generating}>
                {generating === m.id ? <Loader2 size={12} className="spin" /> : m.icon}
                {m.label}
              </button>
            ))}
          </div>

          {/* Research form expand */}
          {researchForm && (
            <div className="fc-research-form">
              <div className="fc-mode-desc">
                {researchForm === 'ai' && 'Pure AI generation — no web search'}
                {researchForm === 'firecrawl' && 'Web search per segment + synthesize'}
                {researchForm === 'deep' && 'Search → Scrape → Extract → Synthesize (full Firecrawl pipeline)'}
                {researchForm === 'agent' && 'Firecrawl Agent autonomously researches each segment'}
              </div>
              <div className="fc-research-form-row">
                <span className="fc-research-form-label">Segments</span>
                <div className="fc-research-form-pills">
                  {[3, 4, 5, 6, 8, 10].map(n => (
                    <button key={n} type="button"
                      className={`fc-research-form-pill ${n === numSegments ? 'fc-research-form-pill-on' : ''}`}
                      onClick={() => setNumSegments(n)}>{n}</button>
                  ))}
                </div>
              </div>
              <input
                className="fc-research-form-instruction"
                placeholder="Optional: focus on recent discoveries..."
                value={instruction}
                onChange={e => setInstruction(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGenerateAll(researchForm)}
              />
              <div className="fc-research-form-actions">
                <button className={`fc-tool-form-submit ${researchForm === 'deep' ? 'fc-submit-deep' : ''} ${researchForm === 'agent' ? 'fc-submit-agent' : ''}`}
                  style={{ flex: 1 }}
                  onClick={() => handleGenerateAll(researchForm)}>
                  {researchForm === 'ai' && <><Sparkles size={12} /> Run AI Generation</>}
                  {researchForm === 'firecrawl' && <><img src="/firecrawl-logo.svg" alt="" width="12" height="12" /> Run Web Research</>}
                  {researchForm === 'deep' && <><Layers size={12} /> Run Deep Research</>}
                  {researchForm === 'agent' && <><Bot size={12} /> Run Agent Research</>}
                </button>
                <button className="fc-quick-btn" style={{ flex: 0, padding: '6px 10px', fontSize: 11 }}
                  onClick={() => setResearchForm(null)}>Cancel</button>
              </div>
            </div>
          )}

          {/* Firecrawl Tool Cards */}
          <FirecrawlToolbar
            topicId={topicId}
            segments={segments}
            onRefresh={refresh}
          />

          {/* Badge */}
          <div className="fc-cmd-badge">
            <img src="/firecrawl-logo.svg" alt="" width="14" height="14" />
            Powered by <strong>Firecrawl</strong>
          </div>
        </div>
      </div>

      {/* ═══ CENTER: Segments ═══ */}
      <div className="rp-col-center">
        <div className="rp-col-header">
          <span className="rp-col-header-title">Segments</span>
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
        </div>

        <div className="rp-seg-controls">
          <div className="rp-search">
            <Search size={13} />
            <input
              placeholder="Search segments..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="rp-search-input"
            />
          </div>
          <div className="rp-seg-controls-right">
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
                : <p>Click AI All or Web All to start researching.</p>}
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
      </div>

      {/* ═══ RIGHT: Knowledge Base ═══ */}
      <div className="rp-col-right">
        <div className="rp-col-header">
          <img src="/firecrawl-logo.svg" alt="" width="12" height="12" />
          <span className="rp-col-header-title">Knowledge Base</span>
          <span className="rp-col-header-badge">{srcCount} sources</span>
        </div>

        <SourcesPanel
          sources={sources || []}
          stats={sourceStats}
          topicId={topicId}
          onRefresh={refresh}
          alwaysOpen
        />
        <ResearchTaskManager
          tasks={research || []}
          fcJobs={fcJobs || []}
          topicId={topicId}
          onRefresh={refresh}
          alwaysOpen
        />
      </div>
    </div>
  )
}
