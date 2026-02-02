import { supabase } from './src/infrastructure/database/connection.js';

async function diag() {
    const pid = '0382a813-85c7-46c3-8d2c-61a5692adffd';
    console.log('--- DB DIAGNOSTIC ---');
    console.log('Querying profiles for ID:', pid);

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', pid)
        .single();

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Found Profile:');
        console.log('ID:', profile.id);
        console.log('payment_methods:', JSON.stringify(profile.payment_methods, null, 2));
        console.log('paypal_email (if any):', profile.paypal_email);
    }
}

diag();
