import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function test() {
    // 1. Try fetching with no disambiguation
    let res1 = await supabase.from('messages').select('id, parent:messages(*)').not('reply_to_id', 'is', null).limit(1);
    console.log("TEST 1 no disambiguation:", res1.error ? res1.error.message : "Success");
    if (!res1.error) console.log("Data 1 type of parent:", Array.isArray(res1.data[0]?.parent) ? 'Array' : 'Object');

    let res3 = await supabase.from('messages').select('id, parent:reply_to_id(*)').not('reply_to_id', 'is', null).limit(1);
    console.log("TEST 3 parent:reply_to_id: ", res3.error ? res3.error.message : JSON.stringify(res3.data[0]?.parent, null, 2));

    let res4 = await supabase.from('messages').select('id, parent_message:messages!reply_to_id(*)').not('reply_to_id', 'is', null).limit(1);
    console.log("TEST 4 parent_message:messages!reply_to_id: ", res4.error ? res4.error.message : JSON.stringify(res4.data[0]?.parent_message, null, 2));
}
test();
