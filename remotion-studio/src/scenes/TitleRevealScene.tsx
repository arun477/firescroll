import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { GlowText } from "../components/GlowText";
import { ParticleField } from "../components/ParticleField";
import type { TitleRevealProps } from "../types";

const PALETTES = {
  warm: { bg: "#0a0a0f", primary: "#E63250", accent: "#ff6b35" },
  cool: { bg: "#050a18", primary: "#3b82f6", accent: "#06b6d4" },
  neon: { bg: "#0a000a", primary: "#a855f7", accent: "#22d3ee" },
  minimal: { bg: "#111111", primary: "#ffffff", accent: "#888888" },
};

export const TitleRevealScene: React.FC<TitleRevealProps> = ({
  title,
  subtitle,
  tagline,
  colorScheme = "warm",
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const palette = PALETTES[colorScheme] || PALETTES.warm;

  const lineProgress = spring({ frame: frame - 15, fps, config: { damping: 20 } });
  const lineWidth = interpolate(lineProgress, [0, 1], [0, 200]);

  return (
    <div
      style={{
        width, height,
        background: `radial-gradient(ellipse at 50% 30%, ${palette.primary}15 0%, ${palette.bg} 70%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 80px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <ParticleField width={width} height={height} color={palette.primary} count={25} />

      {tagline && (
        <GlowText
          text={tagline.toUpperCase()}
          fontSize={24}
          color={palette.accent}
          glowColor={palette.accent}
          delay={0}
          style={{ letterSpacing: "0.15em", marginBottom: 24 }}
        />
      )}

      <GlowText
        text={title}
        fontSize={76}
        color="#fff"
        glowColor={palette.primary}
        delay={8}
        style={{ textAlign: "center" }}
      />

      <div
        style={{
          width: lineWidth,
          height: 4,
          background: `linear-gradient(90deg, transparent, ${palette.primary}, transparent)`,
          margin: "32px 0",
          borderRadius: 2,
        }}
      />

      {subtitle && (
        <GlowText
          text={subtitle}
          fontSize={32}
          color="rgba(255,255,255,0.7)"
          glowColor={palette.primary}
          delay={20}
          style={{ textAlign: "center" }}
        />
      )}
    </div>
  );
};
