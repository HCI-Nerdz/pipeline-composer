import { evaluatePipeline, type EvaluationResult } from "./evaluate.ts";
import type { Pipeline } from "./types.ts";

export interface ReplayResult {
  evaluation: EvaluationResult;
  highlightIds: ReadonlySet<string>;
}

/** Evaluate a sample URL against a pipeline and derive highlight step ids. */
export function replayPipeline(pipeline: Pipeline, sampleUrl: string): ReplayResult {
  const evaluation = evaluatePipeline(pipeline, { url: sampleUrl });
  const highlightIds = new Set(
    evaluation.events
      .filter((e) => e.status === "matched" || e.status === "loop")
      .map((e) => e.stepId),
  );
  return { evaluation, highlightIds };
}
