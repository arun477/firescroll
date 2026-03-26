import { useEffect, useState, useRef, useCallback } from 'react'
import { Send, Loader2, Zap, Film, Mic, Globe, Palette, Check, RotateCcw } from 'lucide-react'
import SceneConfigCard from './SceneConfigCard'
import { VoicePicker, LanguagePicker, StylePicker, TemplateShowcase } from './ChatPickers'

// ── Markdown rendering ──

function renderMarkdown(text) {
  if (!text) return null
  const lines = text.split('\n')
  const elements = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const listMatch = line.match(/^(\d+\.\s+|- )(.*)/)
    if (listMatch) {
      const items = []
      while (i < lines.length) {
        const m = lines[i].match(/^(\d+\.\s+|- )(.*)/)
        if (!m) break
        items.push(m[2])
        i++
      }
      elements.push(<ul key={elements.length} className="vc-md-list">{items.map((item, j) => <li key={j}>{inlineFormat(item)}</li>)}</ul>)
    } else if (line.trim() === '') {
      i++
    } else {
      let para = line
      i++
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].match(/^(\d+\.\s+|- )/)) {
        para += ' ' + lines[i]
        i++
      }
      elements.push(<p key={elements.length} className="vc-md-p">{inlineFormat(para)}</p>)
    }
  }
  return elements
}

function inlineFormat(text) {
  const parts = []
  const regex = /(\*\*(.+?)\*\*|`(.+?)`)/g
  let last = 0, match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    if (match[2]) parts.push(<strong key={match.index}>{match[2]}</strong>)
    else if (match[3]) parts.push(<code key={match.index} className="vc-md-code">{match[3]}</code>)
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

// Strip :::markers::: from text, keep :::scene_config::: for inline cards
function parseMessage(text) {
  if (!text) return [{ type: 'text', content: '' }]
  const cleaned = text.replace(/:::(voice_picker|language_picker|style_picker|template_showcase)(\[.*?\])?:::/g, '')
  const parts = []
  const regex = /:::scene_config:::/g
  let last = 0, match
  while ((match = regex.exec(cleaned)) !== null) {
    if (match.index > last) parts.push({ type: 'text', content: cleaned.slice(last, match.index) })
    parts.push({ type: 'scene_config' })
    last = match.index + match[0].length
  }
  if (last < cleaned.length) parts.push({ type: 'text', content: cleaned.slice(last) })
  return parts.length ? parts : [{ type: 'text', content: cleaned }]
}

// ── Activity Step Component ──

function ActivityCard({ steps }) {
  if (!steps.length) return null
  return (
    <div className="vc-activity-card">
      <div className="vc-activity-header"><Zap size={11} /> Working</div>
      {steps.map(step => (
        <div key={step.id} className={`vc-activity-step ${step.status}`}>
          {step.status === 'running'
            ? <span className="vc-activity-dot" />
            : step.status === 'failed'
              ? <span className="vc-activity-x">✕</span>
              : <Check size={10} className="vc-activity-check" />
          }
          <span className="vc-activity-label">{step.displayMessage}</span>
          {step.resultLabel && <span className="vc-activity-result">{step.resultLabel}</span>}
        </div>
      ))}
    </div>
  )
}

// ── History Activity Card (collapsed, for completed messages) ──

function HistoryActivityCard({ steps }) {
  const [expanded, setExpanded] = useState(false)
  const completed = steps.filter(s => s.status === 'completed').length
  return (
    <div className="vc-activity-history">
      <button className="vc-activity-history-btn" onClick={() => setExpanded(!expanded)}>
        <Zap size={10} />
        <span>{completed} step{completed !== 1 ? 's' : ''} completed</span>
        <span style={{ marginLeft: 'auto', fontSize: 9, opacity: 0.5 }}>{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && steps.map(step => (
        <div key={step.id} className={`vc-activity-step ${step.status}`} style={{ paddingLeft: 8 }}>
          {step.status === 'completed' ? <Check size={10} className="vc-activity-check" /> : <span className="vc-activity-x">✕</span>}
          <span className="vc-activity-label">{step.displayMessage}</span>
        </div>
      ))}
    </div>
  )
}

// ── Picker registry ──

const PICKER_COMPONENTS = {
  voice: (props, onSelect) => <VoicePicker voices={props.voices} currentVoiceId={props.settings?.voice_id} onSelect={onSelect} />,
  language: (props, onSelect) => <LanguagePicker languages={props.languages} currentLang={props.settings?.language} onSelect={onSelect} />,
  style: (props, onSelect) => <StylePicker styles={props.styles} currentStyle={props.settings?.style} onSelect={onSelect} />,
}

// ── Main ChatPanel ──

export default function ChatPanel({ topicId, segment, voices, languages, styles, templates,
                                     sceneConfig, settings, onSceneConfigUpdate, onCustomCodeUpdate,
                                     onSettingsUpdate, onGenerate }) {
  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState('idle')
  const [displayedContent, setDisplayedContent] = useState('')
  const [activitySteps, setActivitySteps] = useState([])
  const activityStepsRef = useRef([])
  const [activePicker, setActivePicker] = useState(null)  // 'voice' | 'language' | 'style' | null

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const streamRef = useRef('')              // Raw accumulated text from SSE
  const displayedLenRef = useRef(0)         // How many chars the typewriter has revealed
  const rafRef = useRef(null)               // requestAnimationFrame handle
  const evtSourceRef = useRef(null)
  const mountedRef = useRef(true)
  const recoveringRef = useRef(false)
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef(null)
  const statusRef = useRef('idle')
  const isResumeRef = useRef(false)
  const settledRef = useRef(false)          // settle() idempotency guard

  const MAX_RETRIES = 10

  useEffect(() => { statusRef.current = status }, [status])
  useEffect(() => { activityStepsRef.current = activitySteps }, [activitySteps])

  // ── Typewriter ──

  const startTypewriter = useCallback(() => {
    if (rafRef.current) return
    const tick = () => {
      const raw = streamRef.current
      const revealed = displayedLenRef.current
      if (revealed >= raw.length) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      const remaining = raw.length - revealed
      const chars = remaining > 200 ? 12 : remaining > 80 ? 6 : remaining > 20 ? 3 : 1
      displayedLenRef.current = Math.min(revealed + chars, raw.length)
      setDisplayedContent(raw.slice(0, displayedLenRef.current))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const stopTypewriter = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
  }, [])

  // ── settle() — idempotent finalization (Salt pattern) ──

  const settle = useCallback((extraSettings) => {
    if (settledRef.current) return
    settledRef.current = true
    stopTypewriter()

    if (extraSettings && onSettingsUpdate) onSettingsUpdate(extraSettings)

    const finalText = streamRef.current
    const steps = [...(activityStepsRef.current || [])]
    if (finalText?.trim() || steps.length) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: finalText || '',
        tool_steps: steps.length ? steps : undefined,  // Persist for history
      }])
    }
    streamRef.current = ''
    displayedLenRef.current = 0
    setDisplayedContent('')
    setActivitySteps([])
    retryCountRef.current = 0

    if (evtSourceRef.current) {
      evtSourceRef.current.close()
      evtSourceRef.current = null
    }

    setStatus('idle')
  }, [onSettingsUpdate, stopTypewriter])

  // ── SSE ──

  const closeSSE = useCallback(() => {
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null }
    if (evtSourceRef.current) { evtSourceRef.current.close(); evtSourceRef.current = null }
    recoveringRef.current = false
  }, [])

  const recoverFromHistory = useCallback((cid) => {
    if (recoveringRef.current) return
    recoveringRef.current = true
    fetch(`/api/chat/${cid}/history`).then(r => r.json()).then(data => {
      if (!mountedRef.current) { recoveringRef.current = false; return }
      if (data.messages?.length) setMessages(data.messages.filter(m => (m.content?.trim() || m.tool_steps?.length) && !m.content?.startsWith('[Started')))
      if (data.scene_config) onSceneConfigUpdate(data.scene_config)
      if (data.custom_code && onCustomCodeUpdate) onCustomCodeUpdate(data.custom_code)
      if (data.settings && onSettingsUpdate) onSettingsUpdate(data.settings)
      if (data.status === 'thinking') {
        if (retryCountRef.current >= MAX_RETRIES) { setStatus('idle'); recoveringRef.current = false; return }
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 8000)
        retryCountRef.current++
        retryTimerRef.current = setTimeout(() => {
          recoveringRef.current = false
          if (mountedRef.current) { isResumeRef.current = true; openSSEStream(cid) }
        }, delay)
      } else {
        streamRef.current = ''; displayedLenRef.current = 0; setDisplayedContent('')
        setStatus('idle'); recoveringRef.current = false
      }
    }).catch(() => {
      if (statusRef.current === 'thinking' && retryCountRef.current < MAX_RETRIES) {
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 8000)
        retryCountRef.current++
        retryTimerRef.current = setTimeout(() => { recoveringRef.current = false; if (mountedRef.current) recoverFromHistory(cid) }, delay)
      } else {
        setStatus('idle'); recoveringRef.current = false
      }
    })
  }, [onSceneConfigUpdate, onCustomCodeUpdate, onSettingsUpdate])

  const openSSEStream = useCallback((cid) => {
    closeSSE()
    settledRef.current = false
    const evtSource = new EventSource(`/api/chat/${cid}/stream`)
    evtSourceRef.current = evtSource

    evtSource.onmessage = (event) => {
      if (!mountedRef.current) { evtSource.close(); return }
      try {
        const data = JSON.parse(event.data)
        switch (data.type) {
          case 'connected':
            retryCountRef.current = 0
            break

          case 'text':
            streamRef.current += data.content
            startTypewriter()
            break

          case 'scene_config':
            if (data.config) onSceneConfigUpdate(data.config)
            break

          case 'custom_code':
            if (data.code && onCustomCodeUpdate) onCustomCodeUpdate(data.code)
            break

          case 'render_requested':
            if (onGenerate) onGenerate()
            break

          // Tool activity events from agent
          case 'tool_call':
            setActivitySteps(prev => [...prev, {
              id: data.call_id || `tc_${Date.now()}`,
              tool: data.tool, displayMessage: data.display || data.tool,
              status: 'running', resultLabel: null,
            }])
            break

          case 'tool_result':
            setActivitySteps(prev => prev.map(s =>
              (s.id === data.call_id || (s.tool === data.tool && s.status === 'running'))
                ? { ...s, status: data.status || 'completed', resultLabel: data.label }
                : s
            ))
            break

          case 'done':
          case 'error':
          case 'idle':
            settle(data.settings)
            break
        }
      } catch (err) {
        console.warn('[ChatPanel] SSE parse error:', err)
      }
    }

    evtSource.onerror = () => {
      evtSource.close()
      evtSourceRef.current = null
      if (!mountedRef.current) return
      recoverFromHistory(cid)
    }
  }, [onSceneConfigUpdate, onCustomCodeUpdate, onSettingsUpdate, onGenerate, closeSSE, recoverFromHistory, startTypewriter, settle])

  // ── Segment init ──

  useEffect(() => {
    if (!segment) return
    closeSSE()
    stopTypewriter()
    settledRef.current = false
    recoveringRef.current = false
    retryCountRef.current = 0
    const cid = `conv_${topicId}_${segment.id}`
    setConversationId(cid)
    streamRef.current = ''
    displayedLenRef.current = 0
    setDisplayedContent('')
    setStatus('idle')
    setActivitySteps([])
    setActivePicker(null)

    fetch(`/api/chat/${cid}/history`).then(r => r.json()).then(data => {
      if (data.messages?.length > 0) {
        setMessages(data.messages.filter(m => (m.content?.trim() || m.tool_steps?.length) && !m.content?.startsWith('[Started')))
        if (data.scene_config) onSceneConfigUpdate(data.scene_config)
        if (data.custom_code && onCustomCodeUpdate) onCustomCodeUpdate(data.custom_code)
        if (data.settings && onSettingsUpdate) onSettingsUpdate(data.settings)
      } else {
        setMessages([{
          role: 'assistant',
          content: `Let's create a motion video for **"${segment.title}"**.\n\nDescribe your vision, pick a voice, or say "compose" to get started.`
        }])
      }
      if (data.status === 'thinking') { setStatus('thinking'); openSSEStream(cid) }
    }).catch(() => {
      setMessages([{ role: 'assistant', content: 'Ready to compose your video.' }])
    })
  }, [segment?.id])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false; closeSSE(); stopTypewriter() }
  }, [closeSSE, stopTypewriter])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, displayedContent, activitySteps])

  // ── Send ──

  const sendMessage = useCallback(async (text) => {
    if (status === 'thinking' || !conversationId) return
    if (text) setMessages(prev => [...prev, { role: 'user', content: text }])
    setInput('')
    closeSSE()
    stopTypewriter()
    settledRef.current = false
    retryCountRef.current = 0
    streamRef.current = ''
    displayedLenRef.current = 0
    setDisplayedContent('')
    setActivitySteps([])
    setStatus('thinking')
    setActivePicker(null)

    try {
      const resp = await fetch('/api/chat/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId, message: text, topic_id: topicId,
          segment_id: segment?.id || null, style: settings?.style || null,
          voice_id: settings?.voice_id || null, language: settings?.language || null,
        }),
      })
      if (!mountedRef.current) return
      const data = await resp.json()
      if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠ ${data.error}` }])
        setStatus('idle')
        return
      }
      openSSEStream(conversationId)
    } catch {
      if (mountedRef.current) {
        setMessages(prev => [...prev, { role: 'assistant', content: '⚠ Failed to send.' }])
        setStatus('idle')
      }
    }
  }, [conversationId, status, topicId, segment, settings, openSSEStream, closeSSE, stopTypewriter])

  // ── Picker selection → direct API + notify agent ──

  const handlePickerSelect = useCallback(async (type, value, label) => {
    setActivePicker(null)
    const pickerLabel = { voice: 'Voice', language: 'Language', style: 'Style' }[type] || type
    // Direct config update
    try {
      const resp = await fetch(`/api/chat/${conversationId}/select`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ picker: type, value, label }),
      })
      const data = await resp.json()
      if (data.settings && onSettingsUpdate) onSettingsUpdate(data.settings)
    } catch {}
    // Notify agent
    sendMessage(`${pickerLabel}: ${label}`)
  }, [conversationId, onSettingsUpdate, sendMessage])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (input.trim()) sendMessage(input.trim()) }
  }

  const resetConversation = useCallback(async () => {
    if (!conversationId) return
    closeSSE()
    stopTypewriter()
    try { await fetch(`/api/chat/${conversationId}`, { method: 'DELETE' }) } catch {}
    streamRef.current = ''
    displayedLenRef.current = 0
    setDisplayedContent('')
    setActivitySteps([])
    setActivePicker(null)
    settledRef.current = false
    setStatus('idle')
    setMessages([{
      role: 'assistant',
      content: `Let's start fresh for **"${segment?.title}"**.\n\nDescribe your vision, pick a voice, or say "compose" to get started.`
    }])
    if (onSceneConfigUpdate) onSceneConfigUpdate(null)
    if (onCustomCodeUpdate) onCustomCodeUpdate(null)
  }, [conversationId, segment, closeSSE, stopTypewriter, onSceneConfigUpdate, onCustomCodeUpdate])

  const renderPart = (part, i) => {
    if (part.type === 'scene_config') return <SceneConfigCard key={`sc_${i}`} config={sceneConfig} />
    return part.content?.trim() ? <div key={i} className="vc-msg-text">{renderMarkdown(part.content.trim())}</div> : null
  }

  return (
    <>
      {/* Header */}
      <div className="ve-left-head">
        <svg width="14" height="14" viewBox="0 0 64 64" fill="none" style={{ flexShrink: 0 }}>
          <defs><linearGradient id="cd" x1="0%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stopColor="#ef4444"/><stop offset="50%" stopColor="#f97316"/><stop offset="100%" stopColor="#fbbf24"/>
          </linearGradient></defs>
          <path d="M32 4C24 16,14 22,14 36c0,11,8,20,18,20s18-9,18-20c0-8-5-15-10-20c0,10-5,15-8,15s-5-5-2-15z" fill="url(#cd)"/>
        </svg>
        <span className="ve-left-label" style={{ textTransform: 'none', letterSpacing: '-0.1px', fontSize: 12, fontWeight: 700, color: '#a1a1aa', flex: 1 }}>
          Motion Director
        </span>
        {settings?.style && <span className="vc-badge">{settings.style}</span>}
        <button className="vc-reset-btn" onClick={resetConversation} title="Reset conversation">
          <RotateCcw size={12} />
        </button>
      </div>

      {/* Messages */}
      <div className="vc-messages">
        {messages.filter(m => m.content?.trim() || m.tool_steps?.length).map((msg, i) => (
          <div key={i} className={`vc-msg ${msg.role === 'user' ? 'vc-msg-user' : 'vc-msg-assistant'}`}>
            {msg.tool_steps?.length > 0 && (
              <HistoryActivityCard steps={msg.tool_steps} />
            )}
            {msg.role === 'assistant' && msg.content?.trim()
              ? parseMessage(msg.content).map(renderPart)
              : msg.role === 'user' ? <p className="vc-msg-text">{msg.content}</p> : null
            }
          </div>
        ))}

        {/* Activity card — shows tool steps */}
        <ActivityCard steps={activitySteps} />

        {/* Streaming text with typewriter */}
        {displayedContent?.trim() && (
          <div className="vc-msg vc-msg-assistant">
            {parseMessage(displayedContent).map(renderPart)}
            <span className="vc-cursor" />
          </div>
        )}

        {/* Thinking indicator */}
        {status === 'thinking' && !displayedContent && activitySteps.length === 0 && (
          <div className="vc-msg vc-msg-assistant">
            <div className="vc-typing"><span /><span /><span /></div>
          </div>
        )}

        {/* Active picker */}
        {activePicker && PICKER_COMPONENTS[activePicker] && (
          <div className="vc-msg vc-msg-assistant vc-picker-zone">
            {PICKER_COMPONENTS[activePicker]({ voices, languages, styles, settings }, handlePickerSelect)}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="vc-input-area">
        <div className="vc-quick-actions">
          <button className={`vc-quick-btn ${activePicker === 'voice' ? 'vc-quick-active' : ''}`}
            onClick={() => setActivePicker(activePicker === 'voice' ? null : 'voice')}><Mic size={12} /> Voice</button>
          <button className={`vc-quick-btn ${activePicker === 'language' ? 'vc-quick-active' : ''}`}
            onClick={() => setActivePicker(activePicker === 'language' ? null : 'language')}><Globe size={12} /> Language</button>
          <button className={`vc-quick-btn ${activePicker === 'style' ? 'vc-quick-active' : ''}`}
            onClick={() => setActivePicker(activePicker === 'style' ? null : 'style')}><Palette size={12} /> Style</button>
          {sceneConfig?.scenes?.length > 0 && (
            <button className="vc-quick-btn vc-quick-render" onClick={onGenerate}><Film size={12} /> Render</button>
          )}
        </div>
        <div className="vc-input-row">
          <textarea ref={inputRef} className="vc-textarea" rows={1}
            value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={status === 'thinking' ? 'Agent is working...' : 'Describe your vision...'}
            disabled={status === 'thinking'} />
          <button className="vc-send-btn" onClick={() => input.trim() && sendMessage(input.trim())}
            disabled={!input.trim() || status === 'thinking'}>
            {status === 'thinking' ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
          </button>
        </div>
      </div>
    </>
  )
}
