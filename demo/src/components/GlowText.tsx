import React from 'react';
import { spring, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { GRADIENT, C } from '../constants';

export const GlowText: React.FC<{
  children: string;
  fontSize?: number;
  delay?: number;
  gradient?: boolean;
}> = ({ children, fontSize = 72, delay = 0, gradient = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const appear = spring({
    frame: frame - delay,
    fps,
    config: { damping: 14, stiffness: 100 },
  });

  const y = interpolate(appear, [0, 1], [40, 0]);
  const opacity = interpolate(appear, [0, 1], [0, 1]);

  return (
    <div
      style={{
        fontSize,
        fontWeight: 800,
        opacity,
        transform: `translateY(${y}px)`,
        ...(gradient
          ? {
              background: GRADIENT,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }
          : { color: C.text }),
      }}
    >
      {children}
    </div>
  );
};
