<#
.SYNOPSIS
  Compila o Dueto para Windows: instalador NSIS (Dueto-Setup-x.y.z.exe) e versão portátil (Dueto-portable.exe).
.NOTES
  Requisitos: Node.js 20+ e npm. Rode a partir da raiz do projeto:  powershell -ExecutionPolicy Bypass -File scripts\build-windows.ps1
#>
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "==> Instalando dependências" -ForegroundColor Cyan
npm ci --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw "npm ci falhou" }

Write-Host "==> Testes do core" -ForegroundColor Cyan
npm test
if ($LASTEXITCODE -ne 0) { throw "testes falharam" }

Write-Host "==> Build (typecheck + Vite + Electron)" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "build falhou" }

Write-Host "==> Empacotando (NSIS + portátil)" -ForegroundColor Cyan
npx electron-builder --win --x64 --publish never
if ($LASTEXITCODE -ne 0) { throw "electron-builder falhou" }

Get-ChildItem release -Recurse -Filter *.exe | ForEach-Object { Write-Host ("   " + $_.FullName + "  (" + [math]::Round($_.Length / 1MB, 1) + " MB)") -ForegroundColor Green }
Write-Host "Pronto." -ForegroundColor Green
