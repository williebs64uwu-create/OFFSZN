require('dotenv').config({ path: './server/.env' });
const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN;
const prompt = "classical music piano";

async function testModel(model) {
    const url = `https://api-inference.huggingface.co/models/${model}`;
    console.log(`Testing model: ${model}`);
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
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
}

async function runTests() {
    const models = [
        "facebook/musicgen-small",
        "facebook/musicgen-medium",
        "facebook/musicgen-large",
        "cvssp/musicgen-small",
        "suno/bark-small" // Diferente modelo para ver si es algo de musicgen
    ];
    for (const m of models) {
        await testModel(m);
        console.log("-------------------");
    }
}

runTests();
