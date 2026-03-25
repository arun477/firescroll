import React, { useEffect, useRef, useState, useCallback } from "react";
import { Player, PlayerRef } from "@remotion/player";
import { AbsoluteFill, Sequence, spring, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { DynamicVideo, TEMPLATE_MAP } from "./DynamicVideo";
import type { SceneConfig } from "./types";

// Expose Remotion primitives globally so agent-generated code can use them
(window as any).__REMOTION__ = { React, AbsoluteFill, Sequence, spring, interpolate, useCurrentFrame, useVideoConfig };

const DEFAULT: SceneConfig = {
  fps: 30, width: 1080, height: 1920,
  scenes: [{
    template: "generic", from: 0, durationInFrames: 90,
    props: {
      backgroundColor: "#0a0a0f",
      textLayers: [{
        text: "Motion Director", fontSize: 64, color: "#fff",
        glowColor: "#E63250", animation: "spring-in", y: "center", textAlign: "center",
      }],
      particles: true, particleColor: "#E63250",
    },
  }],
};

function getTotalFrames(config: SceneConfig): number {
  let max = 0;
  for (const s of config.scenes) {
    const end = s.from + s.durationInFrames;
    if (end > max) max = end;
  }
  return max || 90;
}

/**
 * Custom component renderer — takes agent-generated JS code and renders it.
 * The code should be a function body that returns a React element.
 * Available in scope: React, AbsoluteFill, spring, interpolate, useCurrentFrame, useVideoConfig
 */
function CustomCodeScene({ code }: { code: string }) {
  const frame = useCurrentFrame();
  const config = useVideoConfig();

  try {
    const R = React;
    const fn = new Function(
      "React", "AbsoluteFill", "spring", "interpolate",
      "useCurrentFrame", "useVideoConfig", "frame", "fps", "width", "height",
      code
    );
    const element = fn(
      R, AbsoluteFill, spring, interpolate,
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
}

/**
 * Enhanced DynamicVideo that supports custom code scenes alongside template scenes.
 */
function EnhancedVideo({ sceneConfig, customScenes }: { sceneConfig: SceneConfig; customScenes?: Record<number, string> }) {
  if (!customScenes || Object.keys(customScenes).length === 0) {
    return <DynamicVideo sceneConfig={sceneConfig} />;
  }

  return (
    <AbsoluteFill style={{ background: "#0a0a0f" }}>
      {sceneConfig.scenes.map((scene, i) => {
        const customCode = customScenes[i];
        return (
          <Sequence key={i} from={scene.from} durationInFrames={scene.durationInFrames} name={`scene_${i}`}>
            <AbsoluteFill>
              {customCode ? (
                <CustomCodeScene code={customCode} />
              ) : (
                (() => {
                  // Fall back to template rendering
                  const Template = TEMPLATE_MAP[scene.template];
                  return Template ? <Template {...scene.props} /> : null;
                })()
              )}
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

export const PreviewApp: React.FC = () => {
  const [config, setConfig] = useState<SceneConfig>(
    (window as any).__SCENE_CONFIG__ || DEFAULT
  );
  const [customScenes, setCustomScenes] = useState<Record<number, string>>({});
  const playerRef = useRef<PlayerRef>(null);

  const handleMessage = useCallback((event: MessageEvent) => {
    const { type, payload } = event.data || {};
    switch (type) {
      case "SCENE_CONFIG_UPDATE":
        if (payload?.scenes?.length) {
          setConfig(payload);
        }
        break;
      case "CUSTOM_SCENE_CODE":
        // payload: { sceneIndex: number, code: string }
        if (typeof payload?.sceneIndex === "number" && payload?.code) {
          setCustomScenes(prev => ({ ...prev, [payload.sceneIndex]: payload.code }));
        }
        break;
      case "CLEAR_CUSTOM_SCENES":
        setCustomScenes({});
        break;
      case "PLAY":
        playerRef.current?.play();
        break;
      case "PAUSE":
        playerRef.current?.pause();
        break;
      case "SEEK":
        if (typeof payload?.frame === "number") {
          playerRef.current?.seekTo(payload.frame);
        }
        break;
    }
  }, []);

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    window.parent.postMessage({ type: "PLAYER_READY" }, "*");
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  const totalFrames = getTotalFrames(config);

  return (
    <div style={{
      width: "100vw", height: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0a0a0f",
    }}>
      <Player
        ref={playerRef}
        component={EnhancedVideo as any}
        inputProps={{ sceneConfig: config, customScenes }}
        durationInFrames={totalFrames}
        fps={config.fps || 30}
        compositionWidth={config.width || 1080}
        compositionHeight={config.height || 1920}
        style={{
          width: "100%",
          maxHeight: "100vh",
          aspectRatio: `${config.width || 1080} / ${config.height || 1920}`,
        }}
        controls
        loop
        autoPlay
      />
    </div>
  );
};
