import type { EvaluationResult, Pipeline } from "../core/index.ts";

/** Demo scenario presets loaded by the context bar. */
export type Scenario = "conflict" | "fixed";

/** Headless interaction + evaluation state consumed by UI adapters. */
export interface ControllerState {
  pipeline: Pipeline;
  sampleUrl: string;
  evaluation: EvaluationResult | null;
  insertAt: number | null;
  highlightIds: ReadonlySet<string>;
}
