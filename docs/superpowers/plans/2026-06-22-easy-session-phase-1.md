# EASY SESSION Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desarrollar la Fase 1 del sistema colaborativo en tiempo real **EASY SESSION** para los plugins EasyMix y EasyMaster, creando el Backend Server (WebSockets), el Local Session Bridge, y un Mockup de Plugins y Dashboard Web para validar sincronización y streaming de audio master.

**Architecture:**
- **Backend (WS)**: Servidor en la nube para coordinar y agrupar plugins por `projectFingerprint` y `sessionId`, distribuir cambios en tiempo real y rutear señalización WebRTC.
- **Local Session Bridge**: Servidor local (`localhost:3010`) que recibe conexiones de instancias de plugins locales y las expone en una única conexión segura hacia el backend.
- **Web UI & Mockups**: Dashboard premium de sesión y simuladores de plugin VST con sliders e indicadores visuales de parámetros.

---

## Plan de Ejecución de Tareas (Atomic Tasks)

### Task 1: Estructura del Proyecto y Backend Server

**Files:**
- [NEW] [backend/package.json](file:///C:/Users/Willie/Desktop/EASY%20SESSION/backend/package.json)
- [NEW] [backend/sessionManager.js](file:///C:/Users/Willie/Desktop/EASY%20SESSION/backend/sessionManager.js)
- [NEW] [backend/app.js](file:///C:/Users/Willie/Desktop/EASY%20SESSION/backend/app.js)

- [ ] **Step 1: Crear `backend/package.json` con dependencias base (`express`, `ws`, `cors`)**
- [ ] **Step 2: Implementar `backend/sessionManager.js`**
  - Manejar el ciclo de vida de los plugins: registro con `HELLO`, asignación de `projectFingerprint` y `sessionId`.
  - Implementar limpieza automática de plugins mediante `HEARTBEAT` (desconectar tras 15 segundos sin señal).
- [ ] **Step 3: Implementar `backend/app.js`**
  - Iniciar servidor HTTP y WebSocket adjunto.
  - Implementar eventos de socket: `hello`, `heartbeat`, `param_change`, `mute` y WebRTC signaling (`offer`, `answer`, `ice_candidate`).

---

### Task 2: Local Session Bridge

**Files:**
- [NEW] [bridge/package.json](file:///C:/Users/Willie/Desktop/EASY%20SESSION/bridge/package.json)
- [NEW] [bridge/bridge.js](file:///C:/Users/Willie/Desktop/EASY%20SESSION/bridge/bridge.js)

- [ ] **Step 1: Crear `bridge/package.json` con dependencia `ws`**
- [ ] **Step 2: Implementar `bridge/bridge.js`**
  - Levantar servidor WebSocket local en el puerto `3010`.
  - Calcular/generar `projectFingerprint` dinámico del sistema.
  - Conectarse al servidor backend WebSocket remoto con lógica de auto-reconexión.
  - Multiplexar mensajes entre los plugins locales y el backend remoto.

---

### Task 3: Web UI y Mockup de Plugins

**Files:**
- [NEW] [web-ui/styles.css](file:///C:/Users/Willie/Desktop/EASY%20SESSION/web-ui/styles.css)
- [NEW] [web-ui/vst-mockup.html](file:///C:/Users/Willie/Desktop/EASY%20SESSION/web-ui/vst-mockup.html)
- [NEW] [web-ui/index.html](file:///C:/Users/Willie/Desktop/EASY%20SESSION/web-ui/index.html)

- [ ] **Step 1: Desarrollar `web-ui/styles.css` con estética premium, colores curados y glassmorphism**
- [ ] **Step 2: Crear el simulador `web-ui/vst-mockup.html`**
  - Perillas interactivas (Input, Amount, Output) y botón Mute.
  - Conexión por WebSocket local al bridge (`localhost:3010`).
  - Envío automático de `HELLO` y loops de `HEARTBEAT` cada 5 segundos.
  - Envío inmediato de eventos `param_change` y `mute` al mover controles.
- [ ] **Step 3: Desarrollar el Dashboard `web-ui/index.html`**
  - Panel para crear/unirse a `sessionId`.
  - Visualización en tiempo real de los plugins activos en la sesión ordenados por `uiOrder`.
  - Permitir drag-and-drop para reordenar la jerarquía de plugins.
  - Recibir y reflejar en tiempo real los movimientos de perillas de los VSTs conectados.

---

### Task 4: Streaming de Audio y QA

**Files:**
- [NEW] [tests/syncTest.js](file:///C:/Users/Willie/Desktop/EASY%20SESSION/tests/syncTest.js)

- [ ] **Step 1: Implementar WebRTC Audio Streaming en los clientes**
  - En `vst-mockup.html` (para EasyMaster): Capturar audio (o simular audio con un oscilador Web Audio API) y enviarlo mediante una conexión WebRTC P2P utilizando el backend de WS para la señalización.
  - En `index.html`: Recibir el stream WebRTC y reproducirlo por la salida de audio del navegador con control de volumen/silencio.
- [ ] **Step 2: Escribir script de test automatizado `tests/syncTest.js`**
  - Validar flujo de datos end-to-end simulando múltiples conexiones de socket.
- [ ] **Step 3: QA Manual completo**
  - Iniciar backend, local bridge y abrir múltiples instancias de mockup.
  - Confirmar sincronización de parámetros ultra fluida sin latencia y streaming de audio limpio.
