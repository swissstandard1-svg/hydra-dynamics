/**
 * Scroll-Schicht: Lenis für das weiche Scrollen, GSAP/ScrollTrigger für
 * bewegte Abschnitte. Beide teilen sich einen Takt, damit nichts nachläuft.
 */

import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import Lenis from "lenis";

import { clamp } from "./utils";

gsap.registerPlugin(ScrollTrigger);

export function initScrollLayer(): () => void {
  const lenis = new Lenis({
    duration: 1.05,
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 1.6,
    autoRaf: false,
    anchors: { offset: -80 },
  });

  lenis.on("scroll", ScrollTrigger.update);

  const tick = (time: number): void => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(260, 40);

  // Scroll-Fortschritt als dünne Leuchtäder oben im Bild
  const progress = document.querySelector<HTMLElement>("#scroll-progress-bar");
  let rafId = 0;
  const paint = (): void => {
    rafId = 0;
    if (!progress) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
    progress.style.transform = `scaleX(${ratio.toFixed(4)})`;
  };
  const onScroll = (): void => {
    if (!rafId) rafId = requestAnimationFrame(paint);
  };
  lenis.on("scroll", onScroll);
  paint();

  const context = gsap.context(() => {
    // Hero drückt beim Scrollen leicht weg — erzeugt Tiefe statt Sprung.
    gsap.to(".hero__inner", {
      yPercent: -14,
      autoAlpha: 0.35,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom top",
        scrub: 0.6,
      },
    });

    gsap.to(".hero__aurora", {
      yPercent: 18,
      ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
    });

    // Kopfzeile reagiert auf Scroll-Zustand
    ScrollTrigger.create({
      start: 24,
      end: 99999,
      onToggle: (self) => {
        const header = document.querySelector<HTMLElement>("#site-header");
        if (!header) return;
        if (self.isActive) header.setAttribute("data-scrolled", "true");
        else header.removeAttribute("data-scrolled");
      },
    });

    // Abschnittsüberschriften bekommen beim Erreichen einen weichen Versatz
    gsap.utils.toArray<HTMLElement>(".section__head").forEach((head) => {
      gsap.from(head, {
        y: 36,
        autoAlpha: 0,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: head, start: "top 84%", once: true },
      });
    });

    // Produktkarten laufen beim Scrollen minimal versetzt (Staffelung)
    gsap.utils.toArray<HTMLElement>(".gallery > li").forEach((card, index) => {
      gsap.from(card, {
        y: 48,
        autoAlpha: 0,
        duration: 0.8,
        delay: Math.min(index * 0.08, 0.24),
        ease: "power3.out",
        scrollTrigger: { trigger: card, start: "top 88%", once: true },
      });
    });

    ScrollTrigger.refresh();
  });

  return () => {
    context.revert();
    gsap.ticker.remove(tick);
    lenis.destroy();
    if (rafId) cancelAnimationFrame(rafId);
  };
}