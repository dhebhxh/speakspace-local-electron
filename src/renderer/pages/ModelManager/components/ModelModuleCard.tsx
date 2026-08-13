import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import './ModelModuleCard.css';

export type ModuleKind = 'stt' | 'tts' | 'embedding' | 'lm';
export type ModelMetaKind =
  | 'size'
  | 'language'
  | 'engine'
  | 'format'
  | 'speed'
  | 'parameters';

export type RichModelOption = {
  value: string;
  name: string;
  metadata: Array<{
    kind: ModelMetaKind;
    label: string;
    value: string;
  }>;
  downloaded: boolean;
  current: boolean;
  recommended: boolean;
};

type ModelModuleCardProps = {
  kind: ModuleKind;
  title: string;
  subtitle: string;
  value: string;
  options: RichModelOption[];
  pendingValue: string | null;
  error: string;
  onChange(value: string): void;
  onDownload(value: string): void;
  onDelete(value: string): void;
};

function ModuleIcon({ kind }: { kind: ModuleKind }) {
  if (kind === 'stt') {
    return (
      <svg viewBox="0 0 24 24">
        <path d="M4 12h2l2-6 3 12 3-9 2 6 2-3h2" />
      </svg>
    );
  }
  if (kind === 'tts') {
    return (
      <svg viewBox="0 0 24 24">
        <path d="M5 10v4M9 7v10M13 4v16M17 8v8M21 10v4" />
      </svg>
    );
  }
  if (kind === 'embedding') {
    return (
      <svg viewBox="0 0 24 24">
        <circle cx="6" cy="7" r="2" />
        <circle cx="18" cy="6" r="2" />
        <circle cx="12" cy="18" r="2" />
        <path d="m8 7 8-1M7 9l4 7M17 8l-4 8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24">
      <path d="M7 8a5 5 0 0 1 9-2 4 4 0 0 1 1 7 5 5 0 0 1-9 3 4 4 0 0 1-1-8Z" />
      <path d="M9 10h6M9 13h4" />
    </svg>
  );
}

function MetaIcon({ kind }: { kind: ModelMetaKind }) {
  if (kind === 'size') {
    return (
      <svg viewBox="0 0 16 16">
        <path d="M3 3h10v10H3zM6 1v2M10 1v2M6 13v2M10 13v2M1 6h2M13 6h2M1 10h2M13 10h2" />
      </svg>
    );
  }
  if (kind === 'language') {
    return (
      <svg viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="6" />
        <path d="M2 8h12M8 2c2 2 2 10 0 12M8 2C6 4 6 12 8 14" />
      </svg>
    );
  }
  if (kind === 'speed') {
    return (
      <svg viewBox="0 0 16 16">
        <path d="M3 12a6 6 0 1 1 10 0M8 8l3-2" />
      </svg>
    );
  }
  if (kind === 'parameters') {
    return (
      <svg viewBox="0 0 16 16">
        <path d="M3 4h10M3 8h10M3 12h10M6 2v4M11 6v4M5 10v4" />
      </svg>
    );
  }
  if (kind === 'format') {
    return (
      <svg viewBox="0 0 16 16">
        <path d="M4 2h6l3 3v9H4zM10 2v3h3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16">
      <circle cx="4" cy="4" r="2" />
      <circle cx="12" cy="4" r="2" />
      <circle cx="8" cy="12" r="2" />
      <path d="m5.5 5.5 1.5 4M10.5 5.5 9 10M6 4h4" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 20 20">
      <path d="M10 3v9M6.5 8.5 10 12l3.5-3.5M4 15h12" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 20 20">
      <path d="M4 6h12M8 3h4l1 3H7l1-3ZM6 6l.7 11h6.6L14 6M8.5 9v5M11.5 9v5" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="model-option-spinner" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="7" />
    </svg>
  );
}

function OptionActionIcon({
  pending,
  downloaded,
}: {
  pending: boolean;
  downloaded: boolean;
}) {
  if (pending) return <SpinnerIcon />;
  return downloaded ? <DeleteIcon /> : <DownloadIcon />;
}

function ModelMeta({
  option,
  compact,
}: {
  option: RichModelOption;
  compact: boolean;
}) {
  const metadata = compact ? option.metadata.slice(0, 4) : option.metadata;
  return (
    <div className="model-option-meta">
      {metadata.map((meta) => (
        <span
          className="model-option-meta__item"
          key={`${meta.kind}:${meta.value}`}
          title={`${meta.label}：${meta.value}`}
        >
          <MetaIcon kind={meta.kind} />
          <span>{meta.value}</span>
        </span>
      ))}
    </div>
  );
}

export default function ModelModuleCard({
  kind,
  title,
  subtitle,
  value,
  options,
  pendingValue,
  error,
  onChange,
  onDownload,
  onDelete,
}: ModelModuleCardProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? options[0],
    [options, value],
  );

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  const selectOption = (option: RichModelOption) => {
    onChange(option.value);
    setOpen(false);
  };

  const handleTriggerKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') setOpen(false);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
    }
  };

  return (
    <section
      className={`model-module model-module--${kind}${open ? ' is-open' : ''}`}
      ref={rootRef}
    >
      <header className="model-module__header">
        <div className="model-module__identity">
          <span className="model-module__icon" aria-hidden="true">
            <ModuleIcon kind={kind} />
          </span>
          <div>
            <h2>{title}</h2>
            <span>{subtitle}</span>
          </div>
        </div>
        <span
          className={`model-module__status${selected?.current ? ' is-ready' : ''}`}
          title={
            selected?.current
              ? t('models.card.current')
              : t('models.card.inactive')
          }
          aria-label={
            selected?.current
              ? t('models.card.current')
              : t('models.card.inactive')
          }
        >
          {selected?.current ? (
            <svg viewBox="0 0 18 18">
              <path d="m4 9 3 3 7-7" />
            </svg>
          ) : (
            <DownloadIcon />
          )}
        </span>
      </header>

      <div className="rich-model-select">
        <button
          type="button"
          className="rich-model-select__trigger"
          aria-controls={`${kind}-model-options`}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen((current) => !current)}
          onKeyDown={handleTriggerKeyDown}
        >
          <span className="rich-model-select__selection">
            <strong>{selected?.name ?? t('models.card.none')}</strong>
            {selected && <ModelMeta option={selected} compact />}
          </span>
          <svg className="rich-model-select__chevron" viewBox="0 0 18 18">
            <path d="m5 7 4 4 4-4" />
          </svg>
        </button>

        {open && (
          <div
            className="rich-model-select__menu"
            id={`${kind}-model-options`}
            role="listbox"
            aria-label={t('models.card.choose', { title })}
          >
            {options.map((option) => {
              const optionPending = pendingValue === option.value;
              return (
                <div
                  className={`rich-model-option${
                    option.value === value ? ' is-selected' : ''
                  }`}
                  key={option.value}
                  role="option"
                  aria-selected={option.value === value}
                >
                  <button
                    type="button"
                    className="rich-model-option__select"
                    disabled={optionPending}
                    onClick={() => selectOption(option)}
                  >
                    <span className="rich-model-option__title">
                      <strong>{option.name}</strong>
                      {option.recommended && (
                        <span
                          className="rich-model-option__marker is-recommended"
                          title={t('models.card.recommended')}
                          aria-label={t('models.card.recommended')}
                        >
                          <svg viewBox="0 0 18 18">
                            <path d="m9 2 2 4 4.5.6-3.3 3.2.8 4.5L9 12.2l-4 2.1.8-4.5-3.3-3.2L7 6l2-4Z" />
                          </svg>
                        </span>
                      )}
                      {option.current && (
                        <span
                          className="rich-model-option__marker is-current"
                          title={t('models.card.currentShort')}
                          aria-label={t('models.card.currentShort')}
                        >
                          <svg viewBox="0 0 18 18">
                            <path d="m4 9 3 3 7-7" />
                          </svg>
                        </span>
                      )}
                    </span>
                    <ModelMeta option={option} compact={false} />
                  </button>

                  <button
                    type="button"
                    className={`rich-model-option__action${
                      option.downloaded ? ' is-delete' : ' is-download'
                    }`}
                    disabled={optionPending || pendingValue !== null}
                    title={
                      option.downloaded
                        ? t('models.card.delete')
                        : t('models.card.download')
                    }
                    aria-label={t(
                      option.downloaded
                        ? 'models.card.deleteNamed'
                        : 'models.card.downloadNamed',
                      { name: option.name },
                    )}
                    onClick={() =>
                      option.downloaded
                        ? onDelete(option.value)
                        : onDownload(option.value)
                    }
                  >
                    <OptionActionIcon
                      pending={optionPending}
                      downloaded={option.downloaded}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <p className="model-module__error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
