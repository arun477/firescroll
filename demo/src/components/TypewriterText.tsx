import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { C } from '../constants';

export const TypewriterText: React.FC<{
  text: string;
  fontSize?: number;
  delay?: number;
  speed?: number;
  color?: string;
}> = ({ text, fontSize = 48, delay = 0, speed = 2, color = C.text }) => {
  const frame = useCurrentFrame();
  const adjustedFrame = Math.max(0, frame - delay);

  const charsVisible = Math.min(text.length, Math.floor(adjustedFrame / speed));
  const cursorOpacity = Math.round(adjustedFrame / 15) % 2 === 0 ? 1 : 0;
  const showCursor = charsVisible < text.length;

  return (
    <div
      style={{
        fontSize,
        fontWeight: 600,
        color,
        fontFamily: 'monospace',
        letterSpacing: '-0.5px',
      }}
    >
      {text.slice(0, charsVisible)}
      {showCursor && (
        <span style={{ opacity: cursorOpacity, color: C.accent }}>|</span>
      )}
    </div>
  );
};
