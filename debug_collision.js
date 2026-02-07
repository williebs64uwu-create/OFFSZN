
const OLD_CHARS = 'qL8zF1Gk7XwNjR4yvB5tM6dncb9sPp2hQr3JmKW0ZTDVBgHflSx_'; // Duplicate B at 42
const NEW_CHARS = 'qL8zF1Gk7XwNjR4yvB5tM6dncb9sPp2hQr3JmKW0ZTDVagHflSx_'; // Fixed a at 42

function encode(id, alphabet) {
    const base = alphabet.length;
    let num = id;
    let str = '';
    do {
        str = alphabet[num % base] + str;
        num = Math.floor(num / base);
    } while (num > 0);
    return str;
}

function decode(code, alphabet) {
    const base = alphabet.length;
    let num = 0;
    for (let i = 0; i < code.length; i++) {
        const char = code[i];
        const index = alphabet.indexOf(char);
        if (index === -1) return null;
        num = num * base + index;
    }
    return num;
}

console.log("--- OLD ALPHABET (Broken) ---");
console.log("ID 117 encodes to:", encode(117, OLD_CHARS));
console.log("ID 118 encodes to:", encode(118, OLD_CHARS));
console.log("Code '4LB' decodes to:", decode('4LB', OLD_CHARS)); // Will pick first B (index 14)

console.log("\n--- NEW ALPHABET (Fixed) ---");
console.log("ID 117 encodes to:", encode(117, NEW_CHARS));
console.log("ID 118 encodes to:", encode(118, NEW_CHARS));
console.log("Code '4LB' decodes to:", decode('4LB', NEW_CHARS));
console.log("Code for 118 should be:", encode(118, NEW_CHARS));
