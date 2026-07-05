import 'server-only';
import { requireSupabaseAdmin } from '@/lib/supabase-server';

const DEFAULT_BUCKET = 'artworks';
const DEFAULT_MAX_BYTES = 15 * 1024 * 1024;

type ImagePayload = {
  bytes: Uint8Array;
  contentType: string;
};

function extensionFor(contentType: string) {
  const normalized = contentType.toLowerCase().split(';')[0].trim();
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return 'jpg';
  if (normalized === 'image/webp') return 'webp';
  if (normalized === 'image/svg+xml') return 'svg';
  return 'png';
}

function parseDataUrl(dataUrl: string): ImagePayload {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(dataUrl);
  if (!match) throw new Error('图片 Data URL 格式无效。');

  const contentType = match[1] || 'image/png';
  const isBase64 = Boolean(match[2]);
  const payload = match[3];
  const buffer = isBase64
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8');

  return { bytes: new Uint8Array(buffer), contentType };
}

async function downloadImage(url: string): Promise<ImagePayload> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
    headers: { 'User-Agent': 'VisionCraft-AI/1.0' },
  });

  if (!response.ok) {
    throw new Error(`下载模型图片失败：HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || 'image/png';
  if (!contentType.startsWith('image/')) {
    throw new Error(`模型返回的资源不是图片：${contentType}`);
  }

  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType,
  };
}

async function resolveImage(base64?: string, url?: string): Promise<ImagePayload> {
  if (base64) {
    if (base64.startsWith('data:')) return parseDataUrl(base64);
    return {
      bytes: new Uint8Array(Buffer.from(base64, 'base64')),
      contentType: 'image/png',
    };
  }

  if (url?.startsWith('data:')) return parseDataUrl(url);
  if (url) return downloadImage(url);

  throw new Error('没有可上传的图片数据。');
}

export async function uploadArtworkImage(input: {
  id: string;
  createdAt: string;
  base64?: string;
  url?: string;
}) {
  const supabase = requireSupabaseAdmin();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET;
  const maxBytes = Number(process.env.MAX_ARTWORK_BYTES || DEFAULT_MAX_BYTES);
  const image = await resolveImage(input.base64, input.url);

  if (image.bytes.byteLength === 0) throw new Error('生成图片为空。');
  if (image.bytes.byteLength > maxBytes) {
    throw new Error(`生成图片超过上传限制：${image.bytes.byteLength} bytes。`);
  }

  const date = new Date(input.createdAt);
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const extension = extensionFor(image.contentType);
  const storagePath = `${year}/${month}/${day}/${input.id}.${extension}`;

  const { error } = await supabase.storage.from(bucket).upload(storagePath, image.bytes, {
    contentType: image.contentType,
    cacheControl: '31536000',
    upsert: false,
  });

  if (error) throw new Error(`上传 Supabase Storage 失败：${error.message}`);

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  if (!data.publicUrl) {
    await supabase.storage.from(bucket).remove([storagePath]);
    throw new Error('无法生成 Supabase Storage 公共地址。');
  }

  return {
    imageUrl: data.publicUrl,
    storagePath,
    contentType: image.contentType,
    sizeBytes: image.bytes.byteLength,
  };
}

export async function deleteArtworkImage(storagePath?: string | null) {
  if (!storagePath) return;

  const supabase = requireSupabaseAdmin();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET;
  const { error } = await supabase.storage.from(bucket).remove([storagePath]);

  if (error) throw new Error(`删除 Storage 文件失败：${error.message}`);
}
