import "./styles.css";
import { PipelineController, type ControllerState, type Scenario } from "./controller/index.ts";
import type { RuleKind } from "./core/index.ts";
import { renderApp } from "./ui/render.ts";

const rootEl = document.querySelector<HTMLDivElement>("#app");
if (!rootEl) throw new Error("#app missing");
const root: HTMLDivElement = rootEl;

const SAMPLE_REPLAY_MS = 280;
const COMPOSE_TIP_DISMISS_KEY = "pipeline-composer.compose-tip.dismissed";
/** Insert indices to highlight — after TLS and after CF redirect (early-middle of map). */
const COMPOSE_TIP_INSERT_TARGETS = [3, 4];

const controller = new PipelineController();

let sampleReplayTimer: ReturnType<typeof setTimeout> | null = null;
let composeTipResizeTimer: ReturnType<typeof setTimeout> | null = null;

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

function composeTipDismissed(): boolean {
  try {
    return localStorage.getItem(COMPOSE_TIP_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function dismissComposeTip() {
  try {
    localStorage.setItem(COMPOSE_TIP_DISMISS_KEY, "1");
  } catch {
    /* storage unavailable — hide for this session only */
  }
  const tip = root.querySelector<HTMLElement>("[data-compose-tip]");
  const svg = root.querySelector<SVGElement>("[data-compose-tip-svg]");
  tip?.setAttribute("hidden", "");
  svg?.setAttribute("hidden", "");
}

function syncComposeTipArrows() {
  const tip = root.querySelector<HTMLElement>("[data-compose-tip]");
  const svg = root.querySelector<SVGSVGElement>("[data-compose-tip-svg]");
  const activity = root.querySelector<HTMLElement>(".activity");
  if (!tip || !svg || !activity) return;

  const hide =
    composeTipDismissed() || window.matchMedia("(max-width: 840px)").matches;

  if (hide) {
    tip.setAttribute("hidden", "");
    svg.setAttribute("hidden", "");
    return;
  }

  tip.removeAttribute("hidden");
  svg.removeAttribute("hidden");

  const activityRect = activity.getBoundingClientRect();
  const width = Math.max(1, Math.round(activityRect.width));
  const height = Math.max(1, Math.round(activityRect.height));
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));

  const tipRect = tip.getBoundingClientRect();
  const origin = {
    x: tipRect.left - activityRect.left + tipRect.width * 0.25,
    y: tipRect.bottom - activityRect.top + 2,
  };

  const paths: string[] = [];
  for (const index of COMPOSE_TIP_INSERT_TARGETS) {
    const btn = root.querySelector<HTMLElement>(`[data-insert="${index}"]`);
    if (!btn) continue;
    const r = btn.getBoundingClientRect();
    const target = {
      x: r.left - activityRect.left + r.width / 2,
      y: r.top - activityRect.top + r.height / 2,
    };
    const bendX = origin.x + (target.x - origin.x) * 0.35;
    const bendY = origin.y + (target.y - origin.y) * 0.55;
    paths.push(
      `<path class="compose-tip-arrow" d="M ${origin.x.toFixed(1)} ${origin.y.toFixed(1)} Q ${bendX.toFixed(1)} ${bendY.toFixed(1)} ${target.x.toFixed(1)} ${target.y.toFixed(1)}" marker-end="url(#compose-tip-arrowhead)"/>`,
    );
  }

  svg.innerHTML = `
    <defs>
      <marker id="compose-tip-arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
        <path d="M0,0 L8,4 L0,8 Z"/>
      </marker>
    </defs>
    ${paths.join("")}
  `;
}

function scheduleComposeTipSync() {
  if (composeTipResizeTimer !== null) {
    clearTimeout(composeTipResizeTimer);
  }
  composeTipResizeTimer = setTimeout(() => {
    composeTipResizeTimer = null;
    syncComposeTipArrows();
  }, 50);
}

function paint(state: ControllerState) {
  const focus = sampleFieldFocus();
  root.innerHTML = renderApp(state);
  restoreSampleFieldFocus(focus);
  scheduleComposeTipSync();
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
    return;
  }

  if (t.closest("[data-dismiss-compose-tip]")) {
    dismissComposeTip();
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

window.addEventListener("resize", scheduleComposeTipSync);

paint(controller.getState());
