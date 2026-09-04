#Requires -RunAsAdministrator
# =====================================================================
#  Martindale Chevrolet — one-time Windows Server setup (IIS)
#
#  Run this ONCE on the Lightsail Windows server, inside your RDP session,
#  in PowerShell opened "as Administrator":
#
#     Set-ExecutionPolicy Bypass -Scope Process -Force
#     .\setup-iis.ps1
#
#  Or paste it into the Lightsail "Launch script" box when creating the
#  instance and it runs itself on first boot.
#
#  What it does:
#    1. Installs IIS (Windows' built-in web server).
#    2. Creates the website folder C:\inetpub\martindale.
#    3. Creates an IIS site called "Martindale" on port 80 pointing at it.
#    4. Opens Windows Firewall for HTTP (80) and HTTPS (443).
#    5. Puts up a "server is ready" page so you can confirm it works.
# =====================================================================
$ErrorActionPreference = 'Stop'
$SiteName = 'Martindale'
$SiteRoot = 'C:\inetpub\martindale'

Write-Host "Installing IIS (takes 1-3 minutes)..."
Install-WindowsFeature -Name Web-Server, Web-Static-Content, Web-Default-Doc, Web-Http-Errors, `
    Web-Http-Logging, Web-Stat-Compression, Web-Filtering, Web-Mgmt-Console -IncludeManagementTools | Out-Null
Import-Module WebAdministration

New-Item -ItemType Directory -Force -Path $SiteRoot | Out-Null

if (-not (Test-Path "$SiteRoot\index.html")) {
@"
<!DOCTYPE html><html><head><meta charset="utf-8"><title>Martindale Chevrolet - server ready</title>
<style>body{font-family:system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem;color:#262115}</style></head>
<body><h1>Server is ready.</h1>
<p>This is the Martindale Chevrolet Lightsail server (Windows / IIS). The website has not been uploaded yet.</p>
<p>Next step: run <code>update-site.ps1</code> (see HANDOFF-LIGHTSAIL-WINDOWS.md, Step 6).</p>
</body></html>
"@ | Set-Content -Path "$SiteRoot\index.html" -Encoding UTF8
}

# Turn off the default IIS welcome site so ours answers on port 80.
if (Get-Website -Name 'Default Web Site' -ErrorAction SilentlyContinue) {
    Stop-Website -Name 'Default Web Site' -ErrorAction SilentlyContinue
    Set-ItemProperty 'IIS:\Sites\Default Web Site' -Name serverAutoStart -Value $false
}

if (-not (Get-Website -Name $SiteName -ErrorAction SilentlyContinue)) {
    New-Website -Name $SiteName -PhysicalPath $SiteRoot -Port 80 -Force | Out-Null
}
Start-Website -Name $SiteName

# Firewall: allow web traffic in.
New-NetFirewallRule -DisplayName 'Martindale HTTP 80'  -Direction Inbound -Protocol TCP -LocalPort 80  -Action Allow -ErrorAction SilentlyContinue | Out-Null
New-NetFirewallRule -DisplayName 'Martindale HTTPS 443' -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow -ErrorAction SilentlyContinue | Out-Null

Write-Host ""
Write-Host "Done. IIS is serving $SiteRoot on port 80."
Write-Host "Open http://<your-static-ip> in a browser - you should see 'Server is ready.'"
