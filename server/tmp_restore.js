import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_KEY } from './src/shared/config/config.js'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function restore() {
    console.log('Restoring 472...');
    const { data, error } = await supabase
        .from('products')
        .update({ status: 'published' }) // or approved, but 472 was published
        .eq('id', 472);

    if (error) {
        console.error(error);
        return;
    }

    console.log('Final check:');
    const { data: active, error: fetchError } = await supabase
        .from('products')
        .select('id, name, status')
        .neq('status', 'deleted');

    if (fetchError) {
        console.error(fetchError);
        return;
    }

    active.forEach(p => console.log(JSON.stringify(p)));
}

restore();
