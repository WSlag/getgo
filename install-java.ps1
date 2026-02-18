$url = 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.5%2B11/OpenJDK21U-jdk_x64_windows_hotspot_21.0.5_11.msi'
$out = "$env:TEMP\openjdk21.msi"
Write-Host "Downloading OpenJDK 21..."
Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing
Write-Host "Download complete. Installing..."
Start-Process msiexec.exe -Wait -ArgumentList '/i', $out, '/quiet', '/norestart', 'ADDLOCAL=FeatureMain,FeatureEnvironment,FeatureJarFileRunWith,FeatureJavaHome'
Write-Host "Installation complete."
java -version
