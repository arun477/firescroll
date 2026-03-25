import { useState } from 'react'
import { Code2, Film } from 'lucide-react'

const SCENE_COLORS = [
  '#E63250', '#f97316', '#3b82f6', '#22c55e', '#a855f7', '#06b6d4',
  '#ec4899', '#eab308', '#14b8a6', '#6366f1',
]

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
          const color = SCENE_COLORS[i % SCENE_COLORS.length]
          const dur = Math.round(s.durationInFrames / 30)
          return (
            <div key={i} className="vc-scene-block"
              style={{ width: `${pct}%`, background: `${color}20`, borderLeft: `3px solid ${color}` }}
              onClick={() => setExpanded(expanded === i ? null : i)}
              title={`Scene ${i + 1} (${dur}s)`}>
              <span className="vc-scene-block-name" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Code2 size={9} style={{ opacity: 0.6 }} />
                {i + 1}
              </span>
              <span className="vc-scene-block-dur">{dur}s</span>
            </div>
          )
        })}
      </div>
      <div className="vc-scene-meta">{config.scenes.length} scenes · {totalSec}s total</div>
      {expanded !== null && config.scenes[expanded] && (
        <div className="vc-scene-detail">
          <div className="vc-scene-detail-head" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Code2 size={12} style={{ color: SCENE_COLORS[expanded % SCENE_COLORS.length] }} />
            Scene {expanded + 1} · {Math.round(config.scenes[expanded].durationInFrames / 30)}s
          </div>
          <div style={{ fontSize: 10, color: '#71717a', padding: '4px 0' }}>
            {(config.scenes[expanded].from / 30).toFixed(1)}s – {((config.scenes[expanded].from + config.scenes[expanded].durationInFrames) / 30).toFixed(1)}s
          </div>
        </div>
      )}
    </div>
  )
}
