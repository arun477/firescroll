import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { AnimatedCounter } from "../components/AnimatedCounter";
import { GlassCard } from "../components/GlassCard";
import type { FactCardProps } from "../types";

export const FactCardScene: React.FC<FactCardProps> = ({
  number,
  label,
  accentColor = "#E63250",
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const labelProgress = spring({ frame: frame - 20, fps, config: { damping: 15 } });
  const labelOpacity = interpolate(labelProgress, [0, 1], [0, 1]);
  const labelY = interpolate(labelProgress, [0, 1], [20, 0]);

  return (
    <div
      style={{
        width, height,
        background: `radial-gradient(ellipse at 50% 40%, ${accentColor}12 0%, #0a0a0f 70%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 60px",
      }}
    >
      <GlassCard delay={5} accentColor={accentColor} style={{ textAlign: "center", width: "100%" }}>
        <AnimatedCounter value={number} color={accentColor} delay={10} />
        <div
          style={{
            fontSize: 36,
            fontWeight: 600,
            color: "rgba(255,255,255,0.8)",
            marginTop: 24,
            opacity: labelOpacity,
            transform: `translateY(${labelY}px)`,
            lineHeight: 1.3,
          }}
        >
          {label}
        </div>
      </GlassCard>
    </div>
  );
};
