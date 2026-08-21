# Windows + SideStore 安装 SpeakSpace iOS 测试版

这份文档面向没有 Mac、没有付费 Apple Developer Program 账号的组员。安装包来自本项目的 GitHub Release；每位测试者使用自己的免费 Apple Account 在自己的 iPhone 上签名。

## 先理解限制

- SideStore 不是 Apple 官方分发渠道；它使用 Apple 免费 Personal Team 的设备测试能力。
- 免费签名通常只有 7 天有效期。到期前必须刷新，过期后应用会暂时无法启动。
- Apple 免费账号每台设备最多同时安装 3 个开发应用，SideStore 本身也会占用一个名额。
- 第一次配置需要 Windows 电脑；配置完成后通常可以在 iPhone 上通过 SideStore 和本地 VPN 刷新。
- 刷新签名不等于卸载。不要删除 SpeakSpace，否则本地笔记、录音、Workspace、聊天和已下载模型会一起被 iOS 删除。
- 不要多人共享 Apple Account，也不要把密码、验证码或配对文件发给组员。

Apple 对免费 Personal Team 的限制见 [Choosing a Membership](https://developer.apple.com/support/compare-memberships/)。SideStore 的步骤可能随版本变化；安装 SideStore 本身时始终以 [SideStore 官方安装文档](https://docs.sidestore.io/docs/installation/install) 为准。

## 需要准备

1. Windows 10 或 Windows 11 电脑。
2. 一台运行 iOS 16.4 或更高版本的 iPhone。
3. iPhone 数据线，第一次配对时使用。
4. 每位测试者自己的 Apple Account。建议使用专门用于课程项目测试的账号。
5. GitHub Release 中的两个文件：
   - `SpeakSpace-iOS-v1.0.0.ipa`
   - `SpeakSpace-iOS-v1.0.0.ipa.sha256`

本次已验证构建的下载页（在上游 PR 合并前由 YQ fork 托管）：
<https://github.com/Yanqing797/speakspace-local-mobile/releases/tag/ios-v1.0.0>

上游仓库合并后，维护者可以把同一 IPA 和校验文件镜像到
`dhebhxh/speakspace-local-mobile` 的同名 Release；测试者应只使用本文件列出的
GitHub 仓库和 SHA-256 校验，不使用第三方网盘重新打包的版本。

## 第一步：核对安装包

把 IPA 和 SHA-256 文件放到同一文件夹，在 PowerShell 中进入该文件夹并运行：

```powershell
Get-FileHash .\SpeakSpace-iOS-v1.0.0.ipa -Algorithm SHA256
Get-Content .\SpeakSpace-iOS-v1.0.0.ipa.sha256
```

两处显示的 64 位十六进制值必须完全一致。不同则不要安装，重新从 GitHub Release 下载。

## 第二步：安装并配置 SideStore

1. 打开 [SideStore 官方安装文档](https://docs.sidestore.io/docs/installation/install)。
2. 选择当前提供的 Windows 安装路线，下载文档指定的官方工具。
3. 用数据线连接 iPhone，在 iPhone 上点击“信任此电脑”。
4. 按官方文档生成并导入这台 iPhone 的 pairing file。这个文件只属于当前设备，不要分享。
5. 使用自己的 Apple Account 完成 SideStore 的免费签名。
6. 在 iPhone 打开“设置 → 通用 → VPN 与设备管理”，信任对应的开发者 App。
7. 在“设置 → 隐私与安全性 → 开发者模式”中启用 Developer Mode，并按系统要求重启。
8. 按 SideStore 文档配置 LocalDevVPN，确认 SideStore 可以正常打开并显示剩余签名天数。

不要从不明网盘或所谓“企业证书商店”下载 SideStore。共享企业证书可能随时被撤销，也无法证明安装包未被修改。

## 第三步：安装 SpeakSpace IPA

1. 把 `SpeakSpace-iOS-v1.0.0.ipa` 保存到 iPhone 的“文件”App，或从 iPhone 打开 GitHub Release 下载。
2. 在共享菜单中选择 SideStore；如果没有显示，打开 SideStore 后使用添加 IPA 的入口。
3. 等待 SideStore 完成重新签名和安装。不要在处理中关闭 SideStore 或 LocalDevVPN。
4. 回到主屏幕打开 SpeakSpace。
5. 首次启动时允许麦克风权限。

如果安装时提示 App ID 或设备数量已达到上限，先在 SideStore 中检查当前已安装的免费开发应用。不要删除仍有重要本地数据的 SpeakSpace。

## 第四步：下载本地模型

IPA 不包含数百 MB 到数 GB 的 AI 模型。每台手机必须单独下载：

1. 打开 `AI`。
2. 在 Speech recognition models 中下载并启用需要的 STT 模型。中文测试建议使用 `Whisper Small Multilingual (F16)`。
3. 在 LLM Models 中下载并启用问答模型。
4. 在 TTS Models 中下载并启用语音模型。

下载模型时保持 SpeakSpace 在前台，并预留足够存储空间。下载功能会联网，但录音、转录、笔记、Workspace 和聊天内容保存在当前 iPhone 的应用容器中。

## 第五步：每 7 天刷新

不要等到倒计时变成 0：

1. 建议每 5 至 6 天打开一次 SideStore。
2. 打开 SideStore 文档要求的 LocalDevVPN。
3. 进入 `My Apps`。
4. 点击 SpeakSpace 旁边的剩余天数或 Refresh。
5. 等待倒计时恢复到 7 天附近，再关闭本地 VPN。

刷新完成后直接打开原来的 SpeakSpace，不要卸载重装。Apple 的 provisioning profile 仍会周期性过期；SideStore 只能帮助续签，不能取消这个限制。

## 最小验收步骤

每位组员安装后至少检查：

1. App 在不连接电脑、不运行 Metro 的情况下启动。
2. 下载并启用一个 STT 模型。
3. 录制 20 至 30 秒中文语音，点击 Finish 后出现转写结果。
4. 把转录保存进 Workspace，强制关闭 App 后重新打开，笔记仍存在。
5. 在 Ask AI 中询问转录中的明确事实，回答基于选中的转录。
6. SideStore 显示 SpeakSpace 的有效期，并能完成一次手动 Refresh。

请把 iPhone 型号、iOS 版本、SideStore 版本和失败截图记录到团队测试表中。

## 常见问题

### 打开 SpeakSpace 时提示不再可用

通常是 7 天签名过期。打开 LocalDevVPN 和 SideStore，重新刷新 SpeakSpace。若 SideStore 本身也过期，需要按官方文档重新激活 SideStore。

### 配对文件失效

iOS 升级、设备还原或系统变化可能使 pairing file 失效。重新按 SideStore 官方文档为当前 iPhone 生成配对文件，不要使用其他人的文件。

### 安装成功但模型下载失败

检查 Wi-Fi、剩余存储和 SideStore 重签后的网络权限。保持 SpeakSpace 在前台重新开始下载；失败的临时文件会被清理，不应删除已有模型或笔记。

### 刷新会不会清除数据

使用相同 Apple Account、相同 SideStore 安装记录进行 Refresh，正常情况下不会删除应用容器。卸载、改变最终 Bundle ID、换签名账号或清除设备数据都可能导致无法继续访问原容器，因此重要测试材料应另行备份。

### 只有 iPhone，没有 Windows/Mac/Linux 电脑

无法完成可靠的首次免费签名配置。不要使用来源不明的共享企业证书或声称“永久免签”的网站。

## 项目维护者发布清单

发布新的 SideStore 版本时：

1. 从已验证的 iPhone Release `.app` 生成 IPA：

   ```bash
   npm run package:ios:sidestore -- /absolute/path/to/speakspacelocalmobile.app
   ```

2. 检查 `dist/ios/` 中 IPA 与 `.sha256` 同时生成。
3. 解压检查 IPA 只有 `Payload/*.app` 结构，且没有原开发者的 `_CodeSignature` 和 `embedded.mobileprovision`。
4. 把两个文件上传到与版本号一致的 GitHub Release。
5. 至少让一名 Windows 测试者完成真实安装和一次 Refresh，再扩大测试范围。
