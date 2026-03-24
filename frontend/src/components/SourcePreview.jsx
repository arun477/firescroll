import { useState, useEffect } from 'react'
import { X, ExternalLink, FileText, Loader2 } from 'lucide-react'

export default function SourcePreview({ topicId, sourceUrls, onClose }) {
  const [sources, setSources] = useState([])
  const [activeSrc, setActiveSrc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState(null)
  const [contentLoading, setContentLoading] = useState(false)

  // Fetch all topic sources and match by URL
  useEffect(() => {
    if (!sourceUrls?.length) return
    fetch(`/api/topics/${topicId}/sources`)
      .then(r => r.json())
      .then(data => {
        const matched = (data.sources || []).filter(s =>
          sourceUrls.some(url => s.url === url)
        )
        setSources(matched)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [topicId, sourceUrls])

  const loadContent = (src) => {
    setActiveSrc(src)
    setContentLoading(true)
    setContent(null)
    fetch(`/api/topics/${topicId}/sources/${src.id}`)
      .then(r => r.json())
      .then(data => {
        setContent(data.content || 'No content available')
        setContentLoading(false)
      })
      .catch(() => { setContent('Failed to load'); setContentLoading(false) })
  }

  let hostname = ''
  if (activeSrc?.url) {
    try { hostname = new URL(activeSrc.url).hostname } catch {}
  }

  return (
    <div className="srcpv-overlay" onClick={onClose}>
      <div className="srcpv-slider" onClick={e => e.stopPropagation()}>
        <div className="srcpv-header">
          <span className="srcpv-title">Sources ({sourceUrls?.length || 0})</span>
          <button className="srcpv-close" onClick={onClose}><X size={16} /></button>
        </div>

        {loading ? (
          <div className="srcpv-loading"><Loader2 size={16} className="spin" /></div>
        ) : sources.length === 0 ? (
          <div className="srcpv-empty">
            <p>Sources not found in knowledge base.</p>
            <div className="srcpv-url-list">
              {sourceUrls?.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer" className="srcpv-url-link">
                  <ExternalLink size={10} /> {url}
                </a>
              ))}
            </div>
          </div>
        ) : (
          <div className="srcpv-body">
            {/* Source list */}
            <div className="srcpv-list">
              {sources.map(src => {
                let host = ''
                try { host = new URL(src.url).hostname } catch {}
                return (
                  <button key={src.id}
                    className={`srcpv-item ${activeSrc?.id === src.id ? 'srcpv-item-on' : ''}`}
                    onClick={() => loadContent(src)}>
                    <FileText size={12} />
                    <div className="srcpv-item-info">
                      <span className="srcpv-item-host">{host}</span>
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

            {/* Content preview */}
            {activeSrc && (
              <div className="srcpv-content">
                <div className="srcpv-content-header">
                  <div>
                    <span className="srcpv-content-host">{hostname}</span>
                    {activeSrc.title && <span className="srcpv-content-title">{activeSrc.title}</span>}
                  </div>
                  {activeSrc.url && (
                    <a href={activeSrc.url} target="_blank" rel="noreferrer" className="srcpv-ext">
                      <ExternalLink size={12} />
                    </a>
                  )}
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

            {!activeSrc && (
              <div className="srcpv-hint">Select a source to preview content</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
