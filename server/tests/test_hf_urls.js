require('dotenv').config({ path: './server/.env' });
const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN;
const prompt = "lo-fi hip hop beat";

async function testUrl(url) {
    console.log(`Testing URL: ${url}`);
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${HF_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ inputs: prompt }),
        });
        
        console.log(`Status: ${response.status}`);
        const text = await response.text();
        console.log(`Body: ${text.substring(0, 100)}...`);
        return response.ok;
    } catch (e) {
        console.log(`Fetch error: ${e.message}`);
        return false;
    }
}

async function runTests() {
    const urls = [
        "https://api-inference.huggingface.co/models/facebook/musicgen-small",
        "https://router.huggingface.co/hf-inference/models/facebook/musicgen-small",
        "https://router.huggingface.co/models/facebook/musicgen-small"
    ];
    
    for (const url of urls) {
        await testUrl(url);
        console.log("-------------------");
    }
}

runTests();
