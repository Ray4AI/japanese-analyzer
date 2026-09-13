'use client';

import { useLanguage } from '../contexts/LanguageContext';
import { parseCustomExtraBody, CUSTOM_TTS_FORMATS, type CustomTtsConfig } from '../lib/customProvider';

interface CustomTtsSettingsProps {
  config: CustomTtsConfig;
  onChange: (patch: Partial<CustomTtsConfig>) => void;
}

const FORMAT_LABELS: Record<string, string> = {
  mp3: 'MP3（兼容性好）',
  pcm: 'PCM (16bit LE)',
};

/** 自用：自定义 OpenAI 兼容语音端点（/audio/speech）设置面板 */
export default function CustomTtsSettings({ config, onChange }: CustomTtsSettingsProps) {
  const { t } = useLanguage();
  const { error } = parseCustomExtraBody(config.extraBody);

  return (
    <>
      <div className="mb-3">
        <label className="mb-2 block text-xs font-medium" style={{ color: 'var(--ink-2)' }}>
          {t("API 地址（OpenAI 兼容）")}
        </label>
        <input
          type="text"
          className="nd-input text-sm"
          placeholder="https://openrouter.ai/api/v1"
          value={config.apiUrl}
          onChange={(e) => onChange({ apiUrl: e.target.value })}
        />
      </div>

      <div className="mb-3">
        <label className="mb-2 block text-xs font-medium" style={{ color: 'var(--ink-2)' }}>
          {t("API 密钥")}
        </label>
        <input
          type="password"
          className="nd-input text-sm"
          placeholder="sk-..."
          value={config.apiKey}
          onChange={(e) => onChange({ apiKey: e.target.value })}
        />
      </div>

      <div className="mb-3">
        <label className="mb-2 block text-xs font-medium" style={{ color: 'var(--ink-2)' }}>
          {t("语音模型")}
        </label>
        <input
          type="text"
          className="nd-input text-sm"
          placeholder="qwen/qwen-audio-3.0-tts-flash"
          value={config.model}
          onChange={(e) => onChange({ model: e.target.value })}
        />
      </div>

      <div className="mb-3">
        <label className="mb-2 block text-xs font-medium" style={{ color: 'var(--ink-2)' }}>
          {t("声音（voice）")}
        </label>
        <input
          type="text"
          className="nd-input text-sm"
          placeholder={t("留空使用模型默认声音")}
          value={config.voice}
          onChange={(e) => onChange({ voice: e.target.value })}
        />
      </div>

      <div className="mb-3">
        <label className="mb-2 block text-xs font-medium" style={{ color: 'var(--ink-2)' }}>
          {t("音频格式")}
        </label>
        <select
          className="nd-input text-sm"
          value={config.format}
          onChange={(e) => onChange({ format: e.target.value })}
        >
          {CUSTOM_TTS_FORMATS.map((format) => (
            <option key={format} value={format}>{FORMAT_LABELS[format] || format}</option>
          ))}
        </select>
      </div>

      <div className="mb-3">
        <label className="mb-2 block text-xs font-medium" style={{ color: 'var(--ink-2)' }}>
          {t("语速（speed）")} · {config.speed}x
        </label>
        <input
          type="range"
          aria-label={t("语速")}
          min="0.5"
          max="2"
          step="0.1"
          value={config.speed}
          onChange={(e) => onChange({ speed: Number(e.target.value) })}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg"
          style={{ background: 'var(--line-2)', accentColor: 'var(--primary)' }}
        />
      </div>

      <div className="mb-2">
        <label className="mb-2 block text-xs font-medium" style={{ color: 'var(--ink-2)' }}>
          {t("额外请求体（JSON，可选）")}
        </label>
        <textarea
          className="nd-input font-mono text-xs"
          rows={4}
          placeholder={'{ "voice": "loongjohn" }'}
          value={config.extraBody}
          onChange={(e) => onChange({ extraBody: e.target.value })}
        />
        {error && (
          <p className="m-0 mt-1 text-xs" style={{ color: 'var(--neg, #d0342c)' }}>{error}</p>
        )}
      </div>
    </>
  );
}
