# 在项目根目录执行：.\scripts\push-github.ps1
# 若在 Cursor 里 push 常失败，用「Windows PowerShell」单独打开再运行本脚本（走你本机完整网络/代理）。

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

git config --local http.version HTTP/1.1
if (-not (git config --local --get http.postBuffer)) {
  git config --local http.postBuffer 524288000
}

Write-Host "Remote:" (git remote get-url origin)
git push -u origin main
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "若仍失败："
  Write-Host "1) 确认已开 VPN/系统代理，再在 PowerShell 里临时设置（端口改成你的）："
  Write-Host "   git config --global http.proxy  http://127.0.0.1:7890"
  Write-Host "   git config --global https.proxy http://127.0.0.1:7890"
  Write-Host "2) 推送成功后可取消代理："
  Write-Host "   git config --global --unset http.proxy"
  Write-Host "   git config --global --unset https.proxy"
  exit $LASTEXITCODE
}
