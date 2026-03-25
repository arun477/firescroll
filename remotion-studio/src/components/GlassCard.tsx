import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const GlassCard: React.FC<{
  children: React.ReactNode;
  delay?: number;
  accentColor?: string;
  style?: React.CSSProperties;
}> = ({ children, delay = 0, accentColor = "#E63250", style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({ frame: frame - delay, fps, config: { damping: 12 } });
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const scale = interpolate(progress, [0, 1], [0.95, 1]);

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.05)",
        backdropFilter: "blur(20px)",
        border: `1px solid rgba(255,255,255,0.1)`,
        borderRadius: 24,
        padding: "40px 48px",
        opacity,
        transform: `scale(${scale})`,
        boxShadow: `0 0 60px ${accentColor}15, inset 0 1px 0 rgba(255,255,255,0.1)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
