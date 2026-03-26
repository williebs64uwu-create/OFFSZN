# Sidebar Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Expand the sidebar in `/cuenta` pages to be wider and include text labels next to the icons, without shifting the main content visually.
**Architecture:** Update inline CSS and HTML structure of `.sidebar-stub` and `.sidebar-icon-btn` across all `/cuenta/*.html` files, excluding `planes.html`.
**Tech Stack:** HTML5, CSS3
---

### Task 1: Update CSS inside <style> blocks

**Files:**
- Modify `c:\Users\Willie\Desktop\OFFSZN\cuenta\*.html` (except `planes.html`)
  - `admin-licencias.html`
  - `analiticas.html`
  - `checkout.html`
  - `colaboraciones.html`
  - `cupones.html`
  - `cursos.html`
  - `dashboard.html`
  - `mis-kits.html`
  - `negociar.html`
  - `reels.html`
  - `subir-kit.html`
  - `Upload\Drum-Kits.html` (if applicable)
  - `Upload\Loop-Kits.html` (if applicable)
  - `Upload\Presets.html` (if applicable)

- [ ] **Step 1: Write minimal implementation**
Find the `.sidebar-stub` CSS class and update it to be wider and align items to the left:
```css
        /* ===== SIDEBAR STUB ===== */
        .sidebar-stub {
            width: 220px; /* Expanded Width */
            background: #000;
            border-right: 1px solid var(--border-color);
            height: 100vh;
            position: fixed;
            left: 0;
            top: 0;
            z-index: 100;
            display: flex;
            flex-direction: column;
            align-items: flex-start; /* Changed from center to align text cleanly */
            padding-top: 20px;
            padding-left: 15px; /* Added padding left for icons */
            padding-right: 15px;
            gap: 10px;
        }
```

Update `.sidebar-icon-btn` CSS class to fit the new width and flex layout:
```css
        .sidebar-icon-btn {
            width: 100%; /* Take full width of sidebar (minus padding) */
            height: 40px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: flex-start; /* Left align icon and text */
            padding-left: 15px; /* Space inside button to icon */
            gap: 15px; /* Space between icon and text */
            color: #888;
            font-size: 14px; /* Default font size for text */
            font-weight: 500;
            transition: 0.2s;
            text-decoration: none;
        }

        .sidebar-icon-btn i {
            font-size: 20px; /* Keep icons large */
        }

        .sidebar-icon-btn:hover {
            color: #fff;
            background: rgba(255, 255, 255, 0.05);
        }

        .sidebar-icon-btn.active {
            color: #fff;
            background: var(--accent-purple);
            box-shadow: 0 0 10px var(--accent-glow);
        }
```

- [ ] **Step 2: Commit**
git commit -m "Update sidebar CSS across cuenta pages for text expansion"

---

### Task 2: Update HTML structure to add spans

**Files:**
- Same HTML files as Task 1.

- [ ] **Step 1: Write minimal implementation**
Find the `<div class="sidebar-stub">` content and update the `<a>` tags.
For example, change:
```html
<a href="dashboard.html" class="sidebar-icon-btn active" data-title="Dashboard"><i class="bi bi-grid-fill"></i></a>
```
To:
```html
<a href="dashboard.html" class="sidebar-icon-btn active" data-title="Dashboard"><i class="bi bi-grid-fill"></i> <span>Dashboard</span></a>
```

Apply this pattern to all icons:
- Dashboard -> `<span>Dashboard</span>`
- Mis Beats/Kits -> `<span>Mis Beats/Kits</span>`
- Subir -> `<span>Subir</span>`
- Licencias -> `<span>Licencias</span>`
- Negociar -> `<span>Negociar</span>`
- Cupones -> `<span>Cupones</span>`
- Colaboraciones -> `<span>Colaboraciones</span>`
- Cursos -> `<span>Cursos</span>`
- Estadísticas -> `<span>Estadísticas</span>`
- Reels -> `<span>Reels</span>`
- Mejorar Plan (Plane/Rocket) -> `<span>Mejorar Plan</span>`

Also adjust the logo container:
```html
        <!-- Brand/Home -->
        <a href="/explorar.html" class="sidebar-logo-btn"
            style="margin-bottom:10px; display:flex; align-items:center; justify-content:flex-start; width:100%; height:44px; padding-left:10px; text-decoration: none;">
            <img src="../images/LOGO-OFFSZN.png" style="width:38px; mix-blend-mode: screen; margin-right: 12px;">
            <span style="color: #fff; font-family: Playfair Display, serif; font-size: 20px; font-weight: bold; letter-spacing: 1px;">OFFSZN</span>
        </a>
```

- [ ] **Step 2: Check & Verify Visuals**
Refresh the page. Verify the sidebar is now wider and contains text labels next to each icon, colored in black/white/grey style, without pushing `.main-content-elite` out of place (as `position: fixed` will overlay empty space).

- [ ] **Step 3: Commit**
git commit -m "Add descriptive text spans to sidebar icons in cuenta pages"
