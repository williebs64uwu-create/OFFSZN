// Correo semanal de finanzas: funciones puras (sin red ni base de datos) para calcular la semana y armar el HTML del correo.
// El correo usa solo lo que ya está registrado: nada se inventa. Lo aproximado se dice con la palabra "aprox." o "estimado".

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pen = (n) => `S/ ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pen0 = (n) => `S/ ${Math.round(Number(n || 0)).toLocaleString('es-PE')}`;
const usd = (n) => `US$ ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const METHOD_COLOR = { paypal: '#2563eb', yape: '#9333ea', binance: '#eab308', mp_argentina: '#0891b2', mercadopago: '#0891b2' };
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const limaDay = (ms) => new Date(ms - 5 * 3600000).toISOString().slice(0, 10);
export const dayLabel = (iso) => { const [, m, d] = iso.split('-').map(Number); return `${d} de ${MONTHS[m - 1]}`; };

// Ventas en soles aproximados de una fila: soles netos; pesos ya confirmados; dólares netos × cambio.
export function rowPen(r, rate) {
    if (!r || r.status !== 'confirmed') return null;
    if (r.currency === 'PEN') return Number(r.net);
    if (r.currency === 'ARS') return r.settled_pen === null || r.settled_pen === undefined ? null : Number(r.settled_pen);
    if (r.currency === 'USD') return Number(r.net) * rate;
    return null;
}

// Esta semana (últimos 7 días, hoy incluido) contra la anterior, más lo mejor de la semana.
export function weekStats(rows = [], rate = 3.3, now = Date.now(), methodLabels = {}) {
    const days = (off) => limaDay(now - off * 86400000);
    const cur = new Set([0, 1, 2, 3, 4, 5, 6].map(days)); const prev = new Set([7, 8, 9, 10, 11, 12, 13].map(days));
    const w = { pen: 0, count: 0, prevPen: 0, prevCount: 0, best: null, products: new Map(), methods: new Map() };
    const perDay = new Map();
    for (const r of rows) {
        const v = rowPen(r, rate); if (v === null || !Number.isFinite(v)) continue;
        const d = limaDay(Date.parse(r.occurred_at));
        if (cur.has(d)) {
            w.pen += v; w.count += 1; perDay.set(d, (perDay.get(d) || 0) + v);
            const name = r.product || 'Sin nombre'; w.products.set(name, (w.products.get(name) || 0) + v);
            const m = r.method; w.methods.set(m, (w.methods.get(m) || 0) + v);
        } else if (prev.has(d)) { w.prevPen += v; w.prevCount += 1; }
    }
    for (const [d, v] of perDay) if (!w.best || v > w.best.pen) w.best = { date: d, pen: r2(v) };
    return {
        pen: r2(w.pen), count: w.count, prevPen: r2(w.prevPen), prevCount: w.prevCount, avgTicket: w.count ? r2(w.pen / w.count) : 0, best: w.best,
        products: [...w.products.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, v]) => ({ name, pen: r2(v) })),
        methods: [...w.methods.entries()].sort((a, b) => b[1] - a[1]).map(([m, v]) => ({ method: m, label: methodLabels[m] || m, pen: r2(v) }))
    };
}

const bar = (pct, color) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:999px;overflow:hidden;background:#eef0f4"><tr><td width="${Math.max(2, Math.min(100, Math.round(pct)))}%" height="12" style="background:${color};border-radius:999px;font-size:0;line-height:0">&nbsp;</td><td style="font-size:0;line-height:0">&nbsp;</td></tr></table>`;
const card = (inner, bg = '#ffffff', border = '#e6e8ee') => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border:1px solid ${border};border-radius:16px;margin:0 0 14px"><tr><td style="padding:18px 20px">${inner}</td></tr></table>`;
const label = (t) => `<div style="font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#6b7280;margin:0 0 6px">${t}</div>`;
const big = (t, color = '#0f1115') => `<div style="font-size:32px;line-height:1.1;font-weight:800;color:${color}">${t}</div>`;

// data: ver collectWeeklyData() en el servicio. Devuelve { subject, html }.
export function renderWeeklyEmail(data) {
    const { week, goal } = data;
    const diff = r2(week.pen - week.prevPen);
    const compare = week.prevPen > 0
        ? `<span style="color:${diff >= 0 ? '#16a34a' : '#dc2626'};font-weight:700">${diff >= 0 ? '▲' : '▼'} ${pen0(Math.abs(diff))} ${diff >= 0 ? 'más' : 'menos'}</span> que la semana anterior (${pen0(week.prevPen)})`
        : '<span style="color:#6b7280">Todavía no hay una semana anterior para comparar.</span>';
    const goalLevel = { none: 'Aún no llegas al mínimo', min: 'Mínimo logrado', mid: 'Meta intermedia lograda', top: '¡La mejor meta lograda!' }[goal.level];
    const goalColor = { none: '#dc2626', min: '#eab308', mid: '#16a34a', top: '#16a34a' }[goal.level];
    const methodsHtml = week.methods.length ? week.methods.map((m) => `<tr><td style="padding:4px 0;font-size:14px"><span style="display:inline-block;width:10px;height:10px;border-radius:99px;background:${METHOD_COLOR[m.method] || '#9ca3af'};margin-right:8px"></span>${esc(m.label)}</td><td align="right" style="padding:4px 0 4px 8px;font-size:14px;white-space:nowrap"><b>${pen0(m.pen)}</b></td></tr>`).join('') : '<tr><td style="font-size:14px;color:#6b7280">Sin ventas esta semana.</td></tr>';
    const productsHtml = week.products.length ? week.products.map((p, i) => `<tr><td style="padding:4px 0;font-size:14px">${i + 1}. ${esc(p.name)}</td><td align="right" style="padding:4px 0 4px 8px;font-size:14px;white-space:nowrap"><b>${pen0(p.pen)}</b></td></tr>`).join('') : '<tr><td style="font-size:14px;color:#6b7280">Sin ventas esta semana.</td></tr>';
    const pendingHtml = data.pending ? card(`<div style="font-size:14px;color:#92400e"><b>⚠️ ${data.pending} ${data.pending === 1 ? 'pago' : 'pagos'} por revisar.</b> Entra al panel para ponerles su producto.</div>`, '#fffbeb', '#fde68a') : '';

    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tu semana en OFFSZN</title></head>
<body style="margin:0;padding:0;background:#f3f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f1115">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f8"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
 <tr><td style="padding:0 4px 16px"><div style="font-size:13px;color:#6b7280;letter-spacing:.06em;text-transform:uppercase">OFFSZN · resumen semanal</div>
  <div style="font-size:26px;font-weight:800;margin-top:4px">Así vas, Willie 👋</div>
  <div style="font-size:14px;color:#6b7280;margin-top:2px">${esc(data.rangeText)}</div></td></tr>
 <tr><td>
  ${card(`${label('💰 Dinero para depositar')}${big(pen(data.available), '#16a34a')}<div style="font-size:13px;color:#6b7280;margin-top:8px">Yape ${pen(data.yape)} + PayPal cambiado a soles ${pen(data.paypalNowPen)} (ya con el costo del retiro).</div>`, '#f0fdf4', '#bbf7d0')}
  ${card(`${label('Dinero del mes total')}${big(pen(data.monthTotal))}<div style="font-size:13px;color:#6b7280;margin-top:8px">${pen(data.available)} para depositar + ${pen(data.sentToBank)} que ya llegó al banco este mes.</div>`)}
  ${card(`${label('Esta semana')}${big(pen0(week.pen))}<div style="font-size:14px;margin-top:8px">${compare}</div>
   <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px"><tr>
    <td width="33%" style="font-size:13px;color:#6b7280">Ventas<br><b style="font-size:18px;color:#0f1115">${week.count}</b></td>
    <td width="33%" style="font-size:13px;color:#6b7280">Ticket medio<br><b style="font-size:18px;color:#0f1115">${week.count ? pen0(week.avgTicket) : '—'}</b></td>
    <td width="34%" style="font-size:13px;color:#6b7280">Mejor día<br><b style="font-size:18px;color:#0f1115">${week.best ? esc(dayLabel(week.best.date)) : '—'}</b></td></tr></table>`)}
  ${card(`${label(`🎯 Meta de ${esc(data.monthLabel)}`)}<div style="font-size:22px;font-weight:800">${pen0(goal.salesNetPen)} <span style="font-size:13px;font-weight:600;color:${goalColor}">${goalLevel}</span></div>
   <div style="margin:12px 0 6px">${bar(goal.pct, goalColor)}</div>
   <div style="font-size:12px;color:#6b7280">Mínimo ${pen0(goal.goals.min)} · Intermedia ${pen0(goal.goals.mid)} · La mejor ${pen0(goal.goals.top)}+</div>
   <div style="font-size:13px;margin-top:8px">Faltan <b>${pen0(goal.missing.min)}</b> para el mínimo${data.projection ? ` · estimado simple de cierre: <b>${pen0(data.projection)}</b>` : ''}.</div>`)}
  ${card(`${label('¿Dónde está tu dinero?')}
   <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:5px 0;font-size:14px"><span style="display:inline-block;width:10px;height:10px;border-radius:99px;background:#9ca3af;margin-right:8px"></span>Banco</td><td align="right" style="font-size:15px"><b>${pen(data.bank)}</b></td></tr>
    <tr><td style="padding:5px 0;font-size:14px"><span style="display:inline-block;width:10px;height:10px;border-radius:99px;background:#9333ea;margin-right:8px"></span>Yape (Binance incluido)</td><td align="right" style="font-size:15px"><b>${pen(data.yape)}</b></td></tr>
    <tr><td style="padding:5px 0;font-size:14px"><span style="display:inline-block;width:10px;height:10px;border-radius:99px;background:#2563eb;margin-right:8px"></span>PayPal</td><td align="right" style="font-size:15px"><b>${usd(data.paypalUsd)}</b></td></tr></table>
   <div style="margin:10px 0 4px">${bar(data.paypalProgress * 100, '#2563eb')}</div>
   <div style="font-size:12px;color:#6b7280">${data.paypalRemainingUsd > 0 ? `Faltan ${usd(data.paypalRemainingUsd)} para tu retiro de ${usd(data.paypalThreshold)}.` : 'Ya llegaste a tu retiro de PayPal.'}</div>`)}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
   <td width="50%" valign="top" style="padding-right:7px">${card(`${label('De dónde vinieron')}<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${methodsHtml}</table>`)}</td>
   <td width="50%" valign="top" style="padding-left:7px">${card(`${label('Lo más vendido')}<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${productsHtml}</table>`)}</td></tr></table>
  ${pendingHtml}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:6px 0 18px"><a href="${esc(data.crmUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:12px">Abrir mi panel</a></td></tr></table>
  <div style="font-size:12px;color:#9ca3af;text-align:center;line-height:1.5">Las cifras salen de lo que registraste en el panel. Los dólares se pasan a soles con el cambio de PayPal (aprox.). Los pagos en pesos argentinos no suman hasta que llegue el depósito.</div>
 </td></tr></table></td></tr></table></body></html>`;
    return { subject: `Tu semana en OFFSZN: ${pen0(week.pen)} · para depositar ${pen0(data.available)}`, html };
}
