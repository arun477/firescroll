import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { C, FONT, GRADIENT } from '../constants';

const STEPS = [
  {
    icon: '📝',
    title: 'Enter a Topic',
    desc: '"The Science of Black Holes"',
    accent: C.blue,
  },
  {
    icon: '🔍',
    title: 'AI Researches',
    desc: 'Web scraping + AI synthesis',
    accent: C.fcHeat,
  },
  {
    icon: '🎙️',
    title: 'Script + Voice',
    desc: 'Hook, narration, captions',
    accent: C.green,
  },
  {
    icon: '🎬',
    title: 'Video Rendered',
    desc: 'Backgrounds, effects, music',
    accent: C.accent,
  },
];

const StepCard: React.FC<{
  step: (typeof STEPS)[0];
  index: number;
  frame: number;
  fps: number;
}> = ({ step, index, frame, fps }) => {
  const delay = 30 + index * 50;
  const s = spring({
    frame: frame - delay,
    fps,
    config: { damping: 14, stiffness: 80 },
  });
  const y = interpolate(s, [0, 1], [60, 0]);
  const opacity = interpolate(s, [0, 1], [0, 1]);

  // Progress bar for last step
  const progressDelay = delay + 30;
  const progress =
    index === 3
      ? interpolate(frame, [progressDelay, progressDelay + 80], [0, 100], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 100;

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${y}px)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        width: 320,
      }}
    >
      <div
        style={{
          width: 100,
          height: 100,
          borderRadius: 24,
          background: C.glass,
          border: `1px solid ${C.glassBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 44,
          boxShadow: `0 0 30px ${step.accent}22`,
        }}
      >
        {step.icon}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: C.text, textAlign: 'center' }}>
        {step.title}
      </div>
      <div style={{ fontSize: 17, color: C.textSecondary, textAlign: 'center' }}>
        {step.desc}
      </div>
      {index === 3 && opacity > 0.5 && (
        <div
          style={{
            width: '100%',
            height: 6,
            borderRadius: 3,
            background: 'rgba(255,255,255,0.06)',
            overflow: 'hidden',
            marginTop: 4,
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              borderRadius: 3,
              background: GRADIENT,
            }}
          />
        </div>
      )}
    </div>
  );
};

const Arrow: React.FC<{ index: number; frame: number; fps: number }> = ({
  index,
  frame,
  fps,
}) => {
  const delay = 55 + index * 50;
  const s = spring({
    frame: frame - delay,
    fps,
    config: { damping: 14, stiffness: 100 },
  });
  const opacity = interpolate(s, [0, 1], [0, 0.4]);
  const scaleX = interpolate(s, [0, 1], [0, 1]);

  return (
    <div
      style={{
        opacity,
        transform: `scaleX(${scaleX})`,
        display: 'flex',
        alignItems: 'center',
        color: C.textMuted,
        fontSize: 36,
        marginTop: -40,
      }}
    >
      →
    </div>
  );
};

export const WorkflowScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Scene label
  const labelOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Fade out
  const fadeOut = interpolate(frame, [330, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.bg,
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: FONT,
        opacity: fadeOut,
      }}
    >
      {/* Background radial */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(239,68,68,0.04) 0%, transparent 70%)',
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 48 }}>
        <div
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: C.fcHeat,
            textTransform: 'uppercase',
            letterSpacing: 4,
            opacity: labelOpacity,
          }}
        >
          How It Works
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24 }}>
          {STEPS.map((step, i) => (
            <React.Fragment key={i}>
              <StepCard step={step} index={i} frame={frame} fps={fps} />
              {i < STEPS.length - 1 && <Arrow index={i} frame={frame} fps={fps} />}
            </React.Fragment>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
