require('dotenv').config({ path: './server/.env' });
const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN;

async function listModels() {
    console.log(`Listing models from router...`);
    try {
        const response = await fetch("https://router.huggingface.co/v1/models", {
            headers: {
                "Authorization": `Bearer ${HF_TOKEN}`,
            },
        });
        const json = await response.json();
        const ids = json.data.map(m => m.id);
        console.log(`Total models: ${ids.length}`);
        console.log(`Model snippets: ${ids.slice(0, 20).join(", ")}`);
        
        const musicgen = ids.find(id => id.toLowerCase().includes("musicgen"));
        if (musicgen) {
            console.log(`Found musicgen model: ${musicgen}`);
        } else {
            console.log(`Musicgen not found in the router list.`);
        }
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
}

listModels();
