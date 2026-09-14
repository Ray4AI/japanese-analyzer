// 前后端共享的上游请求构造逻辑。
// 服务端 API 路由与客户端直连模式（Tauri 静态版）共用同一套 payload 规则。

import { mergeCustomExtraBody, CUSTOM_TEXT_PROVIDER } from './customProvider';
import type { AIProvider } from './aiModels';

export type StructuredOutputKind = 'analysisTokens' | 'wordDetail';

export const GEMINI_OPENAI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
export const DEEPSEEK_OPENAI_API_URL = 'https://api.deepseek.com/chat/completions';

const analysisTokensSchema = {
  type: 'object',
  properties: {
    tokens: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          word: { type: 'string' },
          pos: { type: 'string' },
          furigana: { type: 'string' },
        },
        required: ['word', 'pos', 'furigana'],
        additionalProperties: false,
      },
    },
  },
  required: ['tokens'],
  additionalProperties: false,
} as const;

const wordDetailSchema = {
  type: 'object',
  properties: {
    chineseTranslation: { type: 'string' },
    pos: { type: 'string' },
    furigana: { type: 'string' },
    dictionaryForm: { type: 'string' },
    explanation: { type: 'string' },
    conjugation: { type: 'string' },
    example: { type: 'string' },
    exampleTranslation: { type: 'string' },
  },
  required: [
    'chineseTranslation',
    'pos',
    'furigana',
    'dictionaryForm',
    'explanation',
    'conjugation',
    'example',
    'exampleTranslation',
  ],
  additionalProperties: false,
} as const;

const structuredOutputSchemas = {
  analysisTokens: {
    name: 'japanese_sentence_analysis',
    schema: analysisTokensSchema,
  },
  wordDetail: {
    name: 'japanese_word_detail',
    schema: wordDetailSchema,
  },
} as const;

export function getStructuredResponseFormat(
  provider: AIProvider,
  kind: StructuredOutputKind
): Record<string, unknown> {
  // DeepSeek 官方对 json_object 做了语法级强约束（稳定兑现），沿用原项目方案。
  if (provider === 'deepseek') {
    return { type: 'json_object' };
  }

  // 自定义端点与 Gemini 一律使用 json_schema strict：
  // OpenRouter 等聚合平台上 json_object 是否被兑现取决于实际路由到的端点
  // （部分只当提示词暗示，部分直接忽略导致输出非 JSON），
  // 而声明支持 structured outputs 的模型在 json_schema + strict 下才是真正的强约束。
  // 用户仍可通过“额外请求体”覆盖 response_format（浅合并时用户字段优先）。
  const structuredOutput = structuredOutputSchemas[kind];
  return {
    type: 'json_schema',
    json_schema: {
      name: structuredOutput.name,
      strict: true,
      schema: structuredOutput.schema,
    },
  };
}

export function withProviderControls(
  provider: AIProvider,
  payload: Record<string, unknown>,
  options: {
    structuredOutput?: StructuredOutputKind;
    enableThinking?: boolean;
    /** 自用：用户自定义“额外请求体”JSON，浅合并覆盖默认字段 */
    customExtraBody?: string | null;
  } = {}
): Record<string, unknown> {
  const responseFormat = options.structuredOutput
    ? { response_format: getStructuredResponseFormat(provider, options.structuredOutput) }
    : {};

  if (provider === CUSTOM_TEXT_PROVIDER) {
    const merged = mergeCustomExtraBody(
      { ...payload, ...responseFormat },
      options.customExtraBody ?? null
    );
    // 自定义端点默认不强制思考控制，交由模型默认行为或用户的额外请求体。
    return merged;
  }

  if (provider === 'deepseek') {
    const thinkingEnabled = options.enableThinking === true;

    return {
      ...payload,
      ...responseFormat,
      thinking: { type: thinkingEnabled ? 'enabled' : 'disabled' },
      ...(thinkingEnabled ? { reasoning_effort: 'high' } : {}),
    };
  }

  return {
    ...payload,
    ...responseFormat,
    reasoning_effort: payload.model === 'gemini-flash-latest' ? 'low' : 'minimal',
  };
}

/** 直连模式下解析各文本服务商的上游端点。 */
export function resolveTextUpstreamUrl(provider: AIProvider): string {
  if (provider === 'deepseek') return DEEPSEEK_OPENAI_API_URL;
  if (provider === 'gemini') return GEMINI_OPENAI_API_URL;
  // custom-openai：由调用方提供完整 URL。
  return '';
}

export { mergeCustomExtraBody };
