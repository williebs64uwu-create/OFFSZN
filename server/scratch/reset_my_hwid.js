import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function resetActivations() {
    console.log("Deleting all device activations...");
    const { error: actErr } = await supabase.from('plugin_activations').delete().not('id', 'is', null);
    if (actErr) {
        console.error("Error deleting activations:", actErr);
    } else {
        console.log("Successfully cleared all device activations (HWIDs).");
    }
}

resetActivations();
