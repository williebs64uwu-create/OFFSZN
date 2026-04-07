
import { supabase } from '../server/src/infrastructure/database/connection.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkSounds() {
    const { data: sounds, error } = await supabase
        .from('ai_sound_bank')
        .select('name, category, tags')
        .limit(200);

    if (error) {
        console.error('Error fetching sounds:', error);
        return;
    }

    console.log('--- SAMPLE SOUNDS (TOP 200) ---');
    let jerkFound = false;
    let availableCategories = new Set();
    
    sounds.forEach(s => {
        availableCategories.add(s.category);
        const tags = Array.isArray(s.tags) ? s.tags.join(' ') : (s.tags || "");
        const allText = `${s.name} ${s.category} ${tags}`.toLowerCase();
        
        if (allText.includes('jerk')) {
            console.log(`[FOUND JERK!] Name: ${s.name} | Cat: ${s.category} | Tags: ${s.tags}`);
            jerkFound = true;
        }
    });
    
    if (!jerkFound) {
        console.log('No jerk samples found in the top 200.');
        console.log('Available categories:', Array.from(availableCategories));
    }
}

checkSounds();
