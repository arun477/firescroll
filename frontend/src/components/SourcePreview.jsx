import { useState, useEffect } from 'react'
import { X, ExternalLink, FileText, Loader2 } from 'lucide-react'

export default function SourcePreview({ topicId, sourceUrls, onClose }) {
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeIdx, setActiveIdx] = useState(0)
  const [content, setContent] = useState(null)
  const [contentLoading, setContentLoading] = useState(false)

  useEffect(() => {
    if (!sourceUrls?.length) return
    fetch(`/api/topics/${topicId}/sources`)
      .then(r => r.json())
      .then(data => {
        const allSources = data.sources || []
        // Match by ID or by URL
        const matched = allSources.filter(s =>
          sourceUrls.some(ref => s.id === ref || s.url === ref)
        )
        setSources(matched)
        if (matched.length > 0) loadContent(matched[0])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [topicId, sourceUrls])

  const loadContent = (src) => {
    setContentLoading(true)
    setContent(null)
    fetch(`/api/topics/${topicId}/sources/${src.id}`)
      .then(r => r.json())
      .then(data => {
        setContent(data.content || 'No content stored')
        setContentLoading(false)
      })
      .catch(() => { setContent('Failed to load'); setContentLoading(false) })
  }

  const selectSource = (idx) => {
    setActiveIdx(idx)
    loadContent(sources[idx])
  }

  const activeSrc = sources[activeIdx] || null
  let hostname = ''
  if (activeSrc?.url) {
    try { hostname = new URL(activeSrc.url).hostname } catch { hostname = activeSrc.url }
  }

  return (
    <div className="srcpv-overlay" onClick={onClose}>
      <div className="srcpv-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="srcpv-header">
          <span className="srcpv-title">Sources</span>
          <button className="srcpv-close" onClick={onClose}><X size={16} /></button>
        </div>

        {loading ? (
          <div className="srcpv-loading"><Loader2 size={16} className="spin" /></div>
        ) : sources.length === 0 ? (
          <div className="srcpv-empty">No matching sources found in knowledge base.</div>
        ) : (
          <>
            {/* Tab list if multiple */}
            {sources.length > 1 && (
              <div className="srcpv-tabs">
                {sources.map((src, i) => {
                  let host = ''
                  try { host = new URL(src.url).hostname } catch { host = 'source' }
                  return (
                    <button key={src.id}
                      className={`srcpv-tab ${i === activeIdx ? 'srcpv-tab-on' : ''}`}
                      onClick={() => selectSource(i)}>
                      <FileText size={11} />
                      {host}
                      {src.word_count > 0 && <span className="srcpv-tab-w">{src.word_count.toLocaleString()}w</span>}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Content */}
            {activeSrc && (
              <div className="srcpv-content">
                <div className="srcpv-meta">
                  <div className="srcpv-meta-left">
                    <span className="srcpv-host">{hostname}</span>
                    {activeSrc.title && activeSrc.title !== 'Untitled' && (
                      <span className="srcpv-src-title">{activeSrc.title}</span>
                    )}
                  </div>
                  <div className="srcpv-meta-right">
                    {activeSrc.word_count > 0 && <span className="srcpv-words">{activeSrc.word_count.toLocaleString()} words</span>}
                    <span className="srcpv-type">{activeSrc.source_type}</span>
                    {activeSrc.url && !activeSrc.url.startsWith('agent://') && (
                      <a href={activeSrc.url} target="_blank" rel="noreferrer" className="srcpv-ext">
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
                <div className="srcpv-body">
                  {contentLoading ? (
                    <div className="srcpv-loading"><Loader2 size={14} className="spin" /></div>
                  ) : (
                    <pre className="srcpv-text">{content}</pre>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
