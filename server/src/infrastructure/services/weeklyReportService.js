// Correo semanal de finanzas por Brevo. Lee los mismos números que el panel y los manda a tu correo.
// El destinatario sale de finance_settings.report_email ({"email": "..."}) o de la variable FINANCE_REPORT_EMAIL.
import { supabase } from '../database/connection.js';
import { sendOffsznEmail } from '../../shared/utils/mailer.js';
import { monthData, getSettings } from './financeService.js';
import { currentMonth, METHOD_LABEL } from '../../shared/store/finance.js';
import { weekStats, renderWeeklyEmail } from '../../shared/store/weeklyReport.js';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const CRM_URL = process.env.CRM_PUBLIC_URL || 'https://offszn.lat/crm';

export async function collectWeeklyData(now = Date.now()) {
    const settings = await getSettings();
    const month = currentMonth(now);
    const d = await monthData(month);
    const since = new Date(now - 15 * 86400000).toISOString();
    const rows = await supabase.from('finance_income').select('*').gte('occurred_at', since).limit(5000);
    if (rows.error) throw rows.error;
    const rate = settings.withdraw.rate;
    const week = weekStats(rows.data || [], rate, now, METHOD_LABEL);
    const pp = d.pockets.paypal; const live = d.live;
    const yape = d.settings.yape && d.settings.yape.pen !== null && d.settings.yape.pen !== undefined ? live.yape.now : 0;
    const available = yape + pp.nowPen;
    const dayOfMonth = Number(new Date(now - 5 * 3600000).toISOString().slice(8, 10));
    const [y, m] = month.split('-').map(Number);
    const stub = (d.goal && d.goal.stubDays) || 0; // el primer mes también cuenta los días desde el inicio del conteo (31 oct)
    const projection = d.goal && dayOfMonth >= 3 ? Math.round((d.goal.salesNetPen / (dayOfMonth + stub)) * (new Date(y, m, 0).getDate() + stub)) : null;
    const fmt = (ms) => { const [, mm, dd] = new Date(ms - 5 * 3600000).toISOString().slice(0, 10).split('-').map(Number); return `${dd} de ${MONTHS[mm - 1]}`; };
    return {
        rangeText: `Del ${fmt(now - 6 * 86400000)} al ${fmt(now)}`, monthLabel: `${MONTHS[m - 1]} ${y}`,
        available, monthTotal: available + (Number(d.transfersPen) || 0) + (Number(d.withdrawalsBankPen) || 0), sentToBank: (Number(d.transfersPen) || 0) + (Number(d.withdrawalsBankPen) || 0),
        bank: live.bank.now, yape, paypalUsd: pp.balanceUsd, paypalNowPen: pp.nowPen, paypalProgress: pp.progress, paypalRemainingUsd: pp.remainingUsd, paypalThreshold: pp.threshold,
        goal: d.goal, projection, week, pending: d.income.filter((r) => r.kind === 'Por revisar').length + (d.pendingArs || []).length, crmUrl: CRM_URL
    };
}

export async function sendWeeklyReport({ dry = false, to = null } = {}) {
    const data = await collectWeeklyData();
    const mail = renderWeeklyEmail(data);
    if (dry) return { ok: true, dry: true, ...mail };
    const settings = await getSettings();
    const target = String(to || settings.reportEmail || process.env.FINANCE_REPORT_EMAIL || '').trim();
    if (!target) return { ok: false, error: 'Falta el correo del informe: guárdalo en finance_settings (report_email) o en FINANCE_REPORT_EMAIL.' };
    await sendOffsznEmail({ to: target, subject: mail.subject, html: mail.html, fromName: 'OFFSZN · tu semana' });
    return { ok: true, sentTo: target, subject: mail.subject };
}
