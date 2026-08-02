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

let state: AppState = {
  pipeline: createConflictPipeline(),
  sampleUrl: "https://ryanjohnson.dev/",
  evaluation: null,
  insertAt: null,
  highlightIds: new Set(),
};

function paint() {
  root.innerHTML = renderApp(state);
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
    state = runReplay(state);
    paint();
  }
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
    paint();
    return;
  }

  if (t.matches("[data-sample]")) {
    state = { ...state, sampleUrl: t.value };
  }
});

paint();
state = runReplay(state);
paint();
