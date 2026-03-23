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
  const srcCount = sourceStats?.total || 0
  const runningTasks = (research || []).filter(
    t => !['done', 'failed', 'pending'].includes(t.status)
  ).length

  return (
    <div className="rp">
      <div className="rp-top-bar">
        <div className="rp-top-left">
          <div className="rp-stats-row">
            <span className={`rp-chip ${readyCount > 0 ? 'rp-chip-green' : ''}`}>
              <CheckCircle2 size={12} />
              {readyCount}/{segments.length || topic.total_segments} segments
            </span>
            {srcCount > 0 && (
              <span className="rp-chip">
                <Database size={12} />
                {srcCount} sources
              </span>
            )}
            {busyCount > 0 && (
              <span className="rp-chip rp-chip-blue">
                <Loader2 size={12} className="spin" />
                {busyCount} researching
              </span>
            )}
            {runningTasks > 0 && (
              <span className="rp-chip rp-chip-blue">
                <Loader2 size={12} className="spin" />
                {runningTasks} tasks
              </span>
            )}
          </div>
          <div className="rp-bulk-actions">
            <button className="btn btn-secondary btn-sm"
              onClick={() => handleGenerateAll('ai')}
              disabled={isRunning || generating}>
              {generating === 'ai'
                ? <><Loader2 size={13} className="spin" /> Running</>
                : <><Sparkles size={13} /> AI Generate All</>}
            </button>
            <button className="btn btn-firecrawl btn-sm"
              onClick={() => handleGenerateAll('firecrawl')}
              disabled={isRunning || generating}>
              {generating === 'firecrawl'
                ? <><Loader2 size={13} className="spin" /> Researching</>
                : <><img src="/firecrawl-logo.svg" alt="" width="13" height="13" /> Web Research All</>}
            </button>
          </div>
        </div>
        <FirecrawlStatus />
      </div>

      <div className="rp-layout">
        <div className="rp-main">
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
              <div className="rp-empty">
                <h3>No segments yet</h3>
                <p>Click AI Generate All or Web Research All to start.</p>
              </div>
            )}
          </div>
        </div>

        <div className="rp-sidebar">
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

      <FirecrawlBadge variant="footer" />
    </div>
  )
}
