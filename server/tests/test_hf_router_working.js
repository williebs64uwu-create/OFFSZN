require('dotenv').config({ path: './server/.env' });
const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN;

async function testWorkingModel() {
    const model = "facebook/mms-tts-eng";
    const url = `https://router.huggingface.co/hf-inference/models/${model}`;
    console.log(`Testing model on router: ${model}`);
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${HF_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ inputs: "Hello there" }),
        });
        console.log(`Status: ${response.status}`);
        const text = await response.text();
        console.log(`Body: ${text.substring(0, 100)}...`);
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
}

testWorkingModel();
