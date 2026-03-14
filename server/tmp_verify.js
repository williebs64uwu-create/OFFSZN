import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_KEY } from './src/shared/config/config.js'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function verify() {
    const { data, error } = await supabase
        .from('products')
        .select('id, name, status')
        .or('name.ilike.%Karioka%,name.ilike.%Luna%,name.ilike.%Schooldays%,name.ilike.%Batalla%');

    if (error) {
        console.error(error);
        return;
    }

    console.log('Results:');
    data.forEach(p => console.log(JSON.stringify(p)));
}

verify();
