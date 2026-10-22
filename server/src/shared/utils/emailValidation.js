import dns from 'dns/promises';

const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

// Errores de tipeo comunes: se rechazan sugiriendo el dominio correcto.
const TYPO_DOMAINS = {
    'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gnail.com': 'gmail.com',
    'gmail.co': 'gmail.com', 'gmail.con': 'gmail.com', 'gmail.cm': 'gmail.com', 'gmail.comm': 'gmail.com',
    'gmsil.com': 'gmail.com',
    'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'hotmail.con': 'hotmail.com', 'hotmail.co': 'hotmail.com',
    'outlok.com': 'outlook.com', 'outlook.con': 'outlook.com',
    'yahooo.com': 'yahoo.com', 'yaho.com': 'yahoo.com', 'yahoo.con': 'yahoo.com',
    'iclod.com': 'icloud.com', 'icloud.con': 'icloud.com'
};

// El dominio debe poder recibir correo (MX, o A como respaldo). Si el DNS falla por red/timeout se deja pasar.
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), ms))]);
const KNOWN_PROVIDERS = new Set(['gmail.com', 'hotmail.com', 'outlook.com', 'live.com', 'yahoo.com', 'icloud.com', 'proton.me', 'protonmail.com']);
const domainCanReceiveMail = async (domain) => {
    if (KNOWN_PROVIDERS.has(domain)) return true;
    const dead = (e) => e && (e.code === 'ENOTFOUND' || e.code === 'ENODATA');
    try {
        const mx = await withTimeout(dns.resolveMx(domain), 3000);
        if (mx.length) return true;
    } catch (e) {
        if (!dead(e)) return true;
    }
    try {
        const a = await withTimeout(dns.resolve4(domain), 3000);
        return a.length > 0;
    } catch (e) {
        return !dead(e);
    }
};

/**
 * Valida un correo escrito por una persona. Devuelve { email } normalizado o { error } listo para mostrar.
 */
export async function checkEmail(raw) {
    const email = String(raw ?? '').slice(0, 200).trim().toLowerCase();
    const bad = { error: 'Ese correo no se ve bien. Revísalo.' };
    if (!EMAIL_RE.test(email) || email.includes('..') || /(^|@)\.|\.@/.test(email)) return bad;
    const domain = email.split('@')[1];
    if (TYPO_DOMAINS[domain]) return { error: `¿Quisiste decir ${email.split('@')[0]}@${TYPO_DOMAINS[domain]}?` };
    if (!(await domainCanReceiveMail(domain))) return { error: 'Ese correo no existe. Revísalo.' };
    return { email };
}

// País ISO-2 que pone el CDN (Vercel o Cloudflare). null si no hay o es desconocido.
export const countryOf = (req) => {
    const c = String(req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || '').toUpperCase();
    return /^[A-Z]{2}$/.test(c) && c !== 'XX' ? c : null;
};
