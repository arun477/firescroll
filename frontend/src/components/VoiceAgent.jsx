import { useState, useCallback, useEffect } from 'react'
import { useConversation } from '@11labs/react'

const AGENT_ID = 'agent_6801kmn5wtv6fcp8nd29cv923067'

export default function VoiceAgent({ onClose, onTopicCreated }) {
  const [error, setError] = useState(null)
  const [topicName, setTopicName] = useState(null)
  const [transcript, setTranscript] = useState('')

  const conversation = useConversation({
    onError: (err) => setError(err.message || 'Connection failed'),
    onMessage: (msg) => {
      if (msg?.source === 'ai') {
        setTranscript(msg.message || '')
      }
      if (msg?.tool_call?.tool_name === 'create_topic_and_research') {
        const topic = msg.tool_call?.parameters?.topic
        setTopicName(topic || 'your topic')
        setTimeout(() => onTopicCreated?.(), 3000)
      }
    },
  })

  const { status, isSpeaking } = conversation
  const connected = status === 'connected'

  // Auto-start on mount
  useEffect(() => {
    let cancelled = false
    const autoStart = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true })
        if (!cancelled) {
          await conversation.startSession({ agentId: AGENT_ID })
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message?.includes('Permission')
            ? 'Microphone access denied. Please allow mic access and try again.'
            : e.message || 'Failed to connect')
        }
      }
    }
    autoStart()
    return () => { cancelled = true }
  }, [])

  const handleEnd = useCallback(async () => {
    try { await conversation.endSession() } catch {}
    onClose?.()
  }, [conversation, onClose])

  return (
    <div className="va-overlay" onClick={handleEnd}>
      <div className="va-modal" onClick={e => e.stopPropagation()}>
        <button className="va-close" onClick={handleEnd}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
        </button>

        <div className="va-brand">
          <svg width="20" height="20" viewBox="0 0 64 64" fill="none">
            <defs>
              <linearGradient id="vfg" x1="0%" y1="100%" x2="50%" y2="0%">
                <stop offset="0%" stopColor="#ef4444"/><stop offset="50%" stopColor="#f97316"/><stop offset="100%" stopColor="#fbbf24"/>
              </linearGradient>
            </defs>
            <path d="M32 4C24 16,14 22,14 36c0,11,8,20,18,20s18-9,18-20c0-8-5-15-10-20c0,10-5,15-8,15s-5-5-2-15z" fill="url(#vfg)"/>
          </svg>
          <span>FireScroll Voice</span>
          <span className="va-powered">
            powered by
            <svg width="14" height="14" viewBox="0 0 32 32" fill="none" style={{ marginLeft: 4 }}>
              <rect x="8" y="2" width="5" height="28" rx="2.5" fill="#a1a1aa"/>
              <rect x="19" y="2" width="5" height="28" rx="2.5" fill="#a1a1aa"/>
            </svg>
            ElevenLabs
          </span>
        </div>

        <div className={`va-mic ${connected ? (isSpeaking ? 'va-mic-speaking' : 'va-mic-listening') : ''}`}>
          <div className="va-rings">
            {connected && <div className="va-ring va-ring-1" />}
            {connected && <div className="va-ring va-ring-2" />}
            {connected && isSpeaking && <div className="va-ring va-ring-3" />}
          </div>
          <div className="va-mic-btn">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" x2="12" y1="19" y2="22"/>
            </svg>
          </div>
        </div>

        {topicName ? (
          <div className="va-success">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
            <span>Creating "{topicName}" — research started</span>
          </div>
        ) : (
          <p className="va-status">
            {error ? error
              : status === 'connecting' ? 'Connecting to FireScroll...'
              : connected && isSpeaking ? 'FireScroll is speaking...'
              : connected ? 'Listening — tell me a topic'
              : 'Starting...'}
          </p>
        )}

        {transcript && connected && !topicName && (
          <p className="va-transcript">{transcript}</p>
        )}

        {!connected && !error && !topicName && (
          <div className="va-examples">
            <span className="va-examples-label">Try saying</span>
            <span className="va-example">"Black holes"</span>
            <span className="va-example">"History of the internet"</span>
            <span className="va-example">"How vaccines work"</span>
          </div>
        )}

        {error && (
          <button className="va-retry" onClick={() => { setError(null); window.location.reload() }}>
            Try again
          </button>
        )}

        <button className="va-end" onClick={handleEnd}>
          {topicName ? 'Go to Dashboard' : 'Cancel'}
        </button>
      </div>
    </div>
  )
}
