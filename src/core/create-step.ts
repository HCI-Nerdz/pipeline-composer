import { catalogEntry, newId, type RuleKind, type Step } from "./types.ts";

/** Build a new step from catalog defaults for the given kind. */
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
