// OpenAI 兼容自定义端点配置（自用功能）。
// 文本与 TTS 各自拥有独立的自定义配置：URL / Key / 模型 / 额外请求体 JSON。

export const CUSTOM_TEXT_PROVIDER = 'custom-openai' as const;
export const CUSTOM_TTS_PROVIDER = 'custom-openai-tts' as const;

export const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';

export interface CustomExtraBodyParseResult {
  record: Record<string, unknown> | null;
  error: string | null;
}

/** 解析用户填写的“额外请求体”JSON 文本。空值返回 { record: null, error: null }。 */
export function parseCustomExtraBody(raw: string | null | undefined): CustomExtraBodyParseResult {
  const text = (raw ?? '').trim();
  if (!text) return { record: null, error: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { record: null, error: '不是有效的 JSON 对象' };
  }

  // 只接受 JSON 对象，拒绝数组与字面量
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { record: null, error: '额外请求体必须是 JSON 对象' };
  }

  return { record: parsed as Record<string, unknown>, error: null };
}

/**
 * 从自定义 base URL 推导 OpenAI 兼容 TTS 端点：
 * - 已包含 /audio/speech：原样使用
 * - 以 /v1 结尾：追加 /audio/speech
 * - 其余（含 OpenRouter 根地址）：补全 /v1/audio/speech
 */
export function resolveCustomTtsUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  if (/\/audio\/speech$/.test(trimmed)) return trimmed;
  if (/\/v1$/.test(trimmed)) return `${trimmed}/audio/speech`;
  return `${trimmed}/v1/audio/speech`;
}

/**
 * 从自定义 base URL 推导 OpenAI 兼容 chat/completions 端点：
 * - 已包含 /chat/completions：原样使用
 * - 其余（含 OpenRouter 根地址）：补全 /chat/completions
 */
export function resolveCustomTextUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  if (/\/chat\/completions$/.test(trimmed)) return trimmed;
  return `${trimmed}/chat/completions`;
}

/** localStorage 键名（文本 / TTS 各一组） */
export const CUSTOM_TEXT_STORAGE_KEYS = {
  apiKey: 'customTextApiKey',
  apiUrl: 'customTextApiUrl',
  model: 'customTextModel',
  extraBody: 'customTextExtraBody',
} as const;

export const CUSTOM_TTS_STORAGE_KEYS = {
  apiKey: 'customTtsApiKey',
  apiUrl: 'customTtsApiUrl',
  model: 'customTtsModel',
  voice: 'customTtsVoice',
  speed: 'customTtsSpeed',
  format: 'customTtsFormat',
  extraBody: 'customTtsExtraBody',
} as const;

export interface CustomTextConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
  extraBody: string;
}

export interface CustomTtsConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
  voice: string;
  speed: number;
  format: string;
  extraBody: string;
}

export const DEFAULT_CUSTOM_TTS_MODEL = 'qwen/qwen-audio-3.0-tts-flash';
export const CUSTOM_TTS_FORMATS = ['mp3', 'pcm'] as const;

export function loadCustomTextConfig(storage: Pick<Storage, 'getItem'>): CustomTextConfig {
  return {
    apiUrl: storage.getItem(CUSTOM_TEXT_STORAGE_KEYS.apiUrl) || '',
    apiKey: storage.getItem(CUSTOM_TEXT_STORAGE_KEYS.apiKey) || '',
    model: storage.getItem(CUSTOM_TEXT_STORAGE_KEYS.model) || '',
    extraBody: storage.getItem(CUSTOM_TEXT_STORAGE_KEYS.extraBody) || '',
  };
}

export function loadCustomTtsConfig(storage: Pick<Storage, 'getItem'>): CustomTtsConfig {
  const speedRaw = storage.getItem(CUSTOM_TTS_STORAGE_KEYS.speed);
  const speed = speedRaw !== null && speedRaw !== '' && Number.isFinite(Number(speedRaw))
    ? Number(speedRaw)
    : 1;

  return {
    apiUrl: storage.getItem(CUSTOM_TTS_STORAGE_KEYS.apiUrl) || '',
    apiKey: storage.getItem(CUSTOM_TTS_STORAGE_KEYS.apiKey) || '',
    model: storage.getItem(CUSTOM_TTS_STORAGE_KEYS.model) || '',
    voice: storage.getItem(CUSTOM_TTS_STORAGE_KEYS.voice) || '',
    speed,
    format: storage.getItem(CUSTOM_TTS_STORAGE_KEYS.format) || 'mp3',
    extraBody: storage.getItem(CUSTOM_TTS_STORAGE_KEYS.extraBody) || '',
  };
}

/** 合并“额外请求体”到 payload：用户字段优先覆盖（浅合并）。失败时返回原 payload。 */
export function mergeCustomExtraBody(
  payload: Record<string, unknown>,
  rawExtraBody: string | null | undefined
): Record<string, unknown> {
  const { record } = parseCustomExtraBody(rawExtraBody);
  if (!record) return payload;
  return { ...payload, ...record };
}
