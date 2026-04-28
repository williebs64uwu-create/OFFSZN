# Premium Profile Refinement Implementation Plan

> **Goal:** Standardize the profile to a Black & White aesthetic, center sections, and remove redundant playlist components.

**Architecture:** Modular JS (Render/Core/BG) + Vanilla CSS.
**Tech Stack:** HTML5, CSS3, Supabase, Vanilla JS.

---

### Task 1: Dark Mode Standardization (Navbar & Footer)

**Files:**
- Modify `premium-profile.html` (CSS)

- [ ] **Step 1: Define dark navbar and footer styles**
```css
    /* Fix Navbar to Black */
    .prof-nav {
      background: #000 !important;
      border-bottom: 1px solid rgba(255,255,255,0.1) !important;
    }
    .prof-nav .nav-link { color: #fff !important; }
    .prof-nav .nav-logo { filter: brightness(0) invert(1); }

    /* Fix Footer to Black */
    .prof-footer {
      background: #000 !important;
      color: #fff !important;
      border-top: 1px solid rgba(255,255,255,0.1) !important;
    }
```

### Task 2: Refine Services Section (Center & Size)

**Files:**
- Modify `premium-profile.html` (CSS)
- Modify `script/premium-profile-render.js`

- [ ] **Step 1: Adjust Shelf CSS to be centered and smaller**
```css
    .shelf-container {
      justify-content: center; /* Center items if few */
      flex-wrap: wrap; /* Allow wrapping instead of just scrolling if needed */
    }
    .shelf-card {
      flex: 0 0 200px; /* Reduced from 240px */
      transition: background 0.3s ease; /* No transform/zoom */
    }
    .shelf-card:hover {
      transform: none !important; /* Explicitly disable growth */
    }
```

- [ ] **Step 2: Remove Playlist Section from HTML**
- Delete `<section id="playlists-section">` in `premium-profile.html`.

### Task 3: Cleanup Modular Logic

**Files:**
- Modify `script/premium-profile-render.js`
- Modify `script/premium-profile-core.js`

- [ ] **Step 1: Remove `renderPlaylists` from Render Engine**
- [ ] **Step 2: Remove `renderPlaylists` call from Core Engine**
- [ ] **Step 3: Ensure Service Links are absolute and correct**
```javascript
const link = `${window.location.origin}/servicio/${slug}-${code}-${userNickname}`;
```

---

### Verification
- Check navbar is black.
- Check footer is black.
- Check services are centered and don't grow on hover.
- Check playlist section is gone.
- Check service links don't have 'undefined'.
