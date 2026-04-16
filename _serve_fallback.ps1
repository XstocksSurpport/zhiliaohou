# Fallback when Python is missing: HttpListener on 127.0.0.1, static files from this folder
$ErrorActionPreference = 'Stop'
$Root = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$Port = 3002

$listener = New-Object System.Net.HttpListener
try {
    $listener.Prefixes.Add("http://127.0.0.1:$Port/") | Out-Null
}
catch {
    Write-Host "Could not add prefix http://127.0.0.1:${Port}/ : $_"
}
if ($listener.Prefixes.Count -eq 0) {
    Write-Host "Could not register http prefix. Try Serve-Localhost3002.ps1 or install Python."
    Read-Host "Press Enter to exit"
    exit 1
}
try {
    $listener.Start()
}
catch {
    Write-Host "Listen failed (port in use or permissions): $($_.Exception.Message)"
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "----------------------------------------------------------------"
Write-Host " Local server started (no Python)"
Write-Host " Root: $Root"
Write-Host " URL: http://localhost:$Port/"
Write-Host " Keep this window open; Ctrl+C to stop"
Write-Host "----------------------------------------------------------------"

Start-Process "http://localhost:$Port/"

while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext()
    }
    catch {
        break
    }
    $req = $ctx.Request
    $res = $ctx.Response
    $path = $req.Url.LocalPath
    if ($path -eq '/' -or $path -eq '') {
        $path = '/index.html'
    }
    $rel = $path.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
    $full = [System.IO.Path]::GetFullPath((Join-Path $Root $rel))
    if (-not $full.StartsWith($Root, [StringComparison]::OrdinalIgnoreCase)) {
        $res.StatusCode = 403
        $res.Close()
        continue
    }
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
        $res.StatusCode = 404
        $notFound = [Text.Encoding]::UTF8.GetBytes("404 Not Found")
        $res.ContentLength64 = $notFound.Length
        $res.OutputStream.Write($notFound, 0, $notFound.Length)
        $res.Close()
        continue
    }
    $bytes = [System.IO.File]::ReadAllBytes($full)
    $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
    $mime = 'application/octet-stream'
    switch ($ext) {
        '.html' { $mime = 'text/html; charset=utf-8' }
        '.css' { $mime = 'text/css; charset=utf-8' }
        '.js' { $mime = 'application/javascript; charset=utf-8' }
        '.json' { $mime = 'application/json; charset=utf-8' }
        '.png' { $mime = 'image/png' }
        '.jpg' { $mime = 'image/jpeg' }
        '.svg' { $mime = 'image/svg+xml' }
        '.ico' { $mime = 'image/x-icon' }
        '.woff2' { $mime = 'font/woff2' }
    }
    $res.ContentType = $mime
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
    $res.Close()
}
