import { useState } from 'react'
import {
  Sparkles, Loader2, CheckCircle2, Database,
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
  const srcCount = sourceStats?.total || 0

  return (
    <div className="rp-split">
      <div className="rp-left">
        <div className="rp-controls">
          <div className="rp-controls-left">
            <div className="rp-chips">
              <span className={`rp-chip ${readyCount > 0 ? 'rp-chip-green' : ''}`}>
                <CheckCircle2 size={12} />
                {readyCount}/{segments.length || topic.total_segments}
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
              onClick={() => handleGenerateAll('ai')}
              disabled={isRunning || generating}>
              {generating === 'ai'
                ? <Loader2 size={13} className="spin" />
                : <><Sparkles size={13} /> AI All</>}
            </button>
            <button className="btn btn-firecrawl btn-sm"
              onClick={() => handleGenerateAll('firecrawl')}
              disabled={isRunning || generating}>
              {generating === 'firecrawl'
                ? <Loader2 size={13} className="spin" />
                : <><img src="/firecrawl-logo.svg" alt="" width="13" height="13" /> Web All</>}
            </button>
          </div>
          <FirecrawlStatus />
        </div>

        <FirecrawlToolbar
          topicId={topicId}
          segments={segments}
          onRefresh={onRefresh}
        />

        <div className="rp-seg-list">
          {segments.length > 0 ? (
            segments.map(seg => (
              <SegmentDetailCard
                key={seg.id}
                seg={seg}
                topicId={topicId}
                onRefresh={onRefresh}
              />
            ))
          ) : (
            <div className="rp-empty-msg">
              <p>Click AI All or Web All to start.</p>
            </div>
          )}
        </div>

        <FirecrawlBadge variant="footer" />
      </div>

      <div className="rp-right">
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
      </div>
    </div>
  )
}
