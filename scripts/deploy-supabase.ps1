param(
  [string]$EnvFile = ".env",
  [switch]$IncludeSeed
)

$ErrorActionPreference = "Stop"

function Read-DotEnv {
  param([string]$Path)

  $map = @{}
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Fichier d'environnement introuvable: $Path"
  }

  Get-Content -LiteralPath $Path | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)\s*=\s*"?([^"\r\n]*)"?\s*$') {
      $map[$matches[1].Trim()] = $matches[2].Trim()
    }
  }
  return $map
}

function Require-Env {
  param(
    [hashtable]$Map,
    [string]$Name
  )

  if (-not $Map.ContainsKey($Name) -or [string]::IsNullOrWhiteSpace($Map[$Name])) {
    throw "Variable manquante dans ${EnvFile}: $Name"
  }
  return $Map[$Name]
}

function Invoke-Step {
  param(
    [string]$Label,
    [scriptblock]$Command
  )

  Write-Host ""
  Write-Host "==> $Label" -ForegroundColor Cyan
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Echec de l'etape: $Label"
  }
}

$envMap = Read-DotEnv -Path $EnvFile

$supabaseUrl = Require-Env $envMap "VITE_SUPABASE_URL"
$anonKey = Require-Env $envMap "VITE_SUPABASE_ANON_KEY"
$accessToken = Require-Env $envMap "SUPABASE_ACCESS_TOKEN"
$dbPassword = Require-Env $envMap "SUPABASE_DB_PASSWORD"
if ($envMap.ContainsKey("SUPABASE_SERVICE_ROLE_KEY") -and -not [string]::IsNullOrWhiteSpace($envMap["SUPABASE_SERVICE_ROLE_KEY"])) {
  Write-Host "Service-role key presente dans .env. Elle n'est pas transmise via supabase secrets car SUPABASE_* est reserve par Supabase." -ForegroundColor Yellow
}

try {
  $projectRef = ([Uri]$supabaseUrl).Host.Split(".")[0]
} catch {
  throw "VITE_SUPABASE_URL invalide: impossible d'en deduire le project ref."
}

$env:SUPABASE_ACCESS_TOKEN = $accessToken

Write-Host "Projet Supabase cible: $projectRef" -ForegroundColor Green
Write-Host "URL front configuree: $supabaseUrl" -ForegroundColor Green
Write-Host "Anon key presente: $([bool]$anonKey)" -ForegroundColor Green

Invoke-Step "Lier le repo au projet Supabase" {
  npx supabase link --project-ref $projectRef --password $dbPassword --yes
}

Invoke-Step "Appliquer les migrations" {
  if ($IncludeSeed) {
    npx supabase db push --linked --include-seed --password $dbPassword --yes
  } else {
    npx supabase db push --linked --password $dbPassword --yes
  }
}

Invoke-Step "Deployer les Edge Functions sans Docker" {
  npx supabase functions deploy admin-create-user admin-reset-password --project-ref $projectRef --use-api --yes
}

Write-Host ""
Write-Host "Deploiement Supabase termine." -ForegroundColor Green
Write-Host "Prochaine etape: creer le premier admin si ce n'est pas encore fait, puis tester le parcours complet." -ForegroundColor Green
