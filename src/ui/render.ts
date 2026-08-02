import {
  RULE_CATALOG,
  acceptedKinds,
  type EvaluationResult,
} from "../core/index.ts";
import type { ControllerState } from "../controller/state.ts";
import type { Step } from "../core/index.ts";

export type { ControllerState };

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

function renderStep(step: Step, state: ControllerState): string {
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

function renderPipeline(state: ControllerState): string {
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

function renderTrace(state: ControllerState): string {
  const ev = state.evaluation;
  if (!ev) {
    return `<p class="banner">Enter a sample URL above the map to walk it through this pipeline.</p>`;
  }

  const sampleError = ev.events.find((e) => e.status === "error");
  const banner =
    sampleError ?
      `<p class="banner danger">${esc(sampleError.detail)}</p>`
    : ev.loopDetected ?
      `<p class="banner danger">Loop detected — two redirect steps disagree on canonical host. Align them or remove one.</p>`
    : ev.finalUrl ?
      `<p class="banner ok">Settled at <code>${esc(ev.finalUrl)}</code></p>`
    : "";

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

function renderPalette(state: ControllerState): string {
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

/** Render the full demo shell from headless controller state. */
export function renderApp(state: ControllerState): string {
  return `
    <header class="hero">
      <p class="eyebrow">
        <a class="eyebrow-link" href="https://hci-nerdz.github.io/">HCI Nerdz</a>
        <span class="eyebrow-sep" aria-hidden="true">·</span>
        <span class="eyebrow-label">Processing map</span>
      </p>
      <h1>Pipeline composer</h1>
      <p class="hero-tagline">A processing-map demo — sequence-first composition for ordered systems.</p>
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
      </div>
    </header>

    <section class="context-bar" aria-label="Demo scenario">
      <div class="context-bar-inner">
        <p class="context-label">Scenario</p>
        <label class="context-field">
          <span class="sr-only">Which pipeline story to load</span>
          <select data-scenario>
            <option value="conflict" ${state.pipeline.id === "edge-conflict" ? "selected" : ""}>Apex/www conflict</option>
            <option value="fixed" ${state.pipeline.id === "edge-fixed" ? "selected" : ""}>Aligned canonical host</option>
          </select>
        </label>
        <p class="context-hint">Loads a starting pipeline — mental setup before you edit the map.</p>
      </div>
    </section>

    <section class="activity" aria-labelledby="map-heading">
      <div class="activity-head">
        <p class="activity-eyebrow">Compose</p>
        <h2 id="map-heading">${esc(state.pipeline.title)}</h2>
        <p class="activity-desc">${esc(state.pipeline.description)}</p>
      </div>

      <div class="activity-probe-wrap">
        <div class="activity-probe">
          <label>
            Sample URL
            <span class="field-hint">Replay updates as you type — the request you are thinking about while composing</span>
            <input type="url" data-sample value="${esc(state.sampleUrl)}" placeholder="https://example.com/path" />
          </label>
        </div>

        <aside class="compose-tip" data-compose-tip aria-labelledby="compose-tip-heading" hidden>
          <button type="button" class="compose-tip-close" data-dismiss-compose-tip aria-label="Dismiss tip">×</button>
          <p id="compose-tip-heading" class="compose-tip-copy">
            Add a step to the pipeline with the <strong>+</strong> controls between stages — each opens a typed palette.
          </p>
          <button type="button" class="compose-tip-got-it ghost" data-dismiss-compose-tip>Got it</button>
        </aside>
      </div>

      <svg class="compose-tip-arrows" data-compose-tip-svg aria-hidden="true" hidden></svg>

      <div class="map-shell">
        ${renderPipeline(state)}
      </div>
    </section>

    <section class="aux" aria-labelledby="trace-heading">
      <div class="aux-head">
        <div>
          <p class="aux-eyebrow">Consequence</p>
          <h2 id="trace-heading">Path replay</h2>
          <p class="aux-desc">Trace for the sample URL above — updates automatically; use Replay path to re-run after map edits.</p>
        </div>
        <button type="button" class="primary" data-replay title="Re-run path replay">Replay path</button>
      </div>
      <div class="aux-body">
        <div class="panel trace-panel">
          ${renderTrace(state)}
        </div>
        <aside class="panel idea-panel" aria-labelledby="idea-heading">
          <h3 id="idea-heading">Why this UI</h3>
          <p class="banner">
            Cloudflare’s redirect rule and GitHub’s primary domain were never shown as one spine.
            Proxying put both in the same request path — the loop was a visibility bug as much as a config bug.
          </p>
          <ul>
            <li>One map for one runtime order</li>
            <li>Insert between steps; palette is type-filtered</li>
            <li>Parallelism nests inside composite steps</li>
            <li>Replay beats folklore about “how the edge really works”</li>
          </ul>
        </aside>
      </div>
    </section>

    <p class="footnote">
      Prototype for the pattern described in
      <em>Sequence as the top-level: pipeline composer interfaces</em>.
      Not a Cloudflare/GitHub admin replacement — a legibility experiment.
    </p>

    ${renderPalette(state)}
  `;
}

export type { EvaluationResult };
