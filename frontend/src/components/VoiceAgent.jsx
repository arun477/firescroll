import { useState, useCallback, useEffect, useRef } from 'react'
import { useConversation } from '@11labs/react'

const AGENT_ID = 'agent_6801kmn5wtv6fcp8nd29cv923067'

export default function VoiceAgent({ onClose, onTopicCreated }) {
  const [error, setError] = useState(null)
  const [topicCreated, setTopicCreated] = useState(null)
  const [messages, setMessages] = useState([])
  const [status, setStatus] = useState(null)
  const messagesRef = useRef(null)

  const conversation = useConversation({
    onError: (err) => setError(err.message || 'Connection failed'),
    onMessage: (msg) => {
      if (msg?.source === 'ai' && msg.message) {
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (last?.role === 'agent') {
            return [...prev.slice(0, -1), { role: 'agent', text: msg.message }]
          }
          return [...prev, { role: 'agent', text: msg.message }]
        })
      }
      if (msg?.source === 'user' && msg.message) {
        setMessages(prev => [...prev, { role: 'user', text: msg.message }])
      }
      // Detect tool call
      if (msg?.tool_call?.tool_name === 'create_topic') {
        const params = msg.tool_call?.parameters || {}
        setTopicCreated({
          topic: params.topic || 'your topic',
          topicId: null,
          phase: 'creating'
        })
      }
      // Detect tool result
      if (msg?.tool_call_result) {
        try {
          const result = typeof msg.tool_call_result === 'string'
            ? JSON.parse(msg.tool_call_result) : msg.tool_call_result
          if (result?.topic_id) {
            setTopicCreated(prev => prev ? { ...prev, topicId: result.topic_id, phase: 'researching' } : prev)
            // Start polling status
            pollStatus(result.topic_id)
          }
        } catch {}
      }
    },
  })

  const { status: connStatus, isSpeaking } = conversation
  const connected = connStatus === 'connected'

  // Poll topic status
  const pollRef = useRef(null)
  const pollStatus = useCallback((topicId) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/topics/${topicId}`)
        const data = await res.json()
        if (!data.topic) return
        const t = data.topic
        const segments = data.segments || []
        const jobs = data.jobs || []
        const ready = segments.filter(s => s.status === 'ready').length
        const total = segments.length
        const videoDone = jobs.filter(j => j.status === 'done').length
        const videoActive = jobs.filter(j => !['done', 'failed'].includes(j.status) && j.status).length

        setStatus({
          research: t.research_status,
          segmentsReady: ready,
          segmentsTotal: total,
          videosDone: videoDone,
          videosActive: videoActive,
        })

        if (t.research_status === 'done') {
          setTopicCreated(prev => prev ? { ...prev, phase: 'generating' } : prev)
        }
        if (videoDone > 0) {
          setTopicCreated(prev => prev ? { ...prev, phase: 'done' } : prev)
          clearInterval(pollRef.current)
          setTimeout(() => onTopicCreated?.(), 2000)
        }
      } catch {}
    }, 3000)
  }, [onTopicCreated])

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  // Auto-scroll messages
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [messages])

  // Auto-start
  useEffect(() => {
    let cancelled = false
    const autoStart = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true })
        if (!cancelled) await conversation.startSession({ agentId: AGENT_ID })
      } catch (e) {
        if (!cancelled) setError(e.message?.includes('Permission')
          ? 'Microphone access denied' : e.message || 'Failed to connect')
      }
    }
    autoStart()
    return () => { cancelled = true }
  }, [])

  const handleEnd = useCallback(async () => {
    try { await conversation.endSession() } catch {}
    if (pollRef.current) clearInterval(pollRef.current)
    onClose?.()
  }, [conversation, onClose])

  const phaseSteps = [
    { key: 'creating', label: 'Creating topic', icon: 'plus' },
    { key: 'researching', label: 'Firecrawl researching', icon: 'search' },
    { key: 'generating', label: 'Generating first video', icon: 'video' },
    { key: 'done', label: 'Ready to scroll', icon: 'check' },
  ]

  const currentPhaseIdx = topicCreated
    ? phaseSteps.findIndex(s => s.key === topicCreated.phase) : -1

  return (
    <div className="va-overlay">
      <div className="va-panel">
        {/* Header */}
        <div className="va-header">
          <div className="va-header-left">
            <div className={`va-avatar ${connected ? (isSpeaking ? 'va-avatar-speaking' : 'va-avatar-listening') : ''}`}>
              <svg width="20" height="20" viewBox="0 0 64 64" fill="none">
                <defs>
                  <linearGradient id="vfg" x1="0%" y1="100%" x2="50%" y2="0%">
                    <stop offset="0%" stopColor="#ef4444"/><stop offset="50%" stopColor="#f97316"/><stop offset="100%" stopColor="#fbbf24"/>
                  </linearGradient>
                </defs>
                <path d="M32 4C24 16,14 22,14 36c0,11,8,20,18,20s18-9,18-20c0-8-5-15-10-20c0,10-5,15-8,15s-5-5-2-15z" fill="url(#vfg)"/>
              </svg>
            </div>
            <div className="va-header-info">
              <span className="va-header-name">FireScroll</span>
              <span className="va-header-status">
                {error ? 'Error'
                  : connStatus === 'connecting' ? 'Connecting...'
                  : connected && isSpeaking ? 'Speaking'
                  : connected ? 'Listening'
                  : 'Starting...'}
              </span>
            </div>
          </div>
          <button className="va-header-close" onClick={handleEnd}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>

        {/* Waveform */}
        <div className="va-wave-container">
          <div className={`va-waveform ${connected ? (isSpeaking ? 'va-waveform-speaking' : 'va-waveform-listening') : ''}`}>
            {[...Array(32)].map((_, i) => (
              <div key={i} className="va-wave-bar" style={{
                animationDelay: `${i * 0.05}s`,
                animationDuration: `${0.6 + (i % 5) * 0.15}s`,
              }} />
            ))}
          </div>
          {!connected && !error && (
            <div className="va-wave-hint">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" x2="12" y1="19" y2="22"/>
              </svg>
              <span>Connecting to voice agent...</span>
            </div>
          )}
          {error && (
            <div className="va-wave-error">
              <span>{error}</span>
              <button onClick={() => { setError(null); window.location.reload() }}>Retry</button>
            </div>
          )}
        </div>

        {/* Conversation */}
        {messages.length > 0 && (
          <div className="va-messages" ref={messagesRef}>
            {messages.map((m, i) => (
              <div key={i} className={`va-msg va-msg-${m.role}`}>
                {m.role === 'agent' && (
                  <div className="va-msg-avatar">
                    <svg width="10" height="10" viewBox="0 0 64 64" fill="none">
                      <path d="M32 4C24 16,14 22,14 36c0,11,8,20,18,20s18-9,18-20c0-8-5-15-10-20c0,10-5,15-8,15s-5-5-2-15z" fill="#f97316"/>
                    </svg>
                  </div>
                )}
                <span className="va-msg-text">{m.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Pipeline status */}
        {topicCreated && (
          <div className="va-pipeline">
            <div className="va-pipeline-header">
              <span className="va-pipeline-topic">{topicCreated.topic}</span>
            </div>
            <div className="va-pipeline-steps">
              {phaseSteps.map((step, i) => {
                const isDone = i < currentPhaseIdx
                const isActive = i === currentPhaseIdx
                const isPending = i > currentPhaseIdx
                return (
                  <div key={step.key} className={`va-step ${isDone ? 'va-step-done' : isActive ? 'va-step-active' : 'va-step-pending'}`}>
                    <div className="va-step-icon">
                      {isDone ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5"/></svg>
                      ) : isActive ? (
                        <div className="va-step-spinner" />
                      ) : (
                        <div className="va-step-dot" />
                      )}
                    </div>
                    <span className="va-step-label">{step.label}</span>
                    {isActive && status && step.key === 'researching' && (
                      <span className="va-step-detail">{status.segmentsReady}/{status.segmentsTotal} segments</span>
                    )}
                    {isActive && status && step.key === 'generating' && (
                      <span className="va-step-detail">{status.videosDone} done, {status.videosActive} rendering</span>
                    )}
                    {i < phaseSteps.length - 1 && <div className={`va-step-line ${isDone ? 'va-step-line-done' : ''}`} />}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="va-footer">
          {!connected && !error && !topicCreated && (
            <div className="va-suggestions">
              <span className="va-sug-label">Try saying</span>
              <div className="va-sug-chips">
                <span className="va-sug">"Quantum computing"</span>
                <span className="va-sug">"History of the internet"</span>
                <span className="va-sug">"How DNA works"</span>
              </div>
            </div>
          )}
          <div className="va-footer-row">
            <div className="va-powered">
              <svg width="12" height="12" viewBox="0 0 32 32" fill="none">
                <rect x="8" y="2" width="5" height="28" rx="2.5" fill="#3f3f46"/>
                <rect x="19" y="2" width="5" height="28" rx="2.5" fill="#3f3f46"/>
              </svg>
              <span>ElevenLabs</span>
            </div>
            <button className="va-end-btn" onClick={handleEnd}>
              {topicCreated?.phase === 'done' ? 'Go to Dashboard' : connected ? 'End' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
