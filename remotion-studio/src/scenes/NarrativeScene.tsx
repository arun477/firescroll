import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ParticleField } from "../components/ParticleField";
import type { NarrativeProps } from "../types";

const STYLE_CONFIG = {
  cinematic: { bg: "#0a0a0f", color: "#E63250", textColor: "#fff" },
  minimal: { bg: "#111111", color: "#888", textColor: "#eee" },
  bold: { bg: "#0a0018", color: "#a855f7", textColor: "#fff" },
};

export const NarrativeScene: React.FC<NarrativeProps> = ({
  text,
  style = "cinematic",
  highlightWords = [],
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const cfg = STYLE_CONFIG[style] || STYLE_CONFIG.cinematic;

  // Word-by-word reveal
  const words = text.split(" ");
  const wordsPerFrame = words.length / (height > 0 ? 90 : 60); // pace over ~3 seconds

  return (
    <div
      style={{
        width, height,
        background: `radial-gradient(ellipse at 50% 60%, ${cfg.color}10 0%, ${cfg.bg} 70%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 80px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <ParticleField width={width} height={height} color={cfg.color} count={15} />

      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            fontSize: 40,
            fontWeight: 600,
            lineHeight: 1.5,
            textAlign: "center",
          }}
        >
          {words.map((word, i) => {
            const wordFrame = i / wordsPerFrame;
            const progress = spring({
              frame: frame - wordFrame,
              fps,
              config: { damping: 20 },
            });
            const opacity = interpolate(progress, [0, 1], [0, 1]);
            const isHighlight = highlightWords.some(
              (hw) => word.toLowerCase().includes(hw.toLowerCase())
            );

            return (
              <span
                key={i}
                style={{
                  opacity,
                  color: isHighlight ? cfg.color : cfg.textColor,
                  fontWeight: isHighlight ? 800 : 600,
                  display: "inline",
                }}
              >
                {word}{" "}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};
