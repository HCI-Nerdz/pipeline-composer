/** Sticky org link-back — lives outside #app so controller re-renders cannot remove it. */
const SITE_CHROME_HTML = `
  <a class="site-brand" href="https://hci-nerdz.github.io/" aria-label="HCI Nerdz home">
    <img
      src="https://hci-nerdz.github.io/logo-mark.svg"
      width="28"
      height="28"
      alt=""
      decoding="async"
    />
    HCI Nerdz
  </a>
  <p class="site-chrome-tag">Pipeline composer demo</p>
`.trim();

/** Insert the demo chrome once if index.html did not already provide it. */
export function ensureSiteChrome(): void {
  if (document.querySelector(".site-chrome")) return;

  const app = document.getElementById("app");
  if (!app?.parentNode) return;

  const header = document.createElement("header");
  header.className = "site-chrome";
  header.innerHTML = SITE_CHROME_HTML;
  app.parentNode.insertBefore(header, app);
}
