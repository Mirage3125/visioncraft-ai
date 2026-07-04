import type { AspectRatio, StylePreset } from './types';

const sizes: Record<AspectRatio, [number, number]> = {
  '1:1': [1024, 1024],
  '4:3': [1200, 900],
  '3:4': [900, 1200],
  '16:9': [1280, 720]
};

function escapeXml(input: string) {
  return input.replace(/[<>&'\"]/g, char => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
  }[char] ?? char));
}

export function createDemoImage(prompt: string, style: StylePreset, ratio: AspectRatio) {
  const [width, height] = sizes[ratio];
  const safePrompt = escapeXml(prompt.slice(0, 84));
  const safeStyle = escapeXml(style);
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#090b15"/>
        <stop offset="0.48" stop-color="#312e81"/>
        <stop offset="1" stop-color="#0e7490"/>
      </linearGradient>
      <radialGradient id="glow"><stop stop-color="#c4b5fd" stop-opacity=".72"/><stop offset="1" stop-color="#c4b5fd" stop-opacity="0"/></radialGradient>
      <filter id="blur"><feGaussianBlur stdDeviation="36"/></filter>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <circle cx="${width * .2}" cy="${height * .22}" r="${Math.min(width,height) * .22}" fill="url(#glow)" filter="url(#blur)"/>
    <circle cx="${width * .78}" cy="${height * .72}" r="${Math.min(width,height) * .3}" fill="#22d3ee" fill-opacity=".18" filter="url(#blur)"/>
    <g fill="none" stroke="#fff" stroke-opacity=".18">
      <path d="M0 ${height*.72} Q ${width*.28} ${height*.42}, ${width*.52} ${height*.67} T ${width} ${height*.43}" stroke-width="3"/>
      <path d="M0 ${height*.81} Q ${width*.34} ${height*.55}, ${width*.62} ${height*.78} T ${width} ${height*.58}"/>
    </g>
    <rect x="${width*.08}" y="${height*.12}" width="${width*.84}" height="${height*.76}" rx="42" fill="#070812" fill-opacity=".44" stroke="#fff" stroke-opacity=".18"/>
    <text x="${width*.13}" y="${height*.25}" fill="#a5f3fc" font-family="Arial, sans-serif" font-size="${Math.max(22,width*.025)}" letter-spacing="5">PIXELFORGE · DEMO</text>
    <text x="${width*.13}" y="${height*.38}" fill="white" font-family="Arial, sans-serif" font-weight="700" font-size="${Math.max(38,width*.052)}">${safeStyle}</text>
    <foreignObject x="${width*.13}" y="${height*.45}" width="${width*.7}" height="${height*.25}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,sans-serif;color:#e2e8f0;font-size:${Math.max(24,width*.029)}px;line-height:1.45;font-weight:500">${safePrompt}</div>
    </foreignObject>
    <text x="${width*.13}" y="${height*.8}" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="${Math.max(18,width*.018)}">配置 OPENAI_API_KEY 后生成真实 AI 图片</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
