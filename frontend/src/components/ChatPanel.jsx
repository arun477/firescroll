import { useEffect, useState, useRef, useCallback } from 'react'
import { Send, Loader2, Zap, Film } from 'lucide-react'
import SceneConfigCard from './SceneConfigCard'
import { VoicePicker, LanguagePicker, StylePicker, TemplateShowcase } from './ChatPickers'

/**
 * Parse assistant message text into segments:
 * - Plain text
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
                                     sceneConfig, settings, onSceneConfigUpdate, onGenerate }) {
  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState('idle')
  const [streamText, setStreamText] = useState('')
  const [chunkOffset, setChunkOffset] = useState(0)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const pollRef = useRef(null)

  // Stable conversation ID per segment — survives page refresh
  useEffect(() => {
    if (!segment) return
    const cid = `conv_${topicId}_${segment.id}`
    setConversationId(cid)
    setStreamText('')
    setChunkOffset(0)
    setStatus('idle')

    // Try to load existing conversation history
    fetch(`/api/chat/${cid}/history`).then(r => r.json()).then(data => {
      if (data.messages?.length > 0) {
        // Filter out system init messages
        const msgs = data.messages.filter(m => m.content && !m.content.startsWith('[Started'))
        setMessages(msgs)
        if (data.scene_config) onSceneConfigUpdate(data.scene_config)
      } else {
        // New conversation — send init message
        setMessages([])
        sendMessageDirect(cid, '')
      }
    }).catch(() => {
      setMessages([])
      sendMessageDirect(cid, '')
    })
  }, [segment?.id])

  // Poll for response chunks
  useEffect(() => {
    if (status !== 'thinking' || !conversationId) return
    const poll = async () => {
      try {
        const res = await fetch(`/api/chat/${conversationId}/poll?offset=${chunkOffset}`)
        const data = await res.json()

        if (data.chunks?.length) {
          setStreamText(prev => prev + data.chunks.join(''))
          setChunkOffset(data.total_chunks)
        }

        if (data.scene_config) {
          onSceneConfigUpdate(data.scene_config)
        }

        // Agent requested a render via trigger_render tool
        if (data.render_requested && onGenerate) {
          onGenerate()
        }

        if (data.status === 'done' || data.status === 'error') {
          // Finalize the streaming message
          const finalText = streamText + (data.chunks || []).join('')
          if (finalText) {
            setMessages(prev => [...prev, { role: 'assistant', content: finalText }])
          }
          setStreamText('')
          setChunkOffset(0)
          setStatus('idle')
        }
      } catch {}
    }
    pollRef.current = setInterval(poll, 1500)
    // Do first poll immediately
    poll()
    return () => clearInterval(pollRef.current)
  }, [status, conversationId, chunkOffset])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamText])

  const sendMessageDirect = useCallback(async (cid, text) => {
    // Low-level send — used for init and when conversationId isn't in state yet
    setStatus('thinking')
    setStreamText('')
    setChunkOffset(0)
    try {
      await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: cid,
          message: text,
          topic_id: topicId,
          segment_id: segment?.id || null,
        }),
      })
    } catch {
      setStatus('idle')
    }
  }, [topicId, segment])

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
        return part.content ? (
          <p key={i} className="vc-msg-text">{part.content}</p>
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
        {messages.map((msg, i) => (
          <div key={i} className={`vc-msg ${msg.role === 'user' ? 'vc-msg-user' : 'vc-msg-assistant'}`}>
            {msg.role === 'assistant'
              ? parseMessage(msg.content).map(renderPart)
              : <p className="vc-msg-text">{msg.content}</p>
            }
          </div>
        ))}

        {/* Streaming message */}
        {streamText && (
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
