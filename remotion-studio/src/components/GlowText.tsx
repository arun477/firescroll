import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const GlowText: React.FC<{
  text: string;
  fontSize?: number;
  color?: string;
  glowColor?: string;
  delay?: number;
  style?: React.CSSProperties;
}> = ({ text, fontSize = 64, color = "#fff", glowColor = "#E63250", delay = 0, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({ frame: frame - delay, fps, config: { damping: 15 } });
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const y = interpolate(progress, [0, 1], [40, 0]);
  const scale = interpolate(progress, [0, 1], [0.9, 1]);

  return (
    <div
      style={{
        fontSize,
        fontWeight: 800,
        color,
        opacity,
        transform: `translateY(${y}px) scale(${scale})`,
        textShadow: `0 0 40px ${glowColor}80, 0 0 80px ${glowColor}40`,
        letterSpacing: "-0.02em",
        lineHeight: 1.1,
        ...style,
      }}
    >
      {text}
    </div>
  );
};
