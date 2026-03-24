import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { FireLogo } from '../components/FireLogo';
import { C, FONT, GRADIENT } from '../constants';

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Expanding glow ring
  const ringScale = interpolate(frame, [10, 60], [0.5, 3], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ringOpacity = interpolate(frame, [10, 60], [0.6, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Title spring
  const titleSpring = spring({
    frame: frame - 25,
    fps,
    config: { damping: 14, stiffness: 80 },
  });
  const titleY = interpolate(titleSpring, [0, 1], [30, 0]);
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  // Subtitle
  const subSpring = spring({
    frame: frame - 50,
    fps,
    config: { damping: 14, stiffness: 80 },
  });
  const subOpacity = interpolate(subSpring, [0, 1], [0, 1]);
  const subY = interpolate(subSpring, [0, 1], [20, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.bg,
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: FONT,
      }}
    >
      {/* Glow ring */}
      <div
        style={{
          position: 'absolute',
          width: 200,
          height: 200,
          borderRadius: '50%',
          border: '2px solid rgba(249,115,22,0.5)',
          transform: `scale(${ringScale})`,
          opacity: ringOpacity,
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
        }}
      >
        <FireLogo size={140} />

        <div
          style={{
            fontSize: 80,
            fontWeight: 800,
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            background: GRADIENT,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          FireScroll
        </div>

        <div
          style={{
            fontSize: 28,
            fontWeight: 500,
            color: C.textSecondary,
            opacity: subOpacity,
            transform: `translateY(${subY}px)`,
          }}
        >
          AI-Powered Short-Form Video, Instantly.
        </div>
      </div>
    </AbsoluteFill>
  );
};
