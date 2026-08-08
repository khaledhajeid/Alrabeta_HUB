// Runs before paint so the resolved theme applies immediately — otherwise
// the page flashes the wrong theme for a frame before React hydrates.
//
// Dark is the strict brand default, not an OS-preference fallback: an
// explicit "light" choice is the only thing that produces light, including
// on a visitor's very first load regardless of their system setting. The
// CSS itself mirrors this (globals.css's bare :root is the dark palette),
// so this only needs to handle the "light" case — anything else, including
// no stored value at all, is already correctly dark by default.
const THEME_SCRIPT = `
(function () {
  try {
    if (localStorage.getItem("alrabeta-theme") === "light") {
      document.documentElement.dataset.theme = "light";
    }
  } catch (e) {}
})();
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}
