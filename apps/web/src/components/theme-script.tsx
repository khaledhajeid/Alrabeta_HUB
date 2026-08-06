// Runs before paint so the stored theme applies immediately — otherwise the
// page flashes the OS-default theme for a frame before React hydrates.
const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("alrabeta-theme");
    if (stored === "light" || stored === "dark") {
      document.documentElement.dataset.theme = stored;
    }
  } catch (e) {}
})();
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}
