/** Rule kinds that can occupy a pipeline step. */
export type RuleKind =
  | "dns"
  | "proxy"
  | "tls"
  | "redirect"
  | "cache"
  | "transform"
  | "origin"
  | "parallel"
  | "branch";

export type JoinPolicy = "all" | "any" | "race";

export interface Step {
  id: string;
  kind: RuleKind;
  title: string;
  summary: string;
  /** Freeform knobs shown in the expand panel */
  config?: Record<string, string>;
  /** Nested steps for parallel / branch composites */
  children?: Step[];
  join?: JoinPolicy;
}

export interface Pipeline {
  id: string;
  title: string;
  description: string;
  steps: Step[];
}

export interface RuleCatalogEntry {
  kind: RuleKind;
  label: string;
  blurb: string;
  defaultTitle: string;
  defaultSummary: string;
  /** Kinds this rule may follow (empty = anywhere after prior allows it) */
  composite?: boolean;
}

/** What may be inserted after `afterKind` (null = start of pipeline). */
export function acceptedKinds(afterKind: RuleKind | null): RuleKind[] {
  const order: RuleKind[] = [
    "dns",
    "proxy",
    "tls",
    "redirect",
    "cache",
    "transform",
    "origin",
    "parallel",
    "branch",
  ];

  if (afterKind === null) {
    return ["dns", "proxy", "parallel"];
  }

  const phase: Record<RuleKind, number> = {
    dns: 0,
    proxy: 1,
    tls: 2,
    redirect: 3,
    cache: 4,
    transform: 4,
    parallel: 3,
    branch: 3,
    origin: 5,
  };

  const floor = phase[afterKind];
  return order.filter((k) => {
    if (k === "dns" && afterKind !== null) return false;
    if (afterKind === "origin") return false;
    return phase[k] >= floor;
  });
}

export const RULE_CATALOG: RuleCatalogEntry[] = [
  {
    kind: "dns",
    label: "DNS resolve",
    blurb: "Name → address (and proxy orange-cloud).",
    defaultTitle: "DNS",
    defaultSummary: "Resolve hostname",
  },
  {
    kind: "proxy",
    label: "Edge proxy",
    blurb: "Terminate visitor connection at the edge.",
    defaultTitle: "Edge proxy",
    defaultSummary: "Orange-cloud / reverse proxy",
  },
  {
    kind: "tls",
    label: "TLS terminate",
    blurb: "Certificate and HTTPS enforcement.",
    defaultTitle: "TLS",
    defaultSummary: "HTTPS at edge",
  },
  {
    kind: "redirect",
    label: "Redirect rule",
    blurb: "301/302 host or path rewrite.",
    defaultTitle: "Redirect",
    defaultSummary: "HTTP redirect",
  },
  {
    kind: "cache",
    label: "Cache rule",
    blurb: "Cache key and TTL policy.",
    defaultTitle: "Cache",
    defaultSummary: "Edge cache policy",
  },
  {
    kind: "transform",
    label: "Transform",
    blurb: "Header or URL rewrite without redirect.",
    defaultTitle: "Transform",
    defaultSummary: "Rewrite in place",
  },
  {
    kind: "origin",
    label: "Origin fetch",
    blurb: "Talk to the upstream host.",
    defaultTitle: "Origin",
    defaultSummary: "Fetch upstream",
  },
  {
    kind: "parallel",
    label: "Parallel group",
    blurb: "Run sibling checks, then join.",
    defaultTitle: "Parallel checks",
    defaultSummary: "Fan-out then join",
    composite: true,
  },
  {
    kind: "branch",
    label: "Conditional branch",
    blurb: "Pick a sub-path, then rejoin.",
    defaultTitle: "Branch",
    defaultSummary: "If/else then rejoin",
    composite: true,
  },
];

export function catalogEntry(kind: RuleKind): RuleCatalogEntry {
  const entry = RULE_CATALOG.find((r) => r.kind === kind);
  if (!entry) throw new Error(`Unknown kind: ${kind}`);
  return entry;
}

export function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
