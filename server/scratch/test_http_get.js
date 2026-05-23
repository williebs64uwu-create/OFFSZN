async function run() {
    const url = 'http://localhost:3000/api/r2-public/products/covers/0382a813-85c7-46c3-8d2c-61a5692adffd/1777849573752_cover.jpg';
    console.log(`Fetching from local server: ${url}`);
    
    try {
        const res = await fetch(url);
        console.log(`Status: ${res.status} ${res.statusText}`);
        console.log('Headers:');
        for (const [k, v] of res.headers.entries()) {
            console.log(`  ${k}: ${v}`);
        }
        
        const bodyText = await res.text();
        console.log(`Body length: ${bodyText.length}`);
        console.log(`First 200 chars of body:\n${bodyText.substring(0, 200)}`);
    } catch (err) {
        console.error('Fetch error:', err);
    }
}

run();
