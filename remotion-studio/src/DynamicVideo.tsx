import React from "react";
import { AbsoluteFill, Sequence, spring, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { SceneConfig, SceneEntry } from "./types";
import { TitleRevealScene } from "./scenes/TitleRevealScene";
import { FactCardScene } from "./scenes/FactCardScene";
import { NarrativeScene } from "./scenes/NarrativeScene";
import { SplitInfoScene } from "./scenes/SplitInfoScene";
import { CTAOutroScene } from "./scenes/CTAOutroScene";
import { GenericScene } from "./scenes/GenericScene";

export const TEMPLATE_MAP: Record<string, React.FC<any>> = {
  title_reveal: TitleRevealScene,
  fact_card: FactCardScene,
  narrative: NarrativeScene,
  split_info: SplitInfoScene,
  cta_outro: CTAOutroScene,
  generic: GenericScene,
};

/** Renders agent-generated JS code as a React component. */
const CustomCodeScene: React.FC<{ code: string }> = ({ code }) => {
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  try {
    const fn = new Function(
      "React", "AbsoluteFill", "spring", "interpolate",
      "useCurrentFrame", "useVideoConfig", "frame", "fps", "width", "height",
      code
    );
    const element = fn(
      React, AbsoluteFill, spring, interpolate,
      useCurrentFrame, useVideoConfig, frame, config.fps, config.width, config.height
    );
    return element || null;
  } catch (err) {
    return (
      <AbsoluteFill style={{ background: "#1a0000", display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div style={{ color: "#ef4444", fontSize: 18, fontFamily: "monospace", textAlign: "center" }}>
          {String(err)}
        </div>
      </AbsoluteFill>
    );
  }
};

export const DynamicVideo: React.FC<{
  sceneConfig: SceneConfig;
  customCode?: Record<string, string>;
}> = ({ sceneConfig, customCode }) => {
  return (
    <AbsoluteFill style={{ background: "#0a0a0f" }}>
      {sceneConfig.scenes.map((scene: SceneEntry, i: number) => {
        // Custom code scenes — agent-generated
        const code = customCode?.[String(i)];
        if (scene.template === "custom_code" && code) {
          return (
            <Sequence key={i} from={scene.from} durationInFrames={scene.durationInFrames} name={`code_${i}`}>
              <AbsoluteFill>
                <CustomCodeScene code={code} />
              </AbsoluteFill>
            </Sequence>
          );
        }

        // Template scenes — standard pipeline
        const Template = TEMPLATE_MAP[scene.template];
        if (!Template) {
          console.warn(`Unknown template: ${scene.template}`);
          return null;
        }
        return (
          <Sequence
            key={i}
            from={scene.from}
            durationInFrames={scene.durationInFrames}
            name={`${scene.template}_${i}`}
          >
            <AbsoluteFill>
              <Template {...scene.props} />
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
