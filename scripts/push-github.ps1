# 在项目根目录执行：.\scripts\push-github.ps1
# 需要能访问 GitHub 443；国内/公司网常要开 VPN 或给 Git 配代理。

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

git config --local http.version HTTP/1.1
if (-not (git config --local --get http.postBuffer)) {
  git config --local http.postBuffer 524288000
}

# 若已在系统里设置了代理环境变量，让 Git 沿用（Clash / v2rayN 等可设 HTTP_PROXY）
$hp = $env:HTTP_PROXY
if (-not $hp) { $hp = $env:http_proxy }
if ($hp) {
  git config --global http.proxy $hp
  git config --global https.proxy $hp
  Write-Host "已根据环境变量设置 http(s).proxy = $hp"
}

Write-Host "Remote:" (git remote get-url origin)
git push -u origin main
if ($LASTEXITCODE -eq 0) { exit 0 }

Write-Host ""
Write-Host "推送失败（连不上 github.com:443）时可按顺序试："
Write-Host ""
Write-Host "【1】开 VPN / 系统代理后，只对 GitHub 设代理（端口改成你的，常见 7890、10809）："
Write-Host "    git config --global http.https://github.com.proxy http://127.0.0.1:7890"
Write-Host "    git push -u origin main"
Write-Host "    成功后可删：git config --global --unset http.https://github.com.proxy"
Write-Host ""
Write-Host "【2】全局 HTTP 代理（同上改端口）："
Write-Host "    git config --global http.proxy  http://127.0.0.1:7890"
Write-Host "    git config --global https.proxy http://127.0.0.1:7890"
Write-Host ""
Write-Host "【3】改用 SSH（需本机已配 GitHub SSH 密钥，且 22 或 443 SSH 能通）："
Write-Host "    git remote set-url origin git@github.com:XstocksSurpport/zhiliaohou.git"
Write-Host "    git push -u origin main"
Write-Host ""
Write-Host "【4】用手机热点排除宽带/路由器拦截。"
exit $LASTEXITCODE
