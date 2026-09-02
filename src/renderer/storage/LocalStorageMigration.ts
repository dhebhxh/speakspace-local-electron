/**
 * 产品从 SpeakSpace Local 改名为 LetsVoice 时，localStorage 的键前缀也跟着
 * 从 `speakspace:` 换成了 `letsvoice:`。老用户的引导状态、面板高度和 TTS
 * 发音人偏好都存在旧键下，启动时无损搬一次，避免设置看起来被重置。
 *
 * 只在新键不存在时写入；旧键保留不删，出问题时数据仍在原处。
 */
const LEGACY_PREFIX = 'speakspace:';
const CURRENT_PREFIX = 'letsvoice:';
const MARKER_KEY = 'letsvoice:storage-migrated';

export default function migrateLegacyLocalStorage(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (localStorage.getItem(MARKER_KEY)) return;

    Object.keys(localStorage)
      .filter((key) => key.startsWith(LEGACY_PREFIX))
      .forEach((legacyKey) => {
        const nextKey = CURRENT_PREFIX + legacyKey.slice(LEGACY_PREFIX.length);
        if (localStorage.getItem(nextKey) !== null) return;
        const value = localStorage.getItem(legacyKey);
        if (value !== null) localStorage.setItem(nextKey, value);
      });

    localStorage.setItem(MARKER_KEY, new Date().toISOString());
  } catch {
    // 隐私模式或存储被禁用时读写都会抛异常：迁移失败不该挡住渲染进程启动。
  }
}
