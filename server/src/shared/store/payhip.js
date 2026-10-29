// Importador del CSV de clientes de Payhip: solo se guardan los plugins (nada de presets, plantillas ni servicios) y sin datos personales.
// Un producto de Payhip es un plugin cuando su nombre termina en "- WIN Y MAC" (así los nombras allí).

const PLUGIN_ITEM = /^(.*?)\s*(?:PLUGIN\s*)?-\s*WIN Y MAC$/i;

// CSV con comillas (RFC 4180): campos con comas, comillas dobles y saltos de línea.
export function parseCsv(text) {
    const rows = [];
    let row = [];
    let cur = '';
    let q = false;
    const s = String(text || '').replace(/^﻿/, '');
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (q) {
            if (c === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c;
        } else if (c === '"') q = true;
        else if (c === ',') { row.push(cur); cur = ''; }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && s[i + 1] === '\n') i++;
            row.push(cur); cur = '';
            if (row.some((x) => x !== '')) rows.push(row);
            row = [];
        } else cur += c;
    }
    row.push(cur);
    if (row.some((x) => x !== '')) rows.push(row);
    return rows;
}

const titleCase = (s) => s.toLowerCase().replace(/\b\p{L}/gu, (m) => m.toUpperCase());
const money = (v) => Math.round((Number(String(v || '0').replace(',', '.')) || 0) * 100) / 100;

export function pluginNameOf(item) {
    const m = String(item || '').trim().match(PLUGIN_ITEM);
    return m ? titleCase(m[1].trim()) : null;
}

/**
 * @returns {{ rows: Array, ignoredOrders: number, totalOrders: number }}
 * Cada fila: { order_id, sold_on, plugin, unit_price_usd|null, gross_usd, tax_usd, fee_usd, coupon, cart_items, mixed }
 * "mixed" = el pedido llevaba más productos aparte del plugin: no se sabe cuánto fue del plugin, así que no se le asigna precio.
 */
export function parsePayhipPlugins(csvText) {
    const table = parseCsv(csvText);
    if (table.length < 2) return { rows: [], ignoredOrders: 0, totalOrders: 0 };
    const head = table[0].map((h) => h.trim());
    const col = (name) => head.indexOf(name);
    const idx = { id: col('Order ID'), items: col('Items In Cart'), gross: col('Amount Gross'), tax: col('Payhip Collected Sales Tax Amount'), fee: col('Payhip Fee'), status: col('Status'), date: col('Date'), coupon: col('Coupon Code'), n: col('Num of Items In Cart') };
    if ([idx.id, idx.items, idx.gross, idx.date].some((i) => i < 0)) throw new Error('El CSV no parece de Payhip (faltan columnas Order ID, Items In Cart, Amount Gross o Date).');
    const rows = [];
    let ignored = 0;
    const body = table.slice(1);
    for (const r of body) {
        if (idx.status >= 0 && String(r[idx.status]).toUpperCase() !== 'COMPLETED') { ignored++; continue; }
        const items = String(r[idx.items] || '').split(/,\s+/).map((x) => x.trim()).filter(Boolean);
        const plugins = items.map(pluginNameOf).filter(Boolean);
        if (!plugins.length) { ignored++; continue; }
        const gross = money(r[idx.gross]);
        const tax = idx.tax >= 0 ? money(r[idx.tax]) : 0;
        const mixed = items.length > 1;
        rows.push({
            order_id: String(r[idx.id]).trim(),
            sold_on: String(r[idx.date]).slice(0, 10),
            plugin: plugins[0],
            unit_price_usd: mixed ? null : Math.round((gross - tax) * 100) / 100,
            gross_usd: gross,
            tax_usd: tax,
            fee_usd: idx.fee >= 0 ? money(r[idx.fee]) : 0,
            coupon: idx.coupon >= 0 ? String(r[idx.coupon] || '').trim() || null : null,
            cart_items: items.length,
            mixed
        });
    }
    return { rows, ignoredOrders: ignored, totalOrders: body.length };
}
