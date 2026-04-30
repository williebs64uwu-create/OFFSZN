import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../server/.env') });

const KIE_API_KEY = process.env.KIE_API_KEY;
const API_BASE = 'https://api.kie.ai/api/v1/jobs';

/**
 * Creates a single generation task in Kie AI
 */
async function createTask(prompt) {
    if (!KIE_API_KEY) throw new Error('KIE_API_KEY missing in .env');

    const response = await fetch(`${API_BASE}/createTask`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${KIE_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: "nano-banana-pro",
            input: {
                prompt: prompt,
                aspect_ratio: "4:5",
                resolution: "1K",
                output_format: "png"
            }
        })
    });

    const data = await response.json();
    if (data.code !== 200) throw new Error(`Kie AI Error: ${data.message}`);
    return data.data.taskId;
}

/**
 * Polls for task completion
 */
async function pollTask(taskId, maxAttempts = 24) {
    for (let i = 0; i < maxAttempts; i++) {
        const response = await fetch(`${API_BASE}/recordInfo?taskId=${taskId}`, {
            headers: { 'Authorization': `Bearer ${KIE_API_KEY}` }
        });
        const data = await response.json();

        if (data.code !== 200) throw new Error(`Poll Error: ${data.message}`);
        
        const state = data.data.state;
        console.log(`[Task ${taskId}] State: ${state} (Attempt ${i+1}/${maxAttempts})`);

        if (state === 'success') {
            const result = JSON.parse(data.data.resultJson);
            return result.resultUrls[0];
        }
        
        if (state === 'fail') throw new Error(`Generation failed: ${data.data.failMsg}`);
        
        // Wait 10 seconds before next poll
        await new Promise(resolve => setTimeout(resolve, 10000));
    }
    throw new Error('Task timed out after 4 minutes.');
}

/**
 * Main Orchestrator for Carousel (5 slides)
 */
export async function generateCarousel(prompts) {
    console.log('🚀 Starting Nano Banana Carousel Generation...');
    
    try {
        // 1. Create all tasks in parallel
        const taskPromises = prompts.map(p => createTask(p));
        const taskIds = await Promise.all(taskPromises);
        console.log('✅ All tasks created:', taskIds);

        // 2. Poll all tasks 
        const pollPromises = taskIds.map(id => pollTask(id));
        const results = await Promise.all(pollPromises);
        
        console.log('✨ Carousel complete!');
        return results;
    } catch (error) {
        console.error('❌ Error generating carousel:', error.message);
        throw error;
    }
}

// CLI usage
if (process.argv[2]) {
    const prompts = JSON.parse(process.argv[2]);
    generateCarousel(prompts).then(urls => {
        console.log('RESULTS_START');
        console.log(JSON.stringify(urls));
        console.log('RESULTS_END');
    });
}
