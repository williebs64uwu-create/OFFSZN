---
name: nanobanana-carousel
description: Generates high-fidelity Instagram carousels using KIE AI (Nano Banana Pro). Focuses on artistic slides with integrated, legible text and a consistent AI-themed aesthetic.
---

# Nano Banana Carousel Agent

This skill allows the agent to generate full Instagram carousels (4:5) by orchestrating multiple image generation tasks via the KIE AI API.

## Design Aesthetic
*   **Default Style**: "Animated Cinematic AI / 3D Stylized".
*   **Palette**: Primary Red (#FF0000), Pure White (#FFFFFF), and Deep Slate/Black for contrast.
*   **Vibe**: Premium tech, high-energy, "The Future of AI".

## Workflow
1.  **Scripting**: Use `copywriting-premium` and `psicologia-ventas` to draft a 5-slide script.
    - Slide 1: Hook / Title (Big text).
    - Slide 2: Problem / Question.
    - Slide 3: Solution (The "Aha!" moment).
    - Slide 4: Key Feature / Proof.
    - Slide 5: Final CTA (Call to action).
2.  **Prompt Engineering**: Generate one Nano Banana Pro prompt per slide.
3.  **Job Execution**: Send the jobs to KIE AI using the `nanobanana_gen.js` script.
4.  **Polling**: Wait for all 5 images to complete.
5. **Delivery**: Present the final carousel to the user with the generated URLs.

## Dual Execution Modes
*   **Mode A (KIE AI - Recommended)**: Use when `KIE_API_KEY` is in `.env`. Provides the best text rendering.
*   **Mode B (Internal Agent)**: Use when no API key is present. The agent uses the `generate_image` tool. Focus on highly descriptive prompts to simulate the Nano Banana style.

## Nano Banana Prompt Rules (For Perfect Text)
To ensure Nano Banana renders the text correctly, follow these prompt patterns:
*   Place the text in the "Quote" or "Sign" context.
*   **Pattern**: `"... stylized text reading '[YOUR TEXT]' on a floating holographic screen / neon sign / cinematic poster ..."`
*   **Consistency**: Always include the style block at the end: `"... red and white animated style, hyper-detailed 4K, 3D render, ambient occlusion, futuristic AI aesthetics."`

## How to use
Tell the agent: `"Crea un carrusel sobre [TEMA] usando Nano Banana"` or `"Crea un carrusel para willieinspired sobre [PRODUCTO]"`.

## Required Environment Variables
Ensure these are in your `.env`:
- `KIE_API_KEY`: Your Bearer Token from Kie AI.
- `KIE_API_ENDPOINT`: `https://api.kie.ai/api/v1/jobs`
