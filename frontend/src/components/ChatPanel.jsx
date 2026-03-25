import { useEffect, useState, useRef, useCallback } from 'react'
import { Send, Loader2, Zap, Film } from 'lucide-react'
import SceneConfigCard from './SceneConfigCard'
import { VoicePicker, LanguagePicker, StylePicker, TemplateShowcase } from './ChatPickers'

/**
 * Render simple markdown: **bold**, `code`, newlines, lists
 */
function renderMarkdown(text) {
  if (!text) return null
  // Split into lines for list detection
  const lines = text.split('\n')
  const elements = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    // Numbered list item: "1. text" or "- text"
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
      // Regular paragraph
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
  // Split by **bold** and `code` markers
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

/**
 * Parse assistant message text into segments:
 * - Plain text (with markdown)
 * - :::scene_config::: → SceneConfigCard
 * - :::voice_picker::: → VoicePicker
 * - :::language_picker::: → LanguagePicker
 * - :::style_picker::: → StylePicker
 * - :::template_showcase[...]:::  → TemplateShowcase
 */
function parseMessage(text) {
  if (!text) return [{ type: 'text', content: '' }]
  const parts = []
  const regex = /:::(scene_config|voice_picker|language_picker|style_picker|template_showcase)(\[.*?\])?:::/g
  let last = 0
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ type: 'text', content: text.slice(last, match.index) })
    }
    const blockType = match[1]
    const blockArg = match[2] // e.g. ["fact_card","narrative"]
    let args = null
    if (blockArg) {
      try { args = JSON.parse(blockArg) } catch {}
    }
    parts.push({ type: blockType, args })
    last = match.index + match[0].length
  }
  if (last < text.length) {
    parts.push({ type: 'text', content: text.slice(last) })
  }
  return parts.length ? parts : [{ type: 'text', content: text }]
}

export default function ChatPanel({ topicId, segment, voices, languages, styles, templates,
                                     sceneConfig, settings, onSceneConfigUpdate, onCustomCodeUpdate,
                                     onSettingsUpdate, onGenerate }) {
  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState('idle')
  const [streamText, setStreamText] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const streamRef = useRef('')
  const evtSourceRef = useRef(null)

  // Close any active SSE stream
  const closeSSE = useCallback(() => {
    if (evtSourceRef.current) {
      evtSourceRef.current.close()
      evtSourceRef.current = null
    }
  }, [])

  // Open SSE stream imperatively — called AFTER POST succeeds
  const openSSEStream = useCallback((cid) => {
    closeSSE()
    const evtSource = new EventSource(`/api/chat/${cid}/stream`)
    evtSourceRef.current = evtSource

    evtSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        switch (data.type) {
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
            evtSource.close()
            evtSourceRef.current = null
            break
        }
      } catch {}
    }

    evtSource.onerror = () => {
      if (streamRef.current) {
        setMessages(prev => [...prev, { role: 'assistant', content: streamRef.current }])
      }
      streamRef.current = ''
      setStreamText('')
      setStatus('idle')
      evtSource.close()
      evtSourceRef.current = null
    }
  }, [onSceneConfigUpdate, onCustomCodeUpdate, onSettingsUpdate, onGenerate, closeSSE])

  // Stable conversation ID per segment — survives page refresh
  useEffect(() => {
    if (!segment) return
    closeSSE()
    const cid = `conv_${topicId}_${segment.id}`
    setConversationId(cid)
    streamRef.current = ''
    setStreamText('')
    setStatus('idle')

    // Try to load existing conversation history
    fetch(`/api/chat/${cid}/history`).then(r => r.json()).then(data => {
      if (data.messages?.length > 0) {
        const msgs = data.messages.filter(m => m.content && !m.content.startsWith('[Started'))
        setMessages(msgs)
        if (data.scene_config) onSceneConfigUpdate(data.scene_config)
        if (data.custom_code && onCustomCodeUpdate) onCustomCodeUpdate(data.custom_code)
      } else {
        setMessages([{
          role: 'assistant',
          content: `I'm ready to help you create a motion video for **"${segment.title}"**.\n\nDescribe what you'd like — the tone, style, specific visuals — or just say "compose scenes" and I'll propose a layout based on the segment content.`
        }])
      }
    }).catch(() => {
      setMessages([{
        role: 'assistant',
        content: `Ready to compose your video. Describe your vision or say "compose scenes" to get started.`
      }])
    })
  }, [segment?.id])

  // Cleanup on unmount
  useEffect(() => () => closeSSE(), [closeSSE])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamText])

  const sendMessageDirect = useCallback(async (cid, text) => {
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
      const data = await resp.json()
      if (data.error) {
        setStatus('idle')
        return
      }
      // POST succeeded — server has set status="thinking" in Redis.
      // NOW open SSE — no race condition.
      openSSEStream(cid)
    } catch {
      setStatus('idle')
    }
  }, [topicId, segment, settings, openSSEStream])

  const sendMessage = useCallback(async (text) => {
    if (status === 'thinking' || !conversationId) return
    if (text) {
      setMessages(prev => [...prev, { role: 'user', content: text }])
    }
    setInput('')
    await sendMessageDirect(conversationId, text)
  }, [conversationId, status, sendMessageDirect])

  const handlePickerSelect = (type, value, label) => {
    if (type === 'voice') sendMessage(`Use voice ${label}`)
    else if (type === 'language') sendMessage(`Set language to ${label}`)
    else if (type === 'style') sendMessage(`Use ${label} style`)
    else if (type === 'template') sendMessage(`Add a ${label} scene`)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (input.trim()) sendMessage(input.trim())
    }
  }

  const renderPart = (part, i) => {
    switch (part.type) {
      case 'scene_config':
        return <SceneConfigCard key={i} config={sceneConfig} />
      case 'voice_picker':
        return <VoicePicker key={i} voices={voices}
          currentVoiceId={settings?.voice_id} onSelect={handlePickerSelect} />
      case 'language_picker':
        return <LanguagePicker key={i} languages={languages}
          currentLang={settings?.language} onSelect={handlePickerSelect} />
      case 'style_picker':
        return <StylePicker key={i} styles={styles}
          currentStyle={settings?.style} onSelect={handlePickerSelect} />
      case 'template_showcase':
        return <TemplateShowcase key={i} templateIds={part.args}
          templates={templates} onSelect={handlePickerSelect} />
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

        {/* Streaming message — only show if there's visible text */}
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
