export type AIProvider = 'gemini' | 'deepseek' | 'custom-openai';
export type GeminiModelName = 'gemini-flash-latest' | 'gemini-flash-lite-latest';
export type DeepSeekModelName = 'deepseek-flash';
export type AIModelName = GeminiModelName | DeepSeekModelName;
export type ImageRecognitionModelName = GeminiModelName | typeof DEEPSEEK_VISION_MODEL_NAME;

export const DEFAULT_AI_PROVIDER: AIProvider = 'deepseek';
export const GEMINI_MODEL_NAME: GeminiModelName = 'gemini-flash-latest';
export const DEEPSEEK_MODEL_NAME: DeepSeekModelName = 'deepseek-flash';
export const DEEPSEEK_VISION_MODEL_NAME = DEEPSEEK_MODEL_NAME;
export const GEMINI_MODEL_OPTIONS: GeminiModelName[] = ['gemini-flash-latest', 'gemini-flash-lite-latest'];
export const DEEPSEEK_MODEL_OPTIONS: DeepSeekModelName[] = ['deepseek-flash'];

export function normalizeAIProvider(value?: unknown): AIProvider {
  return value === 'gemini' || value === 'deepseek' || value === 'custom-openai'
    ? value
    : DEFAULT_AI_PROVIDER;
}

export function normalizeAIModel(
  provider: AIProvider = DEFAULT_AI_PROVIDER,
  value?: unknown
): AIModelName {
  const model = typeof value === 'string' ? value.trim() : '';

  // 自定义端点的模型名由用户自由填写，不参与内置模型白名单。
  if (provider === 'custom-openai') {
    return (model || DEEPSEEK_MODEL_NAME) as AIModelName;
  }

  if (provider === 'deepseek') {
    return DEEPSEEK_MODEL_OPTIONS.includes(model as DeepSeekModelName)
      ? model as DeepSeekModelName
      : DEEPSEEK_MODEL_NAME;
  }

  if (model === 'gemini-3.7-flash') return 'gemini-flash-latest';
  if (model === 'gemini-3.5-flash-lite') return 'gemini-flash-lite-latest';

  return GEMINI_MODEL_OPTIONS.includes(model as GeminiModelName)
    ? model as GeminiModelName
    : GEMINI_MODEL_NAME;
}

export function getModelName(
  provider: AIProvider = DEFAULT_AI_PROVIDER,
  model?: unknown
): AIModelName {
  return normalizeAIModel(provider, model);
}

export function getImageRecognitionModelName(
  provider: AIProvider = DEFAULT_AI_PROVIDER,
  model?: unknown
): ImageRecognitionModelName | string {
  if (provider === 'deepseek') {
    return DEEPSEEK_VISION_MODEL_NAME;
  }
  // 自定义端点：直接使用用户填写的模型名（是否支持视觉由用户端点决定）。
  if (provider === 'custom-openai') {
    const customModel = typeof model === 'string' ? model.trim() : '';
    return customModel || DEEPSEEK_VISION_MODEL_NAME;
  }
  return normalizeAIModel(provider, model) as GeminiModelName;
}
