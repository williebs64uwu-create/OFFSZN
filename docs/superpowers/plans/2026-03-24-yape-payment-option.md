# Yape Payment Option Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Añadir la opción de pago Yape exclusiva para Perú (prefijo +51 forzado) y requerir aceptación de términos y condiciones.
**Architecture:** Modificación de UI en `transacciones.html`, lógica de frontend en `payment-settings.js`, y columna `yape_phone` en Supabase `users`.
**Tech Stack:** HTML, Vanilla JS, Supabase (PostgreSQL).

---

### Task 1: UI Elements in transacciones.html

**Files:**
- Modify `c:\Users\Willie\Desktop\OFFSZN\transacciones.html`

- [ ] **Step 1: Write the failing test**
`// No aplicable (Visual UI)`

- [ ] **Step 2: Run test to verify it fails**
`// No aplicable (Visual UI)`

- [ ] **Step 3: Write minimal implementation**
```html
<!-- Añadir debajo de la card de PayPal -->
<div class="payment-setup-card" style="...">
    <div style="... align-items: center; gap: 16px;">
        <!-- Logo Yape e Info -->
        <h4 style="margin: 0; font-size: 1rem; font-weight: 700;">Yape (Perú)</h4>
        <div id="yape-status-dot" class="status-dot offline"></div>
        <span id="yape-status-label">No configurado</span>
    </div>
    <!-- Número guardado -->
    <div id="yape-display-phone">Desconectado</div>
    <button id="btn-connect-yape" class="btn-primary-sm" onclick="PaymentSettings.openYapeModal()">Activar Yape</button>
</div>

<!-- Modal para pedir el número Yape -->
<div id="modal-yape-phone" class="modal-overlay">
    <!-- input visualmente bloqueado con +51 -->
    <div style="display:flex; align-items:center;">
        <span style="padding: 14px; background: rgba(255,255,255,0.05); color:#fff; border-radius: 12px 0 0 12px;">+51</span>
        <input type="number" id="yape-input-phone" placeholder="999888777" style="border-radius: 0 12px 12px 0;">
    </div>
    <!-- Checkbox de terms -->
    <label>
        <input type="checkbox" id="yape-terms-checkbox"> Acepto los términos y condiciones
    </label>
</div>
```

- [ ] **Step 4: Run test to verify it passes**
`// Inspección visual en el navegador`

- [ ] **Step 5: Commit**
`git commit -m "feat(ui): add yape payment setup block and config modal"`

---

### Task 2: State management in payment-settings.js

**Files:**
- Modify `c:\Users\Willie\Desktop\OFFSZN\script\payment-settings.js`

- [ ] **Step 1: Write the failing test**
`// No aplicable`

- [ ] **Step 2: Run test to verify it fails**
`// No aplicable`

- [ ] **Step 3: Write minimal implementation**
```javascript
// Actualizar PaymentSettings.data
data: { ... yapePhone: null }

// En fetchStatus() extraer yape_phone de la data
const { data: user, error } = await supabase.from('users').select('..., yape_phone');
this.data.yapePhone = user?.yape_phone;

// En renderStatus() actualizar DOM según configuración Yape
this.updateYapeUI(this.data.yapePhone);

// Funciones
openYapeModal: function() { ... },
closeYapeModal: function() { ... },
saveYapePhone: async function() {
    const phone = document.getElementById('yape-input-phone').value.trim();
    const terms = document.getElementById('yape-terms-checkbox').checked;
    
    if (!terms) { showToast("Debes aceptar los términos."); return; }
    if (phone.length !== 9) { showToast("Número inválido."); return; }
    
    // Save to DB (prefijo +51 guardado o solo numero, decidimos guardar +51999888777)
    await window.supabaseClient.from('users').update({ yape_phone: "+51" + phone }).eq('id', this.userId);
    // UI Updates
}
```

- [ ] **Step 4: Run test to verify it passes**
`// Probar click en Activar Yape, ver modal, testear checkbox, guardar y refrescar para validar persistencia`

- [ ] **Step 5: Commit**
`git commit -m "feat(js): implement yape connection logic and terms validation"`
