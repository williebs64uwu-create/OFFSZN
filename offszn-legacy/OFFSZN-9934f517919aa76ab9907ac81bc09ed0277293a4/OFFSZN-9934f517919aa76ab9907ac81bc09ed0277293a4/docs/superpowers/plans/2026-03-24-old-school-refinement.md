# Old School Template Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Refine the "Old School" profile template to align with the navbar, reposition navigation tabs, and apply a premium "YVIv4" aesthetic.
**Architecture:** CSS Grid for layout constraints, JS DOM manipulation for tab repositioning.
**Tech Stack:** Vanilla CSS, JavaScript (DOM).

---

### Task 1: Alignment & Constraints
**Files:**
- Modify `c:\Users\Willie\Desktop\OFFSZN\css\templates.css`

- [ ] **Step 1: Apply max-width to the profile root**
Match the navbar's `max-width: 1400px` and `padding: 0 1.5rem`.
```css
#profile-root.template-produccion_template_old_school {
    max-width: 1400px;
    margin: 0 auto !important;
    padding: 0 1.5rem;
    grid-template-columns: 320px 1fr; /* Slightly wider sidebar */
}
```

- [ ] **Step 2: Adjust background of the body**
Ensure the outer-most background remains black while the container is centered.
```css
body.template-produccion_template_old_school {
    background: #000 !important;
}
```

### Task 2: Tabs Repositioning
**Files:**
- Modify `c:\Users\Willie\Desktop\OFFSZN\script\profile-public.js`

- [ ] **Step 3: Move #profileTabs to .profile-body**
In the `loadUserProfile` function, check for the template and move the element.
```javascript
if (user.template === 'produccion_template_old_school') {
    const tabs = document.querySelector('#profileTabs');
    const body = document.querySelector('.profile-body');
    const proToolbar = document.querySelector('.pro-toolbar-container');
    if (tabs && body) {
        if (proToolbar) {
            proToolbar.insertAdjacentElement('beforebegin', tabs);
        } else {
            body.prepend(tabs);
        }
    }
}
```

### Task 3: Premium UI Polish (YVIv4 Style)
**Files:**
- Modify `c:\Users\Willie\Desktop\OFFSZN\css\templates.css`

- [ ] **Step 4: Style Sidebar Buttons**
Dark buttons with 1px border, subtle hover glows.
```css
#profile-root.template-produccion_template_old_school .profile-actions button {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #fff;
    border-radius: 8px;
    font-size: 0.85rem;
    padding: 10px 16px;
    font-weight: 500;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
#profile-root.template-produccion_template_old_school .profile-actions button:hover {
    background: rgba(255, 255, 255, 0.08); /* White tint */
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
#profile-root.template-produccion_template_old_school .profile-actions .btn-primary {
    background: #fff !important;
    color: #000 !important;
    border: none;
}
#profile-root.template-produccion_template_old_school .profile-actions .btn-primary:hover {
    background: #e5e5e5 !important;
}
```

- [ ] **Step 5: Style Tabs & Filters**
Clean, uppercase navigation tabs at the top of the content.
```css
#profile-root.template-produccion_template_old_school .profile-tabs-nav {
    border-bottom: 2px solid rgba(255, 255, 255, 0.05);
    margin-bottom: 30px;
    justify-content: flex-start;
    gap: 20px;
    padding-bottom: 0;
}
#profile-root.template-produccion_template_old_school .profile-tab-btn {
    font-weight: 700;
    letter-spacing: 1px;
    color: rgba(255, 255, 255, 0.4);
    border-bottom: 2px solid transparent;
    padding: 12px 4px;
    transition: all 0.2s;
}
- [x] **Task 3: Plantilla "Old School"**
    - [x] Crear layouts en `templates.css` con sidebar.
    - [x] Inyectar clase `.template-old_school` en `#profile-root`.
    - [x] Ajustar alineación con el Navbar (max-width 1400px).
    - [x] Reposicionar pestañas (Productos, etc.) al área principal.
    - [x] Estilizar botones y filtros con estética Premium YVIv4.
    - [x] Verificar en perfil `willieinspired`.

### Task 4: Finalizing & Testing
- [ ] **Step 7: Verification**
Verify that the grid-gap and paddings don't exceed the navbar boundary.
- [ ] **Step 8: Mobile check**
Ensure that the `max-width` doesn't break the responsive behavior.
