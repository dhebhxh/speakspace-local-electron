import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SystemProfile } from '../../../../main/recommendation/ModelRecommendationTypes';

/** 主进程返回的档位是中文枚举，这里映射成翻译键和 CSS 用的英文类名。 */
const LEVELS: Record<
  SystemProfile['level'],
  { labelKey: string; slug: string }
> = {
  入门: { labelKey: 'settings.hardware.level.entry', slug: 'entry' },
  均衡: { labelKey: 'settings.hardware.level.balanced', slug: 'balanced' },
  高性能: { labelKey: 'settings.hardware.level.high', slug: 'high' },
};

/** 展示本机 CPU、内存、显卡和存储，供用户判断该选哪一档模型。 */
export default function HardwareSettingsPanel() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<SystemProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const detect = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const next = (await window.electron.recommendation.getSystemProfile()) as
        | SystemProfile
        | undefined;
      setProfile(next ?? null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t('settings.hardware.error'),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    detect();
  }, [detect]);

  const unknown = t('settings.hardware.unknown');

  // 有几块显卡就列几行；一块都没探测到时保留一行提示未检测到。
  const gpuRows =
    profile && profile.gpus.length > 0
      ? profile.gpus.map((gpu, index) => ({
          key: `gpu-${index}`,
          glyph: '◈',
          label:
            index === 0
              ? t('settings.hardware.gpu')
              : `${t('settings.hardware.gpu')} ${index + 1}`,
          value: gpu.name,
          detail: [
            gpu.vramGb ? `${gpu.vramGb} GB` : '',
            gpu.virtual ? t('settings.hardware.gpu.virtual') : '',
          ]
            .filter(Boolean)
            .join(' · '),
        }))
      : [
          {
            key: 'gpu-0',
            glyph: '◈',
            label: t('settings.hardware.gpu'),
            value: unknown,
            detail: '',
          },
        ];

  const cudaRow = {
    key: 'cuda',
    glyph: '⚡',
    label: t('settings.hardware.cuda'),
    value: profile?.cuda.available
      ? `CUDA ${profile.cuda.version ?? ''}`.trim()
      : t('settings.hardware.cuda.unavailable'),
    detail:
      profile?.cuda.available && profile.cuda.driverVersion
        ? `${t('settings.hardware.driver')} ${profile.cuda.driverVersion}`
        : '',
  };

  const rows = [
    {
      key: 'cpu',
      glyph: '⌘',
      label: t('settings.hardware.cpu'),
      value: profile?.cpuModel ?? unknown,
      detail: profile
        ? t('settings.hardware.cores', { count: profile.logicalCores })
        : '',
    },
    {
      key: 'memory',
      glyph: '▤',
      label: t('settings.hardware.memory'),
      value: profile ? `${profile.totalMemoryGb} GB` : unknown,
      detail: profile
        ? `${profile.availableMemoryGb} GB ${t('settings.hardware.free')}`
        : '',
    },
    ...gpuRows,
    cudaRow,
    {
      key: 'storage',
      glyph: '⬒',
      label: t('settings.hardware.storage'),
      value: profile?.storage ? `${profile.storage.totalGb} GB` : unknown,
      detail: profile?.storage
        ? `${profile.storage.freeGb} GB ${t('settings.hardware.free')}`
        : '',
    },
    {
      key: 'system',
      glyph: '❖',
      label: t('settings.hardware.system'),
      value: profile ? `${profile.platform} · ${profile.arch}` : unknown,
      detail: '',
    },
  ];

  return (
    <section className="settings-panel" aria-labelledby="hardware-title">
      <div className="settings-panel-heading">
        <span className="settings-panel-icon hardware-icon" aria-hidden="true">
          ▣
        </span>
        <div>
          <h2 id="hardware-title">{t('settings.hardware.title')}</h2>
          <p>{t('settings.hardware.desc')}</p>
        </div>
        <button
          className="settings-hardware-refresh"
          disabled={loading}
          onClick={detect}
          type="button"
        >
          {t('settings.hardware.refresh')}
        </button>
      </div>

      {error && (
        <p className="settings-error" role="alert">
          {error}
        </p>
      )}

      <dl className="settings-hardware-grid">
        {rows.map((row) => (
          <div className="settings-hardware-item" key={row.key}>
            <dt>
              <span className="settings-hardware-glyph" aria-hidden="true">
                {row.glyph}
              </span>
              {row.label}
            </dt>
            <dd>
              <strong title={row.value}>{row.value}</strong>
              {row.detail && <small>{row.detail}</small>}
            </dd>
          </div>
        ))}
      </dl>

      {profile && (
        <p className="settings-hardware-level">
          {t('settings.hardware.level')}
          <span
            className={`settings-hardware-badge is-${LEVELS[profile.level].slug}`}
          >
            {t(LEVELS[profile.level].labelKey)}
          </span>
          {profile.storage && (
            <small title={profile.storage.root}>
              {t('settings.hardware.root')}
            </small>
          )}
        </p>
      )}

      <p className="settings-hardware-hint">{t('settings.hardware.hint')}</p>
    </section>
  );
}
