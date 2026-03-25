import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const AnimatedCounter: React.FC<{
  value: string;
  fontSize?: number;
  color?: string;
  delay?: number;
}> = ({ value, fontSize = 120, color = "#E63250", delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({ frame: frame - delay, fps, config: { damping: 20, mass: 0.8 } });

  // Extract numeric part for animation
  const numMatch = value.match(/^([\d.]+)(.*)/);
  const numPart = numMatch ? parseFloat(numMatch[1]) : 0;
  const suffix = numMatch ? numMatch[2] : value;

  const displayNum = numPart > 0
    ? interpolate(progress, [0, 1], [0, numPart])
    : 0;

  const scale = interpolate(progress, [0, 0.5, 1], [0.5, 1.1, 1]);
  const opacity = interpolate(progress, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });

  const formatted = numPart > 0
    ? (numPart >= 1000 ? Math.round(displayNum).toLocaleString() : displayNum.toFixed(numPart % 1 === 0 ? 0 : 1))
    : value;

  return (
    <div style={{ opacity, transform: `scale(${scale})`, textAlign: "center" }}>
      <span style={{ fontSize, fontWeight: 900, color, letterSpacing: "-0.03em" }}>
        {numPart > 0 ? formatted : value}{numPart > 0 ? suffix : ""}
      </span>
    </div>
  );
};
