/**
 * 待办提取的离线评测。
 *
 * 默认跳过：它要连本机 Ollama，跑一轮几十秒，不适合放进 npm test。
 * 需要时显式打开：
 *
 *   TODO_EVAL=1 npx jest todoExtraction.eval
 *   TODO_EVAL=1 TODO_EVAL_MODEL=qwen2.5:7b-instruct npx jest todoExtraction.eval
 *
 * 用的是和线上完全相同的 prompt、日期标注和后处理，
 * 所以这里的通过率就是用户实际会看到的表现。
 */

import * as http from 'http';
import {
  buildDateReference,
  normalizeDueDate,
} from '../main/dashboard/DateContext';
import { rewriteRelativeDates } from '../main/dashboard/RelativeDateRewriter';
import {
  annotateCompletedClauses,
  isEntirelyCompleted,
} from '../main/dashboard/CompletionDetector';
import {
  expandOccurrences,
  normalizeRepeat,
  RepeatKind,
} from '../main/dashboard/RecurrenceExpander';
import { buildExtractionPrompt } from '../main/dashboard/TodoExtractionPrompt';
import {
  allowsOwnershipDrops,
  buildOwnershipPrompt,
  isSuspiciousVerdictSet,
  parseOwnershipVerdicts,
} from '../main/dashboard/TodoOwnershipFilter';

const ENABLED = process.env.TODO_EVAL === '1';
const MODEL = process.env.TODO_EVAL_MODEL ?? 'qwen2.5:3b-instruct';
const HOST = process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434';

/** 与用户手工测试同一天，保证预期日期可以直接对照。 */
const NOW = new Date(2026, 7, 20, 14, 30);
const TODAY = '2026-08-20';

type Expectation = {
  id: string;
  name: string;
  text: string;
  /** 期望的待办条数（展开重复之前）。 */
  count: number | { min: number; max: number };
  /** 期望出现的日期（展开重复之前）。 */
  dates?: string[];
  /** 语义本身有歧义时，命中其中任意一个即可。 */
  anyDate?: string[];
  /** 期望的重复类型。 */
  repeats?: (RepeatKind | null)[];
  /** 标题里必须命中的关键词，每组至少命中一个。 */
  keywords?: string[][];
  /** 标题里绝对不该出现的词。 */
  forbidden?: string[];
};

const CASES: Expectation[] = [
  {
    id: '1',
    name: '单条任务，绝对日期',
    text: '九月四号上午十点我要去参加那个供应商的评审会，地点在三号楼会议室。',
    count: 1,
    dates: ['2026-09-04'],
    // 「三号楼」绝不能被当成日期
    forbidden: ['2026-08-03', '2026-09-03'],
  },
  {
    id: '2',
    name: '多条任务，混合日期',
    text: '这周的安排我说一下。周五之前把季度报表发给财务那边，下周一要交差旅报销的单子，然后八月三十一号之前必须把服务器的续费办完，不然要停机。',
    count: 3,
    dates: ['2026-08-21', '2026-08-24', '2026-08-31'],
  },
  {
    id: '3',
    name: '口语相对时间',
    text: '明天早上记得给张经理回个电话，后天下午的培训我要提前半小时到，下周三还得跟法务过一遍合同条款。',
    count: { min: 2, max: 3 },
    dates: ['2026-08-21', '2026-08-26'],
  },
  {
    id: '4',
    name: '模糊时间范围（上旬 / 年底）',
    text: '这个月底前要把新人的入职材料整理好，下个月上旬安排一次团队复盘，年底之前争取把这套流程文档补全。',
    count: 3,
    dates: ['2026-08-31', '2026-09-10', '2026-12-31'],
  },
  {
    id: '5',
    name: '周期性事项（每天 + 每周五）',
    text: '从下周开始我每天早上九点半都要过一遍值班群的消息，每周五下班前发一次周报。',
    count: 2,
    repeats: ['daily', 'weekly'],
  },
  {
    id: '6',
    name: '事件日 + 提醒日',
    text: '我下个月九月十号要去客户现场做汇报，麻烦提前三天提醒我准备材料。',
    count: 1,
    dates: ['2026-09-07'],
  },
  {
    id: '7',
    name: '截止日 + 提前量',
    text: '投标文件的截止时间是九月十五号中午十二点，我打算提前一周就开始弄，到时候九月八号那天记得叫我一下。',
    count: 1,
    dates: ['2026-09-08'],
  },
  {
    id: '8',
    name: '同一件事反复提',
    text: '那个预算表的事啊…就是预算表，我得改一下预算表。周三之前改完就行，对，就是那个预算的表格，别忘了。',
    count: 1,
    dates: ['2026-08-26'],
    keywords: [['预算']],
  },
  {
    id: '9',
    name: '抱怨式待办',
    text: '唉，李工那边的接口文档拖了快两周了，我这边一直卡着动不了。',
    count: { min: 1, max: 2 },
    keywords: [['接口', '文档', '李工']],
  },
  {
    id: '10',
    name: '客户在等',
    text: '客户那边还等着我们的报价呢，这都第三天了，人家昨天又问了一次。',
    count: { min: 1, max: 2 },
    keywords: [['报价', '客户']],
  },
  {
    id: '11',
    name: '心里记挂',
    text: '有个事儿我心里一直悬着，就是仓库那批货的保险还没续，回头得找王姐问问。',
    count: { min: 1, max: 2 },
    keywords: [['保险', '王姐', '续']],
  },
  {
    id: '12',
    name: '极度含蓄（边界，0 或 1 都可接受）',
    text: '老陈今天提的那个事，我觉得不能再拖了。',
    count: { min: 0, max: 1 },
  },
  {
    id: '13',
    name: '被动委婉语气',
    text: '如果方便的话，麻烦周四之前帮我看一眼那份合同，不着急，但最好别拖到下周。',
    count: { min: 1, max: 2 },
    // 周四当天说「周四之前」按顺延规则落在下周四
    dates: ['2026-08-27'],
    keywords: [['合同']],
  },
  {
    id: '14',
    name: '纯陈述，无任务',
    text: '今天的会主要是同步一下上半年的情况。营收比去年同期涨了百分之十二，华东区表现最好，华南稍微差一点。人员方面没什么变动，就这些。',
    count: 0,
  },
  {
    id: '15',
    name: '已完成事项',
    text: '昨天已经把报销单交上去了，合同也签完了，服务器的续费上周就办好了，邮件我也回过了。这几件事都结了。',
    count: 0,
  },
  {
    id: '16',
    name: '别人的任务（明说不管）',
    text: '小刘说他明天去对接物流，老王负责周五的客户接待，这两块我就不管了。',
    // 有「这两块我就不管了」，归属复核应把两条都筛掉
    count: 0,
  },
  {
    id: '17',
    name: '数字干扰项',
    text: '会议室改到三零一，参会的有十二个人，预算控制在四千二百块以内，项目编号是二零二六零八一七，联系电话尾号三三七八。',
    count: 0,
  },
  {
    id: '18',
    name: '有任务但没日期',
    text: '记得把打印机的墨盒换了，另外把会议室的白板笔补一下。',
    count: 2,
    dates: [TODAY, TODAY],
  },
  {
    id: '19',
    name: '中英混杂',
    text: '明天的 standup 我可能会晚点到。这个 sprint 的 retro 记得排一下，另外那个 PR 麻烦你 review 一下，deadline 是下周二。',
    count: { min: 2, max: 3 },
    dates: ['2026-08-25'],
  },
  {
    id: '20',
    name: '强口语 / 改口',
    text: '呃…那个…就是明天，不对，是后天，后天下午我要去…嗯…去银行办对公账户那个事，然后…哦对，还有个事儿，就是那个啥来着…哦，打印材料，那个得提前弄。',
    count: { min: 1, max: 3 },
    dates: ['2026-08-22'],
    forbidden: ['2026-08-21'],
  },
  {
    id: '21',
    name: '极短输入',
    text: '明天交周报。',
    count: 1,
    dates: ['2026-08-21'],
  },
  {
    id: '22',
    name: '只有寒暄',
    text: '好的好的，行，那就这样，辛苦了，再见。',
    count: 0,
  },
];

type Extracted = { title: string; dueDate: string; repeat: RepeatKind | null };

/** jsdom 环境下没有 fetch，直接用 node 的 http 打 Ollama。 */
function chat(prompt: string): Promise<string> {
  const body = JSON.stringify({
    model: MODEL,
    stream: false,
    options: { temperature: 0.1 },
    messages: [{ role: 'user', content: prompt }],
  });
  const url = new URL(`${HOST}/api/chat`);

  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (response) => {
        let raw = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          raw += chunk;
        });
        response.on('end', () => {
          try {
            const data = JSON.parse(raw) as { message?: { content?: string } };
            resolve(data.message?.content?.trim() ?? '');
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

/** 复刻线上那套解析与后处理，评测结果才等价于实际落库结果。 */
function parse(raw: string, annotated: string): Extracted[] | null {
  const grounded = new Set(
    [...annotated.matchAll(/REPEAT=([a-z]+)/gi)].map((m) => m[1].toLowerCase()),
  );
  let content = raw;
  if (content.startsWith('{') && content.endsWith('}'))
    content = `[${content}]`;
  const match = content.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return null;
    return (
      parsed
        .filter(
          (item) =>
            item &&
            typeof item.title === 'string' &&
            item.title.trim().length > 0,
        )
        .map((item) => ({
          title: String(item.title).trim(),
          dueDate: normalizeDueDate(item.dueDate, TODAY),
          repeat: (() => {
            const kind = normalizeRepeat(item.repeat);
            // 文本里没标注过这个周期就不认，防止模型脑补出 weekly
            return kind && grounded.has(kind) ? kind : null;
          })(),
        }))
        // 与线上一致：标题+日期相同的当作同一条
        .filter((item, index, all) => {
          const key = `${item.title.toLocaleLowerCase()}@${item.dueDate}`;
          return (
            all.findIndex(
              (other) =>
                `${other.title.toLocaleLowerCase()}@${other.dueDate}` === key,
            ) === index
          );
        })
    );
  } catch {
    return null;
  }
}

function check(expect_: Expectation, items: Extracted[]): string[] {
  const problems: string[] = [];
  const { count } = expect_;
  const min = typeof count === 'number' ? count : count.min;
  const max = typeof count === 'number' ? count : count.max;
  if (items.length < min || items.length > max) {
    problems.push(
      `条数 ${items.length}，期望 ${min === max ? min : `${min}~${max}`}`,
    );
  }

  (expect_.dates ?? []).forEach((date) => {
    if (!items.some((item) => item.dueDate === date)) {
      problems.push(`缺少日期 ${date}`);
    }
  });

  if (
    expect_.anyDate &&
    !items.some((item) => expect_.anyDate!.includes(item.dueDate))
  ) {
    problems.push(`日期不在可接受集合 ${expect_.anyDate.join(' / ')}`);
  }

  (expect_.forbidden ?? []).forEach((bad) => {
    if (
      items.some((item) => item.dueDate === bad || item.title.includes(bad))
    ) {
      problems.push(`出现了不该有的 ${bad}`);
    }
  });

  (expect_.keywords ?? []).forEach((group) => {
    const hit = items.some((item) =>
      group.some((word) => item.title.includes(word)),
    );
    if (!hit) problems.push(`标题里没有 ${group.join(' / ')}`);
  });

  (expect_.repeats ?? []).forEach((kind) => {
    if (!items.some((item) => item.repeat === kind)) {
      problems.push(`缺少重复类型 ${kind}`);
    }
  });

  return problems;
}

const describeMaybe = ENABLED ? describe : describe.skip;

describeMaybe(`待办提取评测 (${MODEL})`, () => {
  jest.setTimeout(180000);

  const summary: string[] = [];

  afterAll(() => {
    // eslint-disable-next-line no-console
    console.log(`\n===== 评测汇总 (${MODEL}) =====\n${summary.join('\n')}\n`);
  });

  CASES.forEach((testCase) => {
    it(`#${testCase.id} ${testCase.name}`, async () => {
      // 与线上同一条链路：日期标注 → 已完成标注 → 整段已完成则短路。
      // 短路时不问模型，直接当作零待办。
      const shortCircuited = isEntirelyCompleted(testCase.text);
      let items: Extracted[] = [];

      if (!shortCircuited) {
        const annotated = annotateCompletedClauses(
          rewriteRelativeDates(testCase.text, NOW),
        );
        const prompt = buildExtractionPrompt(
          annotated,
          buildDateReference(NOW),
        );
        const raw = await chat(prompt);
        const parsed = parse(raw, annotated);
        if (!parsed) {
          summary.push(`#${testCase.id} ✗ 输出无法解析: ${raw.slice(0, 120)}`);
          throw new Error(`模型输出不是 JSON 数组: ${raw.slice(0, 200)}`);
        }
        // 第二步复核：和线上一样，只有出现明确甩手表述才跑。
        items = parsed;
        if (parsed.length > 0 && allowsOwnershipDrops(annotated)) {
          const titles = parsed.map((item) => item.title);
          const verdictRaw = await chat(
            buildOwnershipPrompt(annotated, titles),
          );
          const verdicts = parseOwnershipVerdicts(verdictRaw, parsed.length);
          items = isSuspiciousVerdictSet(verdicts)
            ? parsed
            : parsed.filter((_, index) => !verdicts[index].drop);
        }
      }

      const problems = check(testCase, items);
      const rendered = shortCircuited
        ? '(规则判定为全部已完成，零待办)'
        : items
            .map((item) => {
              const dates = expandOccurrences(item.dueDate, item.repeat);
              const tail =
                dates.length > 1 ? ` ×${dates.length}(${item.repeat})` : '';
              return `${item.dueDate}${tail} ${item.title}`;
            })
            .join(' | ');

      summary.push(
        `#${testCase.id} ${problems.length === 0 ? '✓' : '✗'} ${testCase.name}\n` +
          `    得到: ${rendered || '(空)'}${
            problems.length > 0 ? `\n    问题: ${problems.join('; ')}` : ''
          }`,
      );

      expect(problems).toEqual([]);
    });
  });
});
