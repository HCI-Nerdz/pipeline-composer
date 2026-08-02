import "./styles.css";
import { createConflictPipeline, createFixedPipeline } from "./model/demo-pipeline.ts";
import {
  createStep,
  renderApp,
  runReplay,
  type AppState,
} from "./ui/render.ts";
import type { RuleKind } from "./model/types.ts";

const rootEl = document.querySelector<HTMLDivElement>("#app");
if (!rootEl) throw new Error("#app missing");
const root: HTMLDivElement = rootEl;

const SAMPLE_REPLAY_MS = 280;

let state: AppState = {
  pipeline: createConflictPipeline(),
  sampleUrl: "https://ryanjohnson.dev/",
  evaluation: null,
  insertAt: null,
  highlightIds: new Set(),
};

let sampleReplayTimer: ReturnType<typeof setTimeout> | null = null;

interface SampleFieldFocus {
  selectionStart: number | null;
  selectionEnd: number | null;
}

function sampleFieldFocus(): SampleFieldFocus | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLInputElement) || !active.matches("[data-sample]")) {
    return null;
  }
  return {
    selectionStart: active.selectionStart,
    selectionEnd: active.selectionEnd,
  };
}

function restoreSampleFieldFocus(focus: SampleFieldFocus | null) {
  if (!focus) return;
  const el = root.querySelector<HTMLInputElement>("[data-sample]");
  if (!el) return;
  el.focus();
  if (focus.selectionStart !== null && focus.selectionEnd !== null) {
    el.setSelectionRange(focus.selectionStart, focus.selectionEnd);
  }
}

function paint() {
  const focus = sampleFieldFocus();
  root.innerHTML = renderApp(state);
  restoreSampleFieldFocus(focus);
}

function scheduleSampleReplay() {
  if (sampleReplayTimer !== null) {
    clearTimeout(sampleReplayTimer);
  }
  sampleReplayTimer = setTimeout(() => {
    sampleReplayTimer = null;
    state = runReplay(state);
    paint();
  }, SAMPLE_REPLAY_MS);
}

function replaySampleNow() {
  if (sampleReplayTimer !== null) {
    clearTimeout(sampleReplayTimer);
    sampleReplayTimer = null;
  }
  state = runReplay(state);
  paint();
}

root.addEventListener("click", (event) => {
  const t = event.target;
  if (!(t instanceof HTMLElement)) return;

  if (t.closest("[data-close-palette]") && !t.closest("[data-add-kind]")) {
    if (t.hasAttribute("data-close-palette") || t.classList.contains("palette-backdrop")) {
      state = { ...state, insertAt: null };
      paint();
      return;
    }
  }

  const insert = t.closest<HTMLElement>("[data-insert]");
  if (insert) {
    state = { ...state, insertAt: Number(insert.dataset.insert) };
    paint();
    return;
  }

  const add = t.closest<HTMLElement>("[data-add-kind]");
  if (add?.dataset.addKind && state.insertAt !== null) {
    const kind = add.dataset.addKind as RuleKind;
    const steps = [...state.pipeline.steps];
    steps.splice(state.insertAt, 0, createStep(kind));
    state = {
      ...state,
      pipeline: { ...state.pipeline, steps },
      insertAt: null,
      evaluation: null,
      highlightIds: new Set(),
    };
    paint();
    return;
  }

  if (t.closest("[data-replay]")) {
    replaySampleNow();
  }
});

root.addEventListener("input", (event) => {
  const t = event.target;
  if (!(t instanceof HTMLInputElement) || !t.matches("[data-sample]")) return;
  state = { ...state, sampleUrl: t.value };
  scheduleSampleReplay();
});

root.addEventListener("change", (event) => {
  const t = event.target;
  if (!(t instanceof HTMLSelectElement) && !(t instanceof HTMLInputElement)) return;

  if (t.matches("[data-scenario]")) {
    const value = t.value;
    state = {
      pipeline: value === "fixed" ? createFixedPipeline() : createConflictPipeline(),
      sampleUrl: value === "fixed" ? "https://ryanjohnson.dev/" : state.sampleUrl,
      evaluation: null,
      insertAt: null,
      highlightIds: new Set(),
    };
    replaySampleNow();
    return;
  }

  if (t.matches("[data-sample]")) {
    state = { ...state, sampleUrl: t.value };
    replaySampleNow();
  }
});

paint();
state = runReplay(state);
paint();
