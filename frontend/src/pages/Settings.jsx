import { useEffect, useState } from 'react'
import { Check, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react'

const KEY_CONFIG = [
  {
    key: 'openai',
    label: 'OpenAI',
    placeholder: 'sk-...',
    desc: 'Powers AI research synthesis and script generation',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.28 9.37a5.83 5.83 0 0 0-.5-4.79 5.9 5.9 0 0 0-6.36-2.83A5.85 5.85 0 0 0 11.04 0a5.9 5.9 0 0 0-5.62 4.07 5.83 5.83 0 0 0-3.9 2.83 5.9 5.9 0 0 0 .73 6.9 5.83 5.83 0 0 0 .5 4.8 5.9 5.9 0 0 0 6.36 2.82A5.85 5.85 0 0 0 13.5 24a5.9 5.9 0 0 0 5.62-4.07 5.83 5.83 0 0 0 3.9-2.83 5.9 5.9 0 0 0-.73-6.9zM13.5 22.3a4.38 4.38 0 0 1-2.82-1.02l.14-.08 4.68-2.7a.76.76 0 0 0 .38-.66v-6.6l1.98 1.14a.07.07 0 0 1 .04.05v5.47a4.4 4.4 0 0 1-4.4 4.4zM3.65 18.22a4.38 4.38 0 0 1-.52-2.94l.14.08 4.68 2.7a.76.76 0 0 0 .76 0l5.72-3.3v2.28a.07.07 0 0 1-.03.06l-4.74 2.74a4.4 4.4 0 0 1-6.01-1.61zM2.34 7.89A4.38 4.38 0 0 1 4.63 5.96v5.56a.76.76 0 0 0 .38.66l5.72 3.3-1.98 1.14a.07.07 0 0 1-.07 0L3.94 13.9a4.4 4.4 0 0 1-1.6-6.01zm16.42 3.82L13.04 8.4l1.98-1.14a.07.07 0 0 1 .07 0l4.74 2.74a4.4 4.4 0 0 1-.68 7.93v-5.56a.76.76 0 0 0-.38-.66zm1.97-2.96-.14-.08-4.68-2.7a.76.76 0 0 0-.76 0l-5.72 3.3V6.99a.07.07 0 0 1 .03-.06l4.74-2.74a4.4 4.4 0 0 1 6.53 4.56zM8.08 13.18l-1.98-1.14a.07.07 0 0 1-.04-.05V6.52a4.4 4.4 0 0 1 7.22-3.38l-.14.08-4.68 2.7a.76.76 0 0 0-.38.66zm1.08-2.33 2.54-1.47 2.54 1.47v2.93l-2.54 1.47-2.54-1.47z"/>
      </svg>
    ),
  },
  {
    key: 'elevenlabs',
    label: 'ElevenLabs',
    placeholder: 'el-...',
    desc: 'Ultra-realistic voices, AI music, and sound effects',
    icon: (
      <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
        <rect x="8" y="4" width="4.5" height="24" rx="2.25" fill="currentColor"/>
        <rect x="19.5" y="4" width="4.5" height="24" rx="2.25" fill="currentColor"/>
      </svg>
    ),
  },
  {
    key: 'firecrawl',
    label: 'Firecrawl',
    placeholder: 'fc-...',
    desc: 'Web search, scraping, crawling, and extraction',
    icon: (
      <svg width="18" height="18" viewBox="0 0 50 72" fill="currentColor">
        <path d="M41.7 23.2c-2.8.8-4.8 2.7-6.4 4.7-.3.4-1 .1-.9-.4 2.9-12 -.9-22-12.9-26.9-.6-.3-1.2.2-1.1.8 5.5 22-17.5 20.1-14.6 45 .1.4-.4.7-.7.5-1.1-.8-2.3-2.4-3.2-3.6-.2-.3-.8-.2-.9.2-.7 2.4-1 4.7-1 6.9 0 8.7 4.5 16.5 11.3 20.9.4.3.9-.1.8-.5-.4-1.2-.5-2.4-.5-3.7 0-.8 0-1.6.2-2.3.3-1.9.9-3.7 2-5.3 3.8-5.7 11.4-11.1 10.2-18.6-.1-.5.5-.8.8-.5 5.3 4.9 6.4 11.4 5.5 17.3-.1.5.5.8.8.4.8-1 1.8-1.9 2.9-2.6.3-.2.6-.1.7.2.6 1.8 1.5 3.4 2.3 5.1 1 2 1.6 4.2 1.5 6.6 0 1.2-.2 2.3-.5 3.4-.1.5.4.8.8.6C45.5 67 50 59.2 50 50.5c0-3-.5-6.1-1.5-8.8-2.1-5.9-7.5-10.3-6.1-17.9.1-.4-.3-.7-.7-.6z"/>
      </svg>
    ),
  },
]

export default function Settings() {
  const [keys, setKeys] = useState({})
  const [inputs, setInputs] = useState({})
  const [saving, setSaving] = useState(null)
  const [visible, setVisible] = useState({})

  const load = () => {
    fetch('/api/settings/keys')
      .then(r => r.json())
      .then(data => {
        setKeys(data)
        const init = {}
        KEY_CONFIG.forEach(k => { init[k.key] = '' })
        setInputs(init)
      })
  }

  useEffect(() => { load() }, [])

  const handleSave = async (keyName) => {
    if (!inputs[keyName]?.trim()) return
    setSaving(keyName)
    await fetch('/api/settings/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key_name: keyName, key_value: inputs[keyName].trim() }),
    })
    setSaving(null)
    setInputs(prev => ({ ...prev, [keyName]: '' }))
    load()
  }

  const handleDelete = async (keyName) => {
    await fetch(`/api/settings/keys/${keyName}`, { method: 'DELETE' })
    load()
  }

  return (
    <>
      <div className="keys-header">
        <h1>API Keys</h1>
        <span className="keys-sub">Bring your own keys to power the full pipeline.</span>
      </div>

      <div className="keys-page">

        <div className="keys-grid">
          {KEY_CONFIG.map(config => {
            const keyData = keys[config.key] || {}
            const isSet = keyData.is_set

            return (
              <div key={config.key} className={`key-card ${isSet ? 'key-card-connected' : ''}`}>
                <div className="key-card-header">
                  <div className="key-card-icon">{config.icon}</div>
                  <div className="key-card-title">
                    <span className="key-card-name">{config.label}</span>
                    <span className="key-card-desc">{config.desc}</span>
                  </div>
                  {isSet && (
                    <div className="key-card-status">
                      <div className="key-card-dot" />
                      Connected
                    </div>
                  )}
                </div>

                {isSet && (
                  <div className="key-card-masked">
                    <code>
                      {visible[config.key] ? keyData.masked : keyData.masked?.replace(/[^.]/g, '*')}
                    </code>
                    <button className="key-card-action" onClick={() => setVisible(p => ({ ...p, [config.key]: !p[config.key] }))}>
                      {visible[config.key] ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <button className="key-card-action key-card-delete" onClick={() => handleDelete(config.key)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}

                <div className="key-card-input-row">
                  <input
                    type="password"
                    placeholder={isSet ? 'Replace key...' : config.placeholder}
                    value={inputs[config.key] || ''}
                    onChange={e => setInputs(prev => ({ ...prev, [config.key]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleSave(config.key)}
                    className="key-card-input"
                  />
                  <button
                    className="key-card-save"
                    onClick={() => handleSave(config.key)}
                    disabled={!inputs[config.key]?.trim() || saving === config.key}
                  >
                    {saving === config.key ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
