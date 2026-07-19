import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';

async function main() {
    console.log('Updating Easy Mix (899) and Easy Master (900) producer_id...');
    const willieinspiredId = '0382a813-85c7-46c3-8d2c-61a5692adffd';

    const { data: updatedMix, error: mixErr } = await supabase
        .from('products')
        .update({ producer_id: willieinspiredId })
        .eq('id', 899)
        .select('*')
        .single();

    if (mixErr) {
        console.error('Error updating Easy Mix:', mixErr);
    } else {
        console.log('✅ Easy Mix updated:', updatedMix.id, updatedMix.name, 'Producer ID:', updatedMix.producer_id);
    }

    const { data: updatedMaster, error: masterErr } = await supabase
        .from('products')
        .update({ producer_id: willieinspiredId })
        .eq('id', 900)
        .select('*')
        .single();

    if (masterErr) {
        console.error('Error updating Easy Master:', masterErr);
    } else {
        console.log('✅ Easy Master updated:', updatedMaster.id, updatedMaster.name, 'Producer ID:', updatedMaster.producer_id);
    }
}
main().catch(console.error);
