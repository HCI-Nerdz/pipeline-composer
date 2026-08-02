import type { Pipeline, Step } from "./types.ts";

export interface RequestSample {
  url: string;
  method?: string;
}

export type TraceStatus = "applied" | "matched" | "skipped" | "loop" | "done" | "error";

export interface TraceEvent {
  stepId: string;
  title: string;
  status: TraceStatus;
  detail: string;
  urlAfter?: string;
}

export interface EvaluationResult {
  events: TraceEvent[];
  finalUrl: string;
  loopDetected: boolean;
  hopLimit: number;
}

const HOP_LIMIT = 8;

function applyRedirect(step: Step, url: string): { next: string; detail: string } | null {
  const from = step.config?.from?.replace(/\/$/, "") ?? "";
  const to = step.config?.to ?? "";
  if (!from || !to) {
    return null;
  }

  let current: URL;
  try {
    current = new URL(url);
  } catch {
    return null;
  }

  const host = current.host;
  const origin = `${current.protocol}//${host}`;
  const candidates = [origin, `${origin}/`, host, `https://${host}`, `http://${host}`];

  if (!candidates.some((c) => c.replace(/\/$/, "") === from.replace(/\/$/, ""))) {
    return null;
  }

  const next = to.endsWith("/") || current.pathname === "/" ? to.replace(/\/?$/, "/") : to;
  return {
    next: new URL(current.pathname + current.search, next).href,
    detail: `${from} → ${to}`,
  };
}

function walkSteps(
  steps: Step[],
  url: string,
  events: TraceEvent[],
  seen: Set<string>,
): { url: string; loop: boolean; stop: boolean } {
  let current = url;

  for (const step of steps) {
    if (step.kind === "parallel" && step.children?.length) {
      events.push({
        stepId: step.id,
        title: step.title,
        status: "applied",
        detail: `Fan-out (${step.join ?? "all"}), ${step.children.length} branches`,
        urlAfter: current,
      });
      for (const child of step.children) {
        const nested = walkSteps([child], current, events, seen);
        current = nested.url;
        if (nested.loop || nested.stop) {
          return { url: current, loop: nested.loop, stop: nested.stop };
        }
      }
      continue;
    }

    if (step.kind === "branch" && step.children?.length) {
      const chosen = step.children[0];
      events.push({
        stepId: step.id,
        title: step.title,
        status: "matched",
        detail: `Took branch “${chosen.title}”`,
        urlAfter: current,
      });
      const nested = walkSteps([chosen], current, events, seen);
      return nested;
    }

    if (step.kind === "redirect") {
      const hit = applyRedirect(step, current);
      if (!hit) {
        events.push({
          stepId: step.id,
          title: step.title,
          status: "skipped",
          detail: "No host match",
          urlAfter: current,
        });
        continue;
      }

      const hopKey = `${current}=>${hit.next}`;
      if (seen.has(hopKey) || seen.size >= HOP_LIMIT) {
        events.push({
          stepId: step.id,
          title: step.title,
          status: "loop",
          detail: `Loop: ${hit.detail}`,
          urlAfter: hit.next,
        });
        return { url: hit.next, loop: true, stop: true };
      }

      seen.add(hopKey);
      current = hit.next;
      events.push({
        stepId: step.id,
        title: step.title,
        status: "matched",
        detail: hit.detail,
        urlAfter: current,
      });

      // Redirects restart the pipeline from the top in many edges — model that.
      return { url: current, loop: false, stop: false };
    }

    events.push({
      stepId: step.id,
      title: step.title,
      status: "applied",
      detail: step.summary,
      urlAfter: current,
    });
  }

  return { url: current, loop: false, stop: true };
}

/**
 * Replay a sample request through the pipeline.
 * Redirect matches restart evaluation (edge-like), which surfaces apex/www loops.
 */
function invalidSampleResult(detail: string, finalUrl = ""): EvaluationResult {
  return {
    events: [
      {
        stepId: "sample",
        title: "Sample URL",
        status: "error",
        detail,
      },
    ],
    finalUrl,
    loopDetected: false,
    hopLimit: HOP_LIMIT,
  };
}

export function evaluatePipeline(pipeline: Pipeline, sample: RequestSample): EvaluationResult {
  const trimmed = sample.url.trim();
  if (!trimmed) {
    return invalidSampleResult("Enter a URL to replay through the map.");
  }

  try {
    new URL(trimmed);
  } catch {
    return invalidSampleResult(`Invalid URL — use a full address like https://example.com/path`, trimmed);
  }

  const events: TraceEvent[] = [];
  const seen = new Set<string>();
  let url = trimmed;
  let loopDetected = false;
  let guard = 0;

  while (guard < HOP_LIMIT) {
    guard += 1;
    const before = url;
    const result = walkSteps(pipeline.steps, url, events, seen);
    url = result.url;
    if (result.loop) {
      loopDetected = true;
      break;
    }
    if (result.stop) {
      break;
    }
    if (url === before) {
      break;
    }
  }

  if (!loopDetected) {
    events.push({
      stepId: "done",
      title: "Done",
      status: "done",
      detail: `Settled at ${url}`,
      urlAfter: url,
    });
  }

  return {
    events,
    finalUrl: url,
    loopDetected,
    hopLimit: HOP_LIMIT,
  };
}
