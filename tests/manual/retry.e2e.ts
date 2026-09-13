/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * 手动端到端验证脚本（不参与 CI）
 * 运行: dev server + mock 上游启动后 node_modules/.bin/tsx tests/manual/retry.e2e.ts
 */
// 客户端服务层重试逻辑的端到端验证（绕过 Next，直接调用 services/api 的函数）
import { streamTranslateText, translateText, analyzeSentence, streamAnalyzeSentence } from "../../app/services/api";
import type { TokenData } from "../../app/services/api";

type TokenData2 = TokenData;

// Node 环境下 polyfill localStorage，提供自定义端点配置（客户端从这里读取）
const store: Record<string, string> = {
  customTextApiUrl: 'http://127.0.0.1:8899/v1',
  customTextApiKey: 'k',
  customTextModel: 'm',
};
(global as any).localStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
};

const SERVER = 'http://127.0.0.1:3000';
const originalFetch = global.fetch;

// 把 /api/* 相对路径转发到 dev server
global.fetch = ((input: any, init?: any) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url.startsWith('/api/')) return originalFetch(SERVER + url, init);
  return originalFetch(input, init);
}) as typeof fetch;

async function main() {
  // 测1: 流式翻译——mock 第1次返回日文原文，应触发重试拿到中文
  let finalTranslation = '';
  await streamTranslateText('日本には美しい四季があります。', (chunk) => {
    finalTranslation = chunk;
  }, (error) => {
    throw new Error('不应报错: ' + error.message);
  }, undefined, 'custom-openai' as any, 'm');
  if (finalTranslation.includes('美しい') || !finalTranslation) {
    throw new Error('流式翻译重试失败，最终内容: ' + finalTranslation);
  }
  console.log('✓ 测1 流式翻译重试:', finalTranslation);

  // 测2: 非流式翻译（mock 此时已返回中文，应一次成功）
  const t2 = await translateText('日本には美しい四季があります。', undefined, 'custom-openai' as any, 'm');
  console.log('✓ 测2 非流式翻译:', t2);

  // 测3: 非流式解析——mock 前2次截断、第3次完整，应自动重试成功
  const tokens = await analyzeSentence('こんにちは。', undefined, 'custom-openai' as any, 'm');
  if (tokens.map(t => t.word).join('') !== 'こんにちは。') throw new Error('解析结果异常: ' + JSON.stringify(tokens));
  console.log('✓ 测3 非流式解析重试(3次内成功):', tokens.length, '个词元');

  // 测4: 流式解析——mock 第1次流式截断，应降级非流式并重试成功
  let finalJson = '';
  let doneReceived = false;
  await new Promise<void>((resolve, reject) => {
    streamAnalyzeSentence('こんにちは。ストリーム失敗テスト。',
      (chunk, isDone) => {
        if (isDone) { finalJson = chunk; doneReceived = true; }
      },
      (error) => reject(new Error('不应报错: ' + error.message)),
      undefined, 'custom-openai' as any, 'm'
    ).then(resolve).catch(reject);
  });
  const parsed = JSON.parse(finalJson) as { tokens: Array<{ word: string }> };
  const concat = parsed.tokens.map(t => t.word).join('');
  if (!doneReceived || concat !== 'こんにちは。ストリーム失敗テスト。') {
    throw new Error('流式解析降级重试失败: ' + concat);
  }
  console.log('✓ 测4 流式解析失败→非流式降级重试成功');
  await test5();
  console.log('\n全部重试逻辑验证通过');
}

main().then(() => process.exit(0)).catch((e) => { console.error('✗', e.message); process.exit(1); });

// 测5: 分块解析——含“失敗マーカー”的块重试后仍失败 → 原文占位，其余块正常展示
async function test5() {
  const partA = 'これはテストです。'.repeat(50);      // 450 字正常块
  const partB = '失敗マーカーです。'.repeat(40);      // 360 字必然失败块
  const text = `${partA}\n\n${partB}`;

  const result = await new Promise<TokenData2[]>((resolve, reject) => {
    let collected: TokenData2[] = [];
    streamAnalyzeSentence(text,
      (chunk, isDone) => {
        if (isDone) collected = JSON.parse(chunk).tokens;
      },
      (error) => reject(new Error('不应整体报错: ' + error.message)),
      undefined, 'custom-openai' as any, 'm'
    ).then(() => resolve(collected)).catch(reject);
  });

  const concat = result.map(t => t.word).join('');
  if (concat !== text) throw new Error('占位后拼接与原文不一致');
  const placeholder = result.filter(t => t.pos === '解析失敗');
  if (!placeholder.length || !placeholder.some(t => t.word.includes('失敗マーカー'))) {
    throw new Error('缺少失败块占位');
  }
  const normalWords = result.filter(t => t.pos === '名詞').map(t => t.word).join('');
  if (!normalWords.includes('テスト')) throw new Error('正常块未展示');
  console.log(`✓ 测5 分块占位: 正常块 ${normalWords.length} 字已展示，失败块以原文占位 (${placeholder.map(t => t.word.length).join('+')} 字)`);
}
