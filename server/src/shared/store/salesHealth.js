// Prueba de ventas: reglas puras que dicen si cada venta llegó hasta el final (cobro → licencia → finanzas → correo).
// No toca la red ni la base: recibe los datos ya leídos, para poder probarlo igual en el CRM y en los tests.

const DAY = 86400000;
const STAR_INSTALLMENTS = 3;

// Eventos de Brevo que significan "el cliente NO recibió el correo".
export const BREVO_BAD_EVENTS = ['hardBounces', 'softBounces', 'blocked', 'invalid', 'error', 'deferred', 'spam', 'unsubscribed'];

/**
 * Cada cuota de STAR CHAIN cobrada tiene que tener: la cuota guardada, su licencia activa y su fila en finanzas.
 * @param {{payments:object[], licenses:object[], subscriptions:object[], income:object[], now?:number}} d
 */
export function checkStarSales({ payments = [], licenses = [], subscriptions = [], income = [], now = Date.now() }) {
    const licBySerial = new Map(licenses.map((l) => [l.serial_key, l]));
    const subById = new Map(subscriptions.map((s) => [s.subscription_id, s]));
    const incomeRefs = new Set(income.map((i) => String(i.ref)));
    const items = payments.map((p) => {
        const lic = p.license_serial ? licBySerial.get(p.license_serial) : null;
        const sub = subById.get(p.subscription_id);
        const problems = [];
        if (!p.license_serial) problems.push('La cuota se cobró pero NO tiene licencia asignada.');
        else if (!lic) problems.push('La licencia asignada no existe en la base.');
        else if (lic.status !== 'active') problems.push(`La licencia está "${lic.status}" (el cliente no puede usarla).`);
        else if (lic.expires_at && Date.parse(lic.expires_at) < now) problems.push('La licencia ya venció.');
        if (!incomeRefs.has(String(p.sale_id))) problems.push('La cuota no está en el libro de finanzas (no suma a tus ventas).');
        if (!sub?.email) problems.push('La suscripción no tiene correo del cliente (no se le pudo escribir).');
        return { saleId: p.sale_id, n: p.n, paidAt: p.paid_at, email: sub?.email || null, serial: p.license_serial || null, license: lic?.status || null, ok: problems.length === 0, problems };
    });
    const cancelled = subscriptions.filter((s) => s.status === 'cancelled' && Number(s.payments_count) < STAR_INSTALLMENTS).map((s) => ({ email: s.email, payments: s.payments_count }));
    return { total: items.length, bad: items.filter((i) => !i.ok).length, items, cancelled };
}

/**
 * Ventas de PayPal que están en finanzas pero sin cobro real (o al revés) no se pueden ver sin PayPal; aquí se revisa lo que SÍ se ve:
 * que las ventas recientes existan, tengan comisión y que la última no sea sospechosamente vieja.
 */
export function checkLedger({ income = [], now = Date.now() }) {
    const last = income.reduce((m, r) => Math.max(m, Date.parse(r.occurred_at) || 0), 0);
    const usdNoFee = income.filter((r) => r.currency === 'USD' && r.method === 'paypal' && (r.fee === null || r.fee === undefined)).map((r) => ({ ref: r.ref, product: r.product }));
    const badCur = income.filter((r) => ({ yape: 'PEN', binance: 'PEN', paypal: 'USD', mp_argentina: 'ARS' }[r.method] || r.currency) !== r.currency).map((r) => ({ ref: r.ref, product: r.product, method: r.method, currency: r.currency }));
    return { count: income.length, lastAt: last ? new Date(last).toISOString() : null, hoursSinceLast: last ? Math.round((now - last) / 3600000) : null, usdNoFee, badCurrency: badCur };
}

/** Resume los eventos de correo que devuelve Brevo (lista de {event,email,subject,date}). */
export function summarizeBrevoEvents(events = []) {
    const counts = {};
    for (const e of events) counts[e.event] = (counts[e.event] || 0) + 1;
    const failures = events.filter((e) => BREVO_BAD_EVENTS.includes(e.event)).map((e) => ({ event: e.event, email: e.email, subject: e.subject || null, date: e.date || null }));
    return { total: events.length, delivered: counts.delivered || 0, counts, failures };
}

/**
 * Junta todo en una lista de pruebas con semáforo. Cada prueba: { key, name, status: 'ok'|'warn'|'bad', detail, fix? }.
 */
export function buildHealthReport({ env = {}, star, ledger, brevo, licensesRecent = [], now = Date.now() }) {
    const checks = [];
    const add = (key, name, status, detail, fix) => checks.push({ key, name, status, detail, ...(fix ? { fix } : {}) });

    // 1) Conexiones necesarias para que una venta llegue completa
    const need = [['BREVO_API_KEY', 'Correos (Brevo)'], ['PAYPAL_CLIENT_ID', 'PayPal (llave pública)'], ['PAYPAL_CLIENT_SECRET', 'PayPal (llave secreta)'], ['SUPABASE_SERVICE_KEY', 'Base de datos'], ['STORE_CRON_SECRET', 'Cron de GitHub (reintentos y correo semanal)'], ['MERCADOPAGO_ACCESS_TOKEN', 'Yape (Mercado Pago)']];
    for (const [k, name] of need) add(`env_${k}`, name, env[k] ? 'ok' : 'bad', env[k] ? 'Configurado' : 'No está definido en el servidor', `Define ${k} en Vercel y vuelve a desplegar.`);

    // 2) STAR CHAIN: cada cuota con licencia, finanzas y correo
    if (star) {
        const s = star;
        add('star_sales', 'Cuotas de STAR CHAIN → licencia y finanzas', s.total === 0 ? 'warn' : s.bad ? 'bad' : 'ok',
            s.total === 0 ? 'No hubo cuotas en el periodo revisado.' : s.bad ? `${s.bad} de ${s.total} cuotas con problema.` : `${s.total} de ${s.total} cuotas completas: cobradas, con licencia activa y contadas en finanzas.`,
            s.bad ? 'Abre el detalle de abajo: ahí dice qué le falta a cada cuota.' : undefined);
        if (s.cancelled?.length) add('star_cancelled', 'Suscripciones canceladas antes de la cuota 3', 'warn', `${s.cancelled.length} cliente(s) cancelaron antes de pagar las 3 cuotas. Su licencia sigue hasta que venza, pero ya no pagarán más.`);
    }

    // 3) Libro de finanzas
    if (ledger) {
        add('ledger_fresh', 'Libro de finanzas al día', ledger.hoursSinceLast === null ? 'warn' : ledger.hoursSinceLast > 72 ? 'warn' : 'ok',
            ledger.lastAt ? `Última venta anotada hace ${ledger.hoursSinceLast} h.` : 'Aún no hay ventas en el periodo.', ledger.hoursSinceLast > 72 ? 'Si hubo ventas y no se ven, revisa el webhook de PayPal y el cron de reconciliación.' : undefined);
        add('ledger_fee', 'Cobros de PayPal con comisión', ledger.usdNoFee.length ? 'warn' : 'ok', ledger.usdNoFee.length ? `${ledger.usdNoFee.length} cobro(s) en dólares sin comisión: tu saldo de PayPal no cuadrará.` : 'Todos los cobros de PayPal tienen su comisión.', ledger.usdNoFee.length ? 'Edita esas ventas y pon la comisión real.' : undefined);
        add('ledger_currency', 'Método y moneda van juntos', ledger.badCurrency.length ? 'bad' : 'ok', ledger.badCurrency.length ? `${ledger.badCurrency.length} venta(s) con método y moneda que no calzan (ej. Yape en dólares).` : 'Yape/Binance en soles, PayPal en dólares, Mercado Pago en pesos.');
    }

    // 4) Brevo: la llave sirve y los correos de verdad salieron
    if (brevo) {
        if (brevo.error) add('brevo_events', 'Correos entregados (Brevo)', 'warn', `No pude leer el registro de Brevo: ${brevo.error}`, 'Revisa que la llave BREVO_API_KEY tenga permiso de lectura de estadísticas.');
        else {
            const sm = brevo.summary;
            add('brevo_key', 'Llave de Brevo válida', 'ok', brevo.account ? `Cuenta: ${brevo.account}` : 'La llave responde.');
            add('brevo_events', 'Correos entregados (Brevo)', sm.failures.length ? 'bad' : sm.total ? 'ok' : 'warn',
                sm.total ? `${sm.delivered} entregados de ${sm.total} eventos en los últimos días${sm.failures.length ? `; ${sm.failures.length} NO llegaron` : ''}.` : 'Brevo no registra correos en el periodo.',
                sm.failures.length ? 'Mira la lista de correos que fallaron y escríbeles por otro medio.' : undefined);
        }
    }

    // 5) Plugins: licencias nuevas por producto (visibilidad, no semáforo)
    const byPlugin = {};
    for (const l of licensesRecent) { const k = l.plugin_name || 'Sin nombre'; byPlugin[k] = (byPlugin[k] || 0) + 1; }
    const worst = checks.some((c) => c.status === 'bad') ? 'bad' : checks.some((c) => c.status === 'warn') ? 'warn' : 'ok';
    return { status: worst, checks, licensesByPlugin: byPlugin, at: new Date(now).toISOString() };
}

export const HEALTH_WINDOW_DAYS = 14;
export const sinceIso = (now = Date.now(), days = HEALTH_WINDOW_DAYS) => new Date(now - days * DAY).toISOString();
