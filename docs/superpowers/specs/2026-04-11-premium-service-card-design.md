# Design Spec - Premium Deep Dark Service Card

## Goal
Elevate the service card aesthetic to a "Premium/God" level by implementing a solid, deep-dark aesthetic that feels expensive and professional.

## UI Design Details
- **Container**:
    - **Background**: Opaque `#0f1012` (no transparency).
    - **Border**: 1px solid `rgba(255,255,255,0.08)` with `border-radius: 24px`.
    - **Inner Glow**: `box-shadow: inset 0 1px 1px rgba(255,255,255,0.05)`.
    - **Outer Shadow**: `0 20px 40px rgba(0,0,0,0.6)`.
- **Header Section (Top)**:
    - **Cover**: 140x140px, rounded 16px. Placeholder: Premium OFFSZN Gradient.
    - **Info**: 
        - Title: `font-size: 1.6rem`, `font-weight: 800`, `#ffffff`.
        - Description: `color: #94a3b8`, `line-height: 1.6`.
        - **REMOVED**: Category Tag.
- **Action Section (Middle)**:
    - **Buy Button**: Solid white background, black bold text.
    - **Details Button**: Dark background with white border.
- **Embed Section (Bottom)**:
    - High-quality iframe container with matching rounded corners.

## Technical Implementation
- **CSS**: Update `.service-card-modern-v2` in `css/services-redesign.css`.
- **JS**: Adjust `renderServicesTab` in `profile-public.js` to remove the category tag HTML.

## User Approval Needed
- [ ] Confirming the "Deep Dark" opaque look (No more glassmorphism transparency).
- [ ] Content layout: Cover (Left), Info (Right), Actions (Full Width), Embed (Full Width).
