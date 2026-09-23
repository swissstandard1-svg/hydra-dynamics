/**
 * Beobachtungsposten: sammelt unbehandelte Fehler und unerwartete
 * Konsolenmeldungen und schreibt sie in ein Datenattribut am <html>-Element.
 *
 * Warum? So ist von aussen (Screenshot, Prüfskript, DevTools) sofort
 * erkennbar, ob die Seite fehlerfrei gelaufen ist — statt sich auf „sieht gut
 * aus" zu verlassen.
 */

export function initConsoleWatch(): () => void {
  const root = document.documentElement;

  const onError = (event: ErrorEvent): void => {
    root.dataset.jsErrors = String(Number(root.dataset.jsErrors ?? "0") + 1);
    root.dataset.lastError = `error: ${event.message}`;
  };

  const onRejection = (event: PromiseRejectionEvent): void => {
    root.dataset.jsErrors = String(Number(root.dataset.jsErrors ?? "0") + 1);
    root.dataset.lastError = `rejection: ${String(event.reason)}`;
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  root.dataset.jsErrors = "0";

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}