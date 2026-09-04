#Requires -RunAsAdministrator
# =====================================================================
#  Turn on free HTTPS (the padlock) for the IIS site using win-acme
#  (a Let's Encrypt client for Windows).
#
#  Run ON THE SERVER, ONE time, AFTER your domain points at the static IP:
#
#     .\enable-https.ps1 -Domain martindalechevrolet.com -Email you@email.com
#
#  It downloads win-acme to C:\win-acme, tells IIS which domain names the
#  site answers to, gets a certificate for yourdomain.com and
#  www.yourdomain.com, adds the HTTPS binding, and installs a scheduled
#  task that renews the certificate automatically forever.
# =====================================================================
param(
    [Parameter(Mandatory = $true)][string]$Domain,
    [Parameter(Mandatory = $true)][string]$Email
)
$ErrorActionPreference = 'Stop'
$SiteName = 'Martindale'
$Dir = 'C:\win-acme'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

Import-Module WebAdministration
$Site = Get-Website -Name $SiteName
if (-not $Site) { throw "IIS site '$SiteName' not found. Run setup-iis.ps1 first." }

# IIS needs to know the domain names so the certificate check can reach the site.
foreach ($HostName in @($Domain, "www.$Domain")) {
    $existing = Get-WebBinding -Name $SiteName -Protocol http | Where-Object { $_.bindingInformation -like "*:80:$HostName" }
    if (-not $existing) { New-WebBinding -Name $SiteName -Protocol http -Port 80 -HostHeader $HostName | Out-Null }
}

if (-not (Test-Path "$Dir\wacs.exe")) {
    Write-Host "Downloading win-acme..."
    New-Item -ItemType Directory -Force -Path $Dir | Out-Null
    $Release = Invoke-RestMethod 'https://api.github.com/repos/win-acme/win-acme/releases/latest' -UseBasicParsing
    $Asset = $Release.assets | Where-Object { $_.name -like 'win-acme.v*.x64.pluggable.zip' } | Select-Object -First 1
    if (-not $Asset) { throw "Could not find the win-acme download. Get it by hand from https://www.win-acme.com and unzip to $Dir" }
    Invoke-WebRequest -Uri $Asset.browser_download_url -OutFile "$Dir\win-acme.zip" -UseBasicParsing
    Expand-Archive -Path "$Dir\win-acme.zip" -DestinationPath $Dir -Force
}

Write-Host "Requesting certificate for $Domain and www.$Domain ..."
& "$Dir\wacs.exe" --source iis --siteid $Site.Id --host "$Domain,www.$Domain" `
    --emailaddress $Email --accepttos --installation iis
if ($LASTEXITCODE -ne 0) { throw "win-acme returned code $LASTEXITCODE - read the messages above." }

Write-Host ""
Write-Host "HTTPS is on. Open https://$Domain"
Write-Host "Renewal is automatic (Task Scheduler -> 'win-acme renew')."
