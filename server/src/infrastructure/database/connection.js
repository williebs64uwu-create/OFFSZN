// connection.js
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_KEY } from '../../shared/config/config.js'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export const checkConnection = async () => {
    try {
        const { error } = await supabase.from('users').select('id').limit(1)

        if (error) {
            console.error('Error al conectar a Supabase:', error.message)
        } else {
            console.log('Conexión exitosa a Supabase')
        }

    } catch (error) {
        console.error('Error inesperado en la conexión a Supabase:', err.message)
    }
}
