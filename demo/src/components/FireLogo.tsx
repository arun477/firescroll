import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FLAME_PATH } from '../constants';

export const FireLogo: React.FC<{
  size?: number;
  delay?: number;
}> = ({ size = 120, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: frame - delay,
    fps,
    config: { damping: 12, stiffness: 120 },
  });

  const glowOpacity = 0.3 + 0.15 * Math.sin((frame - delay) * 0.08);

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {/* Glow */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: size * 2,
          height: size * 2,
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(249,115,22,0.4) 0%, transparent 70%)',
          opacity: glowOpacity * scale,
        }}
      />
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}
      >
        <defs>
          <linearGradient id="fireGrad" x1="0%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="50%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
        </defs>
        <path d={FLAME_PATH} fill="url(#fireGrad)" />
      </svg>
    </div>
  );
};
