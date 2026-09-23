/**
 * Kontaktformular: Feldprüfung mit klaren deutschen Meldungen.
 * Es gibt kein Backend — die Seite sagt das offen und versendet nichts.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

export function initContactForm(): () => void {
  const form = document.querySelector<HTMLFormElement>(".contact__form");
  const status = document.querySelector<HTMLElement>("[data-form-status]");
  if (!form || !status) return () => {};

  const email = form.querySelector<HTMLInputElement>("#contact-email");
  const note = form.querySelector<HTMLTextAreaElement>("#contact-note");

  const setStatus = (text: string, state: "idle" | "ok" | "error"): void => {
    status.textContent = text;
    if (state === "idle") status.removeAttribute("data-state");
    else status.dataset.state = state;
  };

  const clearError = (field: HTMLInputElement | HTMLTextAreaElement | null): void => {
    field?.removeAttribute("aria-invalid");
  };

  const validate = (): string | null => {
    if (!email) return null;
    if (!email.value.trim()) {
      email.setAttribute("aria-invalid", "true");
      return "Bitte eine geschäftliche E-Mail-Adresse angeben.";
    }
    if (!EMAIL.test(email.value.trim())) {
      email.setAttribute("aria-invalid", "true");
      return "Diese E-Mail-Adresse sieht unvollständig aus — bitte prüfen.";
    }
    clearError(email);
    if (note && note.value.length > 1200) {
      note.setAttribute("aria-invalid", "true");
      return "Die Notiz ist zu lang (maximal 1.200 Zeichen).";
    }
    clearError(note);
    return null;
  };

  const onSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    const error = validate();
    if (error) {
      setStatus(error, "error");
      form.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }
    setStatus(
      "Danke — im echten Betrieb würde die Auslegung jetzt angestossen. Dieses Konzept hat kein Backend, es wurde nichts versendet.",
      "ok",
    );
  };

  const onInput = (event: Event): void => {
    clearError(event.target as HTMLInputElement | HTMLTextAreaElement);
    if (status.dataset.state === "error") setStatus("Konzept ohne Backend: Die Eingaben werden nur lokal geprüft, nichts wird versendet.", "idle");
  };

  form.addEventListener("submit", onSubmit);
  form.addEventListener("input", onInput);

  return () => {
    form.removeEventListener("submit", onSubmit);
    form.removeEventListener("input", onInput);
  };
}