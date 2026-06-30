# Abre el navegador (admin + Twitch) y OBS posicionados en el segundo monitor.
# Navegador -> mitad izquierda, OBS -> mitad derecha.
# Si OBS ya esta abierto, lo cierra y lo vuelve a abrir.
param(
    [string]$AdminUrl  = "http://localhost:3000/admin",
    [string]$TwitchUrl = "https://www.twitch.tv/horuser"
)

$ErrorActionPreference = "Stop"

Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class Win {
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    public static uint PidOf(IntPtr hWnd) { uint pid; GetWindowThreadProcessId(hWnd, out pid); return pid; }
    public static List<IntPtr> AllVisibleWindows() {
        List<IntPtr> r = new List<IntPtr>();
        EnumWindows(delegate(IntPtr h, IntPtr l) {
            if (IsWindowVisible(h) && GetWindowTextLength(h) > 0) r.Add(h);
            return true;
        }, IntPtr.Zero);
        return r;
    }
}
"@

[void][Win]::SetProcessDPIAware()
Add-Type -AssemblyName System.Windows.Forms

# --- Geometria del segundo monitor (el no primario) ---
$screens = [System.Windows.Forms.Screen]::AllScreens
$target  = $screens | Where-Object { -not $_.Primary } | Select-Object -First 1
if (-not $target) {
    Write-Host "No se detecto un segundo monitor; usando el principal."
    $target = [System.Windows.Forms.Screen]::PrimaryScreen
}
$b     = $target.WorkingArea   # area util: excluye la barra de tareas
$halfW = [int][math]::Floor($b.Width / 2)
$left  = @{ X = $b.X;           Y = $b.Y; W = $halfW;            H = $b.Height }
$right = @{ X = $b.X + $halfW;  Y = $b.Y; W = $b.Width - $halfW; H = $b.Height }

function Get-WindowsForProcess([string]$name) {
    $procIds = @{}
    Get-Process -Name $name -ErrorAction SilentlyContinue | ForEach-Object { $procIds[[uint32]$_.Id] = $true }
    $res = @()
    if ($procIds.Count -eq 0) { return $res }
    foreach ($h in [Win]::AllVisibleWindows()) {
        if ($procIds.ContainsKey([Win]::PidOf($h))) { $res += $h }
    }
    return $res
}

function Wait-NewWindow([string]$name, [hashtable]$before, [int]$tries = 60) {
    for ($i = 0; $i -lt $tries; $i++) {
        Start-Sleep -Milliseconds 250
        foreach ($h in (Get-WindowsForProcess $name)) {
            if (-not $before.ContainsKey($h)) { return $h }
        }
    }
    return [IntPtr]::Zero
}

function Place-Window([IntPtr]$h, [hashtable]$rect) {
    if ($h -eq [IntPtr]::Zero) { return }
    [void][Win]::ShowWindow($h, 9)   # SW_RESTORE (saca de maximizado/minimizado)
    [void][Win]::MoveWindow($h, $rect.X, $rect.Y, $rect.W, $rect.H, $true)
    [void][Win]::SetForegroundWindow($h)
}

# --- Navegador (Chrome): ventana nueva con admin + Twitch, mitad izquierda ---
$chrome = (Get-Command chrome.exe -ErrorAction SilentlyContinue).Source
if (-not $chrome) {
    foreach ($p in @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe")) {
        if (Test-Path $p) { $chrome = $p; break }
    }
}

if ($chrome) {
    $before = @{}
    Get-WindowsForProcess 'chrome' | ForEach-Object { $before[$_] = $true }
    Start-Process $chrome -ArgumentList @('--new-window', $AdminUrl, $TwitchUrl) | Out-Null
    $win = Wait-NewWindow 'chrome' $before
    if ($win -ne [IntPtr]::Zero) {
        Place-Window $win $left
        Write-Host "Navegador colocado en la mitad izquierda del segundo monitor."
    } else {
        Write-Host "No se pudo localizar la ventana nueva de Chrome para posicionarla."
    }
} else {
    Write-Host "No se encontro Chrome. Abre manualmente: $AdminUrl  /  $TwitchUrl"
}

# --- OBS: cerrar si esta abierto, abrir y colocar en la mitad derecha ---
$obs = $null
foreach ($p in @(
    "C:\Program Files\obs-studio\bin\64bit\obs64.exe",
    "${env:ProgramFiles}\obs-studio\bin\64bit\obs64.exe",
    "${env:ProgramFiles(x86)}\obs-studio\bin\64bit\obs64.exe")) {
    if (Test-Path $p) { $obs = $p; break }
}

if ($obs) {
    $running = Get-Process -Name obs64 -ErrorAction SilentlyContinue
    if ($running) {
        Write-Host "OBS ya estaba abierto; cerrandolo..."
        $running | Stop-Process -Force
        Start-Sleep -Milliseconds 800
    }
    $obsDir = Split-Path $obs   # OBS requiere su carpeta bin como working dir
    $before = @{}
    Get-WindowsForProcess 'obs64' | ForEach-Object { $before[$_] = $true }
    Start-Process -FilePath $obs -WorkingDirectory $obsDir -ArgumentList @('--enable-media-stream', '--use-fake-ui-for-media-stream', '--disable-shutdown-check') | Out-Null
    $win = Wait-NewWindow 'obs64' $before
    if ($win -ne [IntPtr]::Zero) {
        Place-Window $win $right
        Write-Host "OBS colocado en la mitad derecha del segundo monitor."
    } else {
        Write-Host "OBS abierto, pero no se pudo localizar su ventana para posicionarla."
    }
} else {
    Write-Host "No se encontro obs64.exe en las rutas habituales; revisa la instalacion de OBS."
}
