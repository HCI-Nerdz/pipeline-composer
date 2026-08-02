import {
  createConflictPipeline,
  createFixedPipeline,
  createStep,
  replayPipeline,
  type RuleKind,
} from "../core/index.ts";
import type { ControllerState, Scenario } from "./state.ts";

export type { ControllerState, Scenario } from "./state.ts";

type StateListener = (state: ControllerState) => void;

const DEFAULT_SAMPLE_URL = "https://ryanjohnson.dev/";

function initialState(): ControllerState {
  const pipeline = createConflictPipeline();
  const sampleUrl = DEFAULT_SAMPLE_URL;
  const { evaluation, highlightIds } = replayPipeline(pipeline, sampleUrl);
  return {
    pipeline,
    sampleUrl,
    evaluation,
    insertAt: null,
    highlightIds,
  };
}

/**
 * Framework-agnostic headless controller for pipeline composition.
 * DOM, React, Solid, and canvas adapters bind events to these actions.
 */
export class PipelineController {
  #state: ControllerState;
  #listeners = new Set<StateListener>();

  constructor(seed?: Partial<Pick<ControllerState, "pipeline" | "sampleUrl">>) {
    this.#state = initialState();
    if (seed?.pipeline) {
      this.#state = { ...this.#state, pipeline: seed.pipeline };
    }
    if (seed?.sampleUrl !== undefined) {
      this.#state = { ...this.#state, sampleUrl: seed.sampleUrl };
    }
    if (seed) {
      const replay = replayPipeline(this.#state.pipeline, this.#state.sampleUrl);
      this.#state = { ...this.#state, ...replay };
    }
  }

  getState(): ControllerState {
    return this.#state;
  }

  subscribe(listener: StateListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #emit(): void {
    for (const listener of this.#listeners) {
      listener(this.#state);
    }
  }

  #patch(partial: Partial<ControllerState>): void {
    this.#state = { ...this.#state, ...partial };
    this.#emit();
  }

  setScenario(scenario: Scenario): void {
    const pipeline =
      scenario === "fixed" ? createFixedPipeline() : createConflictPipeline();
    const sampleUrl =
      scenario === "fixed" ? DEFAULT_SAMPLE_URL : this.#state.sampleUrl;
    const replay = replayPipeline(pipeline, sampleUrl);
    this.#patch({
      pipeline,
      sampleUrl,
      insertAt: null,
      ...replay,
    });
  }

  setSampleUrl(url: string): void {
    this.#patch({ sampleUrl: url });
  }

  openInsertAt(index: number): void {
    this.#patch({ insertAt: index });
  }

  closePalette(): void {
    this.#patch({ insertAt: null });
  }

  insertStep(kind: RuleKind): void {
    if (this.#state.insertAt === null) return;

    const steps = [...this.#state.pipeline.steps];
    steps.splice(this.#state.insertAt, 0, createStep(kind));
    this.#patch({
      pipeline: { ...this.#state.pipeline, steps },
      insertAt: null,
      evaluation: null,
      highlightIds: new Set(),
    });
  }

  replay(): void {
    const replay = replayPipeline(this.#state.pipeline, this.#state.sampleUrl);
    this.#patch(replay);
  }
}
