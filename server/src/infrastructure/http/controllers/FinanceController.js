// ─── Finanzas del CRM: endpoints del panel de licencias (despacho) y del CRM ───────────────────────────────────
import { isAdminKey } from '../../../shared/config/adminKey.js';
import {
    recordManualIncome, monthData, addExpense, deleteExpense, saveBank, saveYapeBalance, saveWithdrawRate, addBankTransfer, deleteBankTransfer, addPayPalWithdrawal, deletePayPalWithdrawal, updateIncomeLabel, verifyPayPalIncome, setupPayPalWebhook, getSettings, settleArs
} from '../../services/financeService.js';
import { sendWeeklyReport } from '../../services/weeklyReportService.js';
import { METHOD_LABEL, EXPENSE_CATEGORIES } from '../../../shared/store/finance.js';

const fail = (res, e) => res.status(e.status || 500).json({ error: e.status ? e.message : (e.message || 'Error') });

// POST /api/plugin/admin/ledger  { admin_key, serial, email, product, productId, currency, amount, method, noDetail, note }
// Lo llama el panel de licencias al despachar: anota el precio dado ("Acción de Willie"). La misma clave no se anota dos veces.
export const adminRecordDispatchPayment = async (req, res) => {
    try {
        const b = req.body || {};
        if (!isAdminKey(b.admin_key)) return res.status(403).json({ error: 'Unauthorized: Clave de administrador inválida.' });
        const out = await recordManualIncome({ serial: b.serial, email: b.email, product: b.product, productId: b.productId, currency: b.currency, amount: b.amount, method: b.method, noDetail: Boolean(b.noDetail), note: b.note });
        if (!out.ok) return res.status(out.status || 400).json({ error: out.error });
        return res.json({ ok: true, duplicate: out.duplicate, status: out.row.status });
    } catch (e) { return fail(res, e); }
};

// POST /admin/finance/income { product, currency, amount, method, email, note, occurredAt } → anota una venta cobrada a mano.
// Solo registra en finanzas: no entrega nada, no envía correos y no crea claves.
export const financeAddIncome = async (req, res) => {
    try {
        const b = req.body || {};
        const out = await recordManualIncome({ registerOnly: true, email: b.email, product: b.product, currency: b.currency, amount: b.amount, method: b.method, note: b.note, occurredAt: b.occurredAt });
        if (!out.ok) return res.status(out.status || 400).json({ error: out.error });
        return res.json({ ok: true, income: { id: out.row.ref, status: out.row.status, currency: out.row.currency, net: out.row.net, product: out.row.product, occurredAt: out.row.occurred_at } });
    } catch (e) { return fail(res, e); }
};

// GET /admin/finance?month=AAAA-MM → ajustes + ingresos + gastos + resumen del mes
export const financeMonth = async (req, res) => {
    try {
        const data = await monthData(req.query.month);
        return res.json({ ...data, methods: METHOD_LABEL, categories: EXPENSE_CATEGORIES });
    } catch (e) { return fail(res, e); }
};

// POST /admin/finance/expenses { category, amountPen, note, spentAt } · DELETE /admin/finance/expenses/:id
export const financeAddExpense = async (req, res) => {
    try { return res.json({ ok: true, expense: await addExpense(req.body || {}) }); } catch (e) { return fail(res, e); }
};
export const financeDeleteExpense = async (req, res) => {
    try { await deleteExpense(req.params.id); return res.json({ ok: true }); } catch (e) { return fail(res, e); }
};

// PUT /admin/finance/bank { pen, asOf } → la cuenta del banco la actualizas tú; las ventas nuevas no se suman solas
export const financeSaveBank = async (req, res) => {
    try { return res.json({ ok: true, bank: await saveBank({ pen: req.body?.pen, asOf: req.body?.asOf }) }); } catch (e) { return fail(res, e); }
};

// PUT /admin/finance/yape { pen, asOf } → SALDO YAPE (dato de control, no es venta)
export const financeSaveYape = async (req, res) => {
    try { return res.json({ ok: true, yape: await saveYapeBalance({ pen: req.body?.pen, asOf: req.body?.asOf }) }); } catch (e) { return fail(res, e); }
};

// POST /admin/finance/paypal-withdrawals { usd, fee, rate, pen, date, note } · DELETE /admin/finance/paypal-withdrawals/:id
export const financeAddWithdrawal = async (req, res) => {
    try { const b = req.body || {}; return res.json({ ok: true, withdrawal: await addPayPalWithdrawal({ usd: b.usd, fee: b.fee, rate: b.rate, pen: b.pen, date: b.date, note: b.note, to: b.to }) }); } catch (e) { return fail(res, e); }
};
export const financeDeleteWithdrawal = async (req, res) => {
    try { await deletePayPalWithdrawal(req.params.id); return res.json({ ok: true }); } catch (e) { return fail(res, e); }
};

// PUT /admin/finance/withdraw-rate { rate } → cambio real de PayPal al retirar
export const financeSaveWithdrawRate = async (req, res) => {
    try { return res.json({ ok: true, withdraw: await saveWithdrawRate(req.body?.rate) }); } catch (e) { return fail(res, e); }
};

// POST /admin/finance/bank-transfers { pen, date, note } · DELETE /admin/finance/bank-transfers/:id → dinero enviado al banco
export const financeAddTransfer = async (req, res) => {
    try { return res.json({ ok: true, transfer: await addBankTransfer({ pen: req.body?.pen, date: req.body?.date, note: req.body?.note }) }); } catch (e) { return fail(res, e); }
};
export const financeDeleteTransfer = async (req, res) => {
    try { await deleteBankTransfer(req.params.id); return res.json({ ok: true }); } catch (e) { return fail(res, e); }
};

// PATCH /admin/finance/income/:id { product, note } → corrige el nombre del producto (no cambia montos)
export const financeEditIncome = async (req, res) => {
    try { return res.json({ ok: true, income: await updateIncomeLabel(req.params.id, { product: req.body?.product, note: req.body?.note }) }); } catch (e) { return fail(res, e); }
};

// POST /admin/finance/income/:id/verify → vuelve a preguntarle a PayPal por ese cobro
export const financeVerify = async (req, res) => {
    try { return res.json(await verifyPayPalIncome(req.params.id)); } catch (e) { return fail(res, e); }
};

// POST /admin/paypal-webhook-setup → registra en PayPal los avisos de las cuotas (conserva los que ya había)
export const paypalWebhookSetup = async (req, res) => {
    try { return res.json({ ok: true, ...(await setupPayPalWebhook()) }); } catch (e) { return res.status(500).json({ error: e.message || 'No se pudo configurar el webhook.' }); }
};

export const financeSettings = async (req, res) => {
    try { return res.json(await getSettings()); } catch (e) { return fail(res, e); }
};

// POST /admin/finance/settle-ars { label, pen, ref, ids, note } → llegaron los soles de los pagos en pesos argentinos
export const financeSettleArs = async (req, res) => {
    try { return res.json(await settleArs(req.body || {})); } catch (e) { return fail(res, e); }
};

// GET/POST /api/store/cron/weekly-finance (Authorization: Bearer STORE_CRON_SECRET) → manda el correo semanal. ?dry=1 solo lo arma, sin enviar.
export const financeWeeklyCron = async (req, res) => {
    try { return res.json(await sendWeeklyReport({ dry: String(req.query.dry || '') === '1' })); } catch (e) { return fail(res, e); }
};

// GET /admin/finance/weekly-preview → el correo semanal como página, para verlo antes de recibirlo (no envía nada)
export const financeWeeklyPreview = async (req, res) => {
    try { const out = await sendWeeklyReport({ dry: true }); return res.type('html').send(out.html); } catch (e) { return fail(res, e); }
};

// POST /admin/finance/weekly-send → manda el correo ahora (a report_email o al correo que indiques)
export const financeWeeklySend = async (req, res) => {
    try { return res.json(await sendWeeklyReport({ to: req.body && req.body.to })); } catch (e) { return fail(res, e); }
};
