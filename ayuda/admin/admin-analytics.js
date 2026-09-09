/**
 * OFFSZN Admin Analytics v4 — Modals + Export + Desde Inicio + Full Detail
 */
let funnelChart, activityChart, planChart, categoryChart, roleChart;
let currentTimeframe = 'weekly';
let productNameCache = {};

const sb = () => window.supabaseClient;
const el = id => document.getElementById(id);
const trunc = (s, n = 28) => !s ? '—' : s.length > n ? s.slice(0, n) + '…' : s;
const fmtD = iso => !iso ? '—' : new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtShort = iso => !iso ? '—' : new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });

function getTimeframeStart() {
    const now = new Date();
    if (currentTimeframe === 'daily') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    if (currentTimeframe === 'weekly') { const d = new Date(now); d.setDate(d.getDate() - 7); return d.toISOString(); }
    if (currentTimeframe === 'monthly') { const d = new Date(now); d.setMonth(d.getMonth() - 1); return d.toISOString(); }
    return '2020-01-01T00:00:00Z'; // all-time
}
function getTimeframeDays() {
    if (currentTimeframe === 'daily') return 1;
    if (currentTimeframe === 'weekly') return 7;
    if (currentTimeframe === 'monthly') return 30;
    return 365;
}

function tBadge(t) {
    const c = { beat: '#aaa', preset: '#b19cd9', drumkit: '#f0a', loopkit: '#0cf' }[t] || '#555';
    return `<span style="background:${c}22;color:${c};border:1px solid ${c}44;padding:1px 7px;border-radius:3px;font-size:0.55rem;font-weight:700;text-transform:uppercase;">${t || '?'}</span>`;
}
function tag(l, type) { return `<span class="tag tag-${type}">${l}</span>`; }

// ─── MODAL ──────────────────────────────────────────
function openModal(title, html) {
    el('modal-title').textContent = title;
    el('modal-body').innerHTML = html;
    el('detail-modal').style.display = 'flex';
}
function closeModal() { el('detail-modal').style.display = 'none'; }

// ─── EXPORT .TXT ────────────────────────────────────
function downloadTxt(filename, content) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}

function exportBtn(label, onclick) {
    return `<button onclick="${onclick}" style="background:#111;border:1px solid rgba(255,255,255,0.1);color:#888;padding:3px 10px;border-radius:4px;cursor:pointer;font-size:0.6rem;margin-top:6px;">📄 ${label}</button>`;
}

// ─── INIT ───────────────────────────────────────────
async function initDashboard() {
    // 1. Init Supabase client
    if (!sb() && window.AuthUtils) window.AuthUtils.initSupabase();
    if (!sb()) { console.error('❌ No Supabase client'); return; }

    // 2. Wait for auth session to load (critical for RLS admin policies)
    let retries = 0;
    while (retries < 15) {
        const { data } = await sb().auth.getSession();
        if (data?.session) {
            console.log('✅ Admin session:', data.session.user.email);
            break;
        }
        retries++;
        await new Promise(r => setTimeout(r, 300));
    }

    await refreshData();
}

async function refreshData() {
    try {
        document.querySelectorAll('.stat-value').forEach(v => v.style.opacity = '0.3');
        const tf = getTimeframeStart();
        await Promise.all([
            renderKPIs(tf), renderFunnel(), renderTimeline(),
            renderTopProducts(), renderCategories(),
            renderFreeDownloads(), renderRecentDownloads(),
            renderTopPages(tf), renderPlansAndSubs(),
            renderRoles(), renderYouTube(), renderCredits(),
            renderFriction(), renderMissingData(),
            renderListening(), renderSocial(tf),
        ]);
        document.querySelectorAll('.stat-value').forEach(v => v.style.opacity = '1');
    } catch (e) { console.error('❌', e); }
}

// ═══ 1. KPIs ════════════════════════════════════════
async function renderKPIs(tf) {
    const [
        { count: totalU }, { count: regP }, { count: totalProd }, { count: totalOrd },
        { count: dlT }, { count: freeDl }, { data: subsD }, { count: pvP },
        { count: fol }, { count: lik }, { count: lis },
    ] = await Promise.all([
        sb().from('users').select('*', { count: 'exact', head: true }),
        sb().from('users').select('*', { count: 'exact', head: true }).gte('created_at', tf),
        sb().from('products').select('*', { count: 'exact', head: true }),
        sb().from('orders').select('*', { count: 'exact', head: true }).gte('created_at', tf),
        sb().from('download_logs').select('*', { count: 'exact', head: true }).gte('created_at', tf),
        sb().from('free_downloads').select('*', { count: 'exact', head: true }).gte('downloaded_at', tf),
        sb().from('subscriptions').select('status'),
        sb().from('page_views').select('*', { count: 'exact', head: true }).gte('viewed_at', tf),
        sb().from('followers').select('*', { count: 'exact', head: true }).gte('created_at', tf),
        sb().from('likes').select('*', { count: 'exact', head: true }).gte('created_at', tf),
        sb().from('listening_history').select('*', { count: 'exact', head: true }).gte('created_at', tf),
    ]);
    const act = subsD?.filter(s => s.status === 'active').length || 0;
    el('val-total-users').textContent = totalU || 0;
    el('val-registrations').textContent = regP || 0;
    el('val-products').textContent = totalProd || 0;
    el('val-orders').textContent = totalOrd || 0;
    el('val-downloads').textContent = (dlT || 0) + (freeDl || 0);
    el('val-free-downloads').textContent = freeDl || 0;
    el('val-subscriptions').textContent = act;
    el('val-page-views').textContent = pvP || 0;
    el('val-follows').textContent = fol || 0;
    el('val-likes').textContent = lik || 0;
    el('val-listens').textContent = lis || 0;
    const { count: onb } = await sb().from('users').select('*', { count: 'exact', head: true }).eq('onboarding_completed', true);
    el('val-onboarding-rate').textContent = (totalU > 0 ? ((onb / totalU) * 100).toFixed(1) : 0) + '%';
}

// ═══ 2. FUNNEL with clickable steps ═════════════════
async function renderFunnel() {
    const [{ count: t }, { count: onb }, { count: prof }] = await Promise.all([
        sb().from('users').select('*', { count: 'exact', head: true }),
        sb().from('users').select('*', { count: 'exact', head: true }).eq('onboarding_completed', true),
        sb().from('profiles').select('*', { count: 'exact', head: true }),
    ]);
    const { data: pd } = await sb().from('products').select('producer_id');
    const uniqProd = new Set(pd?.map(p => p.producer_id)).size;
    const { data: yp } = await sb().from('profiles').select('user_id').eq('youtube_import_done', true);
    const ytU = yp?.length || 0;

    const steps = [
        { label: 'Registro', val: t || 0, key: 'registered' },
        { label: 'Onboarding OK', val: onb || 0, key: 'onboarded' },
        { label: 'Perfil Creado', val: prof || 0, key: 'profiled' },
        { label: 'Subió Producto', val: uniqProd, key: 'uploaded' },
        { label: 'Usó YouTube', val: ytU, key: 'youtube' },
    ];

    // Store for modal clicks
    window._funnelSteps = steps;

    const ctx = el('conversionFunnelChart')?.getContext('2d');
    if (!ctx) return;
    if (funnelChart) funnelChart.destroy();

    funnelChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: steps.map(s => `${s.label} (${s.val})`),
            datasets: [{ data: steps.map(s => s.val),
                backgroundColor: steps.map((_, i) => `rgba(255,255,255,${0.15 - i * 0.025})`),
                borderColor: '#fff', borderWidth: 1, borderRadius: 4 }]
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            onClick: (e, elements) => { if (elements.length) showFunnelModal(steps[elements[0].index].key); },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#555' } },
                y: { grid: { display: false }, ticks: { color: '#ddd', font: { size: 10 } } }
            },
            plugins: { legend: { display: false },
                tooltip: { callbacks: { afterLabel: ctx => {
                    const total = steps[0].val;
                    return total > 0 ? `${((steps[ctx.dataIndex].val / total) * 100).toFixed(1)}% del total` : '';
                }}}
            }
        }
    });

    // Add hint
    const hint = el('funnel-hint');
    if (hint) hint.textContent = 'Click en una barra para ver usuarios de ese paso';
}

async function showFunnelModal(key) {
    let query, title;
    if (key === 'registered') {
        title = 'Todos los Registrados';
        query = sb().from('users').select('nickname, email, plan, role, onboarding_completed, created_at').order('created_at', { ascending: false }).limit(50);
    } else if (key === 'onboarded') {
        title = 'Completaron Onboarding';
        query = sb().from('users').select('nickname, email, plan, role, created_at').eq('onboarding_completed', true).order('created_at', { ascending: false }).limit(50);
    } else if (key === 'uploaded') {
        title = 'Subieron al menos 1 Producto';
        const { data: pd } = await sb().from('products').select('producer_id, users!products_producer_id_fkey(nickname, email, plan)').limit(200);
        const seen = new Set();
        const users = [];
        pd?.forEach(p => { if (p.producer_id && !seen.has(p.producer_id)) { seen.add(p.producer_id); users.push(p.users); } });
        openModal(title, modalTable(users, ['nickname', 'email', 'plan']));
        return;
    } else if (key === 'youtube') {
        title = 'Usaron YouTube Import';
        const { data: profs } = await sb().from('profiles').select('user_id').eq('youtube_import_done', true);
        const uids = profs?.map(p => p.user_id) || [];
        if (!uids.length) { openModal(title, '<div style="color:#555;">Ningún usuario ha usado YouTube import.</div>'); return; }
        const { data: users } = await sb().from('users').select('nickname, email, plan, role').in('id', uids);
        openModal(title, modalTable(users, ['nickname', 'email', 'plan', 'role']));
        return;
    } else {
        title = 'Crearon Perfil';
        const { data: profs } = await sb().from('profiles').select('user_id').limit(200);
        const uids = profs?.map(p => p.user_id) || [];
        const { data: users } = await sb().from('users').select('nickname, email, plan, role').in('id', uids.slice(0, 50));
        openModal(title, modalTable(users || [], ['nickname', 'email', 'plan', 'role']));
        return;
    }
    const { data } = await query;
    openModal(title, modalTable(data || [], ['nickname', 'email', 'plan', 'role', 'created_at']));
}

function modalTable(rows, cols) {
    if (!rows?.length) return '<div style="color:#555;">Sin datos.</div>';
    const labels = { nickname: 'Usuario', email: 'Email', plan: 'Plan', role: 'Rol', created_at: 'Fecha', onboarding_completed: 'Onboarding', reward_balance: 'Balance' };
    let txt = rows.map(r => cols.map(c => `- ${labels[c] || c}: ${r[c] ?? '—'}`).join('\n  ')).join('\n----------------------------------------\n');
    window._lastExportData = `OFFSZN Report — ${new Date().toLocaleString()}\n${'='.repeat(50)}\n\n${txt}\n----------------------------------------\n`;
    return `<div style="max-height:400px;overflow-y:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:0.7rem;">
        <thead><tr style="color:#555;border-bottom:1px solid rgba(255,255,255,0.1);text-align:left;">
            ${cols.map(c => `<th style="padding:5px 6px;">${labels[c] || c}</th>`).join('')}
        </tr></thead>
        <tbody>${rows.map(r => `<tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
            ${cols.map(c => {
                let v = r[c] ?? '—';
                if (c === 'created_at') v = fmtShort(v);
                if (c === 'plan') v = `<span class="tag tag-${v === 'pro' ? 'safe' : v === 'starter' ? 'warning' : 'critical'}">${(v || 'free').toUpperCase()}</span>`;
                if (c === 'nickname') v = `<span style="color:#fff;">@${v}</span>`;
                return `<td style="padding:4px 6px;color:#aaa;">${v}</td>`;
            }).join('')}
        </tr>`).join('')}</tbody></table></div>
        <button onclick="downloadTxt('offszn_report.txt', window._lastExportData)" style="margin-top:8px;background:#111;border:1px solid rgba(255,255,255,0.1);color:#888;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:0.6rem;">📄 Exportar .txt</button>`;
}

// ═══ 3. TIMELINE ════════════════════════════════════
async function renderTimeline() {
    const days = getTimeframeDays();
    const actualDays = Math.min(days, 60);
    const labels = [], pvD = [], regD = [];
    const queries = [];
    for (let i = actualDays - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        labels.push(actualDays <= 7 ? d.toLocaleDateString('es', { weekday: 'short', day: 'numeric' }) : d.toISOString().slice(5, 10));
        const s = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
        const e = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).toISOString();
        queries.push(Promise.all([
            sb().from('page_views').select('*', { count: 'exact', head: true }).gte('viewed_at', s).lte('viewed_at', e),
            sb().from('users').select('*', { count: 'exact', head: true }).gte('created_at', s).lte('created_at', e),
        ]));
    }
    const res = await Promise.all(queries);
    res.forEach(([pv, r]) => { pvD.push(pv.count || 0); regD.push(r.count || 0); });
    const ctx = el('activityChart')?.getContext('2d');
    if (!ctx) return;
    if (activityChart) activityChart.destroy();
    activityChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [
            { label: 'Page Views', data: pvD, borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.03)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 2 },
            { label: 'Registros', data: regD, borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,0.03)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 2 },
        ]},
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { x: { grid: { display: false }, ticks: { color: '#444', font: { size: 8 }, maxTicksLimit: 15 } }, y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#555' } } },
            plugins: { legend: { position: 'top', labels: { color: '#666', boxWidth: 8, font: { size: 9 } } } }
        }
    });
}

// ═══ 4. TOP PRODUCTS ════════════════════════════════
async function renderTopProducts() {
    const c = el('top-products-container'); if (!c) return;
    const { data } = await sb().from('products')
        .select('id, name, product_type, is_free, downloads_count, views_count, plays_count, likes_count, youtube_id, users!products_producer_id_fkey(nickname)')
        .order('downloads_count', { ascending: false, nullsFirst: false }).limit(12);
    if (!data?.length) { c.innerHTML = '<div style="color:#555;">Sin datos.</div>'; return; }
    c.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:0.68rem;">
        <thead><tr style="color:#555;text-align:left;border-bottom:1px solid rgba(255,255,255,0.08);">
            <th style="padding:4px 3px;">Producto</th><th style="padding:4px 3px;">Productor</th><th style="padding:4px 3px;">Tipo</th>
            <th style="padding:4px;text-align:center;">⬇</th><th style="padding:4px;text-align:center;">👁</th>
            <th style="padding:4px;text-align:center;">▶</th><th style="padding:4px;text-align:center;">❤</th>
        </tr></thead><tbody>${data.map(p => `<tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
            <td style="padding:5px 3px;color:#ddd;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${(p.name||'').replace(/"/g,'')}">${trunc(p.name, 22)} ${p.is_free ? '<span style="color:#00ff88;font-size:0.5rem;">FREE</span>' : ''}</td>
            <td style="padding:5px 3px;color:#777;font-size:0.62rem;">@${p.users?.nickname || '?'}</td>
            <td style="padding:5px 3px;">${tBadge(p.product_type)}</td>
            <td style="padding:5px;text-align:center;color:#fff;font-weight:700;">${p.downloads_count||0}</td>
            <td style="padding:5px;text-align:center;color:#666;">${p.views_count||0}</td>
            <td style="padding:5px;text-align:center;color:#666;">${p.plays_count||0}</td>
            <td style="padding:5px;text-align:center;color:#666;">${p.likes_count||0}</td>
        </tr>`).join('')}</tbody></table>`;
}

// ═══ 5. CATEGORIES ══════════════════════════════════
async function renderCategories() {
    const { data } = await sb().from('products').select('product_type');
    const cats = {}; data?.forEach(p => { const t = p.product_type || 'otro'; cats[t] = (cats[t]||0)+1; });
    const ctx = el('categoryChart')?.getContext('2d'); if (!ctx) return;
    if (categoryChart) categoryChart.destroy();
    const labels = Object.keys(cats), values = Object.values(cats);
    const cols = { beat:'#fff', preset:'#b19cd9', drumkit:'#f0a', loopkit:'#0cf', otro:'#555' };
    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: labels.map(l=>`${l} (${cats[l]})`), datasets:[{ data:values, backgroundColor:labels.map(l=>(cols[l]||'#555')+'33'), borderColor:labels.map(l=>cols[l]||'#555'), borderWidth:2 }] },
        options:{ responsive:true, plugins:{ legend:{ position:'bottom', labels:{ color:'#888', font:{size:10}, boxWidth:10 } } } }
    });
}

// ═══ 6. FREE DOWNLOADS + modal ══════════════════════
async function renderFreeDownloads() {
    const c = el('free-downloads-container'); if (!c) return;
    const { data } = await sb().from('free_downloads')
        .select('email, downloaded_at, product_id, products(name, product_type)')
        .order('downloaded_at', { ascending: false }).limit(20);
    if (!data?.length) { c.innerHTML = '<div style="color:#555;">Sin datos.</div>'; return; }

    const emails = [...new Set(data.map(d=>d.email).filter(Boolean))];
    const { data: regU } = await sb().from('users').select('email, nickname').in('email', emails);
    const regMap = {}; regU?.forEach(u => { regMap[u.email] = u.nickname; });

    // Store for modal
    window._freeDownloadsData = data.map(d => ({
        email: d.email, product: d.products?.name || `#${d.product_id}`,
        type: d.products?.product_type, date: d.downloaded_at,
        registered: !!regMap[d.email], nickname: regMap[d.email] || null
    }));

    c.innerHTML = data.slice(0, 8).map(d => {
        const isReg = !!regMap[d.email];
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.68rem;">
            <div style="flex:1;min-width:0;">
                <div style="color:#ccc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${trunc(d.products?.name,22)}</div>
                <div style="display:flex;align-items:center;gap:4px;margin-top:2px;">
                    <span style="color:#555;font-size:0.58rem;">📧 ${d.email}</span>
                    ${isReg ? `<span style="color:#00ff88;font-size:0.5rem;font-weight:700;">✓ @${regMap[d.email]}</span>` : '<span style="color:#ff3e3e;font-size:0.5rem;font-weight:700;">✗ NO REGISTRADO</span>'}
                </div>
            </div>
            <span style="color:#444;font-size:0.58rem;flex-shrink:0;">${fmtD(d.downloaded_at)}</span>
        </div>`;
    }).join('') + `<div style="text-align:center;margin-top:6px;">
        <button onclick="showFreeDownloadsModal()" style="background:#111;border:1px solid rgba(255,255,255,0.1);color:#888;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:0.6rem;">🔍 Ver todos (${data.length}+) con detalles</button>
    </div>`;
}

window.showFreeDownloadsModal = function() {
    const data = window._freeDownloadsData || [];
    const regCount = data.filter(d=>d.registered).length;
    const noRegCount = data.filter(d=>!d.registered).length;

    let txt = `OFFSZN — Descargas Gratis (${data.length})\nRegistrados: ${regCount} | No registrados: ${noRegCount}\n${'='.repeat(50)}\n\n`;
    txt += data.map(d => `- Email: ${d.email}\n  Producto: ${d.product}\n  Tipo: ${d.type}\n  Fecha: ${fmtShort(d.date)}\n  Estado: ${d.registered ? '✓ @'+d.nickname : '✗ NO REG'}`).join('\n----------------------------------------\n');
    txt += '\n----------------------------------------\n';
    window._lastExportData = txt;

    openModal(`Descargas Gratis — ${regCount} registrados, ${noRegCount} sin registrar`, `
        <div style="margin-bottom:8px;font-size:0.7rem;color:#888;">
            <span style="color:#00ff88;">✓ ${regCount} se registraron</span> · <span style="color:#ff3e3e;">✗ ${noRegCount} no se registraron</span>
        </div>
        <div style="max-height:400px;overflow-y:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:0.68rem;">
        <thead><tr style="color:#555;border-bottom:1px solid rgba(255,255,255,0.1);text-align:left;">
            <th style="padding:4px;">Email</th><th style="padding:4px;">Producto</th><th style="padding:4px;">Tipo</th><th style="padding:4px;">Fecha</th><th style="padding:4px;">Estado</th>
        </tr></thead>
        <tbody>${data.map(d => `<tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
            <td style="padding:4px;color:#ccc;">${d.email}</td>
            <td style="padding:4px;color:#888;">${trunc(d.product, 20)}</td>
            <td style="padding:4px;">${tBadge(d.type)}</td>
            <td style="padding:4px;color:#555;">${fmtShort(d.date)}</td>
            <td style="padding:4px;">${d.registered ? `<span style="color:#00ff88;">✓ @${d.nickname}</span>` : '<span style="color:#ff3e3e;">✗ NO REG</span>'}</td>
        </tr>`).join('')}</tbody></table></div>
        <button onclick="downloadTxt('offszn_descargas_gratis.txt', window._lastExportData)" style="margin-top:8px;background:#111;border:1px solid rgba(255,255,255,0.1);color:#888;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:0.6rem;">📄 Exportar .txt</button>
    `);
};

// ═══ 7. RECENT DOWNLOADS ════════════════════════════
async function renderRecentDownloads() {
    const c = el('recent-downloads-container'); if (!c) return;
    const { data } = await sb().from('download_logs')
        .select('product_id, user_id, created_at, products(name, product_type, is_free)')
        .order('created_at', { ascending: false }).limit(12);
    if (!data?.length) { c.innerHTML = '<div style="color:#555;">Sin datos.</div>'; return; }
    const uids = data.filter(d=>d.user_id).map(d=>d.user_id);
    let uMap = {};
    if (uids.length) { const { data: us } = await sb().from('users').select('id, email, nickname').in('id', uids); us?.forEach(u=>{uMap[u.id]=u;}); }
    c.innerHTML = data.map(d => {
        const u = d.user_id ? uMap[d.user_id] : null;
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.68rem;">
            <div style="flex:1;min-width:0;">
                <div style="color:#ccc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${trunc(d.products?.name,25)}</div>
                <div style="color:#555;font-size:0.58rem;margin-top:1px;">${u ? `👤 @${u.nickname||'?'} · ${u.email||''}` : '👻 Guest'}</div>
            </div>
            <div style="flex-shrink:0;display:flex;gap:4px;align-items:center;">
                ${tBadge(d.products?.product_type)}<span style="color:#444;font-size:0.58rem;">${fmtD(d.created_at)}</span>
            </div></div>`;
    }).join('');
}

// ═══ 8. TOP PAGES ═══════════════════════════════════
async function renderTopPages(tf) {
    const c = el('top-pages-container'); if (!c) return;
    const { data } = await sb().from('page_views').select('path').gte('viewed_at', tf).limit(2000);
    if (!data?.length) { c.innerHTML = '<div style="color:#555;">Sin datos.</div>'; return; }
    const pc = {}; data.forEach(d => { const p = d.path||'?'; pc[p]=(pc[p]||0)+1; });
    const sorted = Object.entries(pc).sort((a,b)=>b[1]-a[1]).slice(0,12);
    const pids = sorted.map(([p])=>{ const m=p.match(/\/producto\/(\d+)/); return m?parseInt(m[1]):null; }).filter(Boolean);
    if (pids.length) { const{data:ps}=await sb().from('products').select('id,name').in('id',pids); ps?.forEach(p=>{productNameCache[p.id]={name:p.name};}); }
    const mx = sorted[0]?.[1]||1;
    c.innerHTML = sorted.map(([path,count])=>{
        let dp=path; const m=path.match(/\/producto\/(\d+)/);
        if(m&&productNameCache[m[1]]) dp=`🎵 ${trunc(productNameCache[m[1]].name,20)}`;
        const pct=((count/mx)*100).toFixed(0);
        return `<div style="margin-bottom:5px;"><div style="display:flex;justify-content:space-between;font-size:0.68rem;margin-bottom:2px;">
            <span style="color:#ccc;max-width:75%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${path}">${dp}</span>
            <span style="color:#888;font-weight:600;">${count}</span>
        </div><div style="background:rgba(255,255,255,0.04);border-radius:3px;height:3px;">
            <div style="background:rgba(255,255,255,0.2);width:${pct}%;height:100%;border-radius:3px;"></div></div></div>`;
    }).join('');
}

// ═══ 9. SUBS — ALL with full detail ═════════════════
async function renderPlansAndSubs() {
    // Plan chart
    const { data: ud } = await sb().from('users').select('plan');
    const plans = { free:0, starter:0, pro:0 };
    ud?.forEach(u => { const p=(u.plan||'free').toLowerCase(); if(plans[p]!==undefined) plans[p]++; else plans.free++; });
    const ctx = el('planDistributionChart')?.getContext('2d');
    if (ctx) {
        if (planChart) planChart.destroy();
        planChart = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: [`Free (${plans.free})`,`Starter (${plans.starter})`,`PRO (${plans.pro})`],
                datasets:[{ data:[plans.free,plans.starter,plans.pro], backgroundColor:['#33333388','#88888888','#ffffff88'], borderColor:['#333','#888','#fff'], borderWidth:2 }] },
            options:{ responsive:true, plugins:{ legend:{position:'bottom',labels:{color:'#888',font:{size:10}}} } }
        });
    }

    // ALL subscriptions
    const sc = el('subs-detail-container'); if (!sc) return;
    const { data: subs } = await sb().from('subscriptions')
        .select('user_id, status, plan_id, provider, current_period_end, created_at')
        .order('created_at', { ascending: false });
    if (!subs?.length) { sc.innerHTML = '<div style="color:#555;">Sin suscripciones.</div>'; return; }

    const uids = [...new Set(subs.map(s=>s.user_id))];
    // Batch user lookup (max Supabase .in is ~300)
    let uMap = {};
    for (let i = 0; i < uids.length; i += 50) {
        const batch = uids.slice(i, i + 50);
        const { data: users } = await sb().from('users').select('id, nickname, email, plan').in('id', batch);
        users?.forEach(u => { uMap[u.id] = u; });
    }

    // Store for export
    window._subsExport = subs.map(s => {
        const u = uMap[s.user_id] || {};
        const daysLeft = s.current_period_end ? Math.ceil((new Date(s.current_period_end) - new Date()) / 86400000) : '?';
        return { nickname: u.nickname || '?', email: u.email || '?', plan_id: s.plan_id, provider: s.provider, status: s.status, daysLeft, bought: s.created_at, expires: s.current_period_end };
    });

    // Group: show summary + "ver todos" button
    const realPaid = subs.filter(s => s.provider !== 'manual');
    const manual = subs.filter(s => s.provider === 'manual');

    let html = `<div style="font-size:0.7rem;color:#888;margin-bottom:8px;">
        Total: <strong style="color:#fff;">${subs.length}</strong> suscripciones ·
        PayPal: <strong style="color:#00ff88;">${realPaid.length}</strong> ·
        Manual: <strong style="color:#ffa500;">${manual.length}</strong>
    </div>`;

    // Show paypal subs first (these are real paying users)
    const showFirst = [...realPaid, ...manual.slice(0, 5)];
    html += showFirst.map(s => {
        const u = uMap[s.user_id] || {};
        const daysLeft = s.current_period_end ? Math.ceil((new Date(s.current_period_end) - new Date()) / 86400000) : '?';
        const dC = daysLeft === '?' ? '#555' : daysLeft <= 0 ? '#ff3e3e' : daysLeft <= 7 ? '#ffa500' : '#00ff88';
        const expired = typeof daysLeft === 'number' && daysLeft <= 0;
        return `<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.68rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <span style="color:#fff;font-weight:600;">@${u.nickname||'?'}</span>
                    <span style="color:#444;margin-left:5px;font-size:0.58rem;">${u.email||''}</span>
                </div>
                <div style="display:flex;gap:5px;align-items:center;">
                    <span style="color:${dC};font-weight:700;font-size:0.6rem;">${expired ? 'VENCIDO' : daysLeft + 'd'}</span>
                    ${tag(s.plan_id, s.provider === 'paypal' ? 'safe' : 'warning')}
                </div>
            </div>
            <div style="color:#444;font-size:0.58rem;margin-top:2px;">
                Compró: ${fmtShort(s.created_at)} · Vía: <strong style="color:#666;">${s.provider}</strong>
                ${s.current_period_end ? ' · Vence: ' + fmtShort(s.current_period_end) : ''}
            </div>
        </div>`;
    }).join('');

    html += `<div style="text-align:center;margin-top:6px;">
        <button onclick="showAllSubsModal()" style="background:#111;border:1px solid rgba(255,255,255,0.1);color:#888;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:0.6rem;">🔍 Ver las ${subs.length} suscripciones</button>
    </div>`;
    sc.innerHTML = html;
}

window.showAllSubsModal = function() {
    const data = window._subsExport || [];
    let txt = `OFFSZN — Suscripciones (${data.length})\n${'='.repeat(50)}\n\n`;
    txt += data.map(d => `- Usuario: @${d.nickname}\n  Email: ${d.email}\n  Plan: ${d.plan_id}\n  Vía: ${d.provider}\n  Estado: ${d.status}\n  Días restantes: ${d.daysLeft}d\n  Compró: ${fmtShort(d.bought)}`).join('\n----------------------------------------\n');
    txt += '\n----------------------------------------\n';
    window._lastExportData = txt;
    openModal(`Todas las Suscripciones (${data.length})`, `
        <div style="max-height:400px;overflow-y:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:0.65rem;">
        <thead><tr style="color:#555;border-bottom:1px solid rgba(255,255,255,0.1);text-align:left;">
            <th style="padding:4px;">Usuario</th><th style="padding:4px;">Email</th><th style="padding:4px;">Plan</th><th style="padding:4px;">Vía</th><th style="padding:4px;">Días</th><th style="padding:4px;">Compró</th>
        </tr></thead>
        <tbody>${data.map(d => {
            const dC = d.daysLeft <= 0 ? '#ff3e3e' : d.daysLeft <= 7 ? '#ffa500' : '#00ff88';
            return `<tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                <td style="padding:3px 4px;color:#ddd;">@${d.nickname}</td>
                <td style="padding:3px 4px;color:#777;font-size:0.6rem;">${d.email}</td>
                <td style="padding:3px 4px;">${tag(d.plan_id, d.provider==='paypal'?'safe':'warning')}</td>
                <td style="padding:3px 4px;color:#888;">${d.provider}</td>
                <td style="padding:3px 4px;color:${dC};font-weight:700;">${d.daysLeft <= 0 ? 'VENCIDO' : d.daysLeft+'d'}</td>
                <td style="padding:3px 4px;color:#555;">${fmtShort(d.bought)}</td>
            </tr>`}).join('')}</tbody></table></div>
        <button onclick="downloadTxt('offszn_suscripciones.txt', window._lastExportData)" style="margin-top:8px;background:#111;border:1px solid rgba(255,255,255,0.1);color:#888;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:0.6rem;">📄 Exportar .txt</button>
    `);
};

// ═══ 10. ROLES ══════════════════════════════════════
async function renderRoles() {
    const { data } = await sb().from('users').select('role');
    const roles = {}; data?.forEach(u => { const r = u.role || 'Sin rol'; roles[r] = (roles[r]||0)+1; });
    const ctx = el('roleChart')?.getContext('2d'); if (!ctx) return;
    if (roleChart) roleChart.destroy();
    const labels = Object.keys(roles), values = Object.values(roles);
    const pal = ['#fff','#00ff88','#3e8eff','#f0a','#ffa500','#b19cd9','#0cf','#555'];
    roleChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: labels.map(l=>trunc(l,18)), datasets:[{ data:values, backgroundColor:labels.map((_,i)=>(pal[i%pal.length])+'22'), borderColor:labels.map((_,i)=>pal[i%pal.length]), borderWidth:1, borderRadius:4 }] },
        options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
            scales:{ x:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#555'}}, y:{grid:{display:false},ticks:{color:'#bbb',font:{size:9}}} } }
    });
}

// ═══ 11. YOUTUBE with user detail modals ════════════
async function renderYouTube() {
    const c = el('youtube-stats-container'); if (!c) return;
    const [{ data: yp }, { count: pwyt }] = await Promise.all([
        sb().from('profiles').select('user_id, youtube_import_done, youtube_uploads_this_month'),
        sb().from('products').select('*', { count: 'exact', head: true }).not('youtube_id', 'is', null),
    ]);
    const imp = yp?.filter(p=>p.youtube_import_done).length||0;
    const tot = yp?.length||0;
    const ytM = yp?.reduce((s,p)=>s+(p.youtube_uploads_this_month||0),0)||0;
    const pct = tot>0?((imp/tot)*100).toFixed(1):0;

    // Store user_ids for modal
    window._ytImporterIds = yp?.filter(p=>p.youtube_import_done).map(p=>p.user_id)||[];

    c.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
            <div onclick="showYTModal('importers')" style="background:rgba(255,255,255,0.03);padding:10px;border-radius:6px;text-align:center;cursor:pointer;border:1px solid transparent;transition:border 0.2s;" onmouseover="this.style.borderColor='rgba(255,255,255,0.15)'" onmouseout="this.style.borderColor='transparent'">
                <div style="font-size:1.3rem;font-weight:700;color:#3e8eff;">${imp}</div>
                <div style="font-size:0.58rem;color:#555;">Importaron de YT 🔍</div>
            </div>
            <div onclick="showYTModal('beats')" style="background:rgba(255,255,255,0.03);padding:10px;border-radius:6px;text-align:center;cursor:pointer;border:1px solid transparent;transition:border 0.2s;" onmouseover="this.style.borderColor='rgba(255,255,255,0.15)'" onmouseout="this.style.borderColor='transparent'">
                <div style="font-size:1.3rem;font-weight:700;">${pwyt||0}</div>
                <div style="font-size:0.58rem;color:#555;">Beats con YouTube 🔍</div>
            </div>
            <div style="background:rgba(255,255,255,0.03);padding:10px;border-radius:6px;text-align:center;">
                <div style="font-size:1.3rem;font-weight:700;color:#00ff88;">${ytM}</div>
                <div style="font-size:0.58rem;color:#555;">Subidos a YT este mes</div>
            </div>
            <div style="background:rgba(255,255,255,0.03);padding:10px;border-radius:6px;text-align:center;">
                <div style="font-size:1.3rem;font-weight:700;color:#ffa500;">${pct}%</div>
                <div style="font-size:0.58rem;color:#555;">% usuarios que lo usaron</div>
            </div>
        </div>
        <div style="padding:8px;background:rgba(62,142,255,0.05);border:1px solid rgba(62,142,255,0.12);border-radius:5px;font-size:0.62rem;color:#777;line-height:1.5;">
            <strong style="color:#3e8eff;">Cómo mejorar:</strong><br>
            1. Popup al subir beat: "¿Publicar en YouTube automáticamente?"<br>
            2. Mostrar cuántas visitas generó YT en el perfil del productor<br>
            3. +20 créditos por primer beat publicado en YouTube<br>
            4. Video tutorial de 30 seg como tooltip en el upload<br>
            5. Caso de éxito: "X productor consiguió Y views con automatización"
        </div>`;
}

window.showYTModal = async function(type) {
    if (type === 'importers') {
        const ids = window._ytImporterIds || [];
        if (!ids.length) { openModal('Usuarios que importaron de YouTube', '<div style="color:#555;">Nadie aún.</div>'); return; }
        const { data } = await sb().from('users').select('nickname, email, plan, role').in('id', ids);
        openModal(`Usuarios que importaron de YouTube (${ids.length})`, modalTable(data || [], ['nickname', 'email', 'plan', 'role']));
    } else {
        const { data } = await sb().from('products')
            .select('name, product_type, youtube_id, users!products_producer_id_fkey(nickname, email)')
            .not('youtube_id', 'is', null).limit(30);
        const rows = data?.map(p => ({ nickname: p.users?.nickname, email: p.users?.email, name: p.name, type: p.product_type })) || [];
        window._lastExportData = `Beats con YouTube\n${'='.repeat(50)}\n\n` + rows.map(r => `- Productor: @${r.nickname}\n  Nombre: ${r.name}\n  Tipo: ${r.type}`).join('\n----------------------------------------\n') + '\n----------------------------------------\n';
        openModal(`Beats con YouTube (${rows.length})`, `
            <div style="max-height:400px;overflow-y:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:0.68rem;">
            <thead><tr style="color:#555;border-bottom:1px solid rgba(255,255,255,0.1);text-align:left;">
                <th style="padding:4px;">Productor</th><th style="padding:4px;">Beat</th><th style="padding:4px;">Tipo</th>
            </tr></thead>
            <tbody>${rows.map(r=>`<tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                <td style="padding:3px 4px;color:#ddd;">@${r.nickname||'?'}</td>
                <td style="padding:3px 4px;color:#888;">${trunc(r.name, 25)}</td>
                <td style="padding:3px 4px;">${tBadge(r.type)}</td>
            </tr>`).join('')}</tbody></table></div>
            <button onclick="downloadTxt('offszn_beats_youtube.txt',window._lastExportData)" style="margin-top:8px;background:#111;border:1px solid rgba(255,255,255,0.1);color:#888;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:0.6rem;">📄 Exportar .txt</button>
        `);
    }
};

// ═══ 12. CREDITS with modal ═════════════════════════
async function renderCredits() {
    const c = el('credits-container'); if (!c) return;
    const { data } = await sb().from('users').select('id, nickname, email, plan, reward_balance');
    const wC = data?.filter(u=>(u.reward_balance||0)>0)||[];
    const noC = (data?.length||0)-wC.length;
    const totalC = data?.reduce((s,u)=>s+(parseFloat(u.reward_balance)||0),0)||0;
    window._creditUsers = data;
    c.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div onclick="showCreditModal('con')" style="background:rgba(255,255,255,0.03);padding:10px;border-radius:6px;text-align:center;cursor:pointer;border:1px solid transparent;" onmouseover="this.style.borderColor='rgba(255,255,255,0.15)'" onmouseout="this.style.borderColor='transparent'">
                <div style="font-size:1.3rem;font-weight:700;color:#00ff88;">${wC.length}</div>
                <div style="font-size:0.58rem;color:#555;">Con créditos 🔍</div>
            </div>
            <div onclick="showCreditModal('sin')" style="background:rgba(255,255,255,0.03);padding:10px;border-radius:6px;text-align:center;cursor:pointer;border:1px solid transparent;" onmouseover="this.style.borderColor='rgba(255,255,255,0.15)'" onmouseout="this.style.borderColor='transparent'">
                <div style="font-size:1.3rem;font-weight:700;color:#ff3e3e;">${noC}</div>
                <div style="font-size:0.58rem;color:#555;">Sin créditos 🔍</div>
            </div>
            <div style="background:rgba(255,255,255,0.03);padding:10px;border-radius:6px;text-align:center;">
                <div style="font-size:1.3rem;font-weight:700;">${totalC.toFixed(0)}</div>
                <div style="font-size:0.58rem;color:#555;">En circulación total</div>
            </div>
            <div style="background:rgba(255,255,255,0.03);padding:10px;border-radius:6px;text-align:center;">
                <div style="font-size:1.3rem;font-weight:700;color:#ffa500;">${wC.length>0?(totalC/wC.length).toFixed(0):0}</div>
                <div style="font-size:0.58rem;color:#555;">Promedio por usuario</div>
            </div>
        </div>
        <div style="font-size:0.55rem;color:#444;text-align:center;margin-top:5px;">Click en los cuadros para ver lista de usuarios</div>`;
}

window.showCreditModal = function(type) {
    const users = window._creditUsers || [];
    const filtered = type === 'con'
        ? users.filter(u=>(u.reward_balance||0)>0).sort((a,b)=>(b.reward_balance||0)-(a.reward_balance||0))
        : users.filter(u=>!u.reward_balance||u.reward_balance==0);

    const title = type === 'con' ? `Usuarios con Créditos (${filtered.length})` : `Usuarios sin Créditos (${filtered.length})`;
    let txt = `${title}\n${'='.repeat(50)}\n\n`;
    txt += filtered.map(u=>`- Usuario: @${u.nickname||'?'}\n  Email: ${u.email||'?'}\n  Plan: ${u.plan||'free'}\n  Balance: ${u.reward_balance||0}`).join('\n----------------------------------------\n');
    txt += '\n----------------------------------------\n';
    window._lastExportData = txt;

    openModal(title, `<div style="max-height:400px;overflow-y:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:0.68rem;">
        <thead><tr style="color:#555;border-bottom:1px solid rgba(255,255,255,0.1);text-align:left;">
            <th style="padding:4px;">Usuario</th><th style="padding:4px;">Email</th><th style="padding:4px;">Plan</th><th style="padding:4px;text-align:right;">Balance</th>
        </tr></thead>
        <tbody>${filtered.slice(0,60).map(u=>`<tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
            <td style="padding:3px 4px;color:#ddd;">@${u.nickname||'?'}</td>
            <td style="padding:3px 4px;color:#777;font-size:0.6rem;">${u.email||'—'}</td>
            <td style="padding:3px 4px;">${tag((u.plan||'free').toUpperCase(),u.plan==='pro'?'safe':u.plan==='starter'?'warning':'critical')}</td>
            <td style="padding:3px 4px;text-align:right;color:${(u.reward_balance||0)>0?'#00ff88':'#555'};font-weight:600;">${u.reward_balance||0}</td>
        </tr>`).join('')}</tbody></table></div>
        <button onclick="downloadTxt('offszn_creditos.txt',window._lastExportData)" style="margin-top:8px;background:#111;border:1px solid rgba(255,255,255,0.1);color:#888;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:0.6rem;">📄 Exportar .txt</button>
    `);
};

// ═══ 13. LISTENING ══════════════════════════════════
async function renderListening() {
    const c = el('listening-stats-container'); if (!c) return;
    const { data } = await sb().from('listening_history').select('product_id, products(name)').limit(500);
    if (!data?.length) { c.innerHTML = '<div style="color:#555;">Sin datos.</div>'; return; }
    const pc = {}; data.forEach(d=>{ const n=d.products?.name||`#${d.product_id}`; pc[n]=(pc[n]||0)+1; });
    const sorted = Object.entries(pc).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const mx = sorted[0]?.[1]||1;
    c.innerHTML = sorted.map(([n,cnt])=>{
        const pct=((cnt/mx)*100).toFixed(0);
        return `<div style="margin-bottom:6px;"><div style="display:flex;justify-content:space-between;font-size:0.68rem;margin-bottom:2px;">
            <span style="color:#ccc;">${trunc(n,23)}</span><span style="color:#666;font-weight:600;">▶ ${cnt}</span>
        </div><div style="background:rgba(255,255,255,0.04);border-radius:3px;height:3px;">
            <div style="background:rgba(0,255,136,0.25);width:${pct}%;height:100%;border-radius:3px;"></div></div></div>`;
    }).join('');
}

// ═══ 14. SOCIAL ═════════════════════════════════════
async function renderSocial(tf) {
    const c = el('social-stats-container'); if (!c) return;
    const { data: follows } = await sb().from('followers').select('user_id').limit(1000);
    if (!follows?.length) { c.innerHTML = '<div style="color:#555;">Sin datos.</div>'; return; }
    const fc = {}; follows.forEach(f=>{fc[f.user_id]=(fc[f.user_id]||0)+1;});
    const topF = Object.entries(fc).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const uids = topF.map(([id])=>id);
    const { data: users } = await sb().from('users').select('id, nickname').in('id', uids);
    const uMap = {}; users?.forEach(u=>{uMap[u.id]=u;});
    const { data: recent } = await sb().from('followers').select('user_id, follower_id, created_at').order('created_at',{ascending:false}).limit(5);
    const allIds = [...new Set([...(recent?.map(r=>r.user_id)||[]),...(recent?.map(r=>r.follower_id)||[])])];
    const { data: allU } = await sb().from('users').select('id, nickname').in('id', allIds);
    const allMap = {}; allU?.forEach(u=>{allMap[u.id]=u;});

    c.innerHTML = `
        <div style="font-size:0.65rem;color:#666;margin-bottom:6px;font-weight:600;">Perfiles más seguidos</div>
        ${topF.map(([id,cnt])=>`<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:0.68rem;border-bottom:1px solid rgba(255,255,255,0.04);">
            <span style="color:#ccc;">@${uMap[id]?.nickname||'?'}</span>
            <span style="color:#fff;font-weight:700;">${cnt} seguidores</span>
        </div>`).join('')}
        <div style="font-size:0.65rem;color:#666;margin:8px 0 4px;font-weight:600;">Últimos follows</div>
        ${(recent||[]).map(r=>`<div style="font-size:0.62rem;color:#555;padding:2px 0;">
            <span style="color:#ccc;">@${allMap[r.follower_id]?.nickname||'?'}</span> → <span style="color:#fff;">@${allMap[r.user_id]?.nickname||'?'}</span>
            <span style="color:#333;margin-left:4px;">${fmtD(r.created_at)}</span>
        </div>`).join('')}`;
}

// ═══ 15. FRICTION with detail modal ═════════════════
async function renderFriction() {
    const c = el('friction-items-container'); if (!c) return;
    let html = '';
    const onbStart = '2026-03-20T00:00:00Z';

    // 1. Onboarding since 20/03
    const { count: regS } = await sb().from('users').select('*',{count:'exact',head:true}).gte('created_at',onbStart);
    const { count: onbS } = await sb().from('users').select('*',{count:'exact',head:true}).gte('created_at',onbStart).eq('onboarding_completed',true);
    const notOnb = (regS||0)-(onbS||0);
    const dropPct = regS>0?((notOnb/regS)*100).toFixed(1):0;

    const { data: stuck } = await sb().from('users').select('nickname, email, role, created_at')
        .gte('created_at',onbStart).eq('onboarding_completed',false).order('created_at',{ascending:false}).limit(10);

    window._stuckUsers = stuck;

    html += `<div class="friction-item"><div class="friction-info">
        <h4>Onboarding (desde 20/Mar): ${notOnb}/${regS} no completaron (${dropPct}%)</h4>
        <p>Estos usuarios se registraron pero no terminaron de elegir su rol, intereses o géneros. Dejaron el flujo de onboarding incompleto.</p>
        <p><strong>Soluciones:</strong> 1) Reducir pasos de 4 a 2. 2) Hacer pasos opcionales. 3) Auto-skip si no interactúa en 10s.</p>
        <button onclick="showStuckModal()" style="background:#111;border:1px solid rgba(255,255,255,0.1);color:#888;padding:3px 10px;border-radius:4px;cursor:pointer;font-size:0.58rem;margin-top:4px;">🔍 Ver quiénes son (${stuck?.length || 0})</button>
    </div>${tag(dropPct > 15 ? 'CRÍTICO' : 'OK', dropPct > 15 ? 'critical' : 'safe')}</div>`;

    // 2. Upload friction
    const { count: totalU } = await sb().from('users').select('*',{count:'exact',head:true});
    const { data: pd } = await sb().from('products').select('producer_id');
    const prods = new Set(pd?.map(p=>p.producer_id)).size;
    const noUp = totalU-prods;
    const noUpPct = totalU>0?((noUp/totalU)*100).toFixed(1):0;
    if (noUpPct > 50) {
        html += `<div class="friction-item"><div class="friction-info">
            <h4>${noUp} usuarios sin productos (${noUpPct}%)</h4>
            <p>Se registraron pero nunca subieron nada. Pueden ser artistas, fans, o usuarios que perdieron interés.</p>
            <p><strong>Soluciones:</strong> 1) Tutorial "Sube en 2 min". 2) +30 créditos por primer upload. 3) Template pre-llenado.</p>
            <button onclick="showNoUploadModal()" style="background:#111;border:1px solid rgba(255,255,255,0.1);color:#888;padding:3px 10px;border-radius:4px;cursor:pointer;font-size:0.58rem;margin-top:4px;">🔍 Ver quiénes son</button>
        </div>${tag('FUGA', 'warning')}</div>`;
    }

    // 3. Cart
    const { data: cart } = await sb().from('cart_items').select('user_id, product_id, created_at, products(name)').limit(20);
    if (cart?.length) {
        html += `<div class="friction-item"><div class="friction-info">
            <h4>${cart.length} items en carritos sin comprar</h4>
            <p>Productos: ${cart.map(ci=>trunc(ci.products?.name,15)).join(', ')}</p>
            <p><strong>Soluciones:</strong> 1) Email recordatorio. 2) -10% si completan en 24h. 3) Simplificar checkout.</p>
        </div>${tag('CHECKOUT', 'warning')}</div>`;
    }

    // 4. YouTube
    const { data: ytP } = await sb().from('profiles').select('youtube_import_done');
    const ytA = ytP?.filter(p=>p.youtube_import_done).length||0;
    if (ytA < 10) {
        html += `<div class="friction-item"><div class="friction-info">
            <h4>Solo ${ytA} usuarios probaron YouTube</h4>
            <p>La funcionalidad de subir beats automáticamente a YouTube no está siendo descubierta por los usuarios.</p>
            <p><strong>Soluciones:</strong> 1) Popup en upload. 2) Tooltip en dashboard. 3) +20 créditos por primera vez.</p>
        </div>${tag('OPORTUNIDAD', 'warning')}</div>`;
    }

    if (!html) html = '<div style="color:#555;text-align:center;">Sin fricciones.</div>';
    c.innerHTML = html;
}

window.showStuckModal = async function() {
    const data = window._stuckUsers || [];
    let txt = `Usuarios que NO completaron onboarding (desde 20/Mar)\n${'='.repeat(50)}\n`;
    txt += data.map(u=>`@${u.nickname||'?'} | ${u.email||'?'} | Rol: ${u.role||'no eligió'} | Registro: ${fmtShort(u.created_at)}`).join('\n');
    window._lastExportData = txt;
    openModal(`No completaron Onboarding (${data.length})`, modalTable(data, ['nickname', 'email', 'role', 'created_at']));
};

window.showNoUploadModal = async function() {
    const { data: pd } = await sb().from('products').select('producer_id');
    const prodIds = new Set(pd?.map(p=>p.producer_id));
    const { data: allUsers } = await sb().from('users').select('nickname, email, role, plan, created_at').eq('onboarding_completed', true).limit(300);
    const noUpload = allUsers?.filter(u => !prodIds.has(u.id)) || allUsers || [];
    window._lastExportData = `Usuarios sin productos\n${'='.repeat(50)}\n\n` + noUpload.map(u=>`- Usuario: @${u.nickname||'?'}\n  Email: ${u.email}\n  Rol: ${u.role||'?'}\n  Plan: ${u.plan||'free'}`).join('\n----------------------------------------\n') + '\n----------------------------------------\n';
    openModal(`Usuarios sin Productos`, modalTable(noUpload.slice(0,40), ['nickname', 'email', 'role', 'plan', 'created_at']));
};

// ═══ 16. MISSING DATA ═══════════════════════════════
async function renderMissingData() {
    const c = el('missing-data-container'); if (!c) return;
    const { count: ae } = await sb().from('app_events').select('*',{count:'exact',head:true});
    const alerts = [];
    if (ae === 0) alerts.push({ l:'critical', t:'Eventos de navegación (app_events): 0', d:'Clicks en CTAs, uso de formularios, y navegación post-registro no se guardan. El embudo de registro preciso no funciona.' });
    alerts.push({ l:'warning', t:'Modales de "Crear cuenta" para Guests', d:'No sabemos cuántos visitantes sin cuenta ven el popup de crear cuenta y lo cierran.' });
    alerts.push({ l:'warning', t:'Inicio de checkout', d:'Solo vemos carritos, pero no si alguien empezó a pagar y se arrepintió en el proceso.' });
    alerts.push({ l:'warning', t:'Cambios de moneda y periodo en planes', d:'No se sabe cuántos usuarios cambian entre USD/PEN ni entre Mensual/Anual antes de decidir.' });
    alerts.push({ l:'warning', t:'Qué pasa después de descargar', d:'No sabemos si un usuario sigue viendo más productos o cierra la página después de descargar.' });
    c.innerHTML = alerts.map(a=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.68rem;">
        <div style="flex:1;"><div style="color:#ddd;font-weight:600;">${a.t}</div><div style="color:#444;font-size:0.58rem;margin-top:2px;">${a.d}</div></div>
        ${tag('NO TRACKING',a.l)}</div>`).join('');
}

// ─── TIMEFRAME ──────────────────────────────────────
async function updateTimeframe(type, btn) {
    document.querySelectorAll('.tf-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    currentTimeframe = type;
    const labels = { daily:'Hoy', weekly:'Últimos 7 días', monthly:'Últimos 30 días', alltime:'Desde el inicio' };
    el('current-period-text').textContent = `Reporte: ${labels[type]}`;
    await refreshData();
}

window.initDashboard = initDashboard;
window.refreshData = refreshData;
window.updateTimeframe = updateTimeframe;
window.openModal = openModal;
window.closeModal = closeModal;
window.downloadTxt = downloadTxt;
