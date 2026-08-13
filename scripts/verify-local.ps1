[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$envName = "pytorch_env"
$projectRoot = Split-Path -Parent $PSScriptRoot

function Invoke-InProjectEnvironment {
  param([Parameter(Mandatory = $true)][string[]]$Command)
  & conda run --no-capture-output -n $envName @Command
  if ($LASTEXITCODE -ne 0) {
    throw "Verification failed in Conda environment '$envName': $($Command -join ' ')"
  }
}

if (-not (Get-Command conda -ErrorAction SilentlyContinue)) {
  throw "Conda was not found. Open Anaconda Prompt or add Conda to PATH."
}

Push-Location $projectRoot
try {
  Write-Host "Verifying with existing Conda environment: $envName" -ForegroundColor Cyan
  Invoke-InProjectEnvironment @("python", "-c", "import sys; assert sys.prefix.lower().endswith('pytorch_env'); print('Python:', sys.version.split()[0], '|', sys.executable)")
  Invoke-InProjectEnvironment @("node", "--version")
  Invoke-InProjectEnvironment @("npm", "--version")
  Invoke-InProjectEnvironment @("npm", "ci", "--ignore-scripts", "--no-audit", "--no-fund")
  Invoke-InProjectEnvironment @("npm", "run", "verify")
  Write-Host "Local verification passed." -ForegroundColor Green
}
finally {
  Pop-Location
}
