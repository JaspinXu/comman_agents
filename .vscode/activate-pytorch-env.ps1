$ErrorActionPreference = "Stop"

$condaRoot = "C:\Users\19826\anaconda3"
$condaHook = Join-Path $condaRoot "shell\condabin\conda-hook.ps1"
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..")) -replace '^\\\\\?\\', ''

if (-not (Test-Path -LiteralPath $condaHook)) {
    throw "Conda hook not found: $condaHook"
}

& $condaHook
conda activate pytorch_env
Set-Location -LiteralPath $projectRoot

if ($env:CONDA_DEFAULT_ENV -ne "pytorch_env") {
    throw "Failed to activate Conda environment 'pytorch_env'."
}
