import { useEffect, useState, useRef, useCallback } from 'react'
import { Send, Loader2, Zap, Film } from 'lucide-react'
import SceneConfigCard from './SceneConfigCard'
import { VoicePicker, LanguagePicker, StylePicker, TemplateShowcase } from './ChatPickers'

/**
 * Render simple markdown: **bold**, `code`, newlines, lists
 */
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
      elements.push(
        <ul key={elements.length} className="vc-md-list">
          {items.map((item, j) => <li key={j}>{inlineFormat(item)}</li>)}
        </ul>
      )
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
  let last = 0
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    if (match[2]) parts.push(<strong key={match.index}>{match[2]}</strong>)
    else if (match[3]) parts.push(<code key={match.index} className="vc-md-code">{match[3]}</code>)
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

// Legacy marker regex — strip from text, pickers are now rendered from structured tool_ui events
const MARKER_REGEX = /:::(scene_config|voice_picker|language_picker|style_picker|template_showcase)(\[.*?\])?:::/g

/**
 * Parse assistant message text into segments.
 * Strips legacy picker markers. Keeps :::scene_config::: for inline scene cards.
 */
function parseMessage(text) {
  if (!text) return [{ type: 'text', content: '' }]
  const parts = []
  const regex = /:::scene_config:::/g
  let last = 0
  let match
  // First strip all non-scene markers
  const cleaned = text.replace(/:::(voice_picker|language_picker|style_picker|template_showcase)(\[.*?\])?:::/g, '')
  while ((match = regex.exec(cleaned)) !== null) {
    if (match.index > last) {
      parts.push({ type: 'text', content: cleaned.slice(last, match.index) })
    }
    parts.push({ type: 'scene_config' })
    last = match.index + match[0].length
  }
  if (last < cleaned.length) {
    parts.push({ type: 'text', content: cleaned.slice(last) })
  }
  return parts.length ? parts : [{ type: 'text', content: cleaned }]
}

/**
 * Tool UI component registry — maps tool component names to React renderers.
 * To add a new interactive tool: add one entry here + create the component.
 */
const TOOL_COMPONENTS = {
  voice_picker: (props, onRespond) => (
    <VoicePicker voices={props.voices} currentVoiceId={props.currentVoiceId || props.current}
      onSelect={(type, value, label) => onRespond({ picker: 'voice', value, label })} />
  ),
  language_picker: (props, onRespond) => (
    <LanguagePicker languages={props.languages} currentLang={props.currentLang || props.current}
      onSelect={(type, value, label) => onRespond({ picker: 'language', value, label })} />
  ),
  style_picker: (props, onRespond) => (
    <StylePicker styles={props.styles} currentStyle={props.currentStyle || props.current}
      onSelect={(type, value, label) => onRespond({ picker: 'style', value, label })} />
  ),
}

export default function ChatPanel({ topicId, segment, voices, languages, styles, templates,
                                     sceneConfig, settings, onSceneConfigUpdate, onCustomCodeUpdate,
                                     onSettingsUpdate, onGenerate }) {
  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState('idle')
  const [streamText, setStreamText] = useState('')
  const [activeTools, setActiveTools] = useState({})     // {tool_id: {component, props, status}}
  const [agentPhase, setAgentPhase] = useState('setup')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const streamRef = useRef('')
  const evtSourceRef = useRef(null)
  const mountedRef = useRef(true)
  const recoveringRef = useRef(false)
  const retryCountRef = useRef(0)
  const lastEventIdRef = useRef('')
  const retryTimerRef = useRef(null)
  const statusRef = useRef('idle')
  const isResumeRef = useRef(false)

  const MAX_RETRIES = 10

  useEffect(() => { statusRef.current = status }, [status])

  const closeSSE = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    if (evtSourceRef.current) {
      evtSourceRef.current.close()
      evtSourceRef.current = null
    }
    recoveringRef.current = false
  }, [])

  // Handle structured tool UI events from SSE
  const handleToolUIEvent = useCallback((data) => {
    if (data.action === 'show') {
      setActiveTools(prev => ({
        ...prev,
        [data.tool_id]: { component: data.component, props: data.props || {}, status: data.status || 'completed' }
      }))
    } else if (data.action === 'dismiss') {
      setActiveTools(prev => {
        const next = { ...prev }
        delete next[data.tool_id]
        return next
      })
    } else if (data.action === 'update') {
      setActiveTools(prev =>
        prev[data.tool_id]
          ? { ...prev, [data.tool_id]: { ...prev[data.tool_id], status: data.status } }
          : prev
      )
    }
  }, [])

  // Stable ref for sendMessageDirect so handleToolResponse can call it without circular deps
  const sendMessageDirectRef = useRef(null)

  // Generic tool response — direct config update via API, notify agent if idle
  const handleToolResponse = useCallback(async (toolId, response) => {
    // Dismiss immediately in local state
    setActiveTools(prev => {
      const next = { ...prev }
      delete next[toolId]
      return next
    })

    try {
      const resp = await fetch(`/api/chat/${conversationId}/tool_response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool_id: toolId, response }),
      })
      const data = await resp.json()
      if (data.settings && onSettingsUpdate) onSettingsUpdate(data.settings)
    } catch (err) {
      console.warn('[ChatPanel] Tool response failed:', err)
    }

    // Notify agent if idle (not currently streaming)
    if (statusRef.current === 'idle' && conversationId && sendMessageDirectRef.current) {
      const label = response.label || response.value
      setMessages(prev => [...prev, { role: 'user', content: `Selected ${response.picker}: ${label}` }])
      setStatus('thinking')
      sendMessageDirectRef.current(conversationId, `[Selected ${response.picker}: ${label}]`)
    }
  }, [conversationId, onSettingsUpdate])

  // Recover full state from history endpoint
  const recoverFromHistory = useCallback((cid) => {
    if (recoveringRef.current) return
    recoveringRef.current = true

    fetch(`/api/chat/${cid}/history`).then(r => r.json()).then(data => {
      if (!mountedRef.current) { recoveringRef.current = false; return }
      if (data.messages?.length) {
        setMessages(data.messages.filter(m => m.content?.trim() && !m.content.startsWith('[Started')))
      }
      if (data.scene_config) onSceneConfigUpdate(data.scene_config)
      if (data.custom_code && onCustomCodeUpdate) onCustomCodeUpdate(data.custom_code)
      if (data.settings && onSettingsUpdate) onSettingsUpdate(data.settings)
      // Restore tool UI state
      if (data.ui_state) {
        setActiveTools(data.ui_state.active_tools || {})
        setAgentPhase(data.ui_state.phase || 'setup')
      }
      if (data.status === 'thinking') {
        if (retryCountRef.current >= MAX_RETRIES) {
          console.warn('[ChatPanel] Max SSE retries reached, giving up')
          setStatus('idle')
          retryCountRef.current = 0
          recoveringRef.current = false
          return
        }
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 8000)
        retryCountRef.current++
        retryTimerRef.current = setTimeout(() => {
          recoveringRef.current = false
          if (mountedRef.current) {
            isResumeRef.current = true
            openSSEStream(cid)
          }
        }, delay)
      } else {
        streamRef.current = ''
        setStreamText('')
        setStatus('idle')
        retryCountRef.current = 0
        recoveringRef.current = false
      }
    }).catch((err) => {
      console.warn('[ChatPanel] Recovery fetch failed:', err)
      if (!mountedRef.current) { recoveringRef.current = false; return }
      if (statusRef.current === 'thinking') {
        if (retryCountRef.current >= MAX_RETRIES) {
          console.warn('[ChatPanel] Max recovery retries reached, giving up')
          setStatus('idle')
          retryCountRef.current = 0
          recoveringRef.current = false
          return
        }
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 8000)
        retryCountRef.current++
        retryTimerRef.current = setTimeout(() => {
          recoveringRef.current = false
          if (mountedRef.current) recoverFromHistory(cid)
        }, delay)
      } else {
        streamRef.current = ''
        setStreamText('')
        setStatus('idle')
        retryCountRef.current = 0
        recoveringRef.current = false
      }
    })
  }, [onSceneConfigUpdate, onCustomCodeUpdate, onSettingsUpdate])

  // Open SSE stream
  const openSSEStream = useCallback((cid) => {
    closeSSE()
    const evtSource = new EventSource(`/api/chat/${cid}/stream`)
    evtSourceRef.current = evtSource
    const isResume = isResumeRef.current
    isResumeRef.current = false

    evtSource.onmessage = (event) => {
      if (!mountedRef.current) { evtSource.close(); return }
      if (event.lastEventId) lastEventIdRef.current = event.lastEventId

      try {
        const data = JSON.parse(event.data)

        switch (data.type) {
          case 'connected':
            retryCountRef.current = 0
            // Server sends full_text with all accumulated chunks — always reset
            if (data.full_text != null) {
              streamRef.current = data.full_text
              setStreamText(data.full_text)
            } else if (isResume) {
              streamRef.current = ''
              setStreamText('')
            }
            break

          case 'text':
            streamRef.current += data.content
            setStreamText(streamRef.current)
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

          // Structured tool UI events from backend
          case 'tool_ui':
            handleToolUIEvent(data)
            break

          case 'phase_change':
            setAgentPhase(data.to || 'setup')
            break

          case 'done':
          case 'error':
          case 'idle':
            if (data.settings && onSettingsUpdate) onSettingsUpdate(data.settings)
            if (streamRef.current) {
              setMessages(prev => [...prev, { role: 'assistant', content: streamRef.current }])
            }
            streamRef.current = ''
            setStreamText('')
            setStatus('idle')
            retryCountRef.current = 0
            lastEventIdRef.current = ''
            evtSource.close()
            evtSourceRef.current = null
            break
        }
      } catch (err) {
        console.warn('[ChatPanel] SSE parse error:', err, event.data?.slice?.(0, 200))
      }
    }

    evtSource.onerror = () => {
      evtSource.close()
      evtSourceRef.current = null
      if (!mountedRef.current) return
      recoverFromHistory(cid)
    }
  }, [onSceneConfigUpdate, onCustomCodeUpdate, onSettingsUpdate, onGenerate, closeSSE, recoverFromHistory, handleToolUIEvent])

  // Stable conversation ID per segment
  useEffect(() => {
    if (!segment) return
    closeSSE()
    recoveringRef.current = false
    retryCountRef.current = 0
    lastEventIdRef.current = ''
    const cid = `conv_${topicId}_${segment.id}`
    setConversationId(cid)
    streamRef.current = ''
    setStreamText('')
    setStatus('idle')
    setActiveTools({})
    setAgentPhase('setup')

    fetch(`/api/chat/${cid}/history`).then(r => r.json()).then(data => {
      if (data.messages?.length > 0) {
        const msgs = data.messages.filter(m => m.content?.trim() && !m.content.startsWith('[Started'))
        setMessages(msgs)
        if (data.scene_config) onSceneConfigUpdate(data.scene_config)
        if (data.custom_code && onCustomCodeUpdate) onCustomCodeUpdate(data.custom_code)
        if (data.settings && onSettingsUpdate) onSettingsUpdate(data.settings)
        // Restore tool UI state
        if (data.ui_state) {
          setActiveTools(data.ui_state.active_tools || {})
          setAgentPhase(data.ui_state.phase || 'setup')
        }
      } else {
        setMessages([{
          role: 'assistant',
          content: `Let's create a motion video for **"${segment.title}"**.\n\nPick a voice and style to get started, or describe your creative vision.`
        }])
      }

      if (data.status === 'thinking') {
        setStatus('thinking')
        openSSEStream(cid)
      }
    }).catch(() => {
      setMessages([{
        role: 'assistant',
        content: `Ready to compose your video. Describe your vision or say "compose scenes" to get started.`
      }])
    })
  }, [segment?.id])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      closeSSE()
    }
  }, [closeSSE])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamText, activeTools])

  const sendMessageDirect = useCallback(async (cid, text) => {
    closeSSE()
    retryCountRef.current = 0
    lastEventIdRef.current = ''
    isResumeRef.current = false

    setStatus('thinking')
    streamRef.current = ''
    setStreamText('')
    try {
      const resp = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: cid,
          message: text,
          topic_id: topicId,
          segment_id: segment?.id || null,
          style: settings?.style || null,
          voice_id: settings?.voice_id || null,
          language: settings?.language || null,
        }),
      })
      if (!mountedRef.current) return
      const data = await resp.json()
      if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠ ${data.error}` }])
        setStatus('idle')
        return
      }
      openSSEStream(cid)
    } catch (err) {
      console.warn('[ChatPanel] Send failed:', err)
      if (mountedRef.current) {
        setMessages(prev => [...prev, { role: 'assistant', content: '⚠ Failed to send message. Check your connection.' }])
        setStatus('idle')
      }
    }
  }, [topicId, segment, settings, openSSEStream, closeSSE])

  // Keep ref in sync so handleToolResponse can call it
  sendMessageDirectRef.current = sendMessageDirect

  const sendMessage = useCallback(async (text) => {
    if (status === 'thinking' || !conversationId) return
    if (text) {
      setMessages(prev => [...prev, { role: 'user', content: text }])
    }
    setInput('')
    await sendMessageDirect(conversationId, text)
  }, [conversationId, status, sendMessageDirect])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (input.trim()) sendMessage(input.trim())
    }
  }

  // Render parts from messages — scene cards inline, picker markers stripped
  const renderPart = (part, i) => {
    switch (part.type) {
      case 'scene_config':
        return <SceneConfigCard key={`sc_${i}`} config={sceneConfig} />
      default:
        return part.content?.trim() ? (
          <div key={i} className="vc-msg-text">{renderMarkdown(part.content.trim())}</div>
        ) : null
    }
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
        {agentPhase && agentPhase !== 'setup' && (
          <span className="vc-badge">{agentPhase}</span>
        )}
        {settings?.style && (
          <span className="vc-badge">{settings.style}</span>
        )}
      </div>

      {/* Messages */}
      <div className="vc-messages">
        {messages.filter(m => m.content?.trim()).map((msg, i) => (
          <div key={i} className={`vc-msg ${msg.role === 'user' ? 'vc-msg-user' : 'vc-msg-assistant'}`}>
            {msg.role === 'assistant'
              ? parseMessage(msg.content).map(renderPart)
              : <p className="vc-msg-text">{msg.content}</p>
            }
          </div>
        ))}

        {/* Streaming message */}
        {streamText?.trim() && (
          <div className="vc-msg vc-msg-assistant">
            {parseMessage(streamText).map(renderPart)}
          </div>
        )}

        {/* Typing indicator */}
        {status === 'thinking' && !streamText && (
          <div className="vc-msg vc-msg-assistant">
            <div className="vc-typing">
              <span /><span /><span />
            </div>
          </div>
        )}

        {/* Stable tool UI zone — components rendered from structured events, not text parsing */}
        {Object.keys(activeTools).length > 0 && (
          <div className="vc-tool-zone">
            {Object.entries(activeTools).map(([toolId, tool]) => {
              const Renderer = TOOL_COMPONENTS[tool.component]
              if (!Renderer) return null
              const mergedProps = {
                ...tool.props,
                voices, languages, styles,
                currentVoiceId: settings?.voice_id,
                currentLang: settings?.language,
                currentStyle: settings?.style,
              }
              return (
                <div key={toolId} className="vc-tool-ui">
                  {Renderer(mergedProps, (response) => handleToolResponse(toolId, response))}
                </div>
              )
            })}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="vc-input-area">
        {sceneConfig?.scenes?.length > 0 && (
          <button className="vc-render-btn" onClick={onGenerate}>
            <Film size={13} /> Render Final Video
          </button>
        )}
        <div className="vc-input-row">
          <textarea ref={inputRef} className="vc-textarea" rows={1}
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={status === 'thinking' ? 'Agent is thinking...' : 'Describe your vision...'}
            disabled={status === 'thinking'} />
          <button className="vc-send-btn"
            onClick={() => input.trim() && sendMessage(input.trim())}
            disabled={!input.trim() || status === 'thinking'}>
            {status === 'thinking'
              ? <Loader2 size={14} className="spin" />
              : <Send size={14} />}
          </button>
        </div>
      </div>
    </>
  )
}
