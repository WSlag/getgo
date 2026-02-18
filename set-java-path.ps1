$javaHome = "C:\Program Files\Eclipse Adoptium\jdk-21.0.5.11-hotspot"
$javaBin = "$javaHome\bin"

# Set JAVA_HOME machine-wide
[System.Environment]::SetEnvironmentVariable("JAVA_HOME", $javaHome, "Machine")

# Add to machine PATH
$currentPath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
if ($currentPath -notlike "*$javaBin*") {
    [System.Environment]::SetEnvironmentVariable("Path", "$javaBin;$currentPath", "Machine")
    Write-Host "Added Java to system PATH"
} else {
    Write-Host "Java already in system PATH"
}

Write-Host "JAVA_HOME set to: $javaHome"
Write-Host "Done. Please restart any terminals for changes to take effect."
