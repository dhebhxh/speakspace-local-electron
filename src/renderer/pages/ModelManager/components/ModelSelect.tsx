import { useEffect, useRef, useState } from 'react';
import { ModelIcons } from './ModelIcons';
import './ModelSelect.css';

export type ModelOption = {
  id: string;
  name: string;
  /** 尺寸、语言等短元信息，只在下拉里展示。 */
  meta?: string;
  /** 三个字以内的短标签，用来快速判断模型取舍。 */
  tags?: string[];
  /** 长说明只作为悬停提示，避免页面出现大段文字。 */
  description?: string;
  downloaded: boolean;
  active: boolean;
  recommended?: boolean;
};

export type ModelSelectProps = {
  label: string;
  options: ModelOption[];
  placeholder: string;
  /** 正在执行操作的模型 id，用于在该行显示转圈图标。 */
  busyId: string | null;
  onSelect: (id: string) => void;
  /** 传 null 表示该模块没有对应操作，下拉里就不显示这个图标。 */
  onDownload: ((id: string) => void) | null;
  onDelete: ((id: string) => void) | null;
};

/**
 * 模型下拉选择框：选择、下载、删除都收在同一个下拉里，
 * 状态和操作一律用图标表达，推荐项只加一个短标签。
 */
export default function ModelSelect({
  label,
  options,
  placeholder,
  busyId,
  onSelect,
  onDownload,
  onDelete,
}: ModelSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const activeOption = options.find((option) => option.active) ?? null;
  const isDisabled = options.length === 0;

  function handleRowClick(option: ModelOption) {
    if (busyId) return;
    if (option.downloaded) {
      if (!option.active) onSelect(option.id);
      setOpen(false);
      return;
    }
    onDownload?.(option.id);
  }

  return (
    <div className="model-select" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label}
        className={`model-select-trigger${open ? ' is-open' : ''}`}
        disabled={isDisabled}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className="model-select-value">
          {activeOption ? activeOption.name : placeholder}
        </span>
        {activeOption?.meta && (
          <span className="model-select-meta">{activeOption.meta}</span>
        )}
        <span className="model-select-chevron">{ModelIcons.chevron}</span>
      </button>

      {open && (
        <ul aria-label={label} className="model-select-list" role="listbox">
          {options.map((option) => {
            const busy = busyId === option.id;
            let stateIcon = ModelIcons.cloud;
            if (option.active) stateIcon = ModelIcons.active;
            else if (option.downloaded) stateIcon = ModelIcons.check;
            if (busy) stateIcon = ModelIcons.spinner;

            return (
              <li
                aria-selected={option.active}
                className={`model-option${option.active ? ' is-active' : ''}`}
                key={option.id}
                role="option"
              >
                <button
                  className="model-option-main"
                  disabled={busyId !== null}
                  onClick={() => handleRowClick(option)}
                  title={option.description}
                  type="button"
                >
                  <span
                    className={`model-option-state${option.downloaded ? ' is-local' : ''}`}
                  >
                    {stateIcon}
                  </span>
                  <span className="model-option-body">
                    <span className="model-option-line">
                      <span className="model-option-name">{option.name}</span>
                      {option.meta && (
                        <span className="model-option-meta">{option.meta}</span>
                      )}
                    </span>
                    {(option.recommended || option.tags?.length) && (
                      <span className="model-option-tags">
                        {option.recommended && (
                          <span className="model-option-tag is-recommended">
                            推荐
                          </span>
                        )}
                        {option.tags?.map((tag) => (
                          <span className="model-option-tag" key={tag}>
                            {tag}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                </button>

                <span className="model-option-actions">
                  {!option.downloaded && onDownload && (
                    <button
                      aria-label={`下载 ${option.name}`}
                      className="model-icon-button"
                      disabled={busyId !== null}
                      onClick={() => onDownload(option.id)}
                      title="下载"
                      type="button"
                    >
                      {ModelIcons.download}
                    </button>
                  )}
                  {option.downloaded && onDelete && (
                    <button
                      aria-label={`删除 ${option.name}`}
                      className="model-icon-button is-danger"
                      disabled={busyId !== null || option.active}
                      onClick={() => onDelete(option.id)}
                      title={option.active ? '使用中，无法删除' : '删除'}
                      type="button"
                    >
                      {ModelIcons.trash}
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
