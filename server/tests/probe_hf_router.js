require('dotenv').config({ path: './server/.env' });
const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN;

async function probeUrl(url) {
    console.log(`Probing: ${url}`);
    try {
        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${HF_TOKEN}`,
            },
        });
        console.log(`Status: ${response.status}`);
        const text = await response.text();
        console.log(`Body: ${text.substring(0, 100)}...`);
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
}

async function runProbes() {
    const urls = [
        "https://router.huggingface.co/hf-inference/v1/models",
        "https://router.huggingface.co/hf-inference/models",
        "https://router.huggingface.co/hf-inference",
        "https://router.huggingface.co/v1/models",
        "https://router.huggingface.co/models"
    ];
    for (const url of urls) {
        await probeUrl(url);
        console.log("-------------------");
    }
}

runProbes();
