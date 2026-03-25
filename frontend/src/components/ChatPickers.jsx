/**
 * Interactive picker components rendered inline in chat messages.
 * When user clicks an option, onSelect(type, value, label) is called
 * which sends an auto-message in the chat.
 */

export function VoicePicker({ voices, currentVoiceId, onSelect }) {
  if (!voices?.length) return <div className="vc-picker-empty">Loading voices...</div>
  return (
    <div className="vc-picker">
      <div className="vc-picker-grid">
        {voices.map(v => (
          <button key={v.id}
            className={`vc-picker-btn ${currentVoiceId === v.id ? 'vc-picker-active' : ''}`}
            onClick={() => onSelect('voice', v.id, v.name)}>
            <span className="vc-picker-btn-name">{v.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function LanguagePicker({ languages, currentLang, onSelect }) {
  if (!languages?.length) return null
  return (
    <div className="vc-picker">
      <div className="vc-picker-grid">
        <button className={`vc-picker-btn ${!currentLang || currentLang === 'en' ? 'vc-picker-active' : ''}`}
          onClick={() => onSelect('language', 'en', 'English')}>
          English
        </button>
        {languages.filter(l => l.code !== 'en').map(l => (
          <button key={l.code}
            className={`vc-picker-btn ${currentLang === l.code ? 'vc-picker-active' : ''}`}
            onClick={() => onSelect('language', l.code, l.name)}>
            {l.name}
          </button>
        ))}
      </div>
    </div>
  )
}

export function StylePicker({ styles, currentStyle, onSelect }) {
  if (!styles?.length) return null
  return (
    <div className="vc-picker">
      <div className="vc-picker-grid">
        {styles.map(s => (
          <button key={s.id}
            className={`vc-picker-btn ${currentStyle === s.id ? 'vc-picker-active' : ''}`}
            onClick={() => onSelect('style', s.id, s.name)}
            title={s.description}>
            {s.name}
          </button>
        ))}
      </div>
    </div>
  )
}

export function TemplateShowcase({ templateIds, templates, onSelect }) {
  if (!templateIds?.length || !templates?.length) return null
  const shown = templates.filter(t => templateIds.includes(t.id))
  return (
    <div className="vc-picker">
      <div className="vc-picker-grid vc-picker-grid-wide">
        {shown.map(t => (
          <button key={t.id} className="vc-picker-card"
            onClick={() => onSelect('template', t.id, t.name)}>
            <span className="vc-picker-card-name">{t.name}</span>
            <span className="vc-picker-card-desc">{t.description}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
