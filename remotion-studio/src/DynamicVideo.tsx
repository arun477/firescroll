import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import type { SceneConfig, SceneEntry } from "./types";
import { TitleRevealScene } from "./scenes/TitleRevealScene";
import { FactCardScene } from "./scenes/FactCardScene";
import { NarrativeScene } from "./scenes/NarrativeScene";
import { SplitInfoScene } from "./scenes/SplitInfoScene";
import { CTAOutroScene } from "./scenes/CTAOutroScene";
import { GenericScene } from "./scenes/GenericScene";

const TEMPLATE_MAP: Record<string, React.FC<any>> = {
  title_reveal: TitleRevealScene,
  fact_card: FactCardScene,
  narrative: NarrativeScene,
  split_info: SplitInfoScene,
  cta_outro: CTAOutroScene,
  generic: GenericScene,
};

export const DynamicVideo: React.FC<{ sceneConfig: SceneConfig }> = ({ sceneConfig }) => {
  return (
    <AbsoluteFill style={{ background: "#0a0a0f" }}>
      {sceneConfig.scenes.map((scene: SceneEntry, i: number) => {
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
