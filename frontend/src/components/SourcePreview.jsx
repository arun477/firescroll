import { useState, useEffect } from 'react'
import { X, ExternalLink, FileText, Loader2 } from 'lucide-react'

function getHost(url) {
  try { return new URL(url).hostname } catch { return url || 'source' }
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

  return (
    <div className="srcpv-overlay" onClick={onClose}>
      <div className="srcpv-panel" onClick={e => e.stopPropagation()}>
        <div className="srcpv-header">
          <span className="srcpv-title">Sources ({sources.length})</span>
          <button className="srcpv-close" onClick={onClose}><X size={16} /></button>
        </div>

        {sources.length === 0 ? (
          <div className="srcpv-empty">No sources linked to this segment.</div>
        ) : (
          <>
            {sources.length > 1 && (
              <div className="srcpv-tabs">
                {sources.map((src, i) => (
                    <button key={src.id}
                      className={`srcpv-tab ${i === activeIdx ? 'srcpv-tab-on' : ''}`}
                      onClick={() => loadContent(i)}>
                      <FileText size={11} />
                      {getHost(src.url)}
                      {src.word_count > 0 && <span className="srcpv-tab-w">{src.word_count.toLocaleString()}w</span>}
                    </button>
                  ))}
              </div>
            )}

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
