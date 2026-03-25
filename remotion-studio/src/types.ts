import { z } from "zod";

export const SceneEntrySchema = z.object({
  template: z.enum([
    "title_reveal",
    "fact_card",
    "narrative",
    "split_info",
    "cta_outro",
  ]),
  from: z.number().int().min(0),
  durationInFrames: z.number().int().min(1),
  props: z.record(z.any()),
});

export const SceneConfigSchema = z.object({
  fps: z.number().int().default(30),
  width: z.number().int().default(1080),
  height: z.number().int().default(1920),
  scenes: z.array(SceneEntrySchema).min(1),
});

export type SceneEntry = z.infer<typeof SceneEntrySchema>;
export type SceneConfig = z.infer<typeof SceneConfigSchema>;

// Template-specific prop types
export interface TitleRevealProps {
  title: string;
  subtitle?: string;
  tagline?: string;
  colorScheme?: "warm" | "cool" | "neon" | "minimal";
}

export interface FactCardProps {
  number: string;
  label: string;
  icon?: string;
  accentColor?: string;
}

export interface NarrativeProps {
  text: string;
  style?: "cinematic" | "minimal" | "bold";
  highlightWords?: string[];
}

export interface SplitInfoProps {
  heading: string;
  points: string[];
  side?: "left" | "right";
  accentColor?: string;
}

export interface CTAOutroProps {
  headline: string;
  subtext?: string;
  brandColor?: string;
}
