/* eslint-disable no-console */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

/**
 * Electron 的二进制不随 npm 包发布，而是 postinstall 阶段单独下载 + 解压的。
 * 这一步失败时 npm install 依然会以 0 退出，用户要到 `npm start` 才发现应用起不来，
 * 报错也看不出和依赖有关。这个脚本在 install 之后和 start 之前各跑一次。
 *
 * Windows 上最常见的成因是「上一次的开发实例还开着」：
 * 运行中的 electron.exe 会锁住 dist 里的 resources.pak / locales 等文件，
 * 解压既覆盖不了也删不掉，于是留下一个缺可执行文件的半成品 dist。
 * 所以检测到不完整时，先看是谁占着，再决定要不要重装。
 */

const electronPackagePath = path.dirname(
  require.resolve('electron/package.json'),
);
const distPath = path.join(electronPackagePath, 'dist');

/** path.txt 记录了当前平台可执行文件在 dist 里的相对路径。 */
function getExecutablePath() {
  const pathTxt = path.join(electronPackagePath, 'path.txt');
  if (!fs.existsSync(pathTxt)) return null;
  const relative = fs.readFileSync(pathTxt, 'utf8').trim();
  return relative ? path.join(distPath, relative) : null;
}

/** path.txt、version 和可执行文件三者齐备，dist 才算解压完整。 */
function isBinaryComplete() {
  const executablePath = getExecutablePath();
  if (!executablePath || !fs.existsSync(executablePath)) return false;
  if (!fs.existsSync(path.join(distPath, 'version'))) return false;
  // 解压中断会留下 0 字节的占位文件，大小检查能识别出这种半成品。
  return fs.statSync(executablePath).size > 0;
}

/** 仍在占用本仓库 Electron 二进制的进程数；探测本身失败时按 0 处理。 */
function countRunningElectronProcesses() {
  try {
    if (process.platform === 'win32') {
      const output = execFileSync(
        'tasklist',
        ['/FI', 'IMAGENAME eq electron.exe', '/FO', 'CSV', '/NH'],
        { encoding: 'utf8' },
      );
      return output.split(/\r?\n/).filter((line) => line.includes('electron'))
        .length;
    }
    const output = execFileSync('pgrep', ['-f', distPath], {
      encoding: 'utf8',
    });
    return output.split(/\s+/).filter(Boolean).length;
  } catch {
    // 没有匹配进程时 tasklist / pgrep 以非零码退出，等同于「没人占用」。
    return 0;
  }
}

function reinstallElectron() {
  console.log(
    chalk.yellow(
      'Electron 可执行文件缺失，正在重新解压运行时… / Electron binary missing, reinstalling…',
    ),
  );
  // 先清空再解压：直接往半成品 dist 上覆盖，在 Windows 上会静默失败。
  // 删不掉时不阻断，交给 install.js 尽力补齐，最终以完整性检查为准。
  try {
    fs.rmSync(distPath, { recursive: true, force: true });
  } catch (error) {
    console.warn(
      chalk.yellow(`无法清空 ${distPath}（${error.code}），将尝试直接补齐。`),
    );
  }
  execFileSync(process.execPath, ['install.js'], {
    cwd: electronPackagePath,
    stdio: 'inherit',
  });
}

function reportFailure(runningProcessCount) {
  const lines = [
    '',
    ' Electron 二进制不完整，应用无法启动。 / Electron binary is incomplete. ',
    '',
    ` 期望路径 / Expected: ${getExecutablePath() ?? '<path.txt 缺失 / missing>'} `,
    '',
  ];

  if (runningProcessCount > 0) {
    lines.push(
      ` 检测到 ${runningProcessCount} 个 Electron 进程仍在运行，正锁住 dist 目录。 `,
      ` ${runningProcessCount} Electron process(es) are running and locking dist. `,
      '',
      ' 修复方式 / Fix: 先关掉所有开发实例，再重新安装 ',
      process.platform === 'win32'
        ? '   taskkill /F /IM electron.exe /T && npm install '
        : '   pkill -f node_modules/electron/dist && npm install ',
    );
  } else {
    lines.push(
      ' 修复方式 / Fix: ',
      '   rm -rf node_modules/electron && npm install ',
      ' 网络受限时可先设置镜像 / Behind a proxy set a mirror first: ',
      '   npm config set electron_mirror https://npmmirror.com/mirrors/electron/ ',
    );
  }

  lines.push('');
  console.error(chalk.whiteBright.bgRed.bold(lines.join('\n')));
}

function main() {
  if (process.env.ELECTRON_SKIP_BINARY_DOWNLOAD) {
    console.log(
      chalk.yellow(
        'ELECTRON_SKIP_BINARY_DOWNLOAD 已设置，跳过 Electron 二进制自检。',
      ),
    );
    return;
  }

  if (isBinaryComplete()) return;

  const runningProcessCount = countRunningElectronProcesses();
  if (runningProcessCount === 0) {
    try {
      reinstallElectron();
    } catch (error) {
      console.error(chalk.red('Electron 安装脚本执行失败：'), error.message);
    }

    if (isBinaryComplete()) {
      console.log(
        chalk.green('Electron 可执行文件已恢复 / Electron binary restored.'),
      );
      return;
    }
  }

  reportFailure(runningProcessCount);
  process.exit(1);
}

main();
