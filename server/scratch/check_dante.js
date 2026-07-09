import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkDante() {
    const email = 'dantenunez37@gmail.com';
    const beatIds = [779, 780, 781];
    
    console.log(`Checking database tables for email: ${email}...`);

    // 1. Check orders (for free or paid checkout)
    const { data: orders, error: orderErr } = await supabase
        .from('orders')
        .select('*')
        .ilike('guest_email', email);

    if (orderErr) {
        console.error("Error checking orders:", orderErr.message);
    } else {
        console.log(`Orders found (${orders?.length || 0}):`);
        orders?.forEach(o => {
            console.log(`- Order ID: ${o.id} | Amount: $${o.amount} | Product ID: ${o.product_id} | Created: ${o.created_at}`);
        });
    }

    // 2. Check if a table named 'downloads' exists
    const { data: dls, error: dlErr } = await supabase
        .from('downloads')
        .select('*')
        .ilike('email', email); // or whatever column holds email

    if (dlErr) {
        // If table doesn't exist, this will error, but we'll capture it
        console.log(`Downloads table query result: ${dlErr.message}`);
    } else {
        console.log(`Downloads found (${dls?.length || 0}):`);
        dls?.forEach(d => {
            console.log(d);
        });
    }

    // 3. Check for any users with this email
    const { data: users, error: userErr } = await supabase
        .from('users')
        .select('id, nickname, email')
        .eq('email', email);

    if (userErr) {
        console.error("Error checking users:", userErr.message);
    } else {
        console.log(`Users found (${users?.length || 0}):`);
        users?.forEach(u => {
            console.log(`- User ID: ${u.id} | Nickname: ${u.nickname} | Email: ${u.email}`);
        });
    }
}

checkDante();
