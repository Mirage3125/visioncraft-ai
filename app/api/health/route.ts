import { NextResponse } from 'next/server';
import { hasSupabaseAdmin, supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'artworks';
  let storageReady = false;
  let storageError: string | undefined;

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin.storage.getBucket(bucket);
    storageReady = Boolean(data && !error);
    storageError = error?.message;
  }

  return NextResponse.json({
    ok: true,
    realGenerationEnabled: process.env.ENABLE_REAL_GENERATION === 'true',
    arkConfigured: Boolean(process.env.ARK_API_KEY && process.env.ARK_IMAGE_MODEL),
    supabaseServerConfigured: hasSupabaseAdmin,
    storageBucket: bucket,
    storageReady,
    storageError,
    rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    limits: {
      perIpDaily: Number(process.env.PER_IP_DAILY_LIMIT || 3),
      globalDaily: Number(process.env.GLOBAL_DAILY_LIMIT || 30),
    },
  });
}
