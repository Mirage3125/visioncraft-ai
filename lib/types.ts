export type AspectRatio = '1:1' | '4:3' | '3:4' | '16:9';
export type StylePreset = '电商主图' | '品牌广告' | '极简风' | '生活方式' | '杂志封面';

export interface GenerateRequest {
  prompt: string;
  style: StylePreset;
  aspectRatio: AspectRatio;
}

export interface GeneratedArtwork extends GenerateRequest {
  id: string;
  imageUrl: string;
  createdAt: string;
  provider: string;
  model: string;
  demo: boolean;
}
