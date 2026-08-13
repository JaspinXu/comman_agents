[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$envName = "pytorch_env"
$projectRoot = Split-Path -Parent $PSScriptRoot
$backendProcess = $null

function Invoke-InProjectEnvironment {
  param([Parameter(Mandatory = $true)][string[]]$Command)
  & conda run --no-capture-output -n $envName @Command
  if ($LASTEXITCODE -ne 0) { throw "Command failed in '$envName': $($Command -join ' ')" }
}

function Stop-ProcessTree {
  param([Parameter(Mandatory = $true)][int]$ProcessId)
  $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $ProcessId" -ErrorAction SilentlyContinue
  foreach ($child in $children) { Stop-ProcessTree -ProcessId $child.ProcessId }
  Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

if (-not (Get-Command conda -ErrorAction SilentlyContinue)) {
  throw "Conda was not found. Open Anaconda Prompt or add Conda to PATH."
}

Push-Location $projectRoot
try {
  Write-Host "Using existing Conda environment: $envName" -ForegroundColor Cyan
  Invoke-InProjectEnvironment @("python", "-c", "import sys, fastapi, uvicorn, httpx; assert sys.prefix.lower().endswith('pytorch_env'); print(sys.executable)")
  Invoke-InProjectEnvironment @("node", "--version")
  if (-not (Test-Path (Join-Path $projectRoot "node_modules"))) {
    Invoke-InProjectEnvironment @("npm", "ci", "--ignore-scripts", "--no-audit", "--no-fund")
  }

  $portOwner = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
  if ($portOwner) { throw "Port 8000 is already in use. Stop the existing backend and retry." }

  Write-Host "Starting Python API at http://127.0.0.1:8000" -ForegroundColor Green
  $backendProcess = Start-Process -FilePath "conda" `
    -ArgumentList @("run", "--no-capture-output", "-n", $envName, "python", "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "8000") `
    -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru

  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    if ($backendProcess.HasExited) { throw "Python backend exited during startup." }
    try {
      $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health" -TimeoutSec 1
      $ready = $health.status -eq "ok"
      if ($ready) { break }
    } catch { Start-Sleep -Milliseconds 300 }
  }
  if (-not $ready) { throw "Python backend did not become ready on port 8000." }

  Write-Host "Backend provider: $($health.provider) / $($health.model)" -ForegroundColor Cyan
  Write-Host "Starting web studio at http://localhost:3000/" -ForegroundColor Green
  Write-Host "API documentation: http://127.0.0.1:8000/docs" -ForegroundColor DarkGray
  Invoke-InProjectEnvironment @("npm", "run", "dev")
}
finally {
  if ($backendProcess -and -not $backendProcess.HasExited) {
    Stop-ProcessTree -ProcessId $backendProcess.Id
  }
  Pop-Location
}
