const CHARS = 'qL8zF1Gk7XwNjR4yvB5tM6dncb9sPp2hQr3JmKW0ZTDVagHflSx_';
const BASE = CHARS.length;

function toShuffledBase(num) {
    let n = (num * 321) + 74;
    let res = '';
    while (n > 0) {
        res = CHARS[n % BASE] + res;
        n = Math.floor(n / BASE);
    }
    return res;
}

function fromShuffledBase(str) {
    let n = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        const index = CHARS.indexOf(char);
        if (index === -1) return null;
        n = n * BASE + index;
    }
    return Math.floor((n - 74) / 321);
}

const id118 = toShuffledBase(118);
const id117 = toShuffledBase(117);

console.log(`ID 118 -> Code: ${id118} -> Decoded: ${fromShuffledBase(id118)}`);
console.log(`ID 117 -> Code: ${id117} -> Decoded: ${fromShuffledBase(id117)}`);

// Check if any word in the dictionary matches a code
const testWords = ['advantage', 'Narcos', 'bpm', 'key'];
testWords.forEach(w => {
    console.log(`Word '${w}' -> Decoded ID: ${fromShuffledBase(w)}`);
});
