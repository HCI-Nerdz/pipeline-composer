# Agent notes — pipeline-composer

Project facts for agents. Workstation facts: `$CODE_ROOT/machine.md` + `$CODE_ROOT/harness.md` (never commit; never per-repo).

- Interactive prototype for the processing-maps pattern; essays + Antora live on HCI Nerdz site/docs
- GitHub Pages project site: Vite `base: /pipeline-composer/`; enable Pages from GitHub Actions
- Vite demos use a hero breadcrumb eyebrow (linked **HCI Nerdz** · pattern label), not a cloned org nav. Full nav stays on the Astro site until demos embed as routes/islands
- Allow-list `.gitignore`
- Architecture: `src/` core IR + headless controller + DOM renderer (see README)
