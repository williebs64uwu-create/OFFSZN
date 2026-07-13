import fetch from 'node-fetch';

async function main() {
    const url = 'https://offszn.lat/api/download/easymix-mac-installer';
    console.log(`Sending GET request to live URL: ${url}...`);
    try {
        const res = await fetch(url, {
            redirect: 'manual' // Don't follow redirect, just check response status and headers
        });
        console.log('Response Status:', res.status);
        console.log('Headers:', JSON.stringify(Object.fromEntries(res.headers.entries()), null, 2));
        
        if (res.status === 302 || res.status === 301) {
            console.log('Location:', res.headers.get('location'));
        } else {
            const body = await res.text();
            console.log('Body:', body);
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

main();
