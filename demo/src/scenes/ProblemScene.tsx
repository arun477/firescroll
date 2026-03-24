import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { C, FONT } from '../constants';

const PROBLEMS = [
  'Script research takes hours',
  'AI voices sound robotic',
  'Editing captions is tedious',
];

export const ProblemScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade out at the end
  const fadeOut = interpolate(frame, [180, 210], [1, 0], {
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
      {/* Subtle grid pattern */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* "The problem" label */}
        <div
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: C.accent,
            textTransform: 'uppercase',
            letterSpacing: 4,
            opacity: interpolate(frame, [0, 20], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            marginBottom: 8,
          }}
        >
          The Problem
        </div>

        {PROBLEMS.map((text, i) => {
          const delay = 20 + i * 20;
          const s = spring({
            frame: frame - delay,
            fps,
            config: { damping: 14, stiffness: 100 },
          });
          const x = interpolate(s, [0, 1], [80, 0]);
          const opacity = interpolate(s, [0, 1], [0, 1]);

          // Red tint shake at frame ~150
          const shakeOffset =
            frame > 140 && frame < 160
              ? Math.sin(frame * 2) * 3 * (1 - (frame - 140) / 20)
              : 0;

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                opacity,
                transform: `translateX(${x + shakeOffset}px)`,
              }}
            >
              {/* X icon */}
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  color: C.accent,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                ✕
              </div>
              <div
                style={{
                  fontSize: 42,
                  fontWeight: 700,
                  color: C.text,
                }}
              >
                {text}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
