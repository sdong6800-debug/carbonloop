# Local interactive configuration. Never write the key to disk or command-line arguments.
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$ErrorActionPreference = 'Stop'
$script:bridge = $null
$script:readyTask = $null
$script:startedAt = $null
$script:sessionKey = $null
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$nodePath = if($null -ne $nodeCommand) { $nodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
$serverPath = Join-Path $PSScriptRoot 'server.cjs'

$form = New-Object System.Windows.Forms.Form
$form.Text = 'CarbonLoop · 连接 DeepSeek'
$form.ClientSize = New-Object System.Drawing.Size(560,430)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.ShowInTaskbar = $true
$form.Add_Shown({ $form.WindowState = 'Normal'; $form.TopMost = $true; $form.Activate(); $form.TopMost = $false; $keyBox.Focus() })
$form.Font = New-Object System.Drawing.Font('Microsoft YaHei UI',10)

function Add-Label($text,$x,$y,$w,$h) {
 $label = New-Object System.Windows.Forms.Label
 $label.Text = $text
 $label.SetBounds($x,$y,$w,$h)
 $form.Controls.Add($label)
 return $label
}
$null = Add-Label '连接你自己的 DeepSeek 账户' 24 20 500 32
$null = Add-Label '密钥仅保留在此窗口内存中；关闭即清除，不写文件或网页。' 24 60 510 28
$null = Add-Label 'API Key（请在这里粘贴完整密钥，不要发到聊天）' 24 102 510 28
$keyBox = New-Object System.Windows.Forms.TextBox
$keyBox.UseSystemPasswordChar = $true
$keyBox.SetBounds(24,134,510,30)
$form.Controls.Add($keyBox)
$null = Add-Label '模型' 24 183 70 26
$modelBox = New-Object System.Windows.Forms.ComboBox
$modelBox.DropDownStyle = 'DropDownList'
$modelBox.SetBounds(95,179,439,32)
$null = $modelBox.Items.Add('deepseek-flash')
$null = $modelBox.Items.Add('deepseek-v4-pro')
$modelBox.SelectedIndex = 0
$form.Controls.Add($modelBox)
$null = Add-Label '连接只启动本地服务。网页中同意发送资料并点击生成后，才会调用模型并产生 API 用量。' 24 225 510 52
$connect = New-Object System.Windows.Forms.Button
$connect.Text = '启用本地 AI 连接'
$connect.SetBounds(24,285,235,40)
$form.Controls.Add($connect)
$stop = New-Object System.Windows.Forms.Button
$stop.Text = '停止连接'
$stop.Enabled = $false
$stop.SetBounds(280,285,254,40)
$form.Controls.Add($stop)
$status = Add-Label '请输入密钥。连接后保留此窗口；关闭窗口会停止 AI 服务。' 24 344 510 72
$form.AcceptButton = $connect

function Stop-Bridge {
 if($null -ne $script:bridge) {
  try { if(-not $script:bridge.HasExited) { $script:bridge.Kill(); $script:bridge.WaitForExit(3000) | Out-Null } } catch {}
  $script:bridge.Dispose()
  $script:bridge = $null
 }
 $script:readyTask = $null
}
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 250
$timer.Add_Tick({
 if($null -eq $script:bridge) { return }
 if($script:bridge.HasExited) {
  $timer.Stop(); Stop-Bridge
  $status.Text = '连接未启动或已结束。请确认端口 8514 未被占用，然后重试。'
  $connect.Enabled = $true; $keyBox.Enabled = $true; $modelBox.Enabled = $true; $stop.Enabled = $false
  return
 }
 if($null -ne $script:readyTask -and $script:readyTask.IsCompleted) {
  $ready = $script:readyTask.Result
  $script:readyTask = $null
  if($ready -like 'CarbonLoop AI bridge*configured (not yet verified)') {
   $status.Text = '连接已启动。回到网页检查连接即可。以后更新代码，点击“重新连接”即可，不必重复粘贴密钥。'
   $connect.Text = '重新连接（加载更新）'; $connect.Enabled = $true
  }
 } elseif($null -ne $script:readyTask -and ((Get-Date)-$script:startedAt).TotalSeconds -gt 10) {
  $timer.Stop(); Stop-Bridge
  $status.Text = '启动超时，未调用模型。请重试。'
  $connect.Enabled = $true; $keyBox.Enabled = $true; $modelBox.Enabled = $true; $stop.Enabled = $false
 }
})
$connect.Add_Click({
 $key = $keyBox.Text.Trim()
 if($key) {
  if($key -notmatch '^sk-[A-Za-z0-9_-]{12,250}$') { $status.Text = '请输入创建时保存的完整密钥，不能使用带星号的展示值。'; return }
  $script:sessionKey = $key
 } elseif($null -ne $script:sessionKey) {
  $key = $script:sessionKey
 } else { $status.Text = '请粘贴已保存的完整密钥。'; return }
 if(-not (Test-Path -LiteralPath $nodePath)) { $status.Text = '未找到 Node.js。请先安装 Node.js 20 或更高版本，再重新打开此窗口。'; return }
 $connect.Enabled = $false
 try {
  $timer.Stop(); Stop-Bridge
  $info = New-Object System.Diagnostics.ProcessStartInfo
  $info.FileName = $nodePath
  $info.Arguments = '"' + $serverPath + '" --config-stdin'
  $info.WorkingDirectory = $PSScriptRoot
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.RedirectStandardInput = $true
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  $script:bridge = New-Object System.Diagnostics.Process
  $script:bridge.StartInfo = $info
  $null = $script:bridge.Start()
  $payload = @{provider='deepseek'; key=$key; model=[string]$modelBox.SelectedItem} | ConvertTo-Json -Compress
  $script:bridge.StandardInput.WriteLine($payload)
  $script:bridge.StandardInput.Close()
  $script:readyTask = $script:bridge.StandardOutput.ReadLineAsync()
  $script:startedAt = Get-Date
  $keyBox.Clear(); $keyBox.Enabled = $false; $modelBox.Enabled = $false; $stop.Enabled = $true
  $status.Text = '正在启动本地服务；没有发送项目资料，也没有请求模型。'
  $timer.Start()
 } catch {
  Stop-Bridge
  $connect.Enabled = $true; $keyBox.Enabled = $true; $modelBox.Enabled = $true; $stop.Enabled = $false
  $status.Text = '本地连接未启动。请关闭重复的连接窗口后重试；不要发送密钥截图。'
 } finally { $key = $null; $payload = $null }
})
$stop.Add_Click({
 $timer.Stop(); Stop-Bridge
 $connect.Enabled = $true; $keyBox.Enabled = $true; $modelBox.Enabled = $true; $stop.Enabled = $false
 $status.Text = '已停止。密钥仍仅在此窗口内存中，可直接重新连接；关闭窗口后清除。'
})
$form.Add_FormClosed({ $timer.Stop(); Stop-Bridge; $keyBox.Clear(); $script:sessionKey = $null; $timer.Dispose() })
[System.Windows.Forms.Application]::Run($form)
$form.Dispose()
