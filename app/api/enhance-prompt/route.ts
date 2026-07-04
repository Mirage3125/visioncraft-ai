import { NextResponse } from 'next/server';

const validRatios = new Set(['1:1', '4:3', '3:4', '16:9']);
const validStyles = new Set(['电商主图', '品牌广告', '极简风', '生活方式', '杂志封面']);

const styleGuides: Record<string, string> = {
  电商主图: '纯净背景，商品居中，主体完整，细节清晰，适合电商平台主图，真实商业摄影',
  品牌广告: '高级品牌广告构图，强光影层次，精致布景，突出产品卖点，适合官网首屏视觉',
  极简风: '极简构图，留白充足，低饱和配色，干净背景，现代设计感，突出商品轮廓',
  生活方式: '真实生活场景，自然光线，温暖氛围，浅景深，突出使用场景和情绪价值',
  杂志封面: '杂志大片构图，高级布景，戏剧化光影，时尚视觉，适合封面级商业海报'
};

const ratioGuides: Record<string, string> = {
  '1:1': '方形构图，适合商品主图和社交媒体封面',
  '4:3': '横向商业摄影构图，适合详情页和展示图',
  '3:4': '竖向海报构图，适合移动端种草图和广告图',
  '16:9': '宽屏横幅构图，适合官网首屏、Banner 和品牌宣传图'
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawPrompt = String(body.prompt ?? '').trim();
    const style = String(body.style ?? '电商主图');
    const aspectRatio = String(body.aspectRatio ?? '1:1');

    if (!rawPrompt || rawPrompt.length > 1000) {
      return NextResponse.json({ error: 'Prompt 长度需在 1 到 1000 个字符之间。' }, { status: 400 });
    }

    if (!validStyles.has(style) || !validRatios.has(aspectRatio)) {
      return NextResponse.json({ error: 'Prompt 优化参数不合法。' }, { status: 400 });
    }

    const prompt = [
      rawPrompt,
      styleGuides[style],
      ratioGuides[aspectRatio],
      '高质量商业视觉，产品材质真实，光影自然，画面干净，无文字水印，无变形，细节丰富，8k quality'
    ].join('，');

    return NextResponse.json({ prompt });
  } catch (error) {
    console.error('Enhance prompt error:', error);
    return NextResponse.json({ error: 'Prompt 优化失败。' }, { status: 500 });
  }
}
