export default function FirecrawlBadge({ variant = 'footer' }) {
  if (variant === 'inline') {
    return (
      <span className="fc-badge-inline">
        <img src="/firecrawl-logo.svg" alt="" width="14" height="14" />
        Firecrawl
      </span>
    )
  }

  return (
    <div className="fc-badge-footer">
      <img src="/firecrawl-logo.svg" alt="" width="18" height="18" />
      <span>Powered by <strong>Firecrawl</strong></span>
    </div>
  )
}
