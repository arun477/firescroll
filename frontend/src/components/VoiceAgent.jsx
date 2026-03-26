import { useState, useCallback } from 'react'
import { useConversation } from '@11labs/react'

const AGENT_ID = 'agent_6801kmn5wtv6fcp8nd29cv923067'

export default function VoiceAgent({ onClose, onTopicCreated }) {
  const [error, setError] = useState(null)

  const conversation = useConversation({
    onError: (err) => setError(err.message || 'Connection failed'),
    onMessage: (msg) => {
      if (msg?.tool_call?.tool_name === 'create_topic_and_research') {
        setTimeout(() => onTopicCreated?.(), 2000)
      }
    },
  })

  const { status, isSpeaking } = conversation

  const handleStart = useCallback(async () => {
    setError(null)
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      await conversation.startSession({ agentId: AGENT_ID })
    } catch (e) {
      setError(e.message?.includes('Permission')
        ? 'Microphone access denied'
        : e.message || 'Failed to connect')
    }
  }, [conversation])

  const handleEnd = useCallback(async () => {
    await conversation.endSession()
    onClose?.()
  }, [conversation, onClose])

  const connected = status === 'connected'

  return (
    <div className="va-overlay" onClick={handleEnd}>
      <div className="va-modal" onClick={e => e.stopPropagation()}>
        <button className="va-close" onClick={handleEnd}>&times;</button>

        <div className="va-brand">
          <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
            <rect x="8" y="2" width="5" height="28" rx="2.5" fill="#fafafa"/>
            <rect x="19" y="2" width="5" height="28" rx="2.5" fill="#fafafa"/>
          </svg>
          <span>FireScroll Voice</span>
        </div>

        <div className={`va-mic ${connected ? (isSpeaking ? 'va-mic-speaking' : 'va-mic-listening') : ''}`}>
          <button
            className="va-mic-btn"
            onClick={connected ? handleEnd : handleStart}
          >
            {connected ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" x2="12" y1="19" y2="22"/>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" x2="12" y1="19" y2="22"/>
              </svg>
            )}
          </button>
        </div>

        <p className="va-status">
          {error ? error
            : status === 'connecting' ? 'Connecting...'
            : connected && isSpeaking ? 'FireScroll is speaking...'
            : connected ? 'Listening — say a topic'
            : 'Tap to start'}
        </p>

        {!connected && !error && (
          <p className="va-hint">Try: "Make a series about black holes"</p>
        )}
      </div>
    </div>
  )
}
