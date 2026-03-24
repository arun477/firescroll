import { useState, useEffect } from 'react'
import { X, ExternalLink, FileText, Loader2, Globe, Search, Bot, Database } from 'lucide-react'

const TYPE_ICONS = {
  search: Search,
  scrape: FileText,
  crawl: Globe,
  agent: Bot,
  extract: Database,
}

const TYPE_COLORS = {
  search: '#3b82f6',
  scrape: '#22c55e',
  crawl: '#f97316',
  agent: '#8b5cf6',
  extract: '#eab308',
}

function getHost(url) {
  try { return new URL(url).hostname } catch { return url?.slice(0, 30) || 'source' }
}

export default function SourcePreview({ topicId, sources, onClose }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [content, setContent] = useState(null)
  const [contentLoading, setContentLoading] = useState(false)

  const loadContent = (idx) => {
    setActiveIdx(idx)
    setContentLoading(true)
    setContent(null)
    const src = sources[idx]
    fetch(`/api/topics/${topicId}/sources/${src.id}`)
      .then(r => r.json())
      .then(data => {
        setContent(data.content || 'No content stored')
        setContentLoading(false)
      })
      .catch(() => { setContent('Failed to load'); setContentLoading(false) })
  }

  useEffect(() => {
    if (sources.length > 0) loadContent(0)
  }, [])

  const activeSrc = sources[activeIdx] || null
  const hostname = activeSrc ? getHost(activeSrc.url) : ''
  const TypeIcon = activeSrc ? (TYPE_ICONS[activeSrc.source_type] || FileText) : FileText

  return (
    <div className="srcpv-overlay" onClick={onClose}>
      <div className="srcpv-slider" onClick={e => e.stopPropagation()}>
        <div className="srcpv-header">
          <span className="srcpv-title">Sources ({sources.length})</span>
          <button className="srcpv-close" onClick={onClose}><X size={16} /></button>
        </div>

        {sources.length === 0 ? (
          <div className="srcpv-empty">No sources linked to this segment.</div>
        ) : (
          <div className="srcpv-body">
            {/* Source list */}
            <div className="srcpv-list">
              {sources.map((src, i) => {
                const SrcIcon = TYPE_ICONS[src.source_type] || FileText
                return (
                  <button key={src.id}
                    className={`srcpv-item ${i === activeIdx ? 'srcpv-item-on' : ''}`}
                    onClick={() => loadContent(i)}>
                    <SrcIcon size={12} style={{ color: TYPE_COLORS[src.source_type] || '#52525b', flexShrink: 0 }} />
                    <div className="srcpv-item-info">
                      <span className="srcpv-item-host">{getHost(src.url)}</span>
                      {src.title && src.title !== 'Untitled' && (
                        <span className="srcpv-item-title">{src.title}</span>
                      )}
                    </div>
                    {src.word_count > 0 && (
                      <span className="srcpv-item-words">{src.word_count.toLocaleString()}w</span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Content pane */}
            {activeSrc && (
              <div className="srcpv-content">
                <div className="srcpv-content-header">
                  <div>
                    <span className="srcpv-content-host">{hostname}</span>
                    {activeSrc.title && activeSrc.title !== 'Untitled' && (
                      <span className="srcpv-content-title">{activeSrc.title}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {activeSrc.word_count > 0 && (
                      <span style={{ fontSize: 11, color: '#3f3f46' }}>{activeSrc.word_count.toLocaleString()} words</span>
                    )}
                    <span className="srcpv-type" style={{ color: TYPE_COLORS[activeSrc.source_type] || '#52525b' }}>
                      <TypeIcon size={10} />
                      {activeSrc.source_type}
                    </span>
                    {activeSrc.url && !activeSrc.url.startsWith('agent://') && (
                      <a href={activeSrc.url} target="_blank" rel="noreferrer" className="srcpv-ext">
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
                <div className="srcpv-content-body">
                  {contentLoading ? (
                    <div className="srcpv-loading"><Loader2 size={14} className="spin" /></div>
                  ) : (
                    <pre className="srcpv-content-text">{content}</pre>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
