(() => {
  const supportsMatchMedia = typeof window.matchMedia === "function";
  let savedTheme = null;

  try {
    savedTheme = localStorage.getItem("creatorops-theme");
  } catch (_error) {
    savedTheme = null;
  }

  const prefersDark = supportsMatchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : true;

  let themePreference = "system";
  let resolvedTheme = prefersDark ? "dark" : "light";

  if (savedTheme === "light" || savedTheme === "dark") {
    themePreference = savedTheme;
    resolvedTheme = savedTheme;
  } else {
    try {
      localStorage.setItem("creatorops-theme", "system");
    } catch (_error) {}
  }

  document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  document.documentElement.setAttribute("data-theme", themePreference);
  document.documentElement.style.colorScheme = resolvedTheme;
})();
