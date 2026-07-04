'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Copy,
  Download,
  Eraser,
  Heart,
  History,
  ImageIcon,
  LoaderCircle,
  Maximize2,
  RefreshCcw,
  Search,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
} from 'lucide-react';
import type { AspectRatio, GeneratedArtwork, StylePreset } from '@/lib/types';

const styles: StylePreset[] = ['电商主图', '品牌广告', '极简风', '生活方式', '杂志封面'];
const ratios: AspectRatio[] = ['1:1', '4:3', '3:4', '16:9'];

const promptTemplates = [
  {
    label: '美妆护肤',
    value:
      '一瓶高端护肤精华放在大理石台面上，水滴质感，柔和自然光，干净背景，适合电商主图和品牌广告。',
  },
  {
    label: '食品饮品',
    value:
      '一杯冰拿铁放在木质桌面上，周围有咖啡豆和阳光阴影，暖色调，生活方式摄影，适合社交媒体宣传。',
  },
  {
    label: '数码产品',
    value:
      '一副无线耳机悬浮在深色渐变背景中，蓝色科技光效，高级商业摄影，突出产品质感和未来感。',
  },
  {
    label: '服饰鞋包',
    value:
      '一双白色运动鞋放在极简展台上，干净背景，柔和阴影，产品轮廓清晰，适合电商商品详情页。',
  },
  {
    label: '家居生活',
    value:
      '一盏现代台灯放在温馨客厅角落，柔和暖光，北欧风格，杂志封面构图，突出家居氛围。',
  },
];

const editPresets = [
  '背景换成暖色阳光',
  '改成高级黑金广告风',
  '增加水雾和冷色轮廓光',
  '改为极简白底电商主图',
];

type FilterMode = 'all' | 'favorite';

function formatTime(ms?: number) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export default function ImageWorkbench() {
  const [prompt, setPrompt] = useState(promptTemplates[0].value);
  const [negativePrompt, setNegativePrompt] = useState('文字水印，低清晰度，畸形，重复主体，模糊，过曝，噪点');
  const [style, setStyle] = useState<StylePreset>('电商主图');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [history, setHistory] = useState<GeneratedArtwork[]>([]);
  const [selected, setSelected] = useState<GeneratedArtwork | null>(null);
  const [loading, setLoading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [editInstruction, setEditInstruction] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<GeneratedArtwork | null>(null);

  useEffect(() => {
    loadArtworks();
  }, []);

  async function loadArtworks() {
    try {
      const response = await fetch('/api/artworks', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '作品加载失败');
      const items = (data.items || []) as GeneratedArtwork[];
      setHistory(items);
      setSelected(items[0] ?? null);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : '作品加载失败');
    }
  }

  const filteredHistory = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return history.filter((item) => {
      const favoriteMatched = filter === 'all' || item.isFavorite;
      const queryMatched =
        !keyword ||
        item.prompt.toLowerCase().includes(keyword) ||
        item.style.toLowerCase().includes(keyword) ||
        item.provider?.toLowerCase().includes(keyword);
      return favoriteMatched && queryMatched;
    });
  }, [history, filter, query]);

  const status = useMemo(() => {
    if (loading) return '生成中';
    if (selected?.demo) return '演示模式';
    if (selected) return '真实模型';
    return '就绪';
  }, [selected, loading]);

  async function generate(customPrompt?: string) {
    const finalPrompt = (customPrompt || prompt).trim();
    if (finalPrompt.length < 2) {
      setError('请先输入商品或场景描述。');
      return;
    }

    setLoading(true);
    setError('');
    const startedAt = performance.now();

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: finalPrompt, negativePrompt, style, aspectRatio }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '生成失败');

      const elapsedMs = data.elapsedMs ?? Math.round(performance.now() - startedAt);
      const item = { ...data, elapsedMs } as GeneratedArtwork;
      const next = [item, ...history.filter((old) => old.id !== item.id)].slice(0, 48);
      setHistory(next);
      setSelected(item);
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败');
    } finally {
      setLoading(false);
    }
  }

  async function enhancePrompt() {
    const raw = prompt.trim();
    if (!raw) {
      setError('请先输入需要优化的商品描述。');
      return;
    }

    setEnhancing(true);
    setError('');

    try {
      const response = await fetch('/api/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: raw, style }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Prompt 优化失败');
      setPrompt(data.prompt || raw);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Prompt 优化失败');
    } finally {
      setEnhancing(false);
    }
  }

  async function editAndGenerate() {
    if (!selected) {
      setError('请先选择一张作品再进行二次编辑。');
      return;
    }
    if (!editInstruction.trim()) {
      setError('请输入二次编辑要求。');
      return;
    }

    const editedPrompt = `基于已有商品视觉：${selected.prompt}\n\n二次编辑要求：${editInstruction.trim()}\n\n保持商品主体清晰、商业摄影质感、适合品牌展示和电商使用。`;
    setPrompt(editedPrompt);
    await generate(editedPrompt);
  }

  async function toggleFavorite(item: GeneratedArtwork) {
    const nextValue = !item.isFavorite;
    setHistory((items) => items.map((old) => (old.id === item.id ? { ...old, isFavorite: nextValue } : old)));
    if (selected?.id === item.id) setSelected({ ...selected, isFavorite: nextValue });

    try {
      const response = await fetch('/api/artworks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, isFavorite: nextValue }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '收藏同步失败');
    } catch (e) {
      setError(e instanceof Error ? e.message : '收藏同步失败');
      await loadArtworks();
    }
  }

  async function deleteArtwork(item: GeneratedArtwork) {
    const next = history.filter((old) => old.id !== item.id);
    setHistory(next);
    if (selected?.id === item.id) setSelected(next[0] ?? null);

    try {
      const response = await fetch(`/api/artworks?id=${item.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '删除失败');
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
      await loadArtworks();
    }
  }

  function copyPrompt(text: string) {
    navigator.clipboard.writeText(text);
  }

  function download(item: GeneratedArtwork) {
    const anchor = document.createElement('a');
    anchor.href = item.imageUrl;
    anchor.download = `visioncraft-${item.id}.png`;
    anchor.click();
  }

  function applyTemplate(value: string) {
    setPrompt(value);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <WandSparkles size={21} />
          </span>
          <div>
            <strong>VisionCraft AI</strong>
            <small>AI 商品视觉生成平台</small>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="model-pill">Doubao Seedream</div>
          <div className="status">
            <span />
            {status}
          </div>
        </div>
      </header>

      <section className="hero compact-hero">
        <div>
          <div className="eyebrow">
            <Sparkles size={15} /> AI PRODUCT VISUAL STUDIO
          </div>
          <h1>
            AI 生成商品主图，
            <br />
            <em>让营销设计效率提升 10 倍</em>
          </h1>
          <p>
            面向电商、品牌营销和内容创作者的 AI 商品视觉工作台。支持 Prompt 增强、商业风格预设、
            二次编辑、作品收藏和数据库持久化。
          </p>
        </div>
        <div className="metrics">
          <div>
            <b>5</b>
            <span>商业风格</span>
          </div>
          <div>
            <b>4</b>
            <span>常用画幅</span>
          </div>
          <div>
            <b>{history.length}</b>
            <span>作品记录</span>
          </div>
        </div>
      </section>

      <section className="workspace pro-workspace">
        <aside className="panel controls">
          <div className="panel-title sticky-title">
            <span>01</span>
            <div>
              <h2>创作控制台</h2>
              <p>输入商品描述，优化 Prompt 并生成图片</p>
            </div>
          </div>

          <label>Prompt 模板</label>
          <div className="template-grid">
            {promptTemplates.map((item) => (
              <button key={item.label} onClick={() => applyTemplate(item.value)}>
                {item.label}
              </button>
            ))}
          </div>

          <label>商品 / 场景描述</label>
          <div className="prompt-box">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={1600}
              placeholder="例如：一瓶高端香水放在黑色岩石上，周围有薄雾和冷色轮廓光……"
            />
            <div className="prompt-footer">
              <span>{prompt.length} / 1600</span>
              <button onClick={enhancePrompt} disabled={enhancing}>
                {enhancing ? <LoaderCircle className="spin" /> : <Sparkles size={14} />}
                AI 优化 Prompt
              </button>
            </div>
          </div>

          <label>负面提示词</label>
          <textarea
            className="negative-input"
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            placeholder="不希望出现的内容，例如：水印、模糊、低清晰度……"
          />

          <label>视觉风格</label>
          <div className="choice-grid">
            {styles.map((item) => (
              <button className={style === item ? 'active' : ''} key={item} onClick={() => setStyle(item)}>
                {item}
              </button>
            ))}
          </div>

          <label>画面比例</label>
          <div className="ratio-grid">
            {ratios.map((item) => (
              <button className={aspectRatio === item ? 'active' : ''} key={item} onClick={() => setAspectRatio(item)}>
                <i className={`ratio r-${item.replace(':', '-')}`} />
                {item}
              </button>
            ))}
          </div>

          <button className="generate" disabled={loading} onClick={() => generate()}>
            {loading ? (
              <>
                <LoaderCircle className="spin" />
                正在生成商业视觉
              </>
            ) : (
              <>
                <Sparkles />
                生成商品图
              </>
            )}
          </button>

          {error && (
            <div className="error">
              <strong>提示：</strong>
              {error}
            </div>
          )}
        </aside>

        <section className="panel canvas-panel">
          <div className="panel-title">
            <span>02</span>
            <div>
              <h2>作品预览</h2>
              <p>{selected ? `${selected.provider} · ${selected.model}` : '生成结果将在这里显示'}</p>
            </div>
          </div>

          <div className={`canvas pro-canvas ratio-${selected?.aspectRatio?.replace(':', '-') || aspectRatio.replace(':', '-')}`}>
            {loading ? (
              <div className="empty premium-empty">
                <LoaderCircle className="spin big" />
                <h3>正在生成商品视觉</h3>
                <p>模型正在解析商品主体、光线、构图和商业场景。</p>
              </div>
            ) : selected ? (
              <>
                <img src={selected.imageUrl} alt={selected.prompt} />
                {selected.demo && <span className="demo-badge">DEMO</span>}
                <div className="image-toolbar">
                  <button onClick={() => toggleFavorite(selected)} className={selected.isFavorite ? 'is-favorite' : ''}>
                    <Heart size={16} fill={selected.isFavorite ? 'currentColor' : 'none'} />
                    收藏
                  </button>
                  <button onClick={() => setPreview(selected)}>
                    <Maximize2 size={16} />
                    预览
                  </button>
                  <button onClick={() => download(selected)}>
                    <Download size={16} />
                    下载
                  </button>
                </div>
              </>
            ) : (
              <div className="empty premium-empty">
                <span>
                  <ImageIcon />
                </span>
                <h3>等待生成第一张商品图</h3>
                <p>生成后可收藏、下载、二次编辑，并保存到 Supabase 数据库。</p>
              </div>
            )}
          </div>

          {selected && (
            <div className="inspector">
              <div className="inspector-card prompt-card">
                <span>Prompt</span>
                <p>{selected.prompt}</p>
                <div className="meta-actions">
                  <button onClick={() => copyPrompt(selected.prompt)}>
                    <Copy size={14} />
                    复制
                  </button>
                  <button onClick={() => setPrompt(selected.prompt)}>
                    <RefreshCcw size={14} />
                    再次使用
                  </button>
                </div>
              </div>
              <div className="inspector-card">
                <span>参数</span>
                <p>
                  {selected.style} · {selected.aspectRatio}
                </p>
              </div>
              <div className="inspector-card">
                <span>耗时</span>
                <p>{formatTime(selected.elapsedMs)}</p>
              </div>
            </div>
          )}

          <div className="edit-panel">
            <div>
              <h3>AI 二次编辑</h3>
              <p>基于当前作品继续调整背景、光线、风格或构图。</p>
            </div>
            <div className="edit-presets">
              {editPresets.map((item) => (
                <button key={item} onClick={() => setEditInstruction(item)}>
                  {item}
                </button>
              ))}
            </div>
            <div className="edit-row">
              <input
                value={editInstruction}
                onChange={(e) => setEditInstruction(e.target.value)}
                placeholder="例如：背景换成暖色阳光，保留商品主体"
              />
              <button disabled={!selected || loading} onClick={editAndGenerate}>
                <WandSparkles size={16} />
                编辑生成
              </button>
            </div>
          </div>
        </section>
      </section>

      <section className="history-section">
        <div className="section-heading history-heading">
          <div>
            <span>
              <History size={18} />
            </span>
            <h2>作品库</h2>
            <b>{filteredHistory.length}</b>
          </div>

          <div className="history-tools">
            <div className="search-box">
              <Search size={15} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索 Prompt / 风格" />
            </div>
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
              全部
            </button>
            <button className={filter === 'favorite' ? 'active' : ''} onClick={() => setFilter('favorite')}>
              收藏
            </button>
            <button onClick={loadArtworks}>
              <RefreshCcw size={15} />
              刷新
            </button>
          </div>
        </div>

        {filteredHistory.length ? (
          <div className="gallery pro-gallery">
            {filteredHistory.map((item) => (
              <article key={item.id} className={selected?.id === item.id ? 'selected' : ''}>
                <button className="thumb" onClick={() => setSelected(item)}>
                  <img src={item.imageUrl} alt={item.prompt} />
                </button>
                <div className="card-body">
                  <strong>{item.style}</strong>
                  <span>{item.aspectRatio} · {formatTime(item.elapsedMs)}</span>
                  <p>{item.prompt}</p>
                  <div className="card-actions">
                    <button onClick={() => toggleFavorite(item)} className={item.isFavorite ? 'is-favorite' : ''}>
                      <Heart size={14} fill={item.isFavorite ? 'currentColor' : 'none'} />
                    </button>
                    <button onClick={() => setPrompt(item.prompt)}>
                      <RefreshCcw size={14} />
                    </button>
                    <button onClick={() => copyPrompt(item.prompt)}>
                      <Copy size={14} />
                    </button>
                    <button onClick={() => deleteArtwork(item)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="history-empty">
            <Eraser size={20} />
            暂无匹配作品。生成后的图片会自动进入作品库。
          </div>
        )}
      </section>

      <footer>
        VisionCraft AI · Next.js · Supabase · Doubao Seedream · Portfolio Edition
      </footer>

      {preview && (
        <div className="modal-backdrop" onClick={() => setPreview(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setPreview(null)}>
              <X size={18} />
            </button>
            <img src={preview.imageUrl} alt={preview.prompt} />
          </div>
        </div>
      )}
    </main>
  );
}
