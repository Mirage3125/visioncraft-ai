import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PixelForge AI | 智能生图工作台',
  description: '面向营销、电商和内容创作的多场景 AI 图片生成工作台'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
