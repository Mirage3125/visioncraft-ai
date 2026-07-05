import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'artworks';

if (!url || !key) {
  throw new Error('缺少 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY。');
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function parseDataUrl(dataUrl) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error('invalid data url');
  const type = match[1] || 'image/png';
  const bytes = match[2]
    ? Buffer.from(match[3], 'base64')
    : Buffer.from(decodeURIComponent(match[3]), 'utf8');
  return { bytes, type };
}

function extension(type) {
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';
  if (type.includes('webp')) return 'webp';
  if (type.includes('svg')) return 'svg';
  return 'png';
}

async function loadImage(source) {
  if (source.startsWith('data:')) return parseDataUrl(source);
  const response = await fetch(source, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    type: response.headers.get('content-type') || 'image/png',
  };
}

const { data: rows, error } = await supabase
  .from('artworks')
  .select('id,image_url,created_at,storage_path')
  .is('storage_path', null)
  .order('created_at', { ascending: true });

if (error) throw error;
console.log(`Found ${rows.length} legacy artworks.`);

let migrated = 0;
let failed = 0;

for (const row of rows) {
  try {
    const image = await loadImage(row.image_url);
    const date = new Date(row.created_at);
    const path = [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, '0'),
      String(date.getUTCDate()).padStart(2, '0'),
      `${row.id}.${extension(image.type)}`,
    ].join('/');

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, image.bytes, {
        contentType: image.type,
        cacheControl: '31536000',
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    const { error: updateError } = await supabase
      .from('artworks')
      .update({ image_url: data.publicUrl, storage_path: path })
      .eq('id', row.id);
    if (updateError) throw updateError;

    migrated += 1;
    console.log(`✓ ${row.id}`);
  } catch (migrationError) {
    failed += 1;
    console.error(`✗ ${row.id}:`, migrationError.message || migrationError);
  }
}

console.log(`Done. migrated=${migrated}, failed=${failed}`);
