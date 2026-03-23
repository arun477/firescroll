import { useEffect, useState } from 'react'
import { Key, Check, Trash2, Eye, EyeOff, Loader2, ChevronDown, ChevronRight } from 'lucide-react'

const KEY_CONFIG = {
  openai: { label: 'OpenAI', placeholder: 'sk-...' },
  firecrawl: { label: 'Firecrawl', placeholder: 'fc-...' },
  elevenlabs: { label: 'ElevenLabs', placeholder: 'el-...' },
}

export default function SidebarKeys() {
  const [keys, setKeys] = useState({})
  const [inputs, setInputs] = useState({})
  const [saving, setSaving] = useState(null)
  const [visible, setVisible] = useState({})
  const [expanded, setExpanded] = useState(false)

  const load = () => {
    fetch('/api/settings/keys')
      .then(r => r.json())
      .then(data => {
        setKeys(data)
        const init = {}
        Object.keys(KEY_CONFIG).forEach(k => { init[k] = '' })
        setInputs(init)
      })
      .catch(() => {})
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

  const setCount = Object.values(keys).filter(k => k.is_set).length
  const totalCount = Object.keys(KEY_CONFIG).length

  return (
    <div className="sidebar-keys">
      <button className="sidebar-keys-header" onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Key size={14} />
        <span>API Keys</span>
        <span className="sidebar-keys-count">{setCount}/{totalCount}</span>
      </button>

      {expanded && (
        <div className="sidebar-keys-list">
          {Object.entries(KEY_CONFIG).map(([keyName, config]) => {
            const keyData = keys[keyName] || {}
            const isSet = keyData.is_set

            return (
              <div key={keyName} className="sidebar-key-item">
                <div className="sidebar-key-label">
                  <span>{config.label}</span>
                  {isSet && <span className="sidebar-key-dot" />}
                </div>

                {isSet && (
                  <div className="sidebar-key-value">
                    <span className="sidebar-key-masked">
                      {visible[keyName] ? keyData.masked : '****'}
                    </span>
                    <button className="sidebar-key-action"
                      onClick={() => setVisible(prev => ({ ...prev, [keyName]: !prev[keyName] }))}>
                      {visible[keyName] ? <EyeOff size={10} /> : <Eye size={10} />}
                    </button>
                    <button className="sidebar-key-action sidebar-key-delete"
                      onClick={() => handleDelete(keyName)}>
                      <Trash2 size={10} />
                    </button>
                  </div>
                )}

                <div className="sidebar-key-input-row">
                  <input
                    type="password"
                    placeholder={isSet ? 'Replace...' : config.placeholder}
                    value={inputs[keyName] || ''}
                    onChange={e => setInputs(prev => ({ ...prev, [keyName]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleSave(keyName)}
                    className="sidebar-key-input"
                  />
                  <button
                    className="sidebar-key-save"
                    onClick={() => handleSave(keyName)}
                    disabled={!inputs[keyName]?.trim() || saving === keyName}
                  >
                    {saving === keyName ? <Loader2 size={10} className="spin" /> : <Check size={10} />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
