export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const DURATION_SECONDS = 45;
export const TOTAL_FRAMES = FPS * DURATION_SECONDS;

// Scene timings (in frames)
export const SCENES = {
  problem:   { from: 0,    duration: 210 },  // 0-7s
  intro:     { from: 210,  duration: 150 },  // 7-12s
  workflow:  { from: 360,  duration: 360 },  // 12-24s
  showcase:  { from: 720,  duration: 300 },  // 24-34s
  output:    { from: 1020, duration: 180 },  // 34-40s
  cta:       { from: 1200, duration: 150 },  // 40-45s
};

// Colors from the real FireScroll app
export const C = {
  bg: '#09090b',
  bgCard: '#0f0f12',
  bgSurface: 'rgba(20, 20, 24, 0.7)',
  glass: 'rgba(20, 20, 24, 0.65)',
  glassBorder: 'rgba(255, 255, 255, 0.06)',
  text: '#fafafa',
  textSecondary: '#a1a1aa',
  textMuted: '#52525b',
  accent: '#ef4444',
  accentHover: '#dc2626',
  accentGlow: 'rgba(239, 68, 68, 0.15)',
  fcHeat: '#FA5D19',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  border: 'rgba(255, 255, 255, 0.08)',
};

export const GRADIENT = 'linear-gradient(135deg, #ef4444, #f97316, #fbbf24)';
export const FONT = 'Inter, -apple-system, BlinkMacSystemFont, sans-serif';

// Flame SVG path from the real app
export const FLAME_PATH = 'M32 4C24 16,14 22,14 36c0,11,8,20,18,20s18-9,18-20c0-8-5-15-10-20c0,10-5,15-8,15s-5-5-2-15z';
