import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('./panel.html', import.meta.url), 'utf8');
const scriptMatch = html.match(/<script>\s*([\s\S]*?)\s*<\/script>\s*<\/body>/i);

if (!scriptMatch) {
  throw new Error('No se encontro el script embebido en panel.html');
}

const panelScript = scriptMatch[1];

function createElement() {
  return {
    value: '',
    textContent: '',
    listeners: {},
    classList: {
      add() {},
      remove() {}
    },
    addEventListener(eventName, handler) {
      this.listeners[eventName] = handler;
    }
  };
}

function runPanel(initialStorage = {}) {
  const elements = {
    statusDot: createElement(),
    statusText: createElement(),
    webhookUrl: createElement(),
    driveFileId: createElement(),
    keyword: createElement(),
    captionIG: createElement(),
    hashtagsIG: createElement(),
    captionTT: createElement(),
    hashtagsTT: createElement(),
    out: createElement(),
    saveUrlBtn: createElement(),
    clearBtn: createElement(),
    sendBtn: createElement()
  };

  const storage = new Map(Object.entries(initialStorage));

  const context = {
    document: {
      getElementById(id) {
        const el = elements[id];
        if (!el) throw new Error(`Elemento no simulado: ${id}`);
        return el;
      }
    },
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      }
    },
    fetch: async () => ({ ok: true, status: 200, text: async () => '{}' }),
    console,
    JSON,
    String,
    Object
  };

  vm.runInNewContext(panelScript, context, { filename: 'panel.html' });

  return { elements, storage };
}

test('carga defaults cuando no existe estado guardado', () => {
  const { elements, storage } = runPanel();
  const saved = JSON.parse(storage.get('offszn_content_bank_panel_v1'));

  assert.notEqual(elements.keyword.value, '');
  assert.match(elements.captionIG.value, /comenta "plugin"/i);
  assert.equal(saved.keyword, elements.keyword.value);
});

test('mantiene campos vacios despues de limpiar y recargar', () => {
  const firstRun = runPanel();
  const saved = JSON.parse(firstRun.storage.get('offszn_content_bank_panel_v1'));

  const clearedState = {
    offszn_content_bank_panel_v1: JSON.stringify({
      ...saved,
      driveFileId: '',
      keyword: '',
      captionIG: '',
      hashtagsIG: '',
      captionTT: '',
      hashtagsTT: ''
    })
  };

  const { elements } = runPanel(clearedState);

  assert.equal(elements.driveFileId.value, '');
  assert.equal(elements.keyword.value, '');
  assert.equal(elements.captionIG.value, '');
  assert.equal(elements.hashtagsIG.value, '');
  assert.equal(elements.captionTT.value, '');
  assert.equal(elements.hashtagsTT.value, '');
});
