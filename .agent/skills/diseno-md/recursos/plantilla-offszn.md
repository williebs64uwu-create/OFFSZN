# DESIGN.md - OFFSZN Deep Dark
**Version**: 1.0 (B&W Edition)

## 1. Visual Theme & Atmosphere
- **Atmosphere**: Deep Dark, sleek, premium, minimalist.
- **Density**: High density but with generous negative space (white space) to avoid clutter.
- **Philosophy**: "Less is More". Use high contrast for readability and subtle gradients for depth.

## 2. Color Palette & Roles
| Role | Color | Hex | Purpose |
|------|-------|-----|---------|
| Background | Black | `#050505` | Main page background |
| Surface | Eerie Black | `#0a0a0a` | Cards, modals, sidebars |
| Border | Dim Gray | `rgba(255, 255, 255, 0.08)` | Subtle separators |
| Text Primary | White | `#ffffff` | Headings, main body |
| Text Secondary | Gray | `rgba(255, 255, 255, 0.6)` | Subtitles, helper text |
| Accent | Pure White | `#ffffff` | CTAs, high-priority buttons |
| Success | Green | `#10b981` | Positive feedback |
| Error | Red | `#ef4444` | Warnings/errors |

## 3. Typography Rules
- **Primary Font**: `Inter`, sans-serif
- **Hero/Title Font**: `Plus Jakarta Sans`, sans-serif
- **Hierarchy**:
    - `H1`: 3.5rem, Bold, -0.05em spacing.
    - `H2`: 2.5rem, Bold, -0.04em spacing.
    - `Body`: 1rem, Medium (500), 1.6 line height.

## 4. Component Stylings
- **Buttons**:
    - **Primary**: Solid white background, black text, border-radius 50px, hover scale(1.02).
    - **Secondary**: Transparent background, 1px white border (0.2 opacity), white text.
- **Cards**:
    - Background `#0a0a0a`, border 1px solid `rgba(255,255,255,0.08)`, border-radius 16px, soft inner glow.
- **Inputs**:
    - Background `rgba(255,255,255,0.03)`, border 1px solid `rgba(255,255,255,0.1)`, white text.

## 5. Layout Principles
- **Grid**: 12-column system, 24px gutters.
- **Spacing Scale**: 4, 8, 16, 24, 32, 48, 64, 96 (px).
- **Max Width**: 1400px for main content areas.

## 6. Depth & Elevation
- **Elevation 1**: Border only (Z0).
- **Elevation 2**: Border + Shadow: `0 10px 30px rgba(0,0,0,0.5)`.
- **Elevation 3**: Border + Shadow + Inner Glow: `inset 0 1px 1px rgba(255,255,255,0.05)`.

## 7. Do's and Don'ts
- **PROHIBIDO**: Usar colores brillantes (azul, rojo, verde) como fondo. Solo usarlos para micro-detalles.
- **PROHIBIDO**: Añadir bordes redondeados inferiores a 8px (rompe el look premium).
- **SÍ**: Usar gradientes sutiles de `#0a0a0a` a `#050505` en fondos grandes.
- **SÍ**: Usar `letter-spacing: -0.02em` en todos los titulares.

## 8. Responsive Behavior
- **Mobile (< 768px)**: Collapse all 3-column grids into 1. Increase touch targets to 44px min.
- **Desktop**: Maintain fixed sidebar or clean top navigation.

## 9. Agent Prompt Guide
"Build a component using the OFFSZN system: All surfaces must be #0a0a0a or darker. Use White for primary texts and Gray (0.6 opacity) for secondary. Borders must be extremely subtle (0.08 opacity). Typography must use Inter for body and Plus Jakarta Sans for titles with negative letter-spacing."
