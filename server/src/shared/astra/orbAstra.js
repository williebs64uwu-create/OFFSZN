// ─── Astra (Orb) en la nube: prompt, respuesta validada y llamada al modelo ───────────────────────────────────────
// El modelo no inventa un patch completo: elige un preset de fábrica como base y propone cambios acotados.
// orbCatalog.js lo genera Orb (`node tools/gen_params.js` → server/catalog.json); cópialo aquí al cambiar parámetros.
// Proveedor: cualquier API compatible con OpenAI (OpenRouter, Alibaba Model Studio, llama-server propio…).
import catalog from './orbCatalog.js';
const PARAM_KEYS = new Set(catalog.params.map((p) => p.key));
const FAMILY_KEYS = catalog.families.map((f) => f.key);
const PRESET_NAMES = new Set(catalog.families.flatMap((f) => f.presets));

const GUIDE = `Grupos de parámetros:
- o1.* / o2.*: osciladores (wave, oct, semi, fine en cents, level 0-1, pan, uni = voces de unísono, det = detune, spread = ancho).
- noise: ruido de ataque. smp.id / smp.level: capa de sample (solo algunos presets la usan; no la actives en sonidos que no la traen).
- filt.*: filtro (type lp/lp24/hp/bp, cutoff en Hz, res, env = cuánto abre la envolvente del filtro, key, sat = saturación por voz).
- aenv.* (volumen) y fenv.* (filtro): a/d/r en segundos, s 0-1.
- fm.amt/ratio/decay: FM sobre el oscilador 1 (brillo metálico, campanas, keys eléctricas).
- penv.amt (semitonos) y penv.time: golpe de tono al inicio (808, kicks).
- lfo.*: wave, dest (pitch/cutoff/amp), rate en Hz, depth 0-1.
- fx.*: drive, chorus, delay, dtime (s), dfb, reverb, rsize (0-1).
- m.vol, m.glide (0-1), m.mono.`;

const FORMAT = `Responde SOLO con un objeto JSON con exactamente estas claves:
{"reply": string (español, 1-2 frases, sin markdown),
 "action": "new" | "preset" | "edit" | "chat",
 "family": ${FAMILY_KEYS.map((f) => `"${f}"`).join(' | ')} | "none",
 "preset": nombre exacto de un preset de fábrica o "",
 "name": nombre corto del sonido (máx. 3 palabras) o "",
 "changes": [{"param": clave del parámetro, "op": "set" | "mul" | "add", "value": número o opción como texto}]}`;

export function systemPrompt() {
    const params = catalog.params.map((p) => p.opts
        ? `${p.key} (${p.label}): opciones ${p.opts.join('/')}, def ${p.def}`
        : `${p.key} (${p.label}): ${p.min}..${p.max}${p.log ? ' log' : ''}${p.int ? ' entero' : ''}, def ${p.def}`).join('\n');
    const fams = catalog.families.map((f) => `- ${f.key} (${f.label}): ${f.desc} Presets: ${f.presets.join(', ')}.`).join('\n');
    return `Eres Astra, la asistente de sonido de Orb, un sintetizador para música urbana (trap, reggaetón, drill, R&B, phonk, dembow, lo-fi).
El usuario describe un sonido en español (a veces dictado por voz, con errores de transcripción). Tú decides qué hacer.

Cómo decidir:
- Sonido nuevo ("hazme un 808 oscuro", "un pluck para reggaetón"): action "new", elige el preset de fábrica más cercano como base y añade pocos cambios (0-8).
- Si nombra o describe claramente un preset existente: action "preset" con ese nombre.
- Si pide modificar lo que suena ("más oscuro", "quítale reverb"): action "edit" con cambios relativos sobre el sonido actual.
- Si solo conversa: action "chat", responde breve y llévalo al sonido. Si es ajeno al sonido, dilo con amabilidad y no cambies nada.

Reglas:
- Prefiere cambios relativos (mul/add) en edit; set solo para opciones o valores concretos ("corte a 800 Hz").
- Sé moderado: "más oscuro" es corte ×0.6. "Muy" duplica el efecto; "un poco" lo reduce a la mitad. "Menos/bájale/quítale" invierte la dirección.
- Respeta los rangos. No toques parámetros que no tengan que ver con el pedido.
- Para graves de 808 usa la familia bass; para campanas, mallets.
- No inventes nombres de artistas ni de plugins comerciales.

${GUIDE}

Parámetros (clave (etiqueta): rango, valor por defecto):
${params}

Familias y presets de fábrica:
${fams}

${FORMAT}`;
}

const clip = (s, n) => String(s ?? '').slice(0, n);

export function userMessage(req, { noThink = false } = {}) {
    const cur = req.current || {};
    const history = Array.isArray(req.history)
        ? req.history.slice(-6).map((h) => `${h.role === 'ai' ? 'Astra' : 'Usuario'}: ${clip(h.text, 300)}`).join('\n') : '';
    const patch = cur.patch && typeof cur.patch === 'object' ? Object.fromEntries(Object.entries(cur.patch).filter(([k]) => PARAM_KEYS.has(k)).slice(0, 60)) : {};
    return JSON.stringify({
        pedido: clip(req.text, 600),
        sonido_actual: { nombre: clip(cur.name, 60), familia: clip(cur.fam, 20), parametros_cambiados: patch },
        conversacion_reciente: history,
    }) + (noThink ? ' /no_think' : '');
}

// Defensa: aunque el modelo se equivoque, solo salen cambios aplicables
export function sanitize(out) {
    const o = out && typeof out === 'object' ? out : {};
    return {
        reply: clip(o.reply, 400) || 'Listo.',
        action: ['new', 'preset', 'edit', 'chat'].includes(o.action) ? o.action : 'chat',
        family: FAMILY_KEYS.includes(o.family) ? o.family : 'none',
        preset: PRESET_NAMES.has(o.preset) ? o.preset : '',
        name: clip(o.name, 40),
        changes: (Array.isArray(o.changes) ? o.changes : [])
            .filter((c) => c && PARAM_KEYS.has(c.param) && ['set', 'mul', 'add'].includes(c.op))
            .slice(0, 16).map((c) => ({ param: c.param, op: c.op, value: clip(c.value, 24) })),
    };
}

// Primer objeto JSON del texto (algunos modelos lo envuelven en ```json … ```)
export function parseModelJson(text) {
    const t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    try { return JSON.parse(t); } catch { /* sigue */ }
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* sigue */ } }
    return null;
}

// Llamada al proveedor (compatible con OpenAI). `fetchImpl` permite simularlo en las pruebas.
export async function askModel(req, { model, baseUrl, apiKey, timeoutMs = 20000, fetchImpl = fetch }) {
    const noThink = /qwen3/i.test(model) && !/instruct|2507/i.test(model);   // Qwen3 híbrido: sin modo "pensar" (más rápido y barato)
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
        const r = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            signal: ctl.signal,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
                model,
                messages: [{ role: 'system', content: systemPrompt() }, { role: 'user', content: userMessage(req, { noThink }) }],
                response_format: { type: 'json_object' },
                temperature: 0.3,
                max_tokens: 600,
            }),
        });
        const j = await r.json().catch(() => null);
        if (!r.ok || !j) throw Object.assign(new Error(`proveedor ${r.status}`), { status: r.status });
        const text = j.choices?.[0]?.message?.content || '';
        const parsed = parseModelJson(text);
        if (!parsed) throw Object.assign(new Error('respuesta del modelo sin JSON'), { status: 502 });
        return { out: sanitize(parsed), usage: { in: j.usage?.prompt_tokens || 0, out: j.usage?.completion_tokens || 0 } };
    } finally {
        clearTimeout(timer);
    }
}
