import 'dotenv/config';
import { supabase } from './src/infrastructure/database/connection.js';

async function clearHardwareId() {
    const { data, error } = await supabase
        .from('plugin_activations')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); 

    if (error) {
        console.error("Error borrando activations:", error);
    } else {
        console.log("Activaciones limpiadas de la BD. ¡La PC es 'nueva' para el servidor!");
    }
    process.exit(0);
}

clearHardwareId();
