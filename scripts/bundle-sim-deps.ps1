<#
.SYNOPSIS
  Stage the Engineering Labs simulation dependencies INTO the app so the
  packaged build ships them (offline, no live install on stage / metered data).

  Run this once before `npm run tauri build` (or after a fresh clone / a
  python-runtime refresh). It is idempotent — re-running is safe.

  What it stages, all into the BUNDLED runtime / resources (never system Python):
    * MuJoCo + numpy    -> src-tauri/resources/python-runtime  (Robotics field)
    * CybORG            -> src-tauri/resources/python-runtime  (Cyber Simulation)
    * Icarus Verilog    -> src-tauri/resources/mcp/iverilog     (Computing/RTL field)

  Windows-mcp, the cyber-unified build, and CALDERA's REST wrapper are already
  staged in resources/mcp and are not touched here.

.PARAMETER SkipMujoco   Skip the MuJoCo install.
.PARAMETER SkipCyborg   Skip the CybORG install (it is heavy — many deps).
.PARAMETER SkipIverilog Skip staging Icarus Verilog.

.EXAMPLE
  pwsh -File scripts/bundle-sim-deps.ps1
  pwsh -File scripts/bundle-sim-deps.ps1 -SkipCyborg   # robotics + RTL only
#>
[CmdletBinding()]
param(
  [switch]$SkipMujoco,
  [switch]$SkipCyborg,
  [switch]$SkipIverilog
)

$ErrorActionPreference = "Stop"

# The bundled runtime shares the per-user site-packages (%APPDATA%\Python\...),
# so a dep already installed there would report "already satisfied" and NEVER be
# written into the runtime's own site-packages — i.e. it would NOT ship in the
# bundle. Disable user-site so every install lands in the (bundle-able) runtime
# site-packages, and resolution ignores whatever happens to be in Roaming.
$env:PYTHONNOUSERSITE = "1"

# --- Paths (script lives in scripts/, so repo root is its parent) -----------
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Python   = Join-Path $RepoRoot "src-tauri\resources\python-runtime\python.exe"
$McpRoot  = Join-Path $RepoRoot "src-tauri\resources\mcp"
$CyborgSrc = Join-Path $RepoRoot "vendor\sim\cage-challenge-4"

$results = [ordered]@{}

function Write-Head($msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

if (-not (Test-Path $Python)) {
  Write-Host "ERROR: bundled Python not found at:" -ForegroundColor Red
  Write-Host "  $Python" -ForegroundColor Red
  Write-Host "The app's python-runtime must be present first (it ships in" -ForegroundColor Yellow
  Write-Host "src-tauri/resources/python-runtime). Aborting." -ForegroundColor Yellow
  exit 1
}
Write-Host "Bundled Python: $Python" -ForegroundColor DarkGray

# Make sure pip exists in the embedded runtime (some are shipped without it).
Write-Head "Ensuring pip in the bundled runtime"
try {
  & $Python -m pip --version 2>$null
  if ($LASTEXITCODE -ne 0) { throw "no pip" }
  Write-Host "pip present."
} catch {
  Write-Host "Bootstrapping pip (ensurepip)..." -ForegroundColor Yellow
  & $Python -m ensurepip --upgrade
  if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: could not bootstrap pip in the bundled runtime." -ForegroundColor Red
    exit 1
  }
}

# --- MuJoCo (Robotics) ------------------------------------------------------
if ($SkipMujoco) {
  $results["MuJoCo"] = "skipped"
} else {
  Write-Head "Installing MuJoCo + numpy into the bundled runtime"
  & $Python -m pip install --no-warn-script-location mujoco numpy
  if ($LASTEXITCODE -eq 0) {
    $ver = (& $Python -c "import mujoco; print(mujoco.__version__)" 2>$null)
    $results["MuJoCo"] = if ($ver) { "ok ($ver)" } else { "installed (import unverified)" }
  } else {
    $results["MuJoCo"] = "FAILED"
  }
}

# --- CybORG (Cyber Simulation) ---------------------------------------------
if ($SkipCyborg) {
  $results["CybORG"] = "skipped"
} elseif (-not (Test-Path (Join-Path $CyborgSrc "setup.py"))) {
  Write-Host "CybORG source not found at $CyborgSrc (setup.py missing) — skipping." -ForegroundColor Yellow
  $results["CybORG"] = "source missing"
} else {
  Write-Head "Installing CybORG into the bundled runtime (heavy — this can take a while)"
  # Non-editable so it copies into site-packages and travels with the bundle.
  & $Python -m pip install --no-warn-script-location "$CyborgSrc"
  if ($LASTEXITCODE -eq 0) {
    $ok = (& $Python -c "import CybORG; print('ok')" 2>$null)
    $results["CybORG"] = if ($ok -eq "ok") { "ok" } else { "installed (import unverified)" }
  } else {
    $results["CybORG"] = "FAILED"
  }
}

# --- Icarus Verilog (Computing/RTL) ----------------------------------------
if ($SkipIverilog) {
  $results["IcarusVerilog"] = "skipped"
} else {
  Write-Head "Staging Icarus Verilog into resources/mcp/iverilog"
  $dest = Join-Path $McpRoot "iverilog"

  if (Test-Path (Join-Path $dest "bin\iverilog.exe")) {
    Write-Host "Already staged at $dest."
    $results["IcarusVerilog"] = "already staged"
  } else {
    # A valid Icarus tree has bin\iverilog.exe next to its lib\ (the exe finds
    # its runtime relative to itself, so the whole tree must be copied intact).
    $candidates = @(
      "C:\ProgramData\chocolatey\lib\iverilog\tools",
      (Join-Path $env:ProgramFiles "iverilog"),
      (Join-Path ${env:ProgramFiles(x86)} "iverilog"),
      "C:\iverilog"
    ) | Where-Object { $_ -and (Test-Path (Join-Path $_ "bin\iverilog.exe")) }

    $src = $candidates | Select-Object -First 1
    if (-not $src) {
      Write-Host "Icarus Verilog install tree not found." -ForegroundColor Yellow
      Write-Host "Install it first, then re-run:" -ForegroundColor Yellow
      Write-Host "  choco install iverilog    (or winget install --id=IcarusVerilog.IcarusVerilog)" -ForegroundColor Yellow
      Write-Host "or download from https://bleyer.org/icarus/ and copy the install folder to:" -ForegroundColor Yellow
      Write-Host "  $dest" -ForegroundColor Yellow
      $results["IcarusVerilog"] = "not found (see message)"
    } else {
      Write-Host "Copying $src -> $dest"
      New-Item -ItemType Directory -Force -Path $dest | Out-Null
      Copy-Item -Path (Join-Path $src "*") -Destination $dest -Recurse -Force
      $exe = Join-Path $dest "bin\iverilog.exe"
      if (Test-Path $exe) {
        $v = (& $exe -V 2>$null | Select-Object -First 1)
        $results["IcarusVerilog"] = if ($v) { "ok ($v)" } else { "staged" }
      } else {
        $results["IcarusVerilog"] = "FAILED (copy incomplete)"
      }
    }
  }
}

# --- Summary ----------------------------------------------------------------
Write-Head "Bundle summary"
$failed = $false
foreach ($k in $results.Keys) {
  $v = $results[$k]
  $color = if ($v -like "FAILED*") { "Red" }
           elseif ($v -like "ok*" -or $v -like "already*") { "Green" }
           else { "Yellow" }
  Write-Host ("  {0,-16} {1}" -f $k, $v) -ForegroundColor $color
  if ($v -like "FAILED*") { $failed = $true }
}
Write-Host ""
if ($failed) {
  Write-Host "One or more required deps FAILED — fix before packaging." -ForegroundColor Red
  exit 1
}
Write-Host "Done. These now ship with 'npm run tauri build'." -ForegroundColor Green
Write-Host "Note: resources/ is gitignored, so run this on each build machine." -ForegroundColor DarkGray
