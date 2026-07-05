import { NextResponse } from 'next/server';
import { createDemoImage } from '@/lib/demo-image';
import { uploadArtworkImage, deleteArtworkImage } from '@/lib/artwork-storage';
import { consumeGenerationQuota, refundGenerationQuota } from '@/lib/rate-limit';
import { requireSupabaseAdmin } from '@/lib/supabase-server';
import { getVisitorSession, withVisitorCookie } from '@/lib/visitor-session';
import type { GenerateRequest } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

type GenerateBody = GenerateRequest & {
  negativePrompt?: string;
};

const ARK_BASE_URL = process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
const validRatios = new Set(['1:1', '4:3', '3:4', '16:9']);
const validStyles = new Set(['电商主图', '品牌广告', '极简风', '生活方式', '杂志封面']);

function getSize(aspectRatio: string) {
  switch (aspectRatio) {
    case '4:3':
      return '1536x1024';
    case '3:4':
      return '1024x1536';
    case '16:9':
      return '1536x864';
    default:
      return '1024x1024';
  }
}

function buildEnhancedPrompt(prompt: string, style: string, negativePrompt?: string) {
  const styleGuide: Record<string, string> = {
    电商主图: '纯净背景，商品居中，主体完整，产品轮廓明确，适合电商平台主图',
    品牌广告: '高级品牌广告视觉，精致布景，层次丰富，突出商品卖点',
    极简风: '极简留白，低饱和配色，现代设计感，画面干净',
    生活方式: '真实生活场景，自然光线，温暖氛围，浅景深',
    杂志封面: '杂志大片构图，戏剧化光影，时尚高级，封面级视觉',
  };

  const negative = negativePrompt?.trim()
    ? `避免出现：${negativePrompt.trim()}。`
    : '避免出现：文字水印、低清晰度、商品畸形、重复主体、杂乱背景。';

  return `${prompt}。视觉风格：${style}。${styleGuide[style] || ''}。高质量商业摄影构图，商品材质真实，主体清晰，细节丰富，适合品牌营销和电商使用。${negative}`;
}

function demoResponse(
  body: GenerateBody,
  prompt: string,
  session: ReturnType<typeof getVisitorSession>,
  notice?: string
) {
  return withVisitorCookie(
    NextResponse.json({
      id: crypto.randomUUID(),
      imageUrl: createDemoImage(prompt, body.style, body.aspectRatio),
      createdAt: new Date().toISOString(),
      provider: 'VisionCraft Demo',
      model: 'Portfolio Mock',
      demo: true,
      isFavorite: false,
      elapsedMs: 0,
      notice,
      ...body,
    }),
    session
  );
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const session = getVisitorSession(request);
  let quotaScope: string | undefined;
  let modelSucceeded = false;

  try {
    const body = (await request.json()) as GenerateBody;
    const prompt = body.prompt?.trim();

    if (!prompt || prompt.length < 2 || prompt.length > 2000) {
      return withVisitorCookie(
        NextResponse.json(
          { error: 'Prompt 长度需在 2 到 2000 个字符之间。' },
          { status: 400 }
        ),
        session
      );
    }

    if (!validRatios.has(body.aspectRatio) || !validStyles.has(body.style)) {
      return withVisitorCookie(
        NextResponse.json({ error: '生成参数不合法。' }, { status: 400 }),
        session
      );
    }

    const apiKey = process.env.ARK_API_KEY;
    const model = process.env.ARK_IMAGE_MODEL;
    const realGenerationEnabled = process.env.ENABLE_REAL_GENERATION === 'true';

    if (!realGenerationEnabled || !apiKey || !model) {
      return demoResponse(
        body,
        prompt,
        session,
        '真实生图未开启，当前返回作品集演示图。'
      );
    }

    // 真实生成必须通过服务端 Supabase 客户端完成额度检查、Storage 上传和数据库写入。
    const supabase = requireSupabaseAdmin();
    const quota = await consumeGenerationQuota(request);
    quotaScope = quota.ipScope;

    if (!quota.allowed) {
      const reason = quota.reason === 'global' ? '全站' : '当前网络';
      return demoResponse(
        body,
        prompt,
        session,
        `${reason}今日真实生成额度已用完，已自动切换到演示模式。`
      );
    }

    const response = await fetch(`${ARK_BASE_URL}/images/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt: buildEnhancedPrompt(prompt, body.style, body.negativePrompt),
        size: getSize(body.aspectRatio),
        response_format: 'b64_json',
      }),
      signal: AbortSignal.timeout(90_000),
    });

    const rawText = await response.text();
    let result: any;

    try {
      result = JSON.parse(rawText);
    } catch {
      await refundGenerationQuota(quotaScope);
      console.error('Ark raw response:', rawText);
      return withVisitorCookie(
        NextResponse.json(
          { error: `火山方舟返回的不是 JSON：${rawText.slice(0, 180)}` },
          { status: 502 }
        ),
        session
      );
    }

    if (!response.ok) {
      await refundGenerationQuota(quotaScope);
      console.error('Ark image generation error:', result);
      return withVisitorCookie(
        NextResponse.json(
          {
            error:
              result?.error?.message ||
              result?.message ||
              '火山方舟图片生成失败，请检查模型权限或额度。',
          },
          { status: response.status }
        ),
        session
      );
    }

    const base64 = result?.data?.[0]?.b64_json;
    const temporaryUrl = result?.data?.[0]?.url;

    if (!base64 && !temporaryUrl) {
      await refundGenerationQuota(quotaScope);
      return withVisitorCookie(
        NextResponse.json(
          { error: '火山方舟返回结果异常，未找到图片数据。' },
          { status: 502 }
        ),
        session
      );
    }

    modelSucceeded = true;

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const storedImage = await uploadArtworkImage({
      id,
      createdAt,
      base64,
      url: temporaryUrl,
    });

    const elapsedMs = Date.now() - startedAt;
    const { data, error } = await supabase
      .from('artworks')
      .insert({
        id,
        owner_hash: session.ownerHash,
        prompt,
        negative_prompt: body.negativePrompt?.trim() || null,
        style: body.style,
        aspect_ratio: body.aspectRatio,
        image_url: storedImage.imageUrl,
        storage_path: storedImage.storagePath,
        provider: 'Doubao Seedream',
        model,
        demo: false,
        is_favorite: false,
        elapsed_ms: elapsedMs,
        created_at: createdAt,
      })
      .select('*')
      .single();

    if (error) {
      await deleteArtworkImage(storedImage.storagePath).catch(console.error);
      throw new Error(`保存作品记录失败：${error.message}`);
    }

    const responseBody = NextResponse.json({
      id: data.id,
      prompt: data.prompt,
      negativePrompt: data.negative_prompt ?? undefined,
      style: data.style,
      aspectRatio: data.aspect_ratio,
      imageUrl: data.image_url,
      provider: data.provider,
      model: data.model,
      demo: Boolean(data.demo),
      isFavorite: Boolean(data.is_favorite),
      elapsedMs: data.elapsed_ms,
      createdAt: data.created_at,
      storage: 'supabase',
    });

    responseBody.headers.set('Cache-Control', 'no-store');
    responseBody.headers.set('X-RateLimit-Remaining-IP', String(quota.ipRemaining));
    responseBody.headers.set('X-RateLimit-Remaining-Global', String(quota.globalRemaining));
    return withVisitorCookie(responseBody, session);
  } catch (error) {
    if (quotaScope && !modelSucceeded) {
      await refundGenerationQuota(quotaScope);
    }

    console.error('Generate image error:', error);
    const message = error instanceof Error ? error.message : '未知错误';

    return withVisitorCookie(
      NextResponse.json({ error: `图片生成失败：${message}` }, { status: 500 }),
      session
    );
  }
}
