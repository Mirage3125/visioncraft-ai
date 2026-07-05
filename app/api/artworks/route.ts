import { NextResponse } from 'next/server';
import { deleteArtworkImage } from '@/lib/artwork-storage';
import { requireSupabaseAdmin } from '@/lib/supabase-server';
import { getVisitorSession, withVisitorCookie } from '@/lib/visitor-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ArtworkRow = {
  id: string;
  prompt: string;
  negative_prompt: string | null;
  style: string;
  aspect_ratio: string;
  image_url: string;
  storage_path: string | null;
  provider: string | null;
  model: string | null;
  demo: boolean | null;
  is_favorite: boolean | null;
  elapsed_ms: number | null;
  created_at: string;
};

function toClient(row: ArtworkRow) {
  return {
    id: row.id,
    prompt: row.prompt,
    negativePrompt: row.negative_prompt ?? undefined,
    style: row.style,
    aspectRatio: row.aspect_ratio,
    imageUrl: row.image_url,
    provider: row.provider ?? 'Unknown',
    model: row.model ?? 'Unknown',
    demo: Boolean(row.demo),
    isFavorite: Boolean(row.is_favorite),
    elapsedMs: row.elapsed_ms ?? undefined,
    createdAt: row.created_at,
  };
}

export async function GET(request: Request) {
  const session = getVisitorSession(request);

  try {
    const supabase = requireSupabaseAdmin();

    if (process.env.CLAIM_LEGACY_ARTWORKS === 'true') {
      const { error: claimError } = await supabase
        .from('artworks')
        .update({ owner_hash: session.ownerHash })
        .is('owner_hash', null);

      if (claimError) console.error('Claim legacy artworks error:', claimError);
    }

    const { data, error } = await supabase
      .from('artworks')
      .select(
        'id,prompt,negative_prompt,style,aspect_ratio,image_url,storage_path,provider,model,demo,is_favorite,elapsed_ms,created_at'
      )
      .eq('owner_hash', session.ownerHash)
      .order('created_at', { ascending: false })
      .limit(60);

    if (error) throw new Error(error.message);

    const response = NextResponse.json({ items: (data || []).map(toClient) });
    response.headers.set('Cache-Control', 'no-store');
    return withVisitorCookie(response, session);
  } catch (error) {
    const message = error instanceof Error ? error.message : '读取作品失败';
    return withVisitorCookie(
      NextResponse.json({ error: message, items: [] }, { status: 500 }),
      session
    );
  }
}

export async function PATCH(request: Request) {
  const session = getVisitorSession(request);

  try {
    const supabase = requireSupabaseAdmin();
    const body = await request.json();
    const id = String(body.id || '');

    if (!id) {
      return withVisitorCookie(
        NextResponse.json({ error: '缺少作品 ID。' }, { status: 400 }),
        session
      );
    }

    const { data, error } = await supabase
      .from('artworks')
      .update({ is_favorite: Boolean(body.isFavorite) })
      .eq('id', id)
      .eq('owner_hash', session.ownerHash)
      .select(
        'id,prompt,negative_prompt,style,aspect_ratio,image_url,storage_path,provider,model,demo,is_favorite,elapsed_ms,created_at'
      )
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) {
      return withVisitorCookie(
        NextResponse.json({ error: '作品不存在或无权操作。' }, { status: 404 }),
        session
      );
    }

    return withVisitorCookie(NextResponse.json({ item: toClient(data) }), session);
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新收藏失败';
    return withVisitorCookie(
      NextResponse.json({ error: message }, { status: 500 }),
      session
    );
  }
}

export async function DELETE(request: Request) {
  const session = getVisitorSession(request);

  try {
    const supabase = requireSupabaseAdmin();
    const id = new URL(request.url).searchParams.get('id');

    if (!id) {
      return withVisitorCookie(
        NextResponse.json({ error: '缺少作品 ID。' }, { status: 400 }),
        session
      );
    }

    const { data: row, error: findError } = await supabase
      .from('artworks')
      .select('id,storage_path')
      .eq('id', id)
      .eq('owner_hash', session.ownerHash)
      .maybeSingle();

    if (findError) throw new Error(findError.message);
    if (!row) {
      return withVisitorCookie(
        NextResponse.json({ error: '作品不存在或无权操作。' }, { status: 404 }),
        session
      );
    }

    const { error: deleteError } = await supabase
      .from('artworks')
      .delete()
      .eq('id', id)
      .eq('owner_hash', session.ownerHash);

    if (deleteError) throw new Error(deleteError.message);

    // 数据库已经删除成功。Storage 删除失败时记录日志，避免影响前端操作。
    await deleteArtworkImage(row.storage_path).catch((error) => {
      console.error('Delete artwork storage error:', error);
    });

    return withVisitorCookie(NextResponse.json({ ok: true }), session);
  } catch (error) {
    const message = error instanceof Error ? error.message : '删除作品失败';
    return withVisitorCookie(
      NextResponse.json({ error: message }, { status: 500 }),
      session
    );
  }
}
