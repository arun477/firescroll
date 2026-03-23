import { useState } from 'react'
import {
  Sparkles, Loader2, CheckCircle2,
} from 'lucide-react'
import FirecrawlBadge from './FirecrawlBadge'
import FirecrawlStatus from './FirecrawlStatus'
import FirecrawlToolbar from './FirecrawlToolbar'
import SegmentDetailCard from './SegmentDetailCard'
import SourcesPanel from './SourcesPanel'
import ResearchTaskManager from './ResearchTaskManager'

export default function ResearchPanel({
  topicId, topic, segments, research, sources, sourceStats, onRefresh,
}) {
  const [generating, setGenerating] = useState(null)

  const handleGenerateAll = async (method) => {
    setGenerating(method)
    await fetch(`/api/topics/${topicId}/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, num_segments: topic.total_segments }),
    })
    setTimeout(() => { setGenerating(null); onRefresh() }, 1500)
  }

  const readyCount = segments.filter(s => s.status === 'ready').length
  const busyCount = segments.filter(s => s.status === 'researching').length
  const isRunning = topic.research_status === 'generating' || busyCount > 0

  return (
    <div className="research-panel">
      <div className="rp-header">
        <div className="rp-header-left">
          <h2>Research</h2>
          <div className="rp-stats">
            <span className={`rp-stat ${readyCount > 0 ? 'rp-stat-good' : ''}`}>
              <CheckCircle2 size={13} />
              {readyCount}/{segments.length || topic.total_segments} segments
            </span>
            {(sourceStats?.total || 0) > 0 && (
              <span className="rp-stat">
                <img src="/firecrawl-logo.svg" alt="" width="12" height="12" />
                {sourceStats.total} sources
              </span>
            )}
            {busyCount > 0 && (
              <span className="rp-stat rp-stat-active">
                <Loader2 size={13} className="spin" />
                {busyCount} active
              </span>
            )}
          </div>
        </div>
        <div className="rp-header-right">
          <FirecrawlStatus />
        </div>
      </div>

      <div className="rp-actions">
        <button className="btn btn-secondary"
          onClick={() => handleGenerateAll('ai')}
          disabled={isRunning || generating}>
          {generating === 'ai'
            ? <><Loader2 size={14} className="spin" /> Running...</>
            : <><Sparkles size={14} /> AI Generate All</>}
        </button>
        <button className="btn btn-firecrawl"
          onClick={() => handleGenerateAll('firecrawl')}
          disabled={isRunning || generating}>
          {generating === 'firecrawl'
            ? <><Loader2 size={14} className="spin" /> Researching...</>
            : <><img src="/firecrawl-logo.svg" alt="" width="14" height="14" /> Web Research All</>}
        </button>
      </div>

      <FirecrawlToolbar
        topicId={topicId}
        segments={segments}
        onRefresh={onRefresh}
      />

      {segments.length > 0 ? (
        <div className="research-grid">
          {segments.map(seg => (
            <SegmentDetailCard
              key={seg.id}
              seg={seg}
              topicId={topicId}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      ) : (
        <div className="rp-empty">
          <h3>No segments yet</h3>
          <p>Use the buttons above to start researching.</p>
        </div>
      )}

      <SourcesPanel
        sources={sources || []}
        stats={sourceStats}
        topicId={topicId}
        onRefresh={onRefresh}
      />

      <ResearchTaskManager
        tasks={research || []}
        topicId={topicId}
        onRefresh={onRefresh}
      />

      <FirecrawlBadge variant="footer" />
    </div>
  )
}
