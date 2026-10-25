# Envoie les variables EXPO_PUBLIC_* du fichier .env d'une app vers les variables d'environnement EAS (builds preview et production).
# Les valeurs ne passent jamais par Git. Usage : .\scripts\eas-env.ps1 client   (puis)   .\scripts\eas-env.ps1 driver
param([Parameter(Mandatory = $true)][ValidateSet('client', 'driver')][string]$App)
Set-Location (Join-Path $PSScriptRoot "..\apps\$App")
Get-Content .env | Where-Object { $_ -match '^EXPO_PUBLIC_[A-Z_]+=' } | ForEach-Object {
  $name, $value = $_ -split '=', 2
  Write-Host "Envoi de $name"
  npx.cmd eas-cli env:create --name $name --value $value --environment preview --environment production --visibility plaintext --force --non-interactive
}
