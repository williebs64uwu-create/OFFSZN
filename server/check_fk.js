import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://qtjpvztpgfymjhhpoouq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0anB2enRwZ2Z5bWpoaHBvb3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3ODA5MTUsImV4cCI6MjA3NjM1NjkxNX0.YsItTFk3hSQaVuy707-z7Z-j34mXa03O0wWGAlAzjrw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    // Try to query normally to see if user_id or producer_id has a relation
    const { data, error } = await supabase
        .from('propuestas_offszn')
        .select('*, users!user_id(id), users!producer_id(id)')
        .limit(1);

    console.log("Dual Join Test:", error ? error.message : "Success");

    const { data: d2, error: e2 } = await supabase
        .from('propuestas_offszn')
        .select('*, users(id)')
        .limit(1);

    console.log("No specific hint test:", e2 ? e2.message : "Success");
}
checkSchema();
