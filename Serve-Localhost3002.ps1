# Local site: http://127.0.0.1:3002/  (double-click open-localhost3002.cmd)
param([switch] $Elevated)

$Port = 3002
$Root = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
Set-Location -LiteralPath $Root

$isAdmin = ([Security.Principal.WindowsPrincipal]([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
)

function Test-PortInUse {
    try {
        return $null -ne (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    }
    catch { return $false }
}

if (Test-PortInUse) {
    Start-Process "http://127.0.0.1:$Port/"
    exit 0
}

Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "timeout /t 3 /nobreak >nul & start http://127.0.0.1:$Port/" -WindowStyle Hidden

function New-Listener {
    $l = [System.Net.HttpListener]::new()
    $l.Prefixes.Add("http://127.0.0.1:$Port/")
    return $l
}

function Invoke-ListenerLoop([System.Net.HttpListener] $listener) {
    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        $req = $ctx.Request
        $res = $ctx.Response
        $path = $req.Url.LocalPath
        if ($path -eq "/" -or $path -eq "") { $path = "/index.html" }
        $rel = $path.TrimStart("/").Replace("/", [IO.Path]::DirectorySeparatorChar)
        $full = [System.IO.Path]::GetFullPath((Join-Path $Root $rel))
        if (-not $full.StartsWith($Root, [StringComparison]::OrdinalIgnoreCase)) {
            $res.StatusCode = 403
            $res.Close()
            continue
        }
        if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
            $res.StatusCode = 404
            $b = [Text.Encoding]::UTF8.GetBytes("404")
            $res.ContentLength64 = $b.Length
            $res.OutputStream.Write($b, 0, $b.Length)
            $res.Close()
            continue
        }
        $bytes = [System.IO.File]::ReadAllBytes($full)
        $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
        $mime = "application/octet-stream"
        switch ($ext) {
            ".html" { $mime = "text/html; charset=utf-8" }
            ".css" { $mime = "text/css; charset=utf-8" }
            ".js" { $mime = "application/javascript; charset=utf-8" }
            ".json" { $mime = "application/json; charset=utf-8" }
            ".png" { $mime = "image/png" }
            ".jpg" { $mime = "image/jpeg" }
            ".svg" { $mime = "image/svg+xml" }
            ".ico" { $mime = "image/x-icon" }
            ".woff2" { $mime = "font/woff2" }
        }
        $res.ContentType = $mime
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
        $res.Close()
    }
}

function Try-DotNetServer {
    $listener = New-Listener
    try {
        $listener.Start()
    }
    catch {
        $listener.Close()
        throw $_
    }
    try {
        Invoke-ListenerLoop $listener
    }
    finally {
        $listener.Stop()
        $listener.Close()
    }
}

function Try-PythonServer {
    $candidates = @(
        @{ Name = "py"; Args = @("-3", "-m", "http.server", "$Port", "--bind", "127.0.0.1", "--directory", $Root) }
        @{ Name = "py"; Args = @("-3", "-m", "http.server", "$Port", "--bind", "127.0.0.1") }
        @{ Name = "python"; Args = @("-m", "http.server", "$Port", "--bind", "127.0.0.1", "--directory", $Root) }
        @{ Name = "python"; Args = @("-m", "http.server", "$Port", "--bind", "127.0.0.1") }
    )
    foreach ($c in $candidates) {
        $exe = Get-Command $c.Name -ErrorAction SilentlyContinue
        if (-not $exe) { continue }
        Set-Location -LiteralPath $Root
        & $exe.Source @($c.Args)
        exit 0
    }
    return $false
}

function Request-AdminRetry {
    $ps1 = $PSCommandPath
    if ([string]::IsNullOrEmpty($ps1)) { return $false }
    Write-Host "Need admin — approve UAC once."
    try {
        Start-Process -FilePath "powershell.exe" -Verb RunAs -ArgumentList @(
            "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $ps1, "-Elevated"
        ) | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

try {
    Try-DotNetServer
    exit 0
}
catch {
    $err = $_
}

if (-not $Elevated -and -not $isAdmin) {
    if (Request-AdminRetry) { exit 0 }
}

if ($Elevated -or $isAdmin) {
    try {
        $null = netsh http add urlacl url="http://127.0.0.1:$Port/" user="Everyone" 2>&1
    }
    catch { }
    try {
        Try-DotNetServer
        exit 0
    }
    catch {
        Write-Host $_.Exception.Message
    }
}

if (Try-PythonServer) { exit 0 }

Write-Host "Could not start. Port or firewall may block 3002."
exit 1
