import { TTSSpeaker } from './TTSRuntimeTypes';

const VOICE_NAMES = [
  'af_alloy',
  'af_aoede',
  'af_bella',
  'af_heart',
  'af_jessica',
  'af_kore',
  'af_nicole',
  'af_nova',
  'af_river',
  'af_sarah',
  'af_sky',
  'am_adam',
  'am_echo',
  'am_eric',
  'am_fenrir',
  'am_liam',
  'am_michael',
  'am_onyx',
  'am_puck',
  'am_santa',
  'bf_alice',
  'bf_emma',
  'bf_isabella',
  'bf_lily',
  'bm_daniel',
  'bm_fable',
  'bm_george',
  'bm_lewis',
  'ef_dora',
  'em_alex',
  'ff_siwis',
  'hf_alpha',
  'hf_beta',
  'hm_omega',
  'hm_psi',
  'if_sara',
  'im_nicola',
  'jf_alpha',
  'jf_gongitsune',
  'jf_nezumi',
  'jf_tebukuro',
  'jm_kumo',
  'pf_dora',
  'pm_alex',
  'pm_santa',
  'zf_xiaobei',
  'zf_xiaoni',
  'zf_xiaoxiao',
  'zf_xiaoyi',
  'zm_yunjian',
  'zm_yunxi',
  'zm_yunxia',
  'zm_yunyang',
] as const;

const DEFAULT_SPEAKER_ID = 45;
const CHINESE_NAMES: Record<string, string> = {
  zf_xiaobei: '小贝',
  zf_xiaoni: '小妮',
  zf_xiaoxiao: '晓晓',
  zf_xiaoyi: '小艺',
  zm_yunjian: '云健',
  zm_yunxi: '云熙',
  zm_yunxia: '云夏',
  zm_yunyang: '云阳',
};

function getLanguage(prefix: string): string {
  const names: Record<string, string> = {
    a: '美式英语',
    b: '英式英语',
    e: '西班牙语',
    f: '法语',
    h: '印地语',
    i: '意大利语',
    j: '日语',
    p: '葡萄牙语',
    z: '中文',
  };
  return names[prefix[0]] ?? '多语言';
}

/** Kokoro v1.0 的 speaker id 与模型内 voices.bin 顺序一致。 */
export function getTTSSpeakers(): TTSSpeaker[] {
  return VOICE_NAMES.map((name, id) => {
    const language = getLanguage(name);
    const displayName = CHINESE_NAMES[name] ?? name.split('_')[1];
    return {
      id,
      name,
      label: `${language} · ${displayName}${id === DEFAULT_SPEAKER_ID ? '（默认）' : ''}`,
      language,
      isDefault: id === DEFAULT_SPEAKER_ID,
    };
  });
}

export { DEFAULT_SPEAKER_ID };
