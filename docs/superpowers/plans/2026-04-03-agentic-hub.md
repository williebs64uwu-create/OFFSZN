# OFFSZN Herramientas de Redes Sociales (Ahorro de Tokens)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Implementar utilidades iniciales para el "Manager de Redes" controlando meticulosamente el uso de APIs externas (OpenAI / Gemini) para asegurar pruebas a bajo coste.
**Architecture:** Controladores aislados en la carpeta `server/src/domain/agents` que expongan funciones modulares, que pueden ser llamadas manualmente y solo consumen "tokens" al pulsar explícitamente "Generar".
**Tech Stack:** Node.js, `openai` o `@google/generative-ai`, endpoints limpios que no disparen triggers de base de datos automáticamente.

## User Review Required

> [!CAUTION]
> Has pedido "probarlo poco a poco" y "con cuidado".
> Originalmente el modelo de PaperclipAI sugiere agentes que operan 24/7 de forma autónoma.
> **Mi propuesta conservadora:** En lugar de hacer que todo sea autónomo, te crearé una serie de **Endpoints y Funciones bajo demanda** (usando la SDK de Vercel AI, o los conectores específicos). Cada vez que quieras automatizar una red (ej: Generar un Copy de Instagram para un un nuevo Beat), el back-end preparará la orden de Inteligencia Artificial pero **no la enviará hasta que apruebes el "gasto" de tokens en tu propio código o interfaz.**

## Proposed Changes

### Task 1: Preparación del Motor (Ahorrando Tokens)

**Files:**
#### [NEW] `server/src/domain/agents/SocialManager.js`
Este archivo será tu primer "agente".
No disparará mensajes solos, sino que actuará como una clase utilitaria para que puedas *solicitar* que redacte cosas cuando lo necesites.

```javascript
// Pseudo-estructura de lo que tendrá
export class SocialManager {
  constructor(aiClient) {
    this.ai = aiClient; 
  }

  // Se llama SOLO si le das a un botón "Generar Copy en Dashboard"
  async generateInstagramCopy(productDetails) {
     // Lógica con poco gasto usando un prompt muy concreto y modelos Flash/Haiku
  }
}
```

### Task 2: La ruta controlada

#### [NEW] `server/src/infrastructure/http/routes/agent.routes.js`
Una ruta específica (protegida como Admin) a donde tu frontend puede pedir textos/automatizaciones.

#### [MODIFY] `server/src/app.js`
Inyectaremos `agent.routes.js` a tu aplicación, detrás de las rutas públicas.

## Open Questions

- **Modelos**: Para ahorrar y "hacer un buen uso", sugiero usar el modelo **Gemini 1.5 Flash** (es súper rápido y extremadamente barato, casi gratis para poco volumen), o **GPT-4o-mini** si prefieres OpenAI. ¿Con cuál de los dos ecosistemas prefieres que configure este primer "Community Manager" manual? (Veo que en tu `package.json` ya tienes `@google/generative-ai`, podríamos reutilizarlo sin instalar nada nuevo y no te costaría plata mientras pruebas).
- ¿Empezamos **solo** escribiendo la clase de JavaScript para el `SocialManager` (Community Manager) para que veas el código y cómo se usan los "prompts" de este sistema antes de tocar tus vistas HTML?

## Verification Plan
1. Escribimos la clase.
2. Usamos Postman o un simple script para enviarle los datos de un Beat tuyo.
3. Vemos qué texto arroja para Instagram sin haber modificado nada "peligroso" de tu base de datos o front-end.
