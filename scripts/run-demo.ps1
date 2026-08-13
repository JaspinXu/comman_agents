[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$envName = "pytorch_env"
$projectRoot = Split-Path -Parent $PSScriptRoot

function Invoke-InProjectEnvironment {
  param([Parameter(Mandatory = $true)][string[]]$Command)
  & conda run --no-capture-output -n $envName @Command
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed in Conda environment '$envName': $($Command -join ' ')"
  }
}

if (-not (Get-Command conda -ErrorAction SilentlyContinue)) {
  throw "Conda was not found. Open Anaconda Prompt or add Conda to PATH."
}

Push-Location $projectRoot
try {
  Write-Host "Using existing Conda environment: $envName" -ForegroundColor Cyan
  Invoke-InProjectEnvironment @("python", "-c", "import sys; assert sys.prefix.lower().endswith('pytorch_env'); print(sys.executable)")
  Invoke-InProjectEnvironment @("node", "--version")

  if (-not (Test-Path (Join-Path $projectRoot "node_modules"))) {
    Write-Host "Installing project dependencies inside the existing environment..." -ForegroundColor Cyan
    Invoke-InProjectEnvironment @("npm", "ci", "--ignore-scripts", "--no-audit", "--no-fund")
  }

  Write-Host "Starting Persona Lab at http://localhost:3000/" -ForegroundColor Green
  Invoke-InProjectEnvironment @("npm", "run", "dev")
}
finally {
  Pop-Location
}
