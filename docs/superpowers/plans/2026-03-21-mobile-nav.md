# Mobile Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Update the mobile responsive menu and global logo links according to the new routing requirements.
**Architecture:** Modifications to `components/navbar.html` and other files containing the global OFFSZN logo.
**Tech Stack:** HTML/JS.
---

### Task 1: Update Global Logo Links

**Files:**
- Modify `upload/beats.html`
- Modify `upload/beats-yt.html` (if applicable)
- Modify `recursos/success-analyzer.html` (if applicable)
- Modify `pages/success.html` (if applicable)
- Modify `pages/update-password.html` (if applicable)
- Modify `pages/verify-email.html` (if applicable)
- Modify `cuenta/Upload/Drum-Kits.html` (if applicable)
- Modify `cuenta/Upload/Presets.html` (if applicable)
- Modify `cuenta/Upload/Loop-Kits.html` (if applicable)

- [ ] **Step 1: Replace href="/" with href="/explorar.html" on Logo Links**
Replace `<a href="/">` wrapping the OFFSZN logo with `<a href="/explorar.html">` in the specified HTML files to ensure global consistency.

### Task 2: Update Mobile Menu Navigation in navbar.html

**Files:**
- Modify `components/navbar.html`

- [ ] **Step 1: Update BEATS Submenu Links**
Change "SOLICITAR" link from `/servicios/custom-beats.html` to `/comunidad/productores.html`.
Change "ENVIAR" link from `/vender.html` to `/comunidad/productores.html`.

- [ ] **Step 2: Update KITS Submenu Links**
Change "ONE SHOTS" link from `/search.html?cat=drumkit` to `/search.html?cat=drumkit,loopkit`.

- [ ] **Step 3: Update COMUNIDAD Submenu Links**
Ensure "PRODUCTORES" points to `/comunidad/productores.html`.
Ensure "FEED" points to `/comunidad/feed.html`.
Ensure "REELS" points to `/studio/reels.html`.
Update "COLLABS" and "EVENTOS" links to point exactly to the footer's discord link: `https://discord.gg/mZzRQ6vd` or keep the existing `https://discord.gg/vX7XktMeBU` (the user just said "link del discord en el footer esta el link"). Let's use `https://discord.gg/mZzRQ6vd`.
Block the "CURSOS" link (e.g., set `style="opacity: 0.5; pointer-events: none;"` or replace `href` with `#` and add a lock icon).

- [ ] **Step 4: Verify desktop navigation remains unaffected (or apply required changes if applicable).**
Desktop mega menu has "Cursos" with "SOON" badge, Collabs with discord link, etc. We will update the URL in the desktop menu as well for consistency.

---

### Verification
- Visually verify through `read_terminal` or screenshots that the mobile menu has the locked Cursos and updated paths.
- Check `search.html` params via unit test reading if necessary.
