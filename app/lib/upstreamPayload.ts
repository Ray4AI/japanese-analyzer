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
  // 复用原项目 DeepSeek 的成熟方案：json_object 模式 + 宽容解析器。
  // OpenRouter 各上游对 json_schema strict 支持参差不齐（部分直接 400），
  // json_object 兼容性最好，配合原有的提取/校验逻辑解析成功率更高。
  if (provider === 'deepseek' || provider === CUSTOM_TEXT_PROVIDER) {
    return { type: 'json_object' };
  }

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

/**
 * 根据输入文本长度估算解析输出所需的 max_tokens 预算。
 * 每个日文字符约 0.9 token；按原文逐字还原要求，tokens 数组序列化后
 * 约膨胀 15~25 倍（每个词元对象含 word/pos/furigana 与 JSON 语法开销），
 * 再加安全余量。仅用于解析场景；用户额外请求体里的 max_tokens 优先级更高。
 */
export function estimateAnalysisMaxTokens(inputText: string): number {
  const inputChars = Array.from(inputText).length;
  const inputTokens = Math.ceil(inputChars * 0.9);
  const outputBudget = Math.ceil(inputTokens * 22);
  // 下限 4096（覆盖短句 + 思考型模型的思维链开销），上限 65536（避免极端长文触上游硬限）。
  return Math.min(65536, Math.max(4096, outputBudget + 2048));
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
