import { Composition } from 'remotion';
import { FireScrollDemo } from './Video';
import { FPS, WIDTH, HEIGHT, TOTAL_FRAMES } from './constants';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="FireScrollDemo"
        component={FireScrollDemo}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="FireScrollDemoVertical"
        component={FireScrollDemo}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={1080}
        height={1920}
      />
    </>
  );
};
