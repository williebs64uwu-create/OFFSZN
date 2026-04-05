# Spec: Minimalist FAQ & Final CTA Redesign

**Date:** 2026-04-04
**Domain:** Landing Page (OFFSZN)
**Goal:** Implement a high-conversion, minimalist FAQ and Final CTA section with premium aesthetics and Spanish copy.

---

## 1. Visual Specification (FAQ)

- **Header Label:** `COMUNIDAD` (Small, tracked, grey).
- **Title:** `QUESTIONS` (Large, all-caps, ultra-bold, white).
- **Structure:** 
  - Vertical list with 1px subtle borders between items.
  - No card backgrounds; just text and arrows.
  - Right-aligned chevron (`bi-chevron-down`).
- **Typography:** Inter/Montserrat (Project standard).
- **Footer:** "Still have questions? Contact support" (Linked to `/legal/contacto.html`).

## 2. Functional Specification (FAQ)

- **Interaction:** Accordion style. Opening one item closes any previously opened item.
- **Animation:** Smooth JS transition (`max-height`) + CSS transition for chevron rotation.
- **Scope:** Entire row is clickable.

## 3. Visual Specification (Final CTA)

- **Header:** "Gratis para siempre."
- **Subtext:** "Sin necesidad de tarjetas de crédito. Cancela cuando quieras."
- **CTA Button:** "Empezar Ahora" (Primary style, large).
- **Design:** Centered, no cards/complex layouts, dark minimalist background.

## 4. Technical Architecture

- **HTML:** Update `.faq-section` and `.final-cta-section` in `index.html`.
- **CSS:** Add/modify utility classes in `premium-landing.css`.
- **JS:** Reuse/refine `initFaq` in `premium-landing.js`.
- **Routing:** Ensure support link points to `https://offszn.lat/legal/contacto.html`.

## 5. Copy (Spanish)

2. ¿Necesito un canal de YouTube? -> No es obligatorio, pero si lo tienes, OFFSZN automatiza la subida de forma 100% segura mediante la **API Oficial de YouTube**.
3. ¿Puedo programar las subidas? -> Sí, con el plan Creator/Pro.
4. ¿Qué métodos de pago soportan? -> PayPal, Stripe (según la configuración del productor).
5. ¿Puedo cancelar en cualquier momento? -> Sí, sin permanencia.
6. ¿Las subidas automáticas pueden penalizar mi canal? -> No. Estamos alineados con las **políticas y términos de servicio de YouTube**. No es spam, es automatización oficial.
7. Ya tengo beats en otra plataforma. ¿Vale la pena cambiarme? -> Más ganancias, mejor UX, automatización.

---

**Approval Required:** Confirm if this architecture covers all "easy to use" requirements.
