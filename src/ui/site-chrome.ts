/** Minimal org link-back — lives outside #app so controller re-renders cannot remove it. */
const ORG_LINKBACK_HTML = `
  <a class="org-linkback" href="https://hci-nerdz.github.io/">HCI Nerdz</a>
`.trim();

/** Insert the link-back once if index.html did not already provide it. */
export function ensureSiteChrome(): void {
  if (document.querySelector(".org-linkback")) return;

  const app = document.getElementById("app");
  if (!app?.parentNode) return;

  const nav = document.createElement("nav");
  nav.className = "org-linkback-wrap";
  nav.setAttribute("aria-label", "HCI Nerdz");
  nav.innerHTML = ORG_LINKBACK_HTML;
  app.parentNode.insertBefore(nav, app);
}
