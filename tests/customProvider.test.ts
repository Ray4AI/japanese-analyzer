import assert from 'assert';
import {
  parseCustomExtraBody,
  resolveCustomTtsUrl,
  mergeCustomExtraBody,
  CUSTOM_TTS_STORAGE_KEYS,
  loadCustomTtsConfig,
} from '../app/lib/customProvider';

export function runCustomProviderTests() {
  // parseCustomExtraBody
  assert.deepStrictEqual(parseCustomExtraBody(''), { record: null, error: null });
  assert.deepStrictEqual(parseCustomExtraBody('   '), { record: null, error: null });
  assert.deepStrictEqual(parseCustomExtraBody(null), { record: null, error: null });
  assert.deepStrictEqual(parseCustomExtraBody('{"temperature":0.3}'), { record: { temperature: 0.3 }, error: null });
  assert.strictEqual(parseCustomExtraBody('not json').error, '不是有效的 JSON 对象');
  assert.strictEqual(parseCustomExtraBody('[1,2]').error, '额外请求体必须是 JSON 对象');
  assert.strictEqual(parseCustomExtraBody('42').error, '额外请求体必须是 JSON 对象');
  assert.strictEqual(parseCustomExtraBody('"str"').error, '额外请求体必须是 JSON 对象');

  // resolveCustomTtsUrl
  const urlCases: Array<[string, string]> = [
    ['https://openrouter.ai/api/v1', 'https://openrouter.ai/api/v1/audio/speech'],
    ['https://openrouter.ai/api/v1/', 'https://openrouter.ai/api/v1/audio/speech'],
    ['https://my-tts.example.com', 'https://my-tts.example.com/v1/audio/speech'],
    ['https://my-tts.example.com/v1', 'https://my-tts.example.com/v1/audio/speech'],
    ['https://my-tts.example.com/v1/audio/speech', 'https://my-tts.example.com/v1/audio/speech'],
    ['http://127.0.0.1:5050', 'http://127.0.0.1:5050/v1/audio/speech'],
  ];
  for (const [input, expected] of urlCases) {
    assert.strictEqual(resolveCustomTtsUrl(input), expected);
  }

  // mergeCustomExtraBody：用户字段优先
  const base = { model: 'm', input: 'x', temperature: 1 };
  assert.deepStrictEqual(
    mergeCustomExtraBody(base, '{"temperature":0.2,"top_p":0.9}'),
    { model: 'm', input: 'x', temperature: 0.2, top_p: 0.9 }
  );
  assert.deepStrictEqual(mergeCustomExtraBody(base, ''), base);
  assert.deepStrictEqual(mergeCustomExtraBody(base, 'bad json'), base);

  // loadCustomTtsConfig
  const store = new Map<string, string>([
    [CUSTOM_TTS_STORAGE_KEYS.apiUrl, 'https://openrouter.ai/api/v1'],
    [CUSTOM_TTS_STORAGE_KEYS.model, 'qwen/qwen-audio-3.0-tts-flash'],
    [CUSTOM_TTS_STORAGE_KEYS.speed, '1.5'],
  ]);
  const config = loadCustomTtsConfig({
    getItem: (key: string) => store.get(key) ?? null,
  } as Storage);
  assert.strictEqual(config.apiUrl, 'https://openrouter.ai/api/v1');
  assert.strictEqual(config.model, 'qwen/qwen-audio-3.0-tts-flash');
  assert.strictEqual(config.speed, 1.5);
  assert.strictEqual(config.format, 'mp3');
  assert.strictEqual(config.voice, '');

  const emptyConfig = loadCustomTtsConfig({ getItem: () => null } as unknown as Storage);
  assert.strictEqual(emptyConfig.speed, 1);

  console.log('customProvider tests passed');
}

// —— estimateAnalysisMaxTokens ——
import { estimateAnalysisMaxTokens } from '../app/lib/upstreamPayload';

export function runEstimateMaxTokensTests() {
  // 短句：走 4096 下限
  assert.strictEqual(estimateAnalysisMaxTokens('こんにちは。'), 4096);

  // 长文：按 0.9 token/字 × 22 倍 + 2048 估算
  const longText = 'あ'.repeat(600);
  const expected600 = Math.min(65536, Math.max(4096, Math.ceil(600 * 0.9) * 22 + 2048));
  assert.strictEqual(estimateAnalysisMaxTokens(longText), expected600);
  // 600 字 ≈ 540 token × 22 + 2048 = 13928，应在 4k~16k 区间
  assert.ok(expected600 > 8000 && expected600 < 20000, `600字预算异常: ${expected600}`);

  // 极端长文封顶 65536
  assert.strictEqual(estimateAnalysisMaxTokens('あ'.repeat(100000)), 65536);

  // 估算应单调不减
  assert.ok(estimateAnalysisMaxTokens('あ'.repeat(500)) >= estimateAnalysisMaxTokens('あ'.repeat(100)));

  console.log('estimateAnalysisMaxTokens tests passed');
}
