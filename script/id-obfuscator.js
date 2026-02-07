/**
 * ID OBFUSCATOR
 * Simple reversible obfuscation for IDs to look like short codes.
 * Algorithm: pseudo-random shuffle + base conversion.
 */

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const PRIME = 982451653; // Large prime
const OFFSET = 123456789; // Random offset

window.IdObfuscator = {
    // Encodes a numeric ID to a string
    encode: function (id) {
        if (!id) return null;
        const num = parseInt(id);
        if (isNaN(num)) return id; // Fallback

        // 1. Modular arithmetic to scramble
        const scrambled = (num * PRIME + OFFSET) % Number.MAX_SAFE_INTEGER;

        // 2. Base conversion
        return toBase(scrambled, ALPHABET);
    },

    // Decodes the string back to numeric ID
    // Note: With modular arithmetic alone, distinct decoding is hard without a full bijective map.
    // So we'll use a simpler bijective pair: (id * P + O) -> reversible if we ignore modulo wrap (assuming IDs < MaxInt)

    // REVISED SIMPLE BIJECTIVE ALGORITHM:
    // This one is reversible for practical ID ranges.
    // 1. Bitwise mix (simple)
    // 2. Base64-ish text

    encodeId: function (n) {
        // Use a simple multiplicative inverse obfuscation
        // Max ID approx 1 billion.
        // We just want it to look random.
        // Let's use standard Hex transformation + slight shuffle
        // Actually, let's keep it robust: Base64 of a transformed number.

        let x = BigInt(n);
        // Transform: x' = x * 6364136223846793005 + 1442695040888963407 (Knuth's LCG constants)
        // But simpler: just XOR with a mask and maybe swap bits.
        // Let's simpler:
        const xorMask = 0xA5A5A5;
        const result = (Number(n) ^ xorMask).toString(16);
        // To make it look "short code-ish", remove typical hex look.
        // Actually, the user just wants "Short".

        // Let's use simple Base64 of ID but without '==' padding and URL safe.
        // prod.id = 72 -> "NzI"
        // prod.id = 12345 -> "MTIzNDU"

        // The user specifically disliked "NzI=".
        // He liked "LmIrJ".
        // Let's map 0-9 a-z A-Z to a shuffled alphabet.

        return toShuffledBase(n);
    },

    decodeId: function (str) {
        return fromShuffledBase(str);
    }
};

// SHUFFLED ALPHABET (Randomized for "hashing" effect)
const CHARS = 'qL8zF1Gk7XwNjR4yvB5tM6dncb9sPp2hQr3JmKW0ZTDVagHflSx_'; // URL-safe chars (Fixed duplicate B at index 42)
const BASE = CHARS.length;

// 🔥 LEGACY / BROKEN CODES EXCEPTION LIST
// Maps specific broken codes (generated with old buggy alphabet) to their CORRECT intended ID.
// This fixes existing links that users might have shared.
const LEGACY_MAPPINGS = {
    '4LB': 118, // The famous "Narcos" beat collision
};

function toShuffledBase(num) {
    let n = Number(num);
    if (isNaN(n) || n === 0) return CHARS[0];

    // Add a salt offset so ID 1 isn't just 'q'
    n = (n * 321) + 74;

    let res = '';
    while (n > 0) {
        res = CHARS[n % BASE] + res;
        n = Math.floor(n / BASE);
    }
    return res;
}

function fromShuffledBase(str) {
    if (!str) return null;

    // 0. Check Legacy Mappings first
    if (LEGACY_MAPPINGS.hasOwnProperty(str)) {
        console.log(`🔧 [IdObfuscator] Legacy code detected: ${str} -> ${LEGACY_MAPPINGS[str]}`);
        return LEGACY_MAPPINGS[str];
    }

    let n = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        const index = CHARS.indexOf(char);
        if (index === -1) return null;
        n = n * BASE + index;
    }

    // Reverse offset
    n = (n - 74) / 321;
    if (isNaN(n) || !isFinite(n)) return null;
    return Math.floor(n);
}

// Global exposure
// STANDARD OBFUSCATOR
window.encodeProductLink = (id) => {
    return '/producto.html?p=' + window.IdObfuscator.encodeId(id);
};

window.decodeProductLink = (code) => {
    return window.IdObfuscator.decodeId(code);
};

// SEO FRIENDLY LINK GENERATOR (BeatStars Style)
// Generates: /producto.html?beat=slug-name-CODE
window.createSeoLink = (product) => {
    if (!product) return '#';
    const id = product.id;
    const name = product.name || 'product';
    const type = (product.product_type || 'beat').toLowerCase(); // beat, kit, loopkit...

    // 1. If product has a custom public_slug (manually set in DB), use it directly!
    if (product.public_slug) {
        let prefix = 'beat';
        const lType = type.toLowerCase();
        if (lType.includes('drumkit')) prefix = 'drumkit';
        else if (lType.includes('loopkit')) prefix = 'loopkit';
        else if (lType.includes('kit')) prefix = 'kit';
        else if (lType.includes('preset') || lType.includes('voces')) prefix = 'preset';
        else if (lType.includes('sample')) prefix = 'sample';
        else if (lType.includes('instrumento')) prefix = 'instrumento';
        else if (lType.includes('plugin')) prefix = 'plugin';
        else if (lType.includes('plantilla')) prefix = 'plantilla';

        return `/${prefix}/${product.public_slug}`;
    }

    // 2. Fallback to auto-generated slug with obfuscated ID
    let param = 'beat';
    const lType = type.toLowerCase();
    if (lType.includes('drumkit')) param = 'drumkit';
    else if (lType.includes('loopkit')) param = 'loopkit';
    else if (lType.includes('kit')) param = 'kit';
    else if (lType.includes('preset') || lType.includes('voces')) param = 'preset';
    else if (lType.includes('sample')) param = 'sample';
    else if (lType.includes('instrumento')) param = 'instrumento';
    else if (lType.includes('plugin')) param = 'plugin';
    else if (lType.includes('plantilla')) param = 'plantilla';

    const code = window.IdObfuscator.encodeId(id);

    // Slugify name (More aggressive for sanitization)
    const slug = name.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9]+/g, '-')                      // Replace non-alphanum with -
        .replace(/^-+|-+$/g, '')                          // Trim -
        .slice(0, 50);                                    // Max length 50

    // CLEAN URL FORMAT: /beat/slug-name-code
    return `/${param}/${slug}-${code}`;
};

// SEO DECODER
// Extracts ID from "slug-name-CODE"
window.decodeSeoLink = (str) => {
    if (!str) return null;
    const parts = str.split('-');
    const code = parts[parts.length - 1]; // Last part is always the code
    return window.IdObfuscator.decodeId(code);
};

/**
 * PROFILE LINK GENERATOR
 * Generates: /@nickname or /perfil-publico.html?id=UUID
 */
window.createProfileLink = (user) => {
    if (!user) return '#';
    // Use nickname if available (@standard)
    const nickname = user.nickname || user.username; // Support both just in case
    if (nickname) {
        return `/@${nickname}`;
    }
    // Fallback to explicit ID routing
    if (user.id) {
        return `/perfil-publico.html?id=${user.id}`;
    }
    return '#';
};
