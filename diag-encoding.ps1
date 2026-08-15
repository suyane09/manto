Set-Location -Path $PSScriptRoot
[System.IO.Directory]::SetCurrentDirectory($PSScriptRoot)

$markerA = [char]0x00C3
$markerB = [char]0x00E2 + [char]0x20AC

$files = Get-ChildItem -Path $PSScriptRoot -Recurse -Include *.js,*.jsx,*.ts,*.tsx,*.html,*.vue -File | Where-Object { $_.FullName -notmatch 'node_modules' -and $_.FullName -notmatch 'src-backup' }

Write-Host "Total de arquivos escaneados: $($files.Count)"

$countA = 0
$countB = 0

foreach ($f in $files) {
    $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
    $content = [System.Text.Encoding]::UTF8.GetString($bytes)
    if ($content.Contains($markerA)) { $countA++; Write-Host "TEM Ã: $($f.FullName)" }
    if ($content.Contains($markerB)) { $countB++; Write-Host "TEM â€: $($f.FullName)" }
}

Write-Host "Arquivos com marca A (Ã): $countA"
Write-Host "Arquivos com marca B (â€): $countB"