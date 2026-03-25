import React, { useMemo } from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  delay: number;
}

export const ParticleField: React.FC<{
  count?: number;
  color?: string;
  width: number;
  height: number;
}> = ({ count = 30, color = "#E63250", width, height }) => {
  const frame = useCurrentFrame();

  const particles = useMemo<Particle[]>(() => {
    const rng = (seed: number) => {
      let s = seed;
      return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    };
    const r = rng(42);
    return Array.from({ length: count }, () => ({
      x: r() * width,
      y: r() * height,
      size: 2 + r() * 4,
      speed: 0.3 + r() * 0.7,
      opacity: 0.2 + r() * 0.5,
      delay: r() * 60,
    }));
  }, [count, width, height]);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {particles.map((p, i) => {
        const t = frame + p.delay;
        const y = (p.y - t * p.speed) % height;
        const adjustedY = y < 0 ? y + height : y;
        const fade = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.x,
              top: adjustedY,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              background: color,
              opacity: p.opacity * fade,
              boxShadow: `0 0 ${p.size * 3}px ${color}60`,
            }}
          />
        );
      })}
    </div>
  );
};
