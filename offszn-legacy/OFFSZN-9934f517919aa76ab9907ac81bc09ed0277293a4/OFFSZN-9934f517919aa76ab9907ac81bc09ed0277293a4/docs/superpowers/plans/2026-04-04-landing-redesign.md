# FAQ & Closing Section Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Redesign the FAQ into a minimalist accordion with official YouTube policy mentions and simplify the final CTA to a "Free Forever" message.
**Architecture:** Grid-based FAQ list, row-level interaction, flex-centered final block.
**Tech Stack:** HTML5, Vanilla CSS, JS (Accordion logic).

---

### Task 1: Re-structure FAQ in index.html

**Files:**
- Modify `index.html`

- [ ] **Step 1: Write the failing test** (N/A for static HTML, skip to Step 5: Manual check later)
- [ ] **Step 2: Update FAQ Header and individual Items**
  - Change h2 to "QUESTIONS"
  - Replace all `faq-item` content with the new questions and answers (including YouTube API mentions).
  - Change `.faq-icon` content to `<i class="bi bi-chevron-down"></i>`.
- [ ] **Step 3: Add "Still have questions?" link**
  - Append after `.faq-list`.
  - Link to `/legal/contacto.html`.

### Task 2: Refine FAQ CSS for Premium feel

**Files:**
- Modify `css/premium-landing.css`

- [ ] **Step 1: Update .faq-section and .faq-list**
  - Set title to `text-transform: uppercase` and `font-weight: 900`.
  - Remove backgrounds from `.faq-item`.
- [ ] **Step 2: Style .faq-trigger and Chevrons**
  - Ensure row-level clickability (`width: 100%`).
  - Add `transition: transform 0.3s` for `.faq-icon i`.
  - Handle `.faq-item.active .faq-icon i` rotation (180deg).
- [ ] **Step 3: Style Support Link**
  - Centered, grey text, white link on hover.

### Task 3: Simplified "Free Forever" Section

**Files:**
- Modify `index.html`
- Modify `css/premium-landing.css`

- [ ] **Step 1: Update .final-cta-section in index.html**
  - Change h2 to: "Gratis para siempre. <span style='opacity: 0.5'>Sin tarjetas de crédito.</span>"
  - Update subtext to: "Únete a la comunidad más grande de productores independientes."
- [ ] **Step 2: Adjust CSS for simplicity**
  - Ensure centered alignment and clean spacing.

---

**Verification:**
- Click each FAQ item: Check if it opens/closes correctly and rotates the chevron.
- Click "Contact support": Verify redirection to `/legal/contacto.html`.
- Mobile check: Ensure text wrapping is correct.
