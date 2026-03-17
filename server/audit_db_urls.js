
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function fullAudit() {
    // 1. Check ALL products with non-standard image_url  
    const { data: products, error } = await supabase
        .from('products')
        .select('id, image_url, audio_url, r2_version, name');

    if (error) { console.error(error); return; }

    let issues = [];
    
    for (const p of products) {
        let imgIssue = null;
        let audioIssue = null;
        
        // Check image_url
        if (p.image_url) {
            if (p.image_url.startsWith('http') && p.image_url.includes('r2.cloudflarestorage.com')) {
                imgIssue = 'ABSOLUTE_R2_URL';
            } else if (p.image_url.startsWith('http') && p.image_url.includes('X-Amz')) {
                imgIssue = 'SIGNED_URL_IN_DB';
            } else if (!p.image_url.startsWith('http') && !p.image_url.includes('/')) {
                imgIssue = 'FILENAME_ONLY (no folder path)';
            } else if (!p.image_url.startsWith('http') && p.image_url.includes('image/upload')) {
                imgIssue = 'CLOUDINARY_STRIPPED';
            }
        }
        
        // Check audio_url
        if (p.audio_url) {
            if (p.audio_url.startsWith('http') && p.audio_url.includes('r2.cloudflarestorage.com')) {
                audioIssue = 'ABSOLUTE_R2_URL';
            } else if (p.audio_url.startsWith('http') && p.audio_url.includes('X-Amz')) {
                audioIssue = 'SIGNED_URL_IN_DB';
            } else if (!p.audio_url.startsWith('http') && !p.audio_url.includes('/')) {
                audioIssue = 'FILENAME_ONLY (no folder path)';
            }
        }
        
        if (imgIssue || audioIssue) {
            issues.push({
                id: p.id,
                name: p.name,
                r2_version: p.r2_version,
                img: imgIssue ? `${imgIssue}: ${p.image_url.substring(0, 80)}` : 'OK',
                audio: audioIssue ? `${audioIssue}: ${p.audio_url.substring(0, 80)}` : 'OK'
            });
        }
    }
    
    console.log(`\n===== AUDIT RESULTS =====`);
    console.log(`Total products: ${products.length}`);
    console.log(`Products with issues: ${issues.length}`);
    
    if (issues.length > 0) {
        console.log('\n--- Issues Found ---');
        issues.forEach(i => {
            console.log(`\n[${i.id}] ${i.name} (${i.r2_version})`);
            console.log(`  IMG: ${i.img}`);
            console.log(`  AUDIO: ${i.audio}`);
        });
    } else {
        console.log('✅ No issues found! All URLs look clean.');
    }
    
    // Also show a sample of clean products for verification
    console.log(`\n--- Sample Clean Products ---`);
    const clean = products.filter(p => 
        p.image_url && !p.image_url.startsWith('http') && p.image_url.includes('/')
    ).slice(0, 5);
    clean.forEach(p => {
        console.log(`[${p.id}] ${p.name} | img: ${p.image_url} | v: ${p.r2_version}`);
    });
}

fullAudit().catch(console.error);
