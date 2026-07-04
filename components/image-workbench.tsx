'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Copy,
  Download,
  Heart,
  History,
  Brush,
  SlidersHorizontal,
  ImageIcon,
  LoaderCircle,
  Maximize2,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  WandSparkles,
  X
} from 'lucide-react';
import type { AspectRatio, GeneratedArtwork, StylePreset } from '@/lib/types';

type ManagedArtwork = GeneratedArtwork & {
  isFavorite?: boolean;
  elapsedMs?: number;
};

const examples = [
  '一双白色运动鞋放置在现代极简展台上，柔和自然光，电商主图，干净背景，高级质感',
  '高端护肤品放在大理石台面，金色光影，广告摄影，适合品牌官网首屏海报',
  '咖啡豆与咖啡杯组合，暖色调，品牌宣传海报，浅景深，生活方式摄影'
];

const promptTemplates = [
  {
    name: '美妆护肤',
    tag: '自然光 / 高级感',
    prompt: '一套高端护肤品放在白色大理石台面上，水滴、绿植和柔和自然光，干净背景，电商广告摄影，高级质感'
  },
  {
    name: '食品饮品',
    tag: '生活方式 / 暖色调',
    prompt: '一杯冰拿铁放在木质桌面上，旁边有咖啡豆和阳光阴影，暖色调，生活方式摄影，适合品牌宣传图'
  },
  {
    name: '数码产品',
    tag: '科技感 / 深色背景',
    prompt: '一副无线耳机悬浮在深色渐变背景前，科技感灯光，产品细节清晰，电商主图，未来感构图'
  },
  {
    name: '家居用品',
    tag: '舒适氛围 / 空间场景',
    prompt: '一盏现代台灯放在极简卧室床头柜上，暖光照明，柔和阴影，家居品牌宣传图，舒适氛围'
  },
  {
    name: '服饰鞋包',
    tag: '杂志大片 / 品牌广告',
    prompt: '一个黑色皮质手提包放在米色布景中，柔和侧光，杂志大片构图，高端品牌广告摄影'
  }
];



const editPresets = [
  '改成暖色阳光氛围，适合春夏促销海报',
  '背景换成高级灰极简摄影棚，突出商品主体',
  '增加节日礼盒氛围，画面更适合电商活动页',
  '变成杂志封面构图，增加高级品牌感'
];

const styles: StylePreset[] = ['电商主图', '品牌广告', '极简风', '生活方式', '杂志封面'];
const ratios: AspectRatio[] = ['1:1', '4:3', '3:4', '16:9'];

export default function ImageWorkbench() {
  const [prompt, setPrompt] = useState(examples[0]);
  const [negativePrompt, setNegativePrompt] = useState('低清晰度、文字水印、畸形商品、过度变形、杂乱背景');
  const [editInstruction, setEditInstruction] = useState(editPresets[0]);
  const [enhancing, setEnhancing] = useState(false);
  const [style, setStyle] = useState<StylePreset>('电商主图');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [history, setHistory] = useState<ManagedArtwork[]>([]);
  const [selected, setSelected] = useState<ManagedArtwork | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    async function loadArtworks() {
      try {
        const response = await fetch('/api/artworks', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '读取作品失败');
        const items = (data.items ?? []) as ManagedArtwork[];
        setHistory(items);
        setSelected(items[0] ?? null);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : '读取作品失败');
      }
    }

    loadArtworks();
  }, []);

  function persist(items: ManagedArtwork[]) {
    setHistory(items);
  }

  const status = useMemo(() => selected?.demo ? '演示模式' : selected ? '真实模型' : '等待创作', [selected]);
  const favoriteCount = useMemo(() => history.filter(item => item.isFavorite).length, [history]);

  const filteredHistory = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return history.filter(item => {
      const matchFavorite = onlyFavorites ? item.isFavorite : true;
      const matchKeyword = keyword
        ? `${item.prompt} ${item.style} ${item.aspectRatio} ${item.provider} ${item.model}`.toLowerCase().includes(keyword)
        : true;
      return matchFavorite && matchKeyword;
    });
  }, [history, search, onlyFavorites]);

  async function generateWith(params?: { prompt?: string; style?: StylePreset; aspectRatio?: AspectRatio }) {
    const nextPrompt = (params?.prompt ?? prompt).trim();
    const nextStyle = params?.style ?? style;
    const nextRatio = params?.aspectRatio ?? aspectRatio;

    if (nextPrompt.length < 3) return setError('请先输入更完整的商品或场景描述。');
    setLoading(true);
    setError('');

    const start = performance.now();
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: nextPrompt,
          style: nextStyle,
          aspectRatio: nextRatio,
          negativePrompt,
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '生成失败');
      const item: ManagedArtwork = { ...data, elapsedMs: data.elapsedMs ?? Math.round(performance.now() - start) };
      const next = [item, ...history].slice(0, 24);
      persist(next);
      setSelected(item);
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败');
    } finally {
      setLoading(false);
    }
  }

  async function generate() {
    await generateWith();
  }

  async function enhancePrompt() {
    if (prompt.trim().length < 2) return setError('请先输入商品或场景关键词。');
    setEnhancing(true);
    setError('');
    try {
      const response = await fetch('/api/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, style, aspectRatio })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Prompt 优化失败');
      setPrompt(data.prompt);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Prompt 优化失败');
    } finally {
      setEnhancing(false);
    }
  }

  async function editSelected() {
    if (!selected) return setError('请先选择一张要二次编辑的作品。');
    if (editInstruction.trim().length < 3) return setError('请输入更具体的编辑要求。');

    const editedPrompt = `基于已有商品视觉：${selected.prompt}。二次编辑要求：${editInstruction.trim()}。保持商品主体清晰、商业摄影级光影、构图高级、适合电商或品牌营销使用。`;
    setPrompt(editedPrompt);
    setStyle(selected.style);
    setAspectRatio(selected.aspectRatio);
    await generateWith({ prompt: editedPrompt, style: selected.style, aspectRatio: selected.aspectRatio });
  }

  async function clearHistory() {
    const ids = history.map(item => item.id);
    persist([]);
    setSelected(null);

    await Promise.all(
      ids.map(id =>
        fetch(`/api/artworks?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(console.error)
      )
    );
  }

  async function deleteItem(id: string) {
    const previous = history;
    const next = history.filter(item => item.id !== id);
    persist(next);
    if (selected?.id === id) setSelected(next[0] ?? null);

    const response = await fetch(`/api/artworks?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      persist(previous);
      setError(data.error || '删除作品失败');
    }
  }

  async function toggleFavorite(item: ManagedArtwork) {
    const nextFavorite = !item.isFavorite;
    const previous = history;
    const next = history.map(historyItem =>
      historyItem.id === item.id ? { ...historyItem, isFavorite: nextFavorite } : historyItem
    );
    persist(next);
    if (selected?.id === item.id) setSelected({ ...item, isFavorite: nextFavorite });

    const response = await fetch('/api/artworks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, isFavorite: nextFavorite })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      persist(previous);
      if (selected?.id === item.id) setSelected(item);
      setError(data.error || '更新收藏失败');
    }
  }

  function reusePrompt(item: ManagedArtwork) {
    setPrompt(item.prompt);
    setStyle(item.style);
    setAspectRatio(item.aspectRatio);
    setSelected(item);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function copyPrompt(item: ManagedArtwork) {
    await navigator.clipboard.writeText(item.prompt);
    setCopied(item.id);
    window.setTimeout(() => setCopied(''), 1200);
  }

  function download(item: ManagedArtwork) {
    const anchor = document.createElement('a');
    anchor.href = item.imageUrl;
    anchor.download = `visioncraft-${item.id}.png`;
    anchor.click();
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><WandSparkles size={21} /></span>
          <div>
            <strong>VisionCraft AI</strong>
            <small>AI 商品视觉生成平台</small>
          </div>
        </div>
        <div className="status"><span></span>{status}</div>
      </header>

      <section className="hero">
        <div>
          <div className="eyebrow"><Sparkles size={15} /> AI COMMERCE VISUAL STUDIO</div>
          <h1>AI 生成商品主图<br /><em>让营销设计效率提升 10 倍</em></h1>
          <p>面向电商、品牌营销和自媒体运营，通过 AI 快速生成商品图、广告图、宣传海报和创意视觉素材。</p>
        </div>
        <div className="metrics">
          <div><b>{history.length}</b><span>生成作品</span></div>
          <div><b>{favoriteCount}</b><span>收藏作品</span></div>
          <div><b>DB</b><span>云端作品库</span></div>
        </div>
      </section>

      <section className="workspace">
        <aside className="panel controls">
          <div className="panel-title"><span>01</span><div><h2>商品视觉生成</h2><p>选择模板、输入描述并生成商业素材</p></div></div>

          <label>Prompt 模板</label>
          <div className="template-grid">
            {promptTemplates.map(item => (
              <button key={item.name} onClick={() => setPrompt(item.prompt)}>
                <strong>{item.name}</strong>
                <small>{item.tag}</small>
              </button>
            ))}
          </div>

          <label>商品 / 场景描述</label>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} maxLength={1000} placeholder="描述商品、背景、光线、镜头、材质和营销场景……" />
          <div className="char-count">{prompt.length} / 1000</div>
          <div className="example-row">{examples.map((item, index) => <button key={item} onClick={() => setPrompt(item)}>商业示例 {index + 1}</button>)}</div>

          <div className="quick-tools">
            <button type="button" className="mini-action" disabled={enhancing} onClick={enhancePrompt}>
              {enhancing ? <LoaderCircle className="spin" size={14} /> : <Sparkles size={14} />}AI 优化 Prompt
            </button>
            <button type="button" className="mini-action ghost" onClick={() => setPrompt(prompt.replace(/，/g, '，').trim())}>
              <SlidersHorizontal size={14} />整理描述
            </button>
          </div>

          <label>负面提示词</label>
          <textarea className="negative-area" value={negativePrompt} onChange={e => setNegativePrompt(e.target.value)} maxLength={500} placeholder="不希望出现的内容，例如：水印、文字、畸形、低清晰度……" />

          <label>商业风格</label>
          <div className="choice-grid">{styles.map(item => <button className={style === item ? 'active' : ''} key={item} onClick={() => setStyle(item)}>{item}</button>)}</div>

          <label>画面比例</label>
          <div className="ratio-grid">{ratios.map(item => <button className={aspectRatio === item ? 'active' : ''} key={item} onClick={() => setAspectRatio(item)}><i className={`ratio r-${item.replace(':', '-')}`}></i>{item}</button>)}</div>

          {error && <div className="error">{error}</div>}
          <button className="generate" disabled={loading} onClick={generate}>{loading ? <><LoaderCircle className="spin" />正在生成商业视觉</> : <><Sparkles />生成商品图</>}</button>
          <p className="hint">已支持火山方舟 / 豆包 Seedream。未配置 API Key 时自动进入演示模式。</p>

          <div className="edit-panel">
            <div className="edit-title"><Brush size={15} /><strong>AI 二次编辑</strong><span>基于选中作品重绘</span></div>
            <textarea className="negative-area" value={editInstruction} onChange={e => setEditInstruction(e.target.value)} maxLength={500} placeholder="例如：换成暖色阳光、背景改成极简摄影棚、增加节日氛围……" />
            <div className="edit-presets">
              {editPresets.map(item => <button key={item} type="button" onClick={() => setEditInstruction(item)}>{item}</button>)}
            </div>
            <button className="mini-action edit-submit" disabled={loading || !selected} onClick={editSelected}><Brush size={14} />编辑并生成新图</button>
          </div>
        </aside>

        <div className="panel canvas-panel">
          <div className="panel-title"><span>02</span><div><h2>商品图预览</h2><p>{selected ? `${selected.provider} · ${selected.model}` : '生成结果将在此显示'}</p></div></div>
          <div className={`canvas ratio-${selected?.aspectRatio?.replace(':', '-') || aspectRatio.replace(':', '-')}`}>
            {loading ? (
              <div className="empty"><LoaderCircle className="spin big" /><h3>正在生成商品视觉</h3><p>模型正在理解商品卖点、光影和构图</p></div>
            ) : selected ? (
              <>
                <img src={selected.imageUrl} alt={selected.prompt} />
                <div className="image-actions multi-actions">
                  <button onClick={() => setPreviewOpen(true)}><Maximize2 size={17} />预览</button>
                  <button onClick={() => copyPrompt(selected)}><Copy size={17} />{copied === selected.id ? '已复制' : '复制 Prompt'}</button>
                  <button onClick={() => reusePrompt(selected)}><RotateCcw size={17} />再次生成</button>
                  <button onClick={editSelected}><Brush size={17} />二次编辑</button>
                  <button onClick={() => toggleFavorite(selected)}><Heart size={17} className={selected.isFavorite ? 'heart-active' : ''} />{selected.isFavorite ? '已收藏' : '收藏'}</button>
                  <button onClick={() => download(selected)}><Download size={17} />下载 PNG</button>
                </div>
                {selected.demo && <span className="demo-badge">DEMO</span>}
              </>
            ) : (
              <div className="empty"><span><ImageIcon /></span><h3>开始生成第一张商品图</h3><p>选择模板或输入商品描述，然后点击生成</p></div>
            )}
          </div>
          {selected && <div className="result-meta result-meta-3"><div><span>Prompt</span><p>{selected.prompt}</p></div><div><span>参数</span><p>{selected.style} · {selected.aspectRatio}</p></div><div><span>模型信息</span><p>{selected.provider} · {selected.elapsedMs ? `${(selected.elapsedMs / 1000).toFixed(1)}s` : '历史记录'}</p></div></div>}
        </div>
      </section>

      <section className="history-section">
        <div className="section-heading">
          <div><span><History size={18} /></span><h2>作品管理</h2><b>{filteredHistory.length} / {history.length}</b></div>
          {history.length > 0 && <button onClick={clearHistory}><Trash2 size={16} />清空记录</button>}
        </div>

        <div className="history-toolbar">
          <div className="search-box"><Search size={15} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索 Prompt、风格、模型……" /></div>
          <button className={onlyFavorites ? 'toolbar-active' : ''} onClick={() => setOnlyFavorites(value => !value)}><Heart size={15} />只看收藏</button>
        </div>

        {filteredHistory.length ? (
          <div className="gallery managed-gallery">
            {filteredHistory.map(item => (
              <article key={item.id} className={selected?.id === item.id ? 'selected artwork-card' : 'artwork-card'}>
                <button className="artwork-thumb" onClick={() => setSelected(item)}><img src={item.imageUrl} alt={item.prompt} /></button>
                <div className="artwork-info"><strong>{item.style}</strong><span>{item.aspectRatio}</span></div>
                <p title={item.prompt}>{item.prompt}</p>
                <div className="card-actions">
                  <button onClick={() => toggleFavorite(item)} title="收藏"><Heart size={14} className={item.isFavorite ? 'heart-active' : ''} /></button>
                  <button onClick={() => copyPrompt(item)} title="复制 Prompt"><Copy size={14} /></button>
                  <button onClick={() => reusePrompt(item)} title="再次使用"><RotateCcw size={14} /></button>
                  <button onClick={() => download(item)} title="下载"><Download size={14} /></button>
                  <button onClick={() => deleteItem(item.id)} title="删除"><Trash2 size={14} /></button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="history-empty">暂无匹配作品。生成、收藏和搜索结果会显示在这里。</div>
        )}
      </section>

      {previewOpen && selected && (
        <div className="preview-mask" onClick={() => setPreviewOpen(false)}>
          <div className="preview-dialog" onClick={event => event.stopPropagation()}>
            <button className="preview-close" onClick={() => setPreviewOpen(false)}><X size={18} /></button>
            <img src={selected.imageUrl} alt={selected.prompt} />
            <div><strong>{selected.style} · {selected.aspectRatio}</strong><p>{selected.prompt}</p></div>
          </div>
        </div>
      )}

      <footer>VisionCraft AI · Next.js + TypeScript + Doubao Seedream · Portfolio Edition</footer>
    </main>
  );
}
