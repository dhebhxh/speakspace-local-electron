import { useEffect, useState } from 'react';
import { Model } from '../../../main/AI-module/Model';
import ModelModule from './components/ModelModule';
import ModelSelect, { ModelOption } from './components/ModelSelect';
import { ModelIcons } from './components/ModelIcons';
import { getModelDescription } from './ModelDescription';
import { getModelTags } from './ModelTags';
import { buildModuleRuntimes } from './ModelRuntimes';
import {
  getPreferredSpeakerId,
  setPreferredSpeakerId,
} from '../../tts/TTSPreferences';
import useTTSPlayback from '../../tts/useTTSPlayback';
import useModelManager from './useModelManager';
import './ModelManagerPage.css';

function toOptions(
  models: Model[],
  modelType: 'stt' | 'llm',
  recommendedId: string | undefined,
): ModelOption[] {
  return models.map((model) => ({
    id: model.id,
    name: model.name,
    meta: model.size,
    tags: getModelTags(model, modelType),
    description: getModelDescription(model, modelType),
    downloaded: model.downloaded,
    active: model.activated,
    recommended: model.id === recommendedId,
  }));
}

// 保留命名导出，与现有路由导入方式一致。
// eslint-disable-next-line import/prefer-default-export
export function ModelManagerPage() {
  const manager = useModelManager();
  const playback = useTTSPlayback();
  const [speakerId, setSpeakerId] = useState<number | null>(null);

  const transcription = manager.runtime?.transcription;
  const parakeet = manager.runtime?.parakeetTranscription;
  const languageModel = manager.runtime?.languageModel;
  const speech = manager.runtime?.speechSynthesis;

  useEffect(() => {
    if (speech?.speakers.length) {
      setSpeakerId(getPreferredSpeakerId(speech.speakers));
    }
  }, [speech?.speakers]);

  const busy = manager.busyId !== null;
  const runtimes = buildModuleRuntimes(manager.runtime, manager.embedding, {
    installWhisper: manager.installWhisper,
    installFfmpeg: manager.installFfmpeg,
    installOllama: manager.installOllama,
    uninstall: manager.uninstallRuntime,
  });

  const sttOptions = toOptions(
    manager.sttModels,
    'stt',
    manager.recommendation?.stt?.id,
  );
  const llmOptions = toOptions(
    manager.llmModels,
    'llm',
    manager.recommendation?.llm?.id,
  );

  const ttsOptions: ModelOption[] = speech
    ? [
        {
          id: 'kokoro',
          name: speech.modelName,
          meta: `${speech.speakers.length || 0} 音色`,
          tags: ['双语', '离线'],
          description: 'Kokoro 中英双语本地语音模型。',
          downloaded: speech.modelReady,
          active: speech.modelReady,
          recommended: true,
        },
      ]
    : [];

  const speakerOptions: ModelOption[] = (speech?.speakers ?? []).map(
    (speaker) => ({
      id: String(speaker.id),
      name: speaker.label,
      tags: speaker.language ? [speaker.language] : [],
      downloaded: true,
      active: speaker.id === speakerId,
    }),
  );

  const embeddingOptions: ModelOption[] = manager.embedding
    ? [
        {
          id: manager.embedding.modelName,
          name: manager.embedding.modelName,
          tags: ['多语言', '检索'],
          description: '用于相似笔记检索的本地向量模型，由 Ollama 运行。',
          downloaded: manager.embedding.installed,
          active: manager.embedding.installed,
          recommended: true,
        },
      ]
    : [];

  const selectSpeaker = (id: string) => {
    const nextId = Number(id);
    setSpeakerId(nextId);
    setPreferredSpeakerId(nextId);
  };

  return (
    <div className="model-manager-page">
      <header className="model-manager-header">
        <h1>模型管理</h1>
        <button
          aria-label="刷新状态"
          className="model-icon-button"
          onClick={() => manager.refreshAll()}
          title="刷新状态"
          type="button"
        >
          {ModelIcons.refresh}
        </button>
      </header>

      <div className="model-module-list">
        <ModelModule
          actions={null}
          busy={busy}
          error={manager.errors.stt}
          hint="语音转文字：把录音转成文字"
          icon="stt"
          name="STT"
          progress={manager.progress.stt}
          ready={Boolean(transcription?.ready || parakeet?.ready)}
          readyHint={
            transcription?.ready || parakeet?.ready ? '可转写' : '尚未就绪'
          }
          runtimes={runtimes.stt}
        >
          <ModelSelect
            busyId={manager.busyId}
            label="选择语音识别模型"
            onDelete={manager.stt.remove}
            onDownload={manager.stt.download}
            onSelect={manager.stt.select}
            options={sttOptions}
            placeholder="未选择模型"
          />
        </ModelModule>

        <ModelModule
          busy={busy}
          error={manager.errors.tts}
          hint="文字转语音：朗读 AI 回答和笔记"
          icon="tts"
          name="TTS"
          progress={manager.progress.tts}
          ready={Boolean(speech?.runtimeReady)}
          readyHint={speech?.runtimeReady ? '可播报' : '尚未就绪'}
          runtimes={runtimes.tts}
          actions={
            speech?.runtimeReady && speakerId !== null ? (
              <button
                aria-label={playback.playing ? '停止试听' : '试听音色'}
                className="model-icon-button"
                disabled={playback.loading}
                onClick={() =>
                  playback.playing
                    ? playback.stop()
                    : playback.speak(
                        '你好，这是 SpeakSpace 的本地语音。',
                        speakerId,
                      )
                }
                title={playback.playing ? '停止试听' : '试听音色'}
                type="button"
              >
                {playback.playing ? ModelIcons.stop : ModelIcons.play}
              </button>
            ) : null
          }
        >
          <ModelSelect
            busyId={manager.busyId}
            label="选择语音模型"
            onDelete={() => manager.uninstallRuntime('tts', 'tts-model')}
            onDownload={manager.installTTS}
            onSelect={() => {}}
            options={ttsOptions}
            placeholder="未安装"
          />
          {speech?.runtimeReady && speakerOptions.length > 0 && (
            <div className="model-select-compact">
              <ModelSelect
                busyId={null}
                label="选择音色"
                onDelete={null}
                onDownload={null}
                onSelect={selectSpeaker}
                options={speakerOptions}
                placeholder="默认音色"
              />
            </div>
          )}
        </ModelModule>

        <ModelModule
          actions={null}
          busy={busy}
          error={manager.errors.embedding}
          hint="向量模型：相似笔记检索与语义搜索"
          icon="embedding"
          name="Embedding"
          progress={manager.progress.embedding}
          ready={Boolean(manager.embedding?.installed)}
          readyHint={manager.embedding?.installed ? '可搜索' : '尚未安装'}
          runtimes={runtimes.embedding}
        >
          <ModelSelect
            busyId={manager.busyId}
            label="选择向量模型"
            onDelete={null}
            onDownload={manager.installEmbedding}
            onSelect={() => {}}
            options={embeddingOptions}
            placeholder="未安装"
          />
        </ModelModule>

        <ModelModule
          actions={null}
          busy={busy}
          error={manager.errors.llm}
          hint="语言模型：总结、问答与内容整理"
          icon="llm"
          name="LLM"
          progress={manager.progress.llm}
          ready={Boolean(languageModel?.runtimeReady)}
          readyHint={languageModel?.runtimeReady ? '可对话' : '尚未就绪'}
          runtimes={runtimes.llm}
        >
          <ModelSelect
            busyId={manager.busyId}
            label="选择语言模型"
            onDelete={manager.llm.remove}
            onDownload={manager.llm.download}
            onSelect={manager.llm.select}
            options={llmOptions}
            placeholder="未选择模型"
          />
        </ModelModule>
      </div>

      {playback.error && (
        <p className="model-manager-note" role="alert">
          {playback.error}
        </p>
      )}
    </div>
  );
}
