import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { MockBrowser } from '../components/MockBrowser';
import { C, FONT, GRADIENT } from '../constants';

// Simplified mockups of the real UI screens

const DashboardMock: React.FC = () => {
  const topics = [
    { title: 'Black Holes Explained', segments: 8, progress: 100 },
    { title: 'Quantum Computing 101', segments: 6, progress: 75 },
    { title: 'History of the Internet', segments: 10, progress: 40 },
    { title: 'How mRNA Vaccines Work', segments: 5, progress: 0 },
  ];

  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Dashboard</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {topics.map((t, i) => (
          <div
            key={i}
            style={{
              width: 310,
              padding: 20,
              borderRadius: 14,
              background: C.glass,
              border: `1px solid ${C.glassBorder}`,
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 600, color: C.text, marginBottom: 8 }}>
              {t.title}
            </div>
            <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 12 }}>
              {t.segments} segments
            </div>
            <div
              style={{
                height: 4,
                borderRadius: 2,
                background: 'rgba(255,255,255,0.06)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${t.progress}%`,
                  height: '100%',
                  borderRadius: 2,
                  background: t.progress === 100 ? C.green : GRADIENT,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ResearchMock: React.FC = () => {
  const segments = [
    { num: 1, title: 'What is a Black Hole?', status: 'ready' },
    { num: 2, title: 'Formation & Types', status: 'ready' },
    { num: 3, title: 'Event Horizon', status: 'researching' },
    { num: 4, title: 'Hawking Radiation', status: 'draft' },
  ];

  const statusColors: Record<string, string> = {
    ready: C.green,
    researching: C.yellow,
    draft: C.textMuted,
  };

  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>
        Black Holes Explained — Research
      </div>
      {segments.map((seg) => (
        <div
          key={seg.num}
          style={{
            padding: 16,
            borderRadius: 12,
            background: C.glass,
            border: `1px solid ${C.glassBorder}`,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
              fontWeight: 700,
              color: C.textSecondary,
            }}
          >
            {seg.num}
          </div>
          <div style={{ flex: 1, fontSize: 16, fontWeight: 600, color: C.text }}>{seg.title}</div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: statusColors[seg.status],
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            {seg.status}
          </div>
        </div>
      ))}
    </div>
  );
};

const StudioMock: React.FC = () => {
  const modes = [
    { label: 'AI Backgrounds', active: true },
    { label: 'Video BG', active: false },
    { label: 'Split Screen', active: false },
  ];

  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Studio</div>

      {/* Mode pills */}
      <div style={{ display: 'flex', gap: 10 }}>
        {modes.map((m, i) => (
          <div
            key={i}
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              background: m.active ? C.accent : C.glass,
              border: `1px solid ${m.active ? C.accent : C.glassBorder}`,
              fontSize: 14,
              fontWeight: 600,
              color: m.active ? '#fff' : C.textSecondary,
            }}
          >
            {m.label}
          </div>
        ))}
      </div>

      {/* Generation progress */}
      <div
        style={{
          padding: 20,
          borderRadius: 14,
          background: C.glass,
          border: `1px solid ${C.glassBorder}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>
          Generating: "What is a Black Hole?"
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 13, color: C.textSecondary }}>
          <span>Voice: Nova</span>
          <span>•</span>
          <span>Caption: Karaoke</span>
          <span>•</span>
          <span>Music: Ambient Space</span>
        </div>
        <div
          style={{
            height: 6,
            borderRadius: 3,
            background: 'rgba(255,255,255,0.06)',
            overflow: 'hidden',
          }}
        >
          <div style={{ width: '65%', height: '100%', borderRadius: 3, background: GRADIENT }} />
        </div>
        <div style={{ fontSize: 12, color: C.fcHeat }}>Rendering video...</div>
      </div>
    </div>
  );
};

export const UIShowcaseScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Determine which screen to show (3 screens, ~100 frames each)
  const screenIndex = frame < 100 ? 0 : frame < 200 ? 1 : 2;

  const screens = [<DashboardMock />, <ResearchMock />, <StudioMock />];
  const labels = ['Dashboard', 'Research Panel', 'Studio'];

  // Transition
  const transitionFrame = frame < 100 ? frame : frame < 200 ? frame - 100 : frame - 200;
  const fadeIn = interpolate(transitionFrame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Browser entrance
  const browserSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 60 },
  });
  const browserScale = interpolate(browserSpring, [0, 1], [0.9, 1]);
  const browserOpacity = interpolate(browserSpring, [0, 1], [0, 1]);

  // Scene fade out
  const fadeOut = interpolate(frame, [270, 300], [1, 0], {
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
      <div
        style={{
          transform: `scale(${browserScale})`,
          opacity: browserOpacity,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: C.fcHeat,
            textTransform: 'uppercase',
            letterSpacing: 3,
          }}
        >
          {labels[screenIndex]}
        </div>
        <MockBrowser>
          <div style={{ opacity: fadeIn }}>{screens[screenIndex]}</div>
        </MockBrowser>
      </div>
    </AbsoluteFill>
  );
};
