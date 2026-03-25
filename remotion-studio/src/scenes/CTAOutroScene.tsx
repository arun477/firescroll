import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { GlowText } from "../components/GlowText";
import { ParticleField } from "../components/ParticleField";
import type { CTAOutroProps } from "../types";

export const CTAOutroScene: React.FC<CTAOutroProps> = ({
  headline,
  subtext,
  brandColor = "#E63250",
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const ringProgress = spring({ frame: frame - 10, fps, config: { damping: 12, mass: 0.5 } });
  const ringScale = interpolate(ringProgress, [0, 1], [0.3, 1]);
  const ringOpacity = interpolate(ringProgress, [0, 0.5, 1], [0, 0.8, 0.3]);

  return (
    <div
      style={{
        width, height,
        background: `radial-gradient(ellipse at 50% 50%, ${brandColor}20 0%, #0a0a0f 60%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 80px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <ParticleField width={width} height={height} color={brandColor} count={40} />

      {/* Animated ring */}
      <div
        style={{
          position: "absolute",
          width: 300,
          height: 300,
          borderRadius: "50%",
          border: `3px solid ${brandColor}`,
          opacity: ringOpacity,
          transform: `scale(${ringScale})`,
          boxShadow: `0 0 60px ${brandColor}40, inset 0 0 60px ${brandColor}20`,
        }}
      />

      <GlowText
        text={headline}
        fontSize={64}
        color="#fff"
        glowColor={brandColor}
        delay={15}
        style={{ textAlign: "center", position: "relative", zIndex: 1 }}
      />

      {subtext && (
        <GlowText
          text={subtext}
          fontSize={28}
          color="rgba(255,255,255,0.6)"
          glowColor={brandColor}
          delay={25}
          style={{ textAlign: "center", marginTop: 20, position: "relative", zIndex: 1 }}
        />
      )}
    </div>
  );
};
