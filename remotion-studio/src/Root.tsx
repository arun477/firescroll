import { Composition } from "remotion";
import { DynamicVideo } from "./DynamicVideo";
import type { SceneConfig } from "./types";

const DEFAULT_CONFIG: SceneConfig = {
  fps: 30,
  width: 1080,
  height: 1920,
  scenes: [
    {
      template: "title_reveal",
      from: 0,
      durationInFrames: 120,
      props: { title: "FireScroll", subtitle: "AI-Powered Video Generation", colorScheme: "warm" },
    },
    {
      template: "fact_card",
      from: 120,
      durationInFrames: 120,
      props: { number: "10x", label: "Faster than manual editing" },
    },
    {
      template: "narrative",
      from: 240,
      durationInFrames: 150,
      props: { text: "Research any topic. Generate cinema-quality videos. In any language.", style: "cinematic" },
    },
    {
      template: "cta_outro",
      from: 390,
      durationInFrames: 90,
      props: { headline: "Try FireScroll", subtext: "Built with ElevenLabs + Firecrawl" },
    },
  ],
};

function getTotalFrames(config: SceneConfig): number {
  let max = 0;
  for (const scene of config.scenes) {
    const end = scene.from + scene.durationInFrames;
    if (end > max) max = end;
  }
  return max || 300;
}

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DynamicVideo"
        component={DynamicVideo}
        durationInFrames={getTotalFrames(DEFAULT_CONFIG)}
        fps={DEFAULT_CONFIG.fps}
        width={DEFAULT_CONFIG.width}
        height={DEFAULT_CONFIG.height}
        defaultProps={{ sceneConfig: DEFAULT_CONFIG }}
        calculateMetadata={({ props }) => {
          const config = props.sceneConfig;
          return {
            durationInFrames: getTotalFrames(config),
            fps: config.fps || 30,
            width: config.width || 1080,
            height: config.height || 1920,
          };
        }}
      />
    </>
  );
};
