# Shared release selection for Windows PowerShell 5.1 / PowerShell 7.
function Test-ReleasePath([string]$Relative) {
    $relativePath=$Relative.Replace('\','/')
    $leaf=($relativePath -split '/')[-1]
    if ($relativePath -match '(^|/)(logs|backups|\.cache|__pycache__|\.git|\.build-backup|node_modules|\.venv|output|temp|\.pytest_cache)(/|$)') { return $false }
    if ($leaf -in @('config.json','credentials.yaml','.credentials.yaml','sidecar-token.txt','host-plugin.log','.dsh-port-sync.lock')) { return $false }
    return $leaf -notmatch '\.(pyc|pyo|tmp)$|\.log(\.|$)|\.bak([-\.]|$)|\.before-'
}
function Copy-ReleaseSource([string]$Source,[string]$Target) {
    New-Item -ItemType Directory -Force -Path $Target | Out-Null
    foreach ($file in (Get-ChildItem -LiteralPath $Source -Recurse -File -Force)) {
        $relative=$file.FullName.Substring($Source.Length).TrimStart('\','/')
        if (($file.Attributes -band [IO.FileAttributes]::ReparsePoint) -or -not (Test-ReleasePath $relative)) { continue }
        $destination=Join-Path $Target $relative
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
        Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
    }
}
function Copy-InstalledRuntime([string]$Source,[string]$Target) {
    foreach ($name in @('credentials.yaml','.credentials.yaml','sidecar-token.txt','host-plugin.log','logs')) {
        $path=Join-Path $Source $name
        if ((Test-Path -LiteralPath $path) -and -not ((Get-Item -LiteralPath $path -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            Copy-Item -LiteralPath $path -Destination (Join-Path $Target $name) -Recurse -Force
        }
    }
}
