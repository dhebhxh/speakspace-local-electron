[CmdletBinding()]
param(
  [string]$Machine,
  [ValidateSet('full', 'llm', 'tts')]
  [string]$Mode = 'full',
  [switch]$NonInteractive,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$script:OwnedOllamaProcess = $null
$script:NpmCommand = $null
$DefaultLlmModel = 'qwen2.5:3b-instruct'

function Get-PropertyValue {
  # Windows PowerShell 5.1 has no null-conditional operator (`$obj?.Prop`),
  # so use this helper for any property read on a possibly-null object.
  param(
    [Parameter(Position = 0)]$InputObject,
    [Parameter(Position = 1, Mandatory = $true)][string]$Name,
    [Parameter(Position = 2)]$Default = $null
  )

  if ($null -eq $InputObject) {
    return $Default
  }
  $property = $InputObject.PSObject.Properties[$Name]
  if (-not $property) {
    return $Default
  }
  if ($null -eq $property.Value) {
    return $Default
  }
  return $property.Value
}

function Write-Section {
  param([string]$Title)

  Write-Host ''
  Write-Host ('=' * 68) -ForegroundColor DarkCyan
  Write-Host $Title -ForegroundColor Cyan
  Write-Host ('=' * 68) -ForegroundColor DarkCyan
}

function Resolve-MachineLabel {
  param([string]$RequestedLabel)

  $fallback = if ($env:COMPUTERNAME) {
    $env:COMPUTERNAME.ToLowerInvariant()
  } else {
    'windows-machine'
  }
  $candidate = $RequestedLabel
  if ([string]::IsNullOrWhiteSpace($candidate)) {
    $candidate = $fallback
  }

  $normalised = $candidate.Trim() -replace '[^\p{L}\p{Nd}._-]+', '-'
  $normalised = $normalised.Trim('-', '.')
  if ([string]::IsNullOrWhiteSpace($normalised)) {
    throw '机器标签不能为空；请使用字母、数字、中文、点、下划线或短横线。'
  }
  return $normalised
}

function Update-ProcessPathFromRegistry {
  # winget 装完东西后系统 PATH 会更新，但当前进程的 PATH 缓存不会自动刷新；
  # 后面新开的子进程（比如再次调用 npm/ollama）看到的还是旧的，所以每次装完都要重新拼一遍。
  $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$machinePath;$userPath"
}

function Install-WithWinget {
  param(
    [string]$Id,
    [string]$DisplayName
  )

  $winget = Get-Command 'winget.exe' -ErrorAction SilentlyContinue
  if (-not $winget) {
    Write-Warning "没有 winget，无法自动安装 $DisplayName；请手动安装后重新运行本脚本。"
    return $false
  }
  Write-Host "正在通过 winget 自动安装 $DisplayName..."
  & $winget.Source install --id $Id -e --accept-package-agreements --accept-source-agreements | Out-Null
  $installOk = $LASTEXITCODE -eq 0
  Update-ProcessPathFromRegistry
  if (-not $installOk) {
    Write-Warning "$DisplayName 自动安装失败（退出码 $LASTEXITCODE）。"
  }
  return $installOk
}

function Ensure-NodeJs {
  $nodeCommand = Get-Command 'node.exe' -ErrorAction SilentlyContinue
  $npmCommand = Get-Command 'npm.cmd' -ErrorAction SilentlyContinue
  if ($nodeCommand -and $npmCommand) {
    return [PSCustomObject]@{ Node = $nodeCommand; Npm = $npmCommand }
  }
  if ($DryRun) {
    Write-Host '[dry-run] 将自动安装 Node.js LTS' -ForegroundColor Yellow
    return $null
  }
  Install-WithWinget -Id 'OpenJS.NodeJS.LTS' -DisplayName 'Node.js LTS' | Out-Null
  $nodeCommand = Get-Command 'node.exe' -ErrorAction SilentlyContinue
  $npmCommand = Get-Command 'npm.cmd' -ErrorAction SilentlyContinue
  if (-not $nodeCommand -or -not $npmCommand) {
    throw '未检测到 Node.js/npm，且自动安装未成功。请手动安装 Node.js LTS，再重新双击本脚本。'
  }
  return [PSCustomObject]@{ Node = $nodeCommand; Npm = $npmCommand }
}

function Ensure-OllamaBinary {
  $existing = Find-OllamaRuntime
  if ($existing) {
    return $existing
  }
  if ($DryRun) {
    Write-Host '[dry-run] 将自动安装 Ollama' -ForegroundColor Yellow
    return $null
  }
  Install-WithWinget -Id 'Ollama.Ollama' -DisplayName 'Ollama' | Out-Null
  return Find-OllamaRuntime
}

function Ensure-OllamaModel {
  param([string]$HostUrl)

  if ($DryRun) {
    Write-Host "[dry-run] 将自动拉取默认模型：$DefaultLlmModel" -ForegroundColor Yellow
    return
  }

  $ollamaExe = (Get-Command 'ollama.exe' -ErrorAction SilentlyContinue).Source
  if (-not $ollamaExe) {
    $runtime = Find-OllamaRuntime
    $ollamaExe = Get-PropertyValue $runtime 'Binary'
  }
  if (-not $ollamaExe) {
    Write-Warning '没有找到 ollama.exe，无法自动拉取模型；LLM 测速将跳过。'
    return
  }

  Write-Host "Ollama 中没有已装模型，正在自动拉取默认模型：$DefaultLlmModel（约几百 MB 到几 GB，视网络而定）"
  $env:OLLAMA_HOST = $HostUrl
  & $ollamaExe pull $DefaultLlmModel
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "拉取模型 $DefaultLlmModel 失败（退出码 $LASTEXITCODE）；LLM 测速将跳过。"
  }
}

function Test-SttReady {
  # 跟 bench-machine.ts 里 sttReady() 的判断逻辑保持一致，避免每次都重跑安装脚本。
  $appData = [Environment]::GetFolderPath('ApplicationData')
  $binary = Join-Path $appData 'SpeakSpace Local\runtimes\stt\whisper\bin\whisper-cli.exe'
  $modelDir = Join-Path $appData 'SpeakSpace Local\models\stt'
  $recordingDir = Join-Path $projectRoot 'docs\testing\datasets\stt-human-recordings'
  $hasBinary = Test-Path -LiteralPath $binary
  $hasModel = (Test-Path -LiteralPath $modelDir) -and
    (Get-ChildItem -LiteralPath $modelDir -Filter '*.bin' -ErrorAction SilentlyContinue | Select-Object -First 1)
  $hasRecordings = (Test-Path -LiteralPath $recordingDir) -and
    (Get-ChildItem -LiteralPath $recordingDir -ErrorAction SilentlyContinue | Select-Object -First 1)
  return $hasBinary -and $hasModel -and $hasRecordings
}

function Ensure-Stt {
  if (Test-SttReady) {
    Write-Host 'STT 运行时/模型已就绪。'
    return
  }
  if ($DryRun) {
    Write-Host '[dry-run] 将自动安装 ffmpeg + whisper.cpp 运行时 + whisper-small 模型' -ForegroundColor Yellow
    return
  }
  Write-Host '首次运行：正在自动安装 STT 依赖（ffmpeg + whisper.cpp 运行时 + whisper-small 模型，约 500 MiB）。'
  Invoke-Npm -Arguments @('run', 'bench:stt:fetch', '--', 'whisper-small')
  if (-not (Test-SttReady)) {
    Write-Warning 'STT 依赖安装后仍不完整；STT 测速将跳过。'
  }
}

function Invoke-Npm {
  param([string[]]$Arguments)

  $display = 'npm ' + ($Arguments -join ' ')
  if ($DryRun) {
    Write-Host "[dry-run] $display" -ForegroundColor Yellow
    return
  }

  if (-not $script:NpmCommand) {
    throw '没有找到可用的 npm，请先安装 Node.js LTS 再重新运行本脚本。'
  }
  $npmPath = Get-PropertyValue $script:NpmCommand 'Source' $script:NpmCommand
  & $npmPath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "命令执行失败（退出码 $LASTEXITCODE）：$display"
  }
}

function Get-OllamaStatus {
  param([string]$HostUrl)

  try {
    $request = @{
      Uri = "$($HostUrl.TrimEnd('/'))/api/tags"
      Method = 'Get'
      TimeoutSec = 3
    }
    $response = Invoke-RestMethod @request
    return [PSCustomObject]@{
      Reachable = $true
      ModelCount = @($response.models).Count
    }
  } catch {
    return [PSCustomObject]@{
      Reachable = $false
      ModelCount = 0
    }
  }
}

function Find-OllamaRuntime {
  $appData = [Environment]::GetFolderPath('ApplicationData')
  $appNames = @(
    'SpeakSpace Local',
    'SpeakSpace',
    'speakspace',
    'electron-react-boilerplate'
  )
  foreach ($appName in $appNames) {
    $dataRoot = Join-Path $appData $appName
    $binary = Join-Path $dataRoot 'runtimes\llm\bin\ollama.exe'
    if (Test-Path -LiteralPath $binary) {
      return [PSCustomObject]@{
        Binary = $binary
        ModelsRoot = Join-Path $dataRoot 'models\llm'
        Portable = $true
      }
    }
  }

  $systemOllama = Get-Command 'ollama.exe' -ErrorAction SilentlyContinue
  if ($systemOllama) {
    return [PSCustomObject]@{
      Binary = $systemOllama.Source
      ModelsRoot = $null
      Portable = $false
    }
  }
  return $null
}

function Ensure-Ollama {
  $hostUrl = 'http://127.0.0.1:11434'
  if ($env:OLLAMA_HOST) {
    $hostUrl = $env:OLLAMA_HOST.TrimEnd('/')
    if ($hostUrl -notmatch '^https?://') {
      $hostUrl = "http://$hostUrl"
    }
  }
  $env:OLLAMA_HOST = $hostUrl

  $status = Get-OllamaStatus -HostUrl $hostUrl
  if ($status.Reachable) {
    Write-Host "Ollama 已运行，检测到 $($status.ModelCount) 个模型。"
    return $status
  }

  $runtime = Find-OllamaRuntime
  if (-not $runtime) {
    Write-Warning '没有找到 Ollama。LLM 测速会跳过，其他硬件测速仍会继续。'
    return $status
  }
  if ($DryRun) {
    Write-Host "[dry-run] 将自动启动：$($runtime.Binary) serve" -ForegroundColor Yellow
    return [PSCustomObject]@{ Reachable = $true; ModelCount = 0 }
  }

  Write-Host "正在启动 Ollama：$($runtime.Binary)"
  $serverHost = '127.0.0.1:11434'
  $env:OLLAMA_HOST = $serverHost
  if ($runtime.Portable) {
    New-Item -ItemType Directory -Path $runtime.ModelsRoot -Force | Out-Null
    $env:OLLAMA_MODELS = $runtime.ModelsRoot
  }
  $startOptions = @{
    FilePath = $runtime.Binary
    ArgumentList = 'serve'
    WorkingDirectory = Split-Path -Parent $runtime.Binary
    WindowStyle = 'Hidden'
    PassThru = $true
  }
  $script:OwnedOllamaProcess = Start-Process @startOptions
  $env:OLLAMA_HOST = 'http://127.0.0.1:11434'

  for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
    Start-Sleep -Milliseconds 500
    $status = Get-OllamaStatus -HostUrl $env:OLLAMA_HOST
    if ($status.Reachable) {
      Write-Host "Ollama 启动完成，检测到 $($status.ModelCount) 个模型。"
      return $status
    }
    if ($script:OwnedOllamaProcess.HasExited) {
      break
    }
  }

  Write-Warning 'Ollama 启动失败或超时。LLM 测速会跳过，其他硬件测速仍会继续。'
  return [PSCustomObject]@{ Reachable = $false; ModelCount = 0 }
}

function Get-BenchmarkResultsRoot {
  return Join-Path $projectRoot 'docs\testing\results'
}

function Get-BenchmarkBundleRoot {
  $localAppData = [Environment]::GetFolderPath('LocalApplicationData')
  return Join-Path $localAppData 'SpeakSpace-TTS-Benchmark\bundles'
}

function New-ResultBundle {
  param([string]$MachineLabel)

  $resultsRoot = Get-BenchmarkResultsRoot
  $machineDirectory = Join-Path (Join-Path $resultsRoot 'machines') $MachineLabel
  if (-not (Test-Path -LiteralPath $machineDirectory)) {
    Write-Warning "没有找到本机结果目录：$machineDirectory"
    return $null
  }

  $bundleDirectory = Get-BenchmarkBundleRoot
  New-Item -ItemType Directory -Path $bundleDirectory -Force | Out-Null
  $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $bundlePath = Join-Path $bundleDirectory "speakspace-hardware-$MachineLabel-$timestamp.zip"
  $archiveOptions = @{
    LiteralPath = $machineDirectory
    DestinationPath = $bundlePath
    CompressionLevel = 'Optimal'
  }
  Compress-Archive @archiveOptions
  return $bundlePath
}

$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$exitCode = 0

try {
  [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
  Set-Location -LiteralPath $projectRoot
  if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'package.json'))) {
    throw "没有找到 SpeakSpace Local 工程：$projectRoot"
  }

  Write-Section 'SpeakSpace Local · 跨机器硬件测速'
  Write-Host '只测速度、延迟、内存、显存和 GPU 卸载；默认不跑准确率评测。'
  Write-Host '测速期间请关闭 SpeakSpace Local 和其他高负载程序。'

  if (-not $NonInteractive -and -not $PSBoundParameters.ContainsKey('Machine')) {
    $defaultMachine = Resolve-MachineLabel -RequestedLabel $null
    $answer = Read-Host "机器标签（直接回车使用 $defaultMachine）"
    if ([string]::IsNullOrWhiteSpace($answer)) {
      $Machine = $defaultMachine
    } else {
      $Machine = $answer
    }
  }
  $Machine = Resolve-MachineLabel -RequestedLabel $Machine

  if (-not $NonInteractive -and -not $PSBoundParameters.ContainsKey('Mode')) {
    Write-Host ''
    Write-Host '[1] 完整硬件测速：TTS + LLM + STT（约 1–2 小时，推荐）'
    Write-Host '[2] 快速测速：只测 LLM（约 2 分钟/模型）'
    Write-Host '[3] 只测 TTS（约 1–1.5 小时）'
    $choice = Read-Host '请选择（直接回车选 1）'
    switch ($choice) {
      '2' { $Mode = 'llm' }
      '3' { $Mode = 'tts' }
      default { $Mode = 'full' }
    }
  }

  $nodeTools = Ensure-NodeJs
  $nodeCommand = Get-PropertyValue $nodeTools 'Node'
  $script:NpmCommand = Get-PropertyValue $nodeTools 'Npm'

  Write-Section '环境准备'
  Write-Host "机器标签：$Machine"
  Write-Host "测速模式：$Mode"
  if ($nodeCommand) {
    Write-Host "Node.js：$(& $nodeCommand.Source --version)"
  }

  $tsNodeEntry = Join-Path $projectRoot 'node_modules\ts-node\register\transpile-only.js'
  $dependenciesReady = Test-Path -LiteralPath $tsNodeEntry
  if ($Mode -ne 'llm') {
    $ttsRuntime = Join-Path $projectRoot 'release\app\node_modules\sherpa-onnx-node'
    $onnxRuntime = Join-Path $projectRoot 'release\app\node_modules\onnxruntime-node'
    $dependenciesReady = $dependenciesReady -and
      (Test-Path -LiteralPath $ttsRuntime) -and
      (Test-Path -LiteralPath $onnxRuntime)
  }
  if (-not $dependenciesReady) {
    Write-Host '首次运行：正在自动安装项目依赖。'
    $installCommand = if (Test-Path -LiteralPath (Join-Path $projectRoot 'package-lock.json')) {
      @('ci')
    } else {
      @('install')
    }
    if ($Mode -eq 'llm') {
      $installCommand += '--ignore-scripts'
    }
    Invoke-Npm -Arguments $installCommand
  } else {
    Write-Host '项目依赖已就绪。'
  }

  if ($Mode -ne 'tts') {
    Ensure-OllamaBinary | Out-Null
    $ollamaStatus = Ensure-Ollama
    if ($ollamaStatus.Reachable -and $ollamaStatus.ModelCount -eq 0) {
      Ensure-OllamaModel -HostUrl $env:OLLAMA_HOST
    }
  }

  if ($Mode -eq 'full') {
    Ensure-Stt
  }

  Write-Section '开始测速'
  $benchmarkArguments = @('run', 'bench', '--', '--machine', $Machine)
  switch ($Mode) {
    'llm' { $benchmarkArguments += @('--only', 'llm') }
    'tts' { $benchmarkArguments += @('--only', 'tts,tts-memory,tts-length') }
  }
  Invoke-Npm -Arguments $benchmarkArguments

  if ($DryRun) {
    Write-Host ''
    Write-Host 'dry-run 完成：没有安装依赖、启动服务或执行基准。' -ForegroundColor Green
  } else {
    $bundlePath = New-ResultBundle -MachineLabel $Machine
    Write-Section '测速完成'
    Write-Host "本机结果：$(Join-Path (Join-Path (Get-BenchmarkResultsRoot) 'machines') $Machine)"
    if ($bundlePath) {
      Write-Host "可拷走的结果包：$bundlePath" -ForegroundColor Green
    }
    Write-Host '结果已经位于仓库 docs\testing\results\machines，可直接提交或拷回主控机汇总。'
  }
} catch {
  $exitCode = 1
  Write-Host ''
  Write-Host "启动失败：$($_.Exception.Message)" -ForegroundColor Red
} finally {
  if ($script:OwnedOllamaProcess -and -not $script:OwnedOllamaProcess.HasExited) {
    Stop-Process -Id $script:OwnedOllamaProcess.Id -ErrorAction SilentlyContinue
  }
}

exit $exitCode
