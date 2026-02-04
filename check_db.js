
const { createClient } = require('@supabase/supabase-js');

// Using the anon key and url from the source file
const SUPABASE_URL = "https://qtjpvztpgfymjhhpoouq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0anB2enRwZ2Z5bWpoaHBvb3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3ODA5MTUsImV4cCI6MjA3NjM1NjkxNX0.YsItTFk3hSQaVuy707-z7Z-j34mXa03O0wWGAlAzjrw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkTable() {
    const { data, error } = await supabase
        .from('message_reactions')
        .select('*')
        .limit(1);

    if (error) {
        console.log('Error or table missing:', error.message);
    } else {
        console.log('Table exists. Sample data:', data);
    }
}

checkTable();

