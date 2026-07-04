import { NextResponse } from 'next/server';
import { createDemoImage } from '@/lib/demo-image';
import { supabase } from '@/lib/supabase';
import type { GenerateRequest } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ARK_API_KEY = process.env.ARK_API_KEY;
const ARK_IMAGE_MODEL = process.env.ARK_IMAGE_MODEL;
const ARK_BASE_URL = process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';

const validRatios = new Set(['1:1', '4:3', '3:4', '16:9']);
const validStyles = new Set(['电商主图', '品牌广告', '极简风', '生活方式', '杂志封面']);

function getSize(aspectRatio: string): string {
  switch (aspectRatio) {
    case '1:1':
      return '1024x1024';
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
  const commercialGuide =
    '高质量商业摄影构图，商品主体清晰，材质真实，光影自然，细节丰富，适合电商、品牌营销和社交媒体投放';

  const styleGuide: Record<string, string> = {
    电商主图: '纯净背景，主体完整，产品轮廓明确，适合电商主图',
    品牌广告: '高级品牌广告视觉，精致布景，强氛围感，突出产品卖点',
    极简风: '极简留白，低饱和配色，现代感，画面干净',
    生活方式: '自然生活场景，柔和自然光，真实使用氛围，浅景深',
    杂志封面: '杂志大片质感，封面构图，戏剧化光影，时尚高级'
  };

  const negative = negativePrompt?.trim()
    ? `避免出现：${negativePrompt.trim()}。`
    : '避免出现：文字水印、低清晰度、商品畸形、过度变形、杂乱背景。';

  return `${prompt}。视觉风格：${style}。${styleGuide[style] ?? ''}。${commercialGuide}。${negative}`;
}

async function saveArtwork(item: {
  id: string;
  prompt: string;
  style: string;
  aspectRatio: string;
  imageUrl: string;
  provider: string;
  model: string;
  demo: boolean;
  elapsedMs: number;
  createdAt: string;
}) {
  if (!supabase) return item;

  const { data, error } = await supabase
    .from('artworks')
    .insert({
      id: item.id,
      prompt: item.prompt,
      style: item.style,
      aspect_ratio: item.aspectRatio,
      image_url: item.imageUrl,
      provider: item.provider,
      model: item.model,
      demo: item.demo,
      is_favorite: false,
      elapsed_ms: item.elapsedMs,
      created_at: item.createdAt,
    })
    .select('*')
    .single();

  if (error) {
    console.error('Save artwork error:', error);
    return item;
  }

  return {
    id: data.id,
    prompt: data.prompt,
    style: data.style,
    aspectRatio: data.aspect_ratio,
    imageUrl: data.image_url,
    provider: data.provider,
    model: data.model,
    demo: Boolean(data.demo),
    isFavorite: Boolean(data.is_favorite),
    elapsedMs: data.elapsed_ms,
    createdAt: data.created_at,
  };
}

export async function POST(request: Request) {
  const start = Date.now();

  try {
    const body = (await request.json()) as GenerateRequest;
    const prompt = body.prompt?.trim();

    if (!prompt || prompt.length < 3 || prompt.length > 1000) {
      return NextResponse.json(
        { error: '提示词长度需在 3 到 1000 个字符之间。' },
        { status: 400 }
      );
    }

    if (!validRatios.has(body.aspectRatio) || !validStyles.has(body.style)) {
      return NextResponse.json(
        { error: '生成参数不合法。' },
        { status: 400 }
      );
    }

    const enhancedPrompt = buildEnhancedPrompt(prompt, body.style, (body as any).negativePrompt);
    const createdAt = new Date().toISOString();

    if (!ARK_API_KEY || !ARK_IMAGE_MODEL) {
      const item = await saveArtwork({
        id: crypto.randomUUID(),
        imageUrl: createDemoImage(prompt, body.style, body.aspectRatio),
        createdAt,
        provider: 'Doubao Seedream Demo',
        model: 'Portfolio Mock',
        demo: true,
        elapsedMs: Date.now() - start,
        ...body,
      });

      return NextResponse.json(item);
    }

    const size = getSize(body.aspectRatio);

    const response = await fetch(`${ARK_BASE_URL}/images/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ARK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ARK_IMAGE_MODEL,
        prompt: enhancedPrompt,
        size,
        response_format: 'b64_json',
      }),
    });

    const text = await response.text();

    let result: any;
    try {
      result = JSON.parse(text);
    } catch {
      console.error('Ark raw response:', text);
      return NextResponse.json(
        { error: `火山方舟返回的不是 JSON：${text.slice(0, 200)}` },
        { status: 500 }
      );
    }

    if (!response.ok) {
      console.error('Ark image generation error:', result);

      return NextResponse.json(
        {
          error:
            result?.error?.message ||
            result?.message ||
            '火山方舟图片生成失败，请检查 API Key、Endpoint ID 或模型权限。',
        },
        { status: response.status }
      );
    }

    const base64 = result?.data?.[0]?.b64_json;
    const url = result?.data?.[0]?.url;

    if (!base64 && !url) {
      console.error('Unexpected Ark response:', result);

      return NextResponse.json(
        { error: '火山方舟返回结果异常，未找到图片数据。' },
        { status: 500 }
      );
    }

    const item = await saveArtwork({
      id: crypto.randomUUID(),
      imageUrl: base64 ? `data:image/png;base64,${base64}` : url,
      createdAt,
      provider: 'Doubao Seedream',
      model: ARK_IMAGE_MODEL,
      demo: false,
      elapsedMs: Date.now() - start,
      ...body,
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error('Generate image error:', error);

    const message = error instanceof Error ? error.message : '未知错误';

    return NextResponse.json(
      { error: `图片生成失败：${message}` },
      { status: 500 }
    );
  }
}
