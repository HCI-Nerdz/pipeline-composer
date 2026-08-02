import "./styles.css";
import { PipelineController, type ControllerState, type Scenario } from "./controller/index.ts";
import type { RuleKind } from "./core/index.ts";
import { renderApp } from "./ui/render.ts";

const rootEl = document.querySelector<HTMLDivElement>("#app");
if (!rootEl) throw new Error("#app missing");
const root: HTMLDivElement = rootEl;

const SAMPLE_REPLAY_MS = 280;

const controller = new PipelineController();

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

function paint(state: ControllerState) {
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
    controller.replay();
  }, SAMPLE_REPLAY_MS);
}

function replaySampleNow() {
  if (sampleReplayTimer !== null) {
    clearTimeout(sampleReplayTimer);
    sampleReplayTimer = null;
  }
  controller.replay();
}

controller.subscribe(paint);

root.addEventListener("click", (event) => {
  const t = event.target;
  if (!(t instanceof HTMLElement)) return;

  if (t.closest("[data-close-palette]") && !t.closest("[data-add-kind]")) {
    if (t.hasAttribute("data-close-palette") || t.classList.contains("palette-backdrop")) {
      controller.closePalette();
      return;
    }
  }

  const insert = t.closest<HTMLElement>("[data-insert]");
  if (insert) {
    controller.openInsertAt(Number(insert.dataset.insert));
    return;
  }

  const add = t.closest<HTMLElement>("[data-add-kind]");
  if (add?.dataset.addKind && controller.getState().insertAt !== null) {
    controller.insertStep(add.dataset.addKind as RuleKind);
    return;
  }

  if (t.closest("[data-replay]")) {
    replaySampleNow();
  }
});

root.addEventListener("input", (event) => {
  const t = event.target;
  if (!(t instanceof HTMLInputElement) || !t.matches("[data-sample]")) return;
  controller.setSampleUrl(t.value);
  scheduleSampleReplay();
});

root.addEventListener("change", (event) => {
  const t = event.target;
  if (!(t instanceof HTMLSelectElement) && !(t instanceof HTMLInputElement)) return;

  if (t.matches("[data-scenario]")) {
    controller.setScenario(t.value as Scenario);
    return;
  }

  if (t.matches("[data-sample]")) {
    controller.setSampleUrl(t.value);
    replaySampleNow();
  }
});

paint(controller.getState());
