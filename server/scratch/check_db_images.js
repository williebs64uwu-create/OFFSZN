import { supabase } from '../src/infrastructure/database/connection.js';

async function run() {
    const filenames = [
        '1777849573752_cover.jpg',
        '1775697725025_cover.jpg',
        '1774225861578_cover_edit.jpg',
        '1774722797874_cover_edit.jpg',
        '1776970895394_cover.jpg',
        '1776642666014_cover.jpg'
    ];

    console.log('Querying database for image_urls containing these filenames...');

    for (const f of filenames) {
        const { data, error } = await supabase
            .from('products')
            .select('id, name, image_url, r2_version, storage_version')
            .ilike('image_url', `%${f}%`);
        
        if (error) {
            console.error(`Error querying for ${f}:`, error);
        } else {
            console.log(`\nFilename: ${f}`);
            console.log('Matches:', data);
        }
    }
}

run();
