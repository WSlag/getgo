$ports = @(3001, 5173, 4000, 9099, 8080, 5001, 9199)
foreach ($port in $ports) {
    $results = netstat -ano | Select-String ":$port "
    foreach ($line in $results) {
        $parts = ($line -split '\s+')
        $procId = $parts[-1]
        if ($procId -match '^\d+$' -and $procId -ne '0') {
            try {
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                Write-Host "Killed PID $procId on port $port"
            } catch {}
        }
    }
}
Write-Host "Done."
