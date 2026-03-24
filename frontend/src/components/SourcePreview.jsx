import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
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
  if (!url) return 'source'
  if (url.startsWith('agent://')) return 'Firecrawl Agent'
  try { return new URL(url).hostname } catch { return url.slice(0, 30) }
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

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const activeSrc = sources[activeIdx] || null
  const TypeIcon = activeSrc ? (TYPE_ICONS[activeSrc.source_type] || FileText) : FileText

  const formatContent = (text) => {
    if (!text) return ''
    try {
      const parsed = JSON.parse(text)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return text
    }
  }

  const panel = (
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
            <div className="srcpv-list">
              {sources.map((src, i) => {
                const SrcIcon = TYPE_ICONS[src.source_type] || FileText
                const isActive = i === activeIdx
                return (
                  <button key={src.id}
                    className={`srcpv-item ${isActive ? 'srcpv-item-on' : ''}`}
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

            {activeSrc && (
              <div className="srcpv-content">
                <div className="srcpv-content-header">
                  <div className="srcpv-content-meta">
                    <span className="srcpv-content-host">{getHost(activeSrc.url)}</span>
                    {activeSrc.title && activeSrc.title !== 'Untitled' && (
                      <span className="srcpv-content-title">{activeSrc.title}</span>
                    )}
                  </div>
                  <div className="srcpv-content-badges">
                    {activeSrc.word_count > 0 && (
                      <span className="srcpv-badge">{activeSrc.word_count.toLocaleString()} words</span>
                    )}
                    <span className="srcpv-badge" style={{ color: TYPE_COLORS[activeSrc.source_type] || '#52525b' }}>
                      <TypeIcon size={10} />
                      {activeSrc.source_type}
                    </span>
                    {activeSrc.url && !activeSrc.url.startsWith('agent://') && (
                      <a href={activeSrc.url} target="_blank" rel="noreferrer" className="srcpv-ext">
                        <ExternalLink size={11} /> Open
                      </a>
                    )}
                  </div>
                </div>
                <div className="srcpv-content-body">
                  {contentLoading ? (
                    <div className="srcpv-loading"><Loader2 size={16} className="spin" /> Loading...</div>
                  ) : (
                    <pre className="srcpv-content-text">{formatContent(content)}</pre>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(panel, document.body)
}
