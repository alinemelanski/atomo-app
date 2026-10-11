require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY);

async function lerPosts() {
  const { data, error } = await supabase.from('posts').select('*');
  console.log(error ? error.message : data);
}

lerPosts();