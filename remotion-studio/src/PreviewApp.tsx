import React, { useEffect, useRef, useState, useCallback } from "react";
import { Player, PlayerRef } from "@remotion/player";
import { DynamicVideo } from "./DynamicVideo";
import type { SceneConfig } from "./types";

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

export const PreviewApp: React.FC = () => {
  const [config, setConfig] = useState<SceneConfig>(
    (window as any).__SCENE_CONFIG__ || DEFAULT
  );
  const playerRef = useRef<PlayerRef>(null);

  const handleMessage = useCallback((event: MessageEvent) => {
    const { type, payload } = event.data || {};
    switch (type) {
      case "SCENE_CONFIG_UPDATE":
        if (payload?.scenes?.length) {
          setConfig(payload);
        }
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
    // Signal to parent that we're ready
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
        component={DynamicVideo}
        inputProps={{ sceneConfig: config }}
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
