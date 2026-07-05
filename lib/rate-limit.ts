import 'server-only';
import { createHash } from 'node:crypto';
import { requireSupabaseAdmin } from '@/lib/supabase-server';

export type QuotaResult = {
  allowed: boolean;
  ipCount: number;
  globalCount: number;
  ipRemaining: number;
  globalRemaining: number;
  reason?: 'ip' | 'global' | 'disabled';
  ipScope?: string;
};

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getClientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  return request.headers.get('x-real-ip') || 'local-development';
}

function createIpScope(request: Request) {
  const secret =
    process.env.RATE_LIMIT_SECRET ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) throw new Error('缺少 RATE_LIMIT_SECRET，无法启用生成额度保护。');

  const ip = getClientIp(request);
  const hash = createHash('sha256').update(`${secret}:${ip}`).digest('hex');
  return `ip:${hash.slice(0, 40)}`;
}

export async function consumeGenerationQuota(request: Request): Promise<QuotaResult> {
  if (process.env.RATE_LIMIT_ENABLED === 'false') {
    return {
      allowed: true,
      ipCount: 0,
      globalCount: 0,
      ipRemaining: Number.MAX_SAFE_INTEGER,
      globalRemaining: Number.MAX_SAFE_INTEGER,
      reason: 'disabled',
    };
  }

  const supabase = requireSupabaseAdmin();
  const ipLimit = positiveInt(process.env.PER_IP_DAILY_LIMIT, 3);
  const globalLimit = positiveInt(process.env.GLOBAL_DAILY_LIMIT, 30);
  const ipScope = createIpScope(request);

  const { data, error } = await supabase.rpc('consume_generation_quota', {
    p_ip_scope: ipScope,
    p_ip_limit: ipLimit,
    p_global_limit: globalLimit,
  });

  if (error) throw new Error(`生成额度检查失败：${error.message}`);

  const result = (data || {}) as Record<string, unknown>;
  return {
    allowed: Boolean(result.allowed),
    ipCount: Number(result.ip_count || 0),
    globalCount: Number(result.global_count || 0),
    ipRemaining: Number(result.ip_remaining || 0),
    globalRemaining: Number(result.global_remaining || 0),
    reason:
      result.reason === 'ip' || result.reason === 'global'
        ? result.reason
        : undefined,
    ipScope,
  };
}

export async function refundGenerationQuota(ipScope?: string) {
  if (!ipScope || process.env.RATE_LIMIT_ENABLED === 'false') return;

  const supabase = requireSupabaseAdmin();
  const { error } = await supabase.rpc('refund_generation_quota', {
    p_ip_scope: ipScope,
  });

  if (error) console.error('Refund generation quota error:', error);
}
