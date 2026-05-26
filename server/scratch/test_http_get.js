async function run() {
    const productId = process.argv[2] || '783';
    const apiBase = process.env.DIAG_API_BASE || 'http://localhost:3000';

    const defaults = {
        '783': {
            cover: 'products/covers/60e85311-07dc-46ed-83c5-54f4add637a0/1779549767603_cover.jpg',
            audio: 'beats/mp3/60e85311-07dc-46ed-83c5-54f4add637a0/1779549771093_MUEVELO-REGGAETON_TYPE_BEAT_SAMU.mp3',
            v: 'v3'
        }
    };

    const sample = defaults[productId] || defaults['783'];
    const urls = [
        `${apiBase}/api/r2-public/${sample.cover}?v=${sample.v}`,
        `${apiBase}/api/r2-public/${sample.audio}?v=${sample.v}`
    ];

    for (const url of urls) {
    console.log(`\nFetching: ${url}`);
    
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
}

run();
