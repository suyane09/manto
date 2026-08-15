$markerA = [char]0x00C3
$markerB = [char]0x00E2 + [char]0x20AC

$files = Get-ChildItem -Recurse -Include *.js,*.jsx,*.ts,*.tsx,*.html,*.vue -File | Where-Object { $_.FullName -notmatch 'node_modules' -and $_.FullName -notmatch 'src-backup' }

foreach ($f in $files) {
    $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
    $content = [System.Text.Encoding]::UTF8.GetString($bytes)

    if (-not ($content.Contains($markerA) -or $content.Contains($markerB))) {
        continue
    }

    $lines = $content -split "`n"
    $changed = $false
    $newLines = New-Object System.Collections.Generic.List[string]

    foreach ($line in $lines) {
        if ($line.Contains($markerA) -or $line.Contains($markerB)) {
            $lineBytes = [System.Text.Encoding]::GetEncoding(1252).GetBytes($line)
            $fixedLine = [System.Text.Encoding]::UTF8.GetString($lineBytes)
            if ($fixedLine -notmatch [char]0xFFFD) {
                $newLines.Add($fixedLine)
                $changed = $true
            } else {
                $newLines.Add($line)
                Write-Host "LINHA PULADA (risco): $($f.FullName)"
            }
        } else {
            $newLines.Add($line)
        }
    }

    if ($changed) {
        $result = $newLines -join "`n"
        [System.IO.File]::WriteAllText($f.FullName, $result, [System.Text.UTF8Encoding]::new($false))
        Write-Host "Corrigido: $($f.FullName)"
    }
}