import 'server-only';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

export const hasSupabaseAdmin = Boolean(supabaseUrl && supabaseSecretKey);

export const supabaseAdmin = hasSupabaseAdmin
  ? createClient(supabaseUrl!, supabaseSecretKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    })
  : null;

export function requireSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error(
      'Supabase 服务端未配置：请设置 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SECRET_KEY。'
    );
  }

  return supabaseAdmin;
}
