import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { PhoneMockup } from '../components/PhoneMockup';
import { C, FONT, GRADIENT } from '../constants';

const VideoPreview: React.FC<{
  mode: string;
  bgColor: string;
  captionText: string;
}> = ({ mode, bgColor, captionText }) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: bgColor,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: 14,
        position: 'relative',
      }}
    >
      {/* Mode badge */}
      <div
        style={{
          position: 'absolute',
          top: 32,
          left: 10,
          fontSize: 9,
          fontWeight: 700,
          color: '#fff',
          background: 'rgba(0,0,0,0.5)',
          padding: '3px 8px',
          borderRadius: 6,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        {mode}
      </div>

      {/* Fake waveform */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          justifyContent: 'center',
          marginBottom: 12,
        }}
      >
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 3,
              height: 8 + Math.sin(i * 0.8) * 12 + Math.random() * 6,
              borderRadius: 2,
              background: 'rgba(255,255,255,0.3)',
            }}
          />
        ))}
      </div>

      {/* Caption */}
      <div
        style={{
          background: 'rgba(0,0,0,0.7)',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 12,
          fontWeight: 700,
          color: '#fff',
          textAlign: 'center',
          lineHeight: 1.4,
        }}
      >
        {captionText}
      </div>

      {/* TikTok-style sidebar */}
      <div
        style={{
          position: 'absolute',
          right: 10,
          bottom: 80,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          alignItems: 'center',
        }}
      >
        {['❤️', '💬', '↗️', '🔖'].map((icon, i) => (
          <div
            key={i}
            style={{
              fontSize: 16,
              opacity: 0.8,
            }}
          >
            {icon}
          </div>
        ))}
      </div>
    </div>
  );
};

export const OutputScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phones = [
    {
      label: 'AI Backgrounds',
      mode: 'AI BG',
      bg: 'linear-gradient(180deg, #1a0533 0%, #0d1b2a 50%, #1b2838 100%)',
      caption: 'A black hole bends light itself...',
    },
    {
      label: 'Split Screen',
      mode: 'Split',
      bg: 'linear-gradient(180deg, #0a1628 0%, #162033 50%, #0d0d1a 100%)',
      caption: 'The event horizon is the point of no return',
    },
    {
      label: 'Video BG',
      mode: 'Video',
      bg: 'linear-gradient(180deg, #1c1c1c 0%, #2a1a0e 50%, #1a1a2e 100%)',
      caption: 'Hawking radiation means black holes can evaporate',
    },
  ];

  // Fade out
  const fadeOut = interpolate(frame, [150, 180], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.bg,
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: FONT,
        opacity: fadeOut,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40 }}>
        <div
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: C.green,
            textTransform: 'uppercase',
            letterSpacing: 4,
            opacity: interpolate(frame, [0, 20], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          The Output
        </div>

        <div style={{ display: 'flex', gap: 48, alignItems: 'center' }}>
          {phones.map((phone, i) => {
            const delay = 10 + i * 15;
            const s = spring({
              frame: frame - delay,
              fps,
              config: { damping: 12, stiffness: 80 },
            });
            const y = interpolate(s, [0, 1], [80, 0]);
            const opacity = interpolate(s, [0, 1], [0, 1]);

            // Subtle float
            const float = Math.sin((frame + i * 20) * 0.04) * 4;

            return (
              <div
                key={i}
                style={{
                  opacity,
                  transform: `translateY(${y + float}px)`,
                }}
              >
                <PhoneMockup label={phone.label}>
                  <VideoPreview
                    mode={phone.mode}
                    bgColor={phone.bg}
                    captionText={phone.caption}
                  />
                </PhoneMockup>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
