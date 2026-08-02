import { evaluatePipeline, type EvaluationResult } from "../model/evaluate.ts";
import {
  RULE_CATALOG,
  acceptedKinds,
  catalogEntry,
  newId,
  type Pipeline,
  type RuleKind,
  type Step,
} from "../model/types.ts";

export interface AppState {
  pipeline: Pipeline;
  sampleUrl: string;
  evaluation: EvaluationResult | null;
  insertAt: number | null;
  highlightIds: Set<string>;
}

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function shortHost(url: string): string {
  try {
    const u = new URL(url);
    return u.host + (u.pathname === "/" ? "" : u.pathname.replace(/\/$/, ""));
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

function stepMeta(step: Step): string {
  if (step.kind === "redirect" && step.config?.from && step.config?.to) {
    return `${shortHost(step.config.from)} → ${shortHost(step.config.to)}`;
  }
  if (step.config?.vendor) return step.config.vendor;
  if (step.config?.proxy) return step.config.proxy;
  return step.kind;
}

function renderStep(step: Step, state: AppState): string {
  const status = [...state.evaluation?.events ?? []]
    .reverse()
    .find((e) => e.stepId === step.id)?.status;
  const active = state.highlightIds.has(step.id);

  const children =
    step.children?.length ?
      `<div class="children" aria-label="Nested steps">
        ${step.children
          .map(
            (c) =>
              `<div class="child-step"><strong>${esc(c.title)}</strong> — ${esc(c.summary)}</div>`,
          )
          .join("")}
      </div>`
    : "";

  return `
    <article class="step" data-id="${esc(step.id)}" data-active="${active}" data-status="${status ?? ""}">
      <div class="step-kind">${esc(step.kind)}</div>
      <h3>${esc(step.title)}</h3>
      <p class="summary">${esc(step.summary)}</p>
      <div class="meta">${esc(stepMeta(step))}</div>
      ${children}
    </article>
  `;
}

function renderPipeline(state: AppState): string {
  const parts: string[] = [];
  const { steps } = state.pipeline;

  for (let i = 0; i <= steps.length; i += 1) {
    parts.push(`
      <div class="socket">
        <button type="button" data-insert="${i}" title="Insert step" aria-label="Insert step at position ${i}">+</button>
      </div>
    `);
    if (i < steps.length) {
      parts.push(renderStep(steps[i], state));
    }
  }

  return `<div class="pipeline" role="list">${parts.join("")}</div>`;
}

function renderTrace(state: AppState): string {
  const ev = state.evaluation;
  if (!ev) {
    return `<p class="banner">Press <strong>Replay path</strong> to walk a sample URL through the map.</p>`;
  }

  const banner =
    ev.loopDetected ?
      `<p class="banner danger">Loop detected — two redirect steps disagree on canonical host. Align them or remove one.</p>`
    : `<p class="banner ok">Settled at <code>${esc(ev.finalUrl)}</code></p>`;

  const items = ev.events
    .map(
      (e) => `
      <li>
        <span class="status" data-s="${esc(e.status)}">${esc(e.status)}</span>
        <span><strong>${esc(e.title)}</strong> — ${esc(e.detail)}${
          e.urlAfter ? `<br /><span style="color:var(--muted)">${esc(e.urlAfter)}</span>` : ""
        }</span>
      </li>`,
    )
    .join("");

  return `${banner}<ol class="trace">${items}</ol>`;
}

function renderPalette(state: AppState): string {
  if (state.insertAt === null) return "";

  const afterKind =
    state.insertAt === 0 ? null : (state.pipeline.steps[state.insertAt - 1]?.kind ?? null);
  const allowed = new Set(acceptedKinds(afterKind));
  const options = RULE_CATALOG.filter((r) => allowed.has(r.kind));

  return `
    <div class="palette-backdrop" data-close-palette="1">
      <div class="palette" role="dialog" aria-modal="true" aria-labelledby="palette-title">
        <h2 id="palette-title">Insert step</h2>
        <p>Only rule kinds valid after <strong>${esc(afterKind ?? "start")}</strong> are listed. Sequence stays typed.</p>
        <div class="palette-list">
          ${
            options.length === 0 ?
              `<p>No valid kinds at this socket.</p>`
            : options
                .map(
                  (r) => `
              <button type="button" data-add-kind="${r.kind}">
                <strong>${esc(r.label)}</strong>
                <span>${esc(r.blurb)}</span>
              </button>`,
                )
                .join("")
          }
        </div>
        <div class="palette-actions">
          <button type="button" class="ghost" data-close-palette="1">Cancel</button>
        </div>
      </div>
    </div>
  `;
}

export function renderApp(state: AppState): string {
  return `
    <header class="hero">
      <p class="eyebrow">HCI Nerdz · processing map</p>
      <h1>Pipeline composer</h1>
      <p class="lede">
        A <strong>pipeline</strong> is an ordered path a unit of work walks through stages — each
        stage can transform it, stop it, or pass it on — before a final result. This composer puts
        that order on one map: insert typed steps between neighbors, nest parallel checks inside a
        stage, and replay a sample so conflicting rules show up here instead of only in production.
        Example: a web request walking DNS → proxy → redirects → cache → origin (the demo below).
      </p>
      <div class="hero-links">
        <a href="https://hci-nerdz.github.io/blog/pipeline-composer-interfaces/">Essay</a>
        <a href="https://hci-nerdz.github.io/docs/hci-nerdz/processing-maps.html">Docs</a>
        <a href="https://github.com/HCI-Nerdz/pipeline-composer">Repo</a>
        <a href="https://hci-nerdz.github.io/">HCI Nerdz</a>
      </div>
    </header>

    <div class="toolbar">
      <label>
        Scenario
        <select data-scenario>
          <option value="conflict" ${state.pipeline.id === "edge-conflict" ? "selected" : ""}>Apex/www conflict</option>
          <option value="fixed" ${state.pipeline.id === "edge-fixed" ? "selected" : ""}>Aligned canonical host</option>
        </select>
      </label>
      <label>
        Sample URL
        <input type="url" data-sample value="${esc(state.sampleUrl)}" />
      </label>
      <button type="button" class="primary" data-replay>Replay path</button>
    </div>

    <section class="map-shell" aria-labelledby="map-heading">
      <div class="map-title">
        <div>
          <h2 id="map-heading">${esc(state.pipeline.title)}</h2>
          <p>${esc(state.pipeline.description)}</p>
        </div>
      </div>
      ${renderPipeline(state)}
    </section>

    <div class="panels">
      <section class="panel" aria-labelledby="trace-heading">
        <h2 id="trace-heading">Path replay</h2>
        ${renderTrace(state)}
      </section>
      <section class="panel" aria-labelledby="idea-heading">
        <h2 id="idea-heading">Why this UI</h2>
        <p class="banner">
          Cloudflare’s redirect rule and GitHub’s primary domain were never shown as one spine.
          Proxying put both in the same request path — the loop was a visibility bug as much as a config bug.
        </p>
        <ul style="margin:0;padding-left:1.1rem;color:var(--muted);font-size:0.92rem">
          <li>One map for one runtime order</li>
          <li>Insert between steps; palette is type-filtered</li>
          <li>Parallelism nests inside composite steps</li>
          <li>Replay beats folklore about “how the edge really works”</li>
        </ul>
      </section>
    </div>

    <p class="footnote">
      Prototype for the pattern described in
      <em>Sequence is the top-level: pipeline composer interfaces</em>.
      Not a Cloudflare/GitHub admin replacement — a legibility experiment.
    </p>

    ${renderPalette(state)}
  `;
}

export function createStep(kind: RuleKind): Step {
  const entry = catalogEntry(kind);
  const step: Step = {
    id: newId(kind),
    kind,
    title: entry.defaultTitle,
    summary: entry.defaultSummary,
  };

  if (kind === "redirect") {
    step.config = {
      from: "https://example.com",
      to: "https://www.example.com/",
    };
    step.summary = "example.com → www.example.com";
  }

  if (kind === "parallel") {
    step.join = "all";
    step.children = [
      {
        id: newId("check"),
        kind: "transform",
        title: "Header check A",
        summary: "Parallel probe A",
      },
      {
        id: newId("check"),
        kind: "transform",
        title: "Header check B",
        summary: "Parallel probe B",
      },
    ];
  }

  if (kind === "branch") {
    step.children = [
      {
        id: newId("arm"),
        kind: "transform",
        title: "If host matches",
        summary: "Taken when predicate matches",
      },
    ];
  }

  return step;
}

export function runReplay(state: AppState): AppState {
  const evaluation = evaluatePipeline(state.pipeline, { url: state.sampleUrl });
  const highlightIds = new Set(
    evaluation.events.filter((e) => e.status === "matched" || e.status === "loop").map((e) => e.stepId),
  );
  return { ...state, evaluation, highlightIds };
}
