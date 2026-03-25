import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const TEMPLATE_COLORS = {
  title_reveal: '#E63250',
  fact_card: '#f97316',
  narrative: '#3b82f6',
  split_info: '#22c55e',
  cta_outro: '#a855f7',
}

const TEMPLATE_NAMES = {
  title_reveal: 'Title',
  fact_card: 'Fact',
  narrative: 'Narrate',
  split_info: 'Info',
  cta_outro: 'CTA',
}

export default function SceneConfigCard({ config }) {
  const [expanded, setExpanded] = useState(null)
  if (!config?.scenes?.length) return null

  const totalFrames = Math.max(...config.scenes.map(s => s.from + s.durationInFrames))
  const totalSec = (totalFrames / (config.fps || 30)).toFixed(1)

  return (
    <div className="vc-scene-card">
      <div className="vc-scene-bar">
        {config.scenes.map((s, i) => {
          const pct = (s.durationInFrames / totalFrames) * 100
          const color = TEMPLATE_COLORS[s.template] || '#666'
          return (
            <div key={i} className="vc-scene-block"
              style={{ width: `${pct}%`, background: `${color}20`, borderLeft: `3px solid ${color}` }}
              onClick={() => setExpanded(expanded === i ? null : i)}
              title={`${TEMPLATE_NAMES[s.template] || s.template} (${Math.round(s.durationInFrames / 30)}s)`}>
              <span className="vc-scene-block-name">{TEMPLATE_NAMES[s.template] || s.template}</span>
              <span className="vc-scene-block-dur">{Math.round(s.durationInFrames / 30)}s</span>
            </div>
          )
        })}
      </div>
      <div className="vc-scene-meta">{config.scenes.length} scenes · {totalSec}s total</div>
      {expanded !== null && config.scenes[expanded] && (
        <div className="vc-scene-detail">
          <div className="vc-scene-detail-head">
            Scene {expanded + 1}: {config.scenes[expanded].template.replace(/_/g, ' ')}
          </div>
          <pre className="vc-scene-detail-props">
            {JSON.stringify(config.scenes[expanded].props, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
