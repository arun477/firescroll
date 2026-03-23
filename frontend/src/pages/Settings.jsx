import { useEffect, useState } from 'react'
import { Key, Check, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react'

const KEY_CONFIG = {
  openai: { label: 'OpenAI', placeholder: 'sk-...' },
  firecrawl: { label: 'Firecrawl', placeholder: 'fc-...' },
  elevenlabs: { label: 'ElevenLabs', placeholder: 'el-...' },
}

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
        Object.keys(KEY_CONFIG).forEach(k => { init[k] = '' })
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

  const toggleVisibility = (keyName) => {
    setVisible(prev => ({ ...prev, [keyName]: !prev[keyName] }))
  }

  return (
    <>
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      <div style={{ maxWidth: 560 }}>
        <div className="card">
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: 20, paddingBottom: 16,
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            <Key size={18} style={{ opacity: 0.5 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
              API Keys
            </span>
          </div>

          {Object.entries(KEY_CONFIG).map(([keyName, config]) => {
            const keyData = keys[keyName] || {}
            const isSet = keyData.is_set

            return (
              <div key={keyName} className="key-row" style={{
                marginBottom: 20,
                paddingBottom: 20,
                borderBottom: '1px solid var(--border-subtle)',
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: 8,
                }}>
                  <label style={{
                    fontSize: 13, fontWeight: 600, color: 'var(--text)',
                  }}>
                    {config.label}
                  </label>
                  {isSet && (
                    <span className="status status-done" style={{ fontSize: 10 }}>
                      Connected
                    </span>
                  )}
                </div>

                {isSet && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginBottom: 10, padding: '8px 12px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 8, fontSize: 13,
                    fontFamily: 'monospace', color: 'var(--text-muted)',
                  }}>
                    <span style={{ flex: 1 }}>
                      {visible[keyName] ? keyData.masked : keyData.masked?.replace(/[^.]/g, '*')}
                    </span>
                    <button
                      className="btn-ghost"
                      onClick={() => toggleVisibility(keyName)}
                      style={{
                        background: 'none', border: 'none',
                        color: 'var(--text-muted)', cursor: 'pointer', padding: 4,
                      }}
                    >
                      {visible[keyName] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      onClick={() => handleDelete(keyName)}
                      style={{
                        background: 'none', border: 'none',
                        color: 'var(--accent)', cursor: 'pointer', padding: 4,
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="password"
                    placeholder={isSet ? 'Replace key...' : config.placeholder}
                    value={inputs[keyName] || ''}
                    onChange={e => setInputs(prev => ({ ...prev, [keyName]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleSave(keyName)}
                    style={{
                      flex: 1, padding: '9px 12px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid var(--border)',
                      borderRadius: 8, color: 'var(--text)',
                      fontSize: 13, fontFamily: 'monospace', outline: 'none',
                    }}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleSave(keyName)}
                    disabled={!inputs[keyName]?.trim() || saving === keyName}
                  >
                    {saving === keyName ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
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
