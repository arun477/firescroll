import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { GlassCard } from "../components/GlassCard";
import type { SplitInfoProps } from "../types";

export const SplitInfoScene: React.FC<SplitInfoProps> = ({
  heading,
  points,
  side = "left",
  accentColor = "#3b82f6",
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const headProgress = spring({ frame: frame - 5, fps, config: { damping: 15 } });
  const headOpacity = interpolate(headProgress, [0, 1], [0, 1]);

  const textSide = side === "left" ? "flex-start" : "flex-end";

  return (
    <div
      style={{
        width, height,
        background: `linear-gradient(160deg, #0a0a0f 0%, ${accentColor}08 50%, #0a0a0f 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: textSide,
        justifyContent: "center",
        padding: "0 60px",
      }}
    >
      <div style={{ maxWidth: width * 0.85 }}>
        <div
          style={{
            fontSize: 48,
            fontWeight: 800,
            color: "#fff",
            marginBottom: 40,
            opacity: headOpacity,
            lineHeight: 1.2,
          }}
        >
          {heading}
        </div>

        {points.map((point, i) => {
          const pointProgress = spring({
            frame: frame - 15 - i * 8,
            fps,
            config: { damping: 15 },
          });
          const opacity = interpolate(pointProgress, [0, 1], [0, 1]);
          const x = interpolate(pointProgress, [0, 1], [side === "left" ? -30 : 30, 0]);

          return (
            <GlassCard
              key={i}
              delay={15 + i * 8}
              accentColor={accentColor}
              style={{
                marginBottom: 16,
                padding: "24px 32px",
                opacity,
                transform: `translateX(${x}px)`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: accentColor,
                    flexShrink: 0,
                    boxShadow: `0 0 12px ${accentColor}`,
                  }}
                />
                <div style={{ fontSize: 28, fontWeight: 500, color: "rgba(255,255,255,0.9)", lineHeight: 1.4 }}>
                  {point}
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
};
