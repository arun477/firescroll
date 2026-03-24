import { AbsoluteFill, Sequence } from 'remotion';
import { SCENES, C, FONT } from './constants';
import { ProblemScene } from './scenes/ProblemScene';
import { IntroScene } from './scenes/IntroScene';
import { WorkflowScene } from './scenes/WorkflowScene';
import { UIShowcaseScene } from './scenes/UIShowcaseScene';
import { OutputScene } from './scenes/OutputScene';
import { CTAScene } from './scenes/CTAScene';

export const FireScrollDemo: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.bg,
        fontFamily: FONT,
        overflow: 'hidden',
      }}
    >
      <Sequence from={SCENES.problem.from} durationInFrames={SCENES.problem.duration}>
        <ProblemScene />
      </Sequence>

      <Sequence from={SCENES.intro.from} durationInFrames={SCENES.intro.duration}>
        <IntroScene />
      </Sequence>

      <Sequence from={SCENES.workflow.from} durationInFrames={SCENES.workflow.duration}>
        <WorkflowScene />
      </Sequence>

      <Sequence from={SCENES.showcase.from} durationInFrames={SCENES.showcase.duration}>
        <UIShowcaseScene />
      </Sequence>

      <Sequence from={SCENES.output.from} durationInFrames={SCENES.output.duration}>
        <OutputScene />
      </Sequence>

      <Sequence from={SCENES.cta.from} durationInFrames={SCENES.cta.duration}>
        <CTAScene />
      </Sequence>
    </AbsoluteFill>
  );
};
