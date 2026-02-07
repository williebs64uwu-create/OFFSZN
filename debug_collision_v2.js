
const OLD_CHARS = 'qL8zF1Gk7XwNjR4yvB5tM6dncb9sPp2hQr3JmKW0ZTDVBgHflSx_'; // Duplicate B at 42
const NEW_CHARS = 'qL8zF1Gk7XwNjR4yvB5tM6dncb9sPp2hQr3JmKW0ZTDVagHflSx_'; // Fixed a at 42
const BASE = 52;

function toShuffledBase(num, chars) {
    let n = Number(num);
    if (isNaN(n) || n === 0) return chars[0];

    // Add a salt offset so ID 1 isn't just 'q'
    n = (n * 321) + 74;

    let res = '';
    while (n > 0) {
        res = chars[n % BASE] + res;
        n = Math.floor(n / BASE);
    }
    return res;
}

function fromShuffledBase(str, chars) {
    if (!str) return null;
    let n = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        const index = chars.indexOf(char); // Find first occurrence
        if (index === -1) return null;
        n = n * BASE + index;
    }

    // Reverse offset
    n = (n - 74) / 321;
    // return n;
    return Math.round(n); // Handle float precision if any
}

console.log("--- OLD ALPHABET (Broken) ---");
const code117_old = toShuffledBase(117, OLD_CHARS);
const code118_old = toShuffledBase(118, OLD_CHARS);
console.log("ID 117 encodes to:", code117_old);
console.log("ID 118 encodes to:", code118_old);
console.log(`Decode '${code117_old}':`, fromShuffledBase(code117_old, OLD_CHARS));
console.log(`Decode '${code118_old}':`, fromShuffledBase(code118_old, OLD_CHARS));
console.log(`Decode '4LB':`, fromShuffledBase('4LB', OLD_CHARS));


console.log("\n--- NEW ALPHABET (Fixed) ---");
const code117_new = toShuffledBase(117, NEW_CHARS);
const code118_new = toShuffledBase(118, NEW_CHARS);
console.log("ID 117 encodes to:", code117_new);
console.log("ID 118 encodes to:", code118_new);
console.log(`Decode '4LB':`, fromShuffledBase('4LB', NEW_CHARS));
