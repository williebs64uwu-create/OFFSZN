require('dotenv').config({ path: './server/.env' });
const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN;

async function testUrl(url, body) {
    console.log(`Testing URL: ${url}`);
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${HF_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
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
    const model = "facebook/musicgen-small";
    const prompt = "lo-fi hip hop beat";
    
    const urls = [
        `https://router.huggingface.co/hf-inference/models/${model}`,
        `https://router.huggingface.co/v1/models/${model}`,
        `https://router.huggingface.co/hf-inference/v1/models/${model}`,
        `https://router.huggingface.co/hf-inference/v1/chat/completions`, // Just to see if router itself is alive
        `https://huggingface.co/api/models/${model}/inference`
    ];
    
    for (const url of urls) {
        let body = { inputs: prompt };
        if (url.includes("chat/completions")) {
            body = { model: "meta-llama/Llama-3-8b-instruct", messages: [{role: "user", content: "Hi"}] };
        }
        await testUrl(url, body);
        console.log("-------------------");
    }
}

runTests();
