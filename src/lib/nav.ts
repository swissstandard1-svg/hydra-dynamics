/**
 * Navigation: mobiles Menü, Fokusverwaltung und Markierung des aktiven
 * Abschnitts. Läuft auch im reduzierten Modus, weil es Kernfunktion ist.
 */

export function initNav(): () => void {
  const toggle = document.querySelector<HTMLButtonElement>("#nav-toggle");
  const menu = document.querySelector<HTMLElement>("#mobile-nav");
  const header = document.querySelector<HTMLElement>("#site-header");

  const onEscape = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || !toggle || !menu || toggle.getAttribute("aria-expanded") !== "true") return;
    toggle.setAttribute("aria-expanded", "false");
    menu.hidden = true;
    toggle.focus();
  };

  const onToggle = (): void => {
    if (!toggle || !menu) return;
    const open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!open));
    menu.hidden = open;
  };

  toggle?.addEventListener("click", onToggle);
  menu?.addEventListener("click", (event) => {
    if ((event.target as Element).closest("a") && toggle && menu) {
      toggle.setAttribute("aria-expanded", "false");
      menu.hidden = true;
    }
  });
  document.addEventListener("keydown", onEscape);

  // Aktiver Abschnitt: schmale Beobachtungslinie in der Bildmitte
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const id = entry.target.id;
        for (const link of document.querySelectorAll<HTMLAnchorElement>(".nav__list a")) {
          if (link.getAttribute("href") === `#${id}`) link.setAttribute("data-active", "true");
          else link.removeAttribute("data-active");
        }
      }
    },
    { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
  );

  const sections = document.querySelectorAll<HTMLElement>("main > section[id]");
  for (const section of sections) observer.observe(section);

  // Jahr im Footer aktuell halten
  const year = document.querySelector<HTMLElement>("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());

  return () => {
    toggle?.removeEventListener("click", onToggle);
    document.removeEventListener("keydown", onEscape);
    observer.disconnect();
    if (header) header.removeAttribute("data-scrolled");
  };
}