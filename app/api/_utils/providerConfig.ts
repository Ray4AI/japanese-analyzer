import { NextRequest } from 'next/server';
import {
  CUSTOM_TEXT_PROVIDER,
  resolveCustomTextUrl,
} from '../../lib/customProvider';
import {
  withProviderControls,
  getStructuredResponseFormat,
  type StructuredOutputKind,
} from '../../lib/upstreamPayload';
import {
  DEFAULT_AI_PROVIDER,
  getModelName,
  normalizeAIModel,
  normalizeAIProvider,
  type AIProvider,
} from '../../lib/aiModels';

export {
  DEFAULT_AI_PROVIDER,
  normalizeAIProvider,
  withProviderControls,
  getStructuredResponseFormat,
};
export type { AIProvider, StructuredOutputKind };

export const GEMINI_OPENAI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const DEEPSEEK_OPENAI_API_URL = 'https://api.deepseek.com/chat/completions';

export class ProviderConfigError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ProviderConfigError';
    this.status = status;
  }
}

// 自用：透传客户端提供的 OpenAI 兼容端点配置。
export interface CustomOpenAIRequestOptions {
  /** 客户端传入的 OpenAI 兼容 base URL（含 /v1） */
  customApiUrl?: unknown;
  /** 客户端传入的 API Key */
  customApiKey?: unknown;
  /** 客户端传入的模型名 */
  customModel?: unknown;
  /** 客户端传入的额外请求体 JSON 字符串 */
  customExtraBody?: unknown;
}

function asNonEmptyString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * 解析自定义 OpenAI 兼容端点配置。客户端未提供 URL/Key/Model 时回退服务器环境变量
 * CUSTOM_OPENAI_API_URL / CUSTOM_OPENAI_API_KEY / CUSTOM_OPENAI_MODEL。
 */
export function resolveCustomOpenAIConfig(options: CustomOpenAIRequestOptions): {
  apiUrl: string;
  apiKey: string;
  model: string;
  extraBody: string;
} {
  const apiUrl = asNonEmptyString(options.customApiUrl)
    || process.env.CUSTOM_OPENAI_API_URL || '';
  const apiKey = asNonEmptyString(options.customApiKey)
    || process.env.CUSTOM_OPENAI_API_KEY || '';
  const model = asNonEmptyString(options.customModel)
    || process.env.CUSTOM_OPENAI_MODEL || '';
  const extraBody = asNonEmptyString(options.customExtraBody);

  if (!apiUrl) {
    throw new ProviderConfigError('未配置自定义端点：请在设置中填写 API 地址。');
  }
  if (!apiKey) {
    throw new ProviderConfigError('未配置自定义端点：请在设置中填写 API 密钥。');
  }

  return { apiUrl, apiKey, model, extraBody };
}

function getBearerToken(req: NextRequest): string {
  const authHeader = req.headers.get('Authorization');
  return authHeader ? authHeader.replace('Bearer ', '').trim() : '';
}

function getDefaultApiUrl(provider: AIProvider): string {
  if (provider === 'deepseek') {
    return process.env.DEEPSEEK_API_URL || DEEPSEEK_OPENAI_API_URL;
  }

  return process.env.GEMINI_API_URL || GEMINI_OPENAI_API_URL;
}

function getDefaultApiKey(provider: AIProvider): string {
  if (provider === 'deepseek') {
    return process.env.DEEPSEEK_API_KEY || '';
  }

  return process.env.GEMINI_API_KEY || '';
}

export function resolveProviderConfig(
  req: NextRequest,
  options: {
    provider?: unknown;
    apiUrl?: unknown;
    model?: unknown;
  } = {}
) {
  const provider = normalizeAIProvider(options.provider);
  const customModel = typeof options.model === 'string' ? options.model.trim() : '';
  const hasClientApiUrl = typeof options.apiUrl === 'string'
    ? options.apiUrl.trim().length > 0
    : options.apiUrl !== undefined && options.apiUrl !== null;

  if (hasClientApiUrl) {
    throw new ProviderConfigError('客户端不再支持自定义 API URL，请在服务器环境变量中配置上游端点。');
  }

  return {
    provider,
    apiKey: getBearerToken(req) || getDefaultApiKey(provider),
    apiUrl: getDefaultApiUrl(provider),
    model: customModel ? normalizeAIModel(provider, customModel) : getModelName(provider),
  };
}

/**
 * 各 API 路由的统一入口：custom-openai 走客户端透传配置，内置服务商走服务器配置。
 * 返回的 customExtraBody 供 withProviderControls 使用。
 */
export function resolveRequestProviderConfig(
  req: NextRequest,
  options: {
    provider?: unknown;
    apiUrl?: unknown;
    model?: unknown;
    customApiUrl?: unknown;
    customApiKey?: unknown;
    customModel?: unknown;
    customExtraBody?: unknown;
  } = {}
) {
  const provider = normalizeAIProvider(options.provider);

  if (provider === CUSTOM_TEXT_PROVIDER) {
    const custom = resolveCustomOpenAIConfig({
      customApiUrl: options.customApiUrl,
      customApiKey: options.customApiKey,
      customModel: options.customModel,
      customExtraBody: options.customExtraBody,
    });
    return {
      provider,
      apiKey: custom.apiKey,
      apiUrl: resolveCustomTextUrl(custom.apiUrl),
      model: custom.model || 'default',
      customExtraBody: custom.extraBody,
    };
  }

  const base = resolveProviderConfig(req, {
    provider,
    apiUrl: options.apiUrl,
    model: options.model,
  });
  return { ...base, customExtraBody: '' };
}
