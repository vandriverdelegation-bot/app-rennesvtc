const { createClient } = require('@supabase/supabase-js');

function createSupabaseClient(url, anonKey, storage) {
  if (!url || !anonKey) {
    throw new Error('Supabase url/anonKey manquants (verifiez le fichier .env)');
  }
  return createClient(url, anonKey, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

module.exports = { createSupabaseClient };
