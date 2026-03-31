# OFFSZN AI Co-Producer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Integrar el modelo `nemotron-3-super-120b-a12b` vía NVIDIA NIM como un asistente de inteligencia artificial ("AI Co-Producer") que recomiende VSTs y Presets a los usuarios en la plataforma OFFSZN basándose en sus dudas musicales.
**Architecture:** Frontend con componente de Chat (UI/UX acorde a OFFSZN black & white premium). Backend en Node.js/Express (controlador) que reciba los mensajes, construya el prompt con el inventario de VSTs de la base de datos Supabase, y llame a la API de NVIDIA NIM.
**Tech Stack:** HTML/CSS/JS (Vanilla), Node.js, Supabase, NVIDIA NIM API (nemotron-3-super-120b-a12b).

---

### Task 1: Configurar dependencias e integración con NVIDIA NIM
**Files:**
- Modify `backend/services/NvidiaNimService.js` (o ruta equivalente)
- Modify `backend/package.json`

- [ ] **Step 1: Write the failing test**
```javascript
// tests/nvidiaNim.test.js
const { getChatResponse } = require('../services/NvidiaNimService');
test('getChatResponse fails if API Key is missing', async () => {
    process.env.NVIDIA_API_KEY = '';
    await expect(getChatResponse('Hola')).rejects.toThrow();
});
```

- [ ] **Step 2: Run test to verify it fails**
`npm run test tests/nvidiaNim.test.js` Expected: FAIL con ... "Cannot find module '../services/NvidiaNimService'" o test failed.

- [ ] **Step 3: Write minimal implementation**
```javascript
// backend/services/NvidiaNimService.js
const axios = require('axios');

async function getChatResponse(message) {
    if (!process.env.NVIDIA_API_KEY) throw new Error('Missing NVIDIA API KEY');
    // Minimal mock or actual API Call
    return "API Response";
}
module.exports = { getChatResponse };
```

- [ ] **Step 4: Run test to verify it passes**
`npm run test tests/nvidiaNim.test.js` Expected: PASS

- [ ] **Step 5: Commit**
`git add . && git commit -m "feat(ai): configure initial NvidiaNimService"`

### Task 2: Crear el endpoint del AI Controller
**Files:**
- Modify `backend/controllers/AiController.js`
- Modify `backend/routes/api.js`

- [ ] **Step 1: Write the failing test**
```javascript
// tests/AiController.test.js
const request = require('supertest');
const app = require('../app');
test('POST /api/chat returns 400 without message', async () => {
    const res = await request(app).post('/api/chat').send({});
    expect(res.statusCode).toEqual(400);
});
```

- [ ] **Step 2: Run test to verify it fails**
`npm run test tests/AiController.test.js` Expected: FAIL con 404 Not Found porque la ruta no existe.

- [ ] **Step 3: Write minimal implementation**
```javascript
// backend/controllers/AiController.js
exports.chat = async (req, res) => {
    if (!req.body.message) return res.status(400).json({ error: 'Message required' });
    res.json({ reply: 'Mocked reply' });
};

// backend/routes/api.js
const AiController = require('../controllers/AiController');
const express = require('express');
const router = express.Router();
router.post('/chat', AiController.chat);
module.exports = router;
```

- [ ] **Step 4: Run test to verify it passes**
`npm run test tests/AiController.test.js` Expected: PASS

- [ ] **Step 5: Commit**
`git add . && git commit -m "feat(ai): create backend chat endpoint"`

### Task 3: Crear el componente UI del Chat Assistant (Frontend)
**Files:**
- Modify `public/js/chat.js`
- Modify `public/css/chat.css`
- Modify `views/pages/explore.html` (o donde se vaya a ubicar)

- [ ] **Step 1: Write the failing test**
```javascript
// tests/frontend.chat.test.js (Asumiendo JSDOM o Cypress)
// Comprobar que el elemento .ai-chat-box existe
```

- [ ] **Step 2: Run test to verify it fails**
Expected: FAIL, no element found.

- [ ] **Step 3: Write minimal implementation**
```html
<!-- explore.html -->
<div id="ai-chat-modal" class="ai-chat-hidden" style="display:none;">
   <div class="chat-history"></div>
   <input type="text" id="ai-chat-input" placeholder="Pregunta sobre plugins..." />
   <button id="ai-chat-send">Enviar</button>
</div>
```
```javascript
// public/js/chat.js
document.getElementById('ai-chat-send').addEventListener('click', async () => {
    const input = document.getElementById('ai-chat-input').value;
    const res = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({message: input}), headers: {'Content-Type': 'application/json'}});
    // ...
});
```

- [ ] **Step 4: Run test to verify it passes**
`npm run test tests/frontend.chat.test.js` Expected: PASS

- [ ] **Step 5: Commit**
`git add . && git commit -m "feat(ui): add AI Assistant chat interface"`
