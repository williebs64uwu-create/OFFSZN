// ─── Catálogo de la tienda Willie Inspired ────────────────────────────────────────────────────────────────────
// Une willieinspired/data/store-catalog.json (productos, servicios, comunidad) con artist-presets-catalog.json
// (presets de artistas con archivos reales en R2). El checkout, la entrega y /api/store leen SOLO de aquí.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.VERCEL ? process.cwd() : path.resolve(__dirname, '../../../../');
const STORE_PATH = path.join(ROOT, 'willieinspired/data/store-catalog.json');
const ARTISTS_PATH = path.join(ROOT, 'willieinspired/data/artist-presets-catalog.json');

const readJson = (p, fallback) => {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) {
        console.warn(`[StoreCatalog] No se pudo leer ${path.basename(p)}:`, e.message);
        return fallback;
    }
};
const exists = (webPath) => Boolean(webPath) && fs.existsSync(path.join(ROOT, webPath.replace(/^\//, '')));

// IDs que usaba el checkout anterior (carritos guardados en localStorage) → id del catálogo nuevo.
const LEGACY_ALIASES = {
    'bundle-all-presets': 'bundle-todos-los-presets',
    'bundle-easy-mix-ai': 'plugin-easy-mix',
    'easy-mix-ai': 'plugin-easy-mix',
    'promo-2x1': 'bundle-promo-2x1',
    '899': 'plugin-easy-mix', '901': 'plugin-easy-mix',
    '900': 'plugin-easy-master',
    '902': 'plugin-inka-kola',
    '903': 'plugin-coca-cola',
    'preset-jhay': 'preset-jhayco',
    'preset-myke': null, 'preset-anuel': null, 'preset-maluma': null, 'preset-ozuna': null,
    'preset-j-balvin': null, 'preset-sech': null, 'preset-mora': null, 'preset-rauw': null
};

const titleCase = (s) => String(s || '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

function resolveCover(id, catalogCover) {
    const candidates = [`/willieimages/covers/${id}-v2.png`, `/willieimages/covers/${id}.png`, `/willieimages/covers/${id}.jpg`, catalogCover];
    if (id === 'natan') candidates.push('/willieimages/covers/nat-n.jpg');
    return candidates.find(exists) || null;
}

function resolveHoverCover(id, cover) {
    const alt = [`/willieimages/covers/${id}.jpg`, `/willieimages/covers/${id}.png`].find((c) => c !== cover && exists(c));
    return alt || null;
}

function buildArtistProduct(a, defaults, audio, extra = {}) {
    const name = titleCase(a.artist);
    const cover = extra.cover !== undefined ? (exists(extra.cover) ? extra.cover : null) : resolveCover(a.id, a.cover_url);
    return {
        id: `preset-${a.id}`,
        slug: a.id,
        category: 'presets',
        subcategory: 'artistas',
        kind: 'digital',
        artist: name,
        title: `${name} Vocal Preset`,
        tagline: defaults.tagline,
        description: `Suena como ${name}: la cadena vocal armada a partir de su sonido, lista para grabar en FL Studio con tu micrófono de casa.`,
        price: { ...defaults.price },
        status: extra.status || 'active',
        delivery: extra.delivery || (a.files?.length ? 'files' : 'manual'),
        format: a.format || 'FST',
        badges: [...defaults.badges],
        features: [...defaults.features],
        includes: [...defaults.includes],
        media: {
            cover,
            hoverCover: cover ? resolveHoverCover(a.id, cover) : null,
            video: null,
            audioBefore: audio?.before || null,
            audioAfter: audio?.after || null
        },
        eligible2x1: true,
        eligibleWelcome: true,
        upsells: [...defaults.upsells],
        // Solo para la entrega (nunca sale en la API pública)
        files: a.files || []
    };
}

let cache = null;

export function loadCatalog({ force = false } = {}) {
    if (cache && !force) return cache;
    const store = readJson(STORE_PATH, { products: [], artistExtras: [], artistDefaults: {} });
    const artists = readJson(ARTISTS_PATH, []);
    const defaults = store.artistDefaults || {};
    const audio = store.artistAudio || {};

    const artistProducts = artists.map((a) => buildArtistProduct(a, defaults, audio[a.id]));
    const known = new Set(artistProducts.map((p) => p.id));
    for (const x of store.artistExtras || []) {
        if (known.has(`preset-${x.id}`)) continue;
        artistProducts.push(buildArtistProduct({ id: x.id, artist: x.artist, files: [] }, defaults, audio[x.id], x));
    }
    artistProducts.sort((a, b) => a.artist.localeCompare(b.artist, 'es'));

    const products = [...(store.products || []).map((p) => ({ ...p, media: { ...(p.media || {}) } })), ...artistProducts];
    for (const p of products) {
        if (p.media?.cover && !/^https?:/.test(p.media.cover) && !exists(p.media.cover)) p.media.cover = null;
    }

    const byId = new Map(products.map((p) => [p.id, p]));
    const bySlug = new Map(products.map((p) => [`${p.category}/${p.subcategory === 'artistas' ? 'artistas/' : ''}${p.slug}`, p]));

    cache = {
        products,
        byId,
        bySlug,
        genres: store.genres || [],
        faq: store.faq || [],
        version: store.version || 1
    };
    return cache;
}

// Acepta ids nuevos y los del checkout anterior ("preset-bad-bunny", "899", "bundle-all-presets").
export function getProduct(rawId) {
    const { byId } = loadCatalog();
    const id = String(rawId || '').trim();
    if (!id) return null;
    if (byId.has(id)) return byId.get(id);
    if (Object.prototype.hasOwnProperty.call(LEGACY_ALIASES, id)) return LEGACY_ALIASES[id] ? byId.get(LEGACY_ALIASES[id]) || null : null;
    if (byId.has(`preset-${id}`)) return byId.get(`preset-${id}`);
    if (byId.has(`plugin-${id}`)) return byId.get(`plugin-${id}`);
    return null;
}

export function getProductBySlug(category, slug, sub = null) {
    return loadCatalog().bySlug.get(`${category}/${sub ? `${sub}/` : ''}${slug}`) || null;
}

// Archivos a entregar por producto (los packs se expanden a todos los presets con archivo).
export function deliverablesFor(productId) {
    const product = getProduct(productId);
    if (!product) return [];
    if (product.bundleOf === 'all-artist-presets') {
        return loadCatalog().products.filter((p) => p.subcategory === 'artistas' && p.status === 'active' && p.files?.length);
    }
    return product.files?.length ? [product] : [];
}

// Lo que ve el navegador: sin rutas del bucket.
export function publicProduct(p) {
    if (!p) return null;
    const { files, ...rest } = p;
    return { ...rest, fileCount: files?.length || 0 };
}
