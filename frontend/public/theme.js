// Fija el modo de color antes de pintar la página, para que nunca aparezca un destello blanco
// en el modo oscuro. Lee la preferencia que la persona eligió (src/features/theme/theme.ts usa
// la misma clave) o, si no eligió, la de su sistema. Es un archivo aparte porque la política de
// seguridad del sitio no permite scripts escritos dentro del HTML.
(function () {
  var preference = null;
  try {
    preference = localStorage.getItem("aletheia:tema");
  } catch {
    preference = null;
  }
  var dark =
    preference === "dark" ||
    (preference !== "light" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  var root = document.documentElement;
  root.setAttribute("data-theme", dark ? "dark" : "light");
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#131017" : "#ffffff");
})();
