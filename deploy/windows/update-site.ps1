#Requires -RunAsAdministrator
# =====================================================================
#  Publish / update the Martindale Chevrolet website on this server.
#
#  Run ON THE SERVER (RDP session, PowerShell as Administrator) every
#  time you want the live site to match what is on GitHub:
#
#     .\update-site.ps1
#
#  It downloads the latest copy of the repo from GitHub (main branch),
#  and copies the site\ folder into C:\inetpub\martindale.
#
#  No internet access to GitHub, or the repo is private?  Copy the
#  site folder to the server through Remote Desktop (drag it onto the
#  Desktop) and run:
#
#     .\update-site.ps1 -LocalSite "$env:USERPROFILE\Desktop\site"
#
#  Options:
#     -Branch <name>   use a branch other than main
# =====================================================================
param(
    [string]$Branch = 'main',
    [string]$Repo = 'jbrewersales-dot/MARTINDALECHEVROLETWEBSITE',
    [string]$LocalSite = ''
)
$ErrorActionPreference = 'Stop'
$SiteRoot = 'C:\inetpub\martindale'
$Temp = Join-Path $env:TEMP 'martindale-update'

Remove-Item $Temp -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $Temp | Out-Null

if ($LocalSite) {
    if (-not (Test-Path (Join-Path $LocalSite 'index.html'))) { throw "No index.html found in $LocalSite" }
    $Source = $LocalSite
    $WebConfig = Join-Path $PSScriptRoot 'web.config'
    Write-Host "Publishing from local folder: $Source"
} else {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $Zip = Join-Path $Temp 'repo.zip'
    $Url = "https://github.com/$Repo/archive/refs/heads/$Branch.zip"
    Write-Host "Downloading $Url ..."
    Invoke-WebRequest -Uri $Url -OutFile $Zip -UseBasicParsing
    Expand-Archive -Path $Zip -DestinationPath $Temp -Force
    $RepoDir = Get-ChildItem $Temp -Directory | Select-Object -First 1
    $Source = Join-Path $RepoDir.FullName 'site'
    $WebConfig = Join-Path $RepoDir.FullName 'deploy\windows\web.config'
    if (-not (Test-Path (Join-Path $Source 'index.html'))) { throw "Download did not contain site\index.html" }
}

Write-Host "Copying to $SiteRoot ..."
# /MIR makes the server folder an exact mirror of site\ (adds, updates, and removes files).
robocopy $Source $SiteRoot /MIR /XF README-SITE.md .DS_Store Thumbs.db /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy reported an error (code $LASTEXITCODE)" }

if (Test-Path $WebConfig) { Copy-Item $WebConfig (Join-Path $SiteRoot 'web.config') -Force }

Write-Host ""
Write-Host "Done. The live site now matches site\ on branch '$Branch'."
Write-Host "Open the site in a browser and press Ctrl+Shift+R to refresh."
