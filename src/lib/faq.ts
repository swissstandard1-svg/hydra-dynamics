/**
 * FAQ-Akkordeon: native Buttons, aria-expanded und eine Höhenanimation,
 * die ohne Layoutmessung im Fluss auskommt. Aus-Zustand bleibt im DOM,
 * damit Screenreader nichts vermissen.
 */

const DURATION = 320;
const reduceMotion = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function initFaq(): () => void {
  const triggers = Array.from(document.querySelectorAll<HTMLButtonElement>(".faq__trigger"));
  const timeouts = new Set<number>();

  const later = (fn: () => void, ms: number): void => {
    const id = window.setTimeout(() => {
      timeouts.delete(id);
      fn();
    }, ms);
    timeouts.add(id);
  };

  for (const trigger of triggers) {
    const panel = trigger.closest(".faq__item")?.querySelector<HTMLElement>(".faq__panel");
    if (!panel) continue;

    trigger.addEventListener("click", () => {
      const isOpen = trigger.getAttribute("aria-expanded") === "true";
      trigger.setAttribute("aria-expanded", String(!isOpen));

      const item = trigger.closest<HTMLElement>(".faq__item");
      if (item) {
        if (isOpen) item.removeAttribute("data-open");
        else item.setAttribute("data-open", "true");
      }

      if (reduceMotion()) {
        panel.hidden = isOpen;
        panel.style.height = "";
        return;
      }

      if (isOpen) {
        panel.style.height = `${panel.scrollHeight}px`;
        requestAnimationFrame(() => {
          panel.style.height = "0px";
        });
        later(() => {
          panel.hidden = true;
          panel.style.height = "";
        }, DURATION);
      } else {
        panel.hidden = false;
        panel.style.height = "0px";
        const target = panel.scrollHeight;
        requestAnimationFrame(() => {
          panel.style.height = `${target}px`;
        });
        later(() => {
          panel.style.height = "";
        }, DURATION);
      }
    });
  }

  return () => {
    for (const id of timeouts) window.clearTimeout(id);
    timeouts.clear();
  };
}