
import fetch from 'node-fetch';

async function test() {
    try {
        const res = await fetch('http://localhost:3000/api/me/favorites');
        console.log(`Status: ${res.status}`);
        const text = await res.text();
        console.log(`Body: ${text}`);
    } catch (err) {
        console.error(`Error: ${err.message}`);
    }
}

test();
