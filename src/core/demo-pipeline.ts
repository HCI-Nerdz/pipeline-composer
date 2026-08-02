import { newId, type Pipeline } from "./types.ts";

/** Motivating demo: Cloudflare apex→www fights GitHub www→apex. */
export function createConflictPipeline(): Pipeline {
  return {
    id: "edge-conflict",
    title: "Edge request path (conflict)",
    description:
      "One spine for DNS → proxy → redirects → origin. Two redirect rules disagree; replay shows the loop.",
    steps: [
      {
        id: newId("dns"),
        kind: "dns",
        title: "DNS (proxied)",
        summary: "ryanjohnson.dev → Cloudflare anycast",
        config: { proxy: "orange-cloud" },
      },
      {
        id: newId("proxy"),
        kind: "proxy",
        title: "Cloudflare proxy",
        summary: "Visitor hits CF first; origin is GitHub Pages",
      },
      {
        id: newId("tls"),
        kind: "tls",
        title: "TLS at edge",
        summary: "HTTPS enforced by Cloudflare",
      },
      {
        id: newId("redir-cf"),
        kind: "redirect",
        title: "CF redirect rule",
        summary: "apex → www",
        config: {
          from: "https://ryanjohnson.dev",
          to: "https://www.ryanjohnson.dev/",
          vendor: "Cloudflare",
        },
      },
      {
        id: newId("redir-gh"),
        kind: "redirect",
        title: "GitHub Pages canonical",
        summary: "www → apex (CNAME primary)",
        config: {
          from: "https://www.ryanjohnson.dev",
          to: "https://ryanjohnson.dev/",
          vendor: "GitHub Pages",
        },
      },
      {
        id: newId("cache"),
        kind: "cache",
        title: "Edge cache",
        summary: "301s cached (max-age 14400) — loops stick",
        config: { "cache-control": "max-age=14400" },
      },
      {
        id: newId("origin"),
        kind: "origin",
        title: "GitHub Pages origin",
        summary: "Static site — never reached while looping",
      },
    ],
  };
}

/** Fixed pipeline: only apex→www, GitHub also prefers www. */
export function createFixedPipeline(): Pipeline {
  const p = createConflictPipeline();
  p.id = "edge-fixed";
  p.title = "Edge request path (aligned)";
  p.description =
    "Same spine, but GitHub primary is www — both vendors agree. Replay settles.";
  const gh = p.steps.find((s) => s.config?.vendor === "GitHub Pages");
  if (gh) {
    gh.title = "GitHub Pages canonical";
    gh.summary = "www is primary — no bounce to apex";
    gh.config = {
      from: "https://ryanjohnson.dev",
      to: "https://www.ryanjohnson.dev/",
      vendor: "GitHub Pages",
    };
  }
  // Remove duplicate CF rule conflict by making CF the only apex→www and GH a no-op skip for www
  const cf = p.steps.find((s) => s.config?.vendor === "Cloudflare");
  if (cf) {
    cf.summary = "apex → www (matches origin primary)";
  }
  return p;
}
