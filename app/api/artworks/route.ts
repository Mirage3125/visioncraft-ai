import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET() {
  console.log('SUPABASE ENV:', {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  hasKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
});
  if (!supabase) {
    return NextResponse.json({ items: [] });
  }

  const { data, error } = await supabase
    .from('artworks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(24);

  if (error) {
    console.error('Load artworks error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = data.map((item) => ({
    id: item.id,
    prompt: item.prompt,
    style: item.style,
    aspectRatio: item.aspect_ratio,
    imageUrl: item.image_url,
    provider: item.provider,
    model: item.model,
    demo: item.demo,
    isFavorite: item.is_favorite,
    elapsedMs: item.elapsed_ms,
    createdAt: item.created_at,
  }));

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase 未配置。' }, { status: 500 });
  }

  const body = await request.json();

  const { data, error } = await supabase
    .from('artworks')
    .insert({
      prompt: body.prompt,
      style: body.style,
      aspect_ratio: body.aspectRatio,
      image_url: body.imageUrl,
      provider: body.provider,
      model: body.model,
      demo: body.demo ?? false,
      is_favorite: body.isFavorite ?? false,
      elapsed_ms: body.elapsedMs ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('Create artwork error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    item: {
      id: data.id,
      prompt: data.prompt,
      style: data.style,
      aspectRatio: data.aspect_ratio,
      imageUrl: data.image_url,
      provider: data.provider,
      model: data.model,
      demo: data.demo,
      isFavorite: data.is_favorite,
      elapsedMs: data.elapsed_ms,
      createdAt: data.created_at,
    },
  });
}

export async function PATCH(request: Request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase 未配置。' }, { status: 500 });
  }

  const body = await request.json();

  const { id, isFavorite } = body;

  if (!id) {
    return NextResponse.json({ error: '缺少作品 ID。' }, { status: 400 });
  }

  const { error } = await supabase
    .from('artworks')
    .update({ is_favorite: isFavorite })
    .eq('id', id);

  if (error) {
    console.error('Update artwork error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase 未配置。' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: '缺少作品 ID。' }, { status: 400 });
  }

  const { error } = await supabase
    .from('artworks')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Delete artwork error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}