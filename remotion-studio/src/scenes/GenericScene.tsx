import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { GlowText } from "../components/GlowText";
import { ParticleField } from "../components/ParticleField";
import { GlassCard } from "../components/GlassCard";
import { AnimatedCounter } from "../components/AnimatedCounter";

export interface TextLayer {
  text: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  glowColor?: string;
  textAlign?: "left" | "center" | "right";
  y?: "top" | "center" | "bottom" | number;
  animation?: "spring-in" | "fade-in" | "word-by-word" | "none";
  animationDelay?: number;
  letterSpacing?: string;
  highlightWords?: string[];
  maxWidth?: number;
}

export interface ShapeElement {
  type: "circle" | "rect" | "line" | "image";
  x?: number;       // pixels from left (default: center)
  y?: number;       // pixels from top (default: center)
  size?: number;     // diameter for circle, side for rect
  width?: number;    // rect width
  height?: number;   // rect height
  color?: string;
  borderColor?: string;
  borderWidth?: number;
  opacity?: number;
  shadow?: boolean;
  shadowColor?: string;
  blur?: number;
  rotation?: number; // degrees
  animation?: "bounce" | "pulse" | "spin" | "float" | "slide-in" | "scale-in" | "fade-in" | "none";
  animationDelay?: number;  // frames
  animationSpeed?: number;  // multiplier (default 1)
}

export interface GenericSceneProps {
  backgroundColor?: string;
  backgroundGradient?: string;

  textLayers?: TextLayer[];

  shapes?: ShapeElement[];

  counter?: {
    value: string;
    color?: string;
    fontSize?: number;
    delay?: number;
  };

  points?: string[];
  pointsAccentColor?: string;
  pointsSide?: "left" | "right";

  particles?: boolean;
  particleColor?: string;
  particleCount?: number;

  ring?: boolean;
  ringColor?: string;

  dividerLine?: boolean;
  dividerColor?: string;

  glassCard?: boolean;
  glassCardAccentColor?: string;
}

function WordByWordText({
  text, fontSize = 40, color = "#fff", highlightWords = [], delay = 0,
}: {
  text: string; fontSize?: number; color?: string;
  highlightWords?: string[]; delay?: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  const wordsPerFrame = words.length / 90;

  return (
    <div style={{ fontSize, fontWeight: 600, lineHeight: 1.5, textAlign: "center" }}>
      {words.map((word, i) => {
        const wf = delay + i / wordsPerFrame;
        const progress = spring({ frame: frame - wf, fps, config: { damping: 20 } });
        const opacity = interpolate(progress, [0, 1], [0, 1]);
        const isHL = highlightWords.some(hw => word.toLowerCase().includes(hw.toLowerCase()));
        return (
          <span key={i} style={{ opacity, color: isHL ? "#E63250" : color, fontWeight: isHL ? 800 : 600, display: "inline" }}>
            {word}{" "}
          </span>
        );
      })}
    </div>
  );
}

function AnimatedRing({ color = "#E63250" }: { color?: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - 10, fps, config: { damping: 12, mass: 0.5 } });
  const scale = interpolate(p, [0, 1], [0.3, 1]);
  const opacity = interpolate(p, [0, 0.5, 1], [0, 0.8, 0.3]);
  return (
    <div style={{
      position: "absolute", width: 300, height: 300, borderRadius: "50%",
      border: `3px solid ${color}`, opacity, transform: `scale(${scale})`,
      boxShadow: `0 0 60px ${color}40, inset 0 0 60px ${color}20`,
      top: "50%", left: "50%", marginTop: -150, marginLeft: -150,
    }} />
  );
}

function getYPosition(y: TextLayer["y"], height: number): number {
  if (y === "top") return height * 0.15;
  if (y === "bottom") return height * 0.75;
  if (typeof y === "number") return y;
  return height * 0.45; // center
}

export const GenericScene: React.FC<GenericSceneProps> = (props) => {
  const { width, height } = useVideoConfig();

  const bg = props.backgroundGradient
    || (props.backgroundColor ? `linear-gradient(180deg, ${props.backgroundColor}, ${props.backgroundColor})` : undefined)
    || "linear-gradient(180deg, #0a0a0f, #0a0a0f)";

  return (
    <div style={{
      width, height, background: bg,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden", padding: "0 60px",
    }}>
      {/* Particles */}
      {props.particles && (
        <ParticleField width={width} height={height}
          color={props.particleColor || "#E63250"} count={props.particleCount || 25} />
      )}

      {/* Ring */}
      {props.ring && <AnimatedRing color={props.ringColor || "#E63250"} />}

      {/* Counter */}
      {props.counter && (
        <div style={{ position: "relative", zIndex: 1 }}>
          {props.glassCard ? (
            <GlassCard delay={props.counter.delay || 5} accentColor={props.glassCardAccentColor || "#E63250"}>
              <AnimatedCounter value={props.counter.value}
                color={props.counter.color || "#E63250"}
                fontSize={props.counter.fontSize || 120}
                delay={props.counter.delay || 10} />
            </GlassCard>
          ) : (
            <AnimatedCounter value={props.counter.value}
              color={props.counter.color || "#E63250"}
              fontSize={props.counter.fontSize || 120}
              delay={props.counter.delay || 10} />
          )}
        </div>
      )}

      {/* Text Layers */}
      {props.textLayers?.map((layer, i) => {
        const yPos = getYPosition(layer.y, height);
        return (
          <div key={i} style={{
            position: "absolute", left: 60, right: 60, top: yPos,
            textAlign: layer.textAlign || "center", zIndex: 2,
          }}>
            {layer.animation === "word-by-word" ? (
              <WordByWordText text={layer.text} fontSize={layer.fontSize || 40}
                color={layer.color || "#fff"} highlightWords={layer.highlightWords || []}
                delay={layer.animationDelay || 0} />
            ) : (
              <GlowText text={layer.text} fontSize={layer.fontSize || 40}
                color={layer.color || "#fff"}
                glowColor={layer.glowColor || "transparent"}
                delay={layer.animationDelay || i * 10}
                style={{
                  fontWeight: layer.fontWeight || 600,
                  letterSpacing: layer.letterSpacing || "-0.02em",
                  textAlign: layer.textAlign || "center",
                  maxWidth: layer.maxWidth || undefined,
                }} />
            )}
          </div>
        );
      })}

      {/* Divider Line */}
      {props.dividerLine && <DividerLine color={props.dividerColor || "#E63250"} />}

      {/* Bullet Points */}
      {props.points && props.points.length > 0 && (
        <div style={{
          position: "relative", zIndex: 2, width: "100%",
          display: "flex", flexDirection: "column", gap: 16,
          alignItems: props.pointsSide === "right" ? "flex-end" : "flex-start",
        }}>
          {props.points.map((point, i) => (
            <GlassCard key={i} delay={15 + i * 8}
              accentColor={props.pointsAccentColor || "#3b82f6"}
              style={{ padding: "24px 32px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: props.pointsAccentColor || "#3b82f6", flexShrink: 0,
                  boxShadow: `0 0 12px ${props.pointsAccentColor || "#3b82f6"}`,
                }} />
                <div style={{ fontSize: 28, fontWeight: 500, color: "rgba(255,255,255,0.9)", lineHeight: 1.4 }}>
                  {point}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
};

function DividerLine({ color }: { color: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - 15, fps, config: { damping: 20 } });
  const w = interpolate(p, [0, 1], [0, 200]);
  return (
    <div style={{
      width: w, height: 4, borderRadius: 2, zIndex: 2,
      background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
      margin: "24px 0",
    }} />
  );
}
