const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const si = require("systeminformation");

const DATA_DIR = path.join(os.homedir(), "HAMRITA-TWEAKS");
const LOG_FILE = path.join(DATA_DIR, "hamrita.log");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let win;

function log(action, result = {}) {
  fs.appendFileSync(LOG_FILE, JSON.stringify({
    time: new Date().toISOString(), action, ...result
  }) + "\n", "utf8");
}

function ps(command, timeout = 30000) {
  return new Promise((resolve) => {
    execFile("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
      "-Command", command
    ], { windowsHide: true, timeout }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        code: error?.code ?? 0,
        stdout: String(stdout || "").trim(),
        stderr: String(stderr || "").trim()
      });
    });
  });
}

async function summary() {
  const [cpu, graphics, mem, load, osInfo, fsInfo, battery] = await Promise.all([
    si.cpu(), si.graphics(), si.mem(), si.currentLoad(),
    si.osInfo(), si.fsSize(), si.battery()
  ]);

  return {
    cpu: {
      brand: cpu.brand,
      cores: cpu.physicalCores,
      logical: cpu.cores,
      load: Math.round(load.currentLoad)
    },
    gpu: graphics.controllers?.map(g => ({
      model: g.model, vendor: g.vendor, vram: g.vram, driver: g.driverVersion
    })) || [],
    memory: {
      totalGB: +(mem.total / 1073741824).toFixed(1),
      usedGB: +(mem.used / 1073741824).toFixed(1),
      percent: Math.round(mem.used / mem.total * 100)
    },
    windows: {
      distro: osInfo.distro,
      version: osInfo.release,
      build: osInfo.build,
      arch: osInfo.arch
    },
    disks: fsInfo.map(d => ({
      mount: d.mount, sizeGB: +(d.size / 1073741824).toFixed(1),
      usedGB: +(d.used / 1073741824).toFixed(1), percent: Math.round(d.use)
    })),
    battery: battery.hasBattery ? {
      percent: battery.percent, charging: battery.isCharging
    } : null
  };
}

async function gameModeStatus() {
  const r = await ps(`$p='HKCU:\\Software\\Microsoft\\GameBar'; $v=(Get-ItemProperty -Path $p -Name AllowAutoGameMode -ErrorAction SilentlyContinue).AllowAutoGameMode; if($null -eq $v){$v=1}; [pscustomobject]@{value=$v} | ConvertTo-Json`);
  return r.ok ? { ok: true, enabled: Number(JSON.parse(r.stdout).value) !== 0 } : { ok: false, error: r.stderr };
}

async function setGameMode(enabled) {
  const value = enabled ? 1 : 0;
  const r = await ps(`New-Item -Path 'HKCU:\\Software\\Microsoft\\GameBar' -Force | Out-Null; Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\GameBar' -Name AllowAutoGameMode -Type DWord -Value ${value}`);
  log("game_mode", { enabled, ok: r.ok });
  return { ok: r.ok, message: r.ok ? `Game Mode ${enabled ? "enabled" : "disabled"}.` : r.stderr };
}

async function hagsStatus() {
  const r = await ps(`$p='HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers'; $v=(Get-ItemProperty -Path $p -Name HwSchMode -ErrorAction SilentlyContinue).HwSchMode; if($null -eq $v){$v=0}; [pscustomobject]@{value=$v} | ConvertTo-Json`);
  if (!r.ok) return { ok: false, error: r.stderr };
  const v = Number(JSON.parse(r.stdout).value);
  return { ok: true, enabled: v === 2, supportedValue: v };
}

async function setHags(enabled) {
  const value = enabled ? 2 : 1;
  const r = await ps(`New-Item -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Force | Out-Null; Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name HwSchMode -Type DWord -Value ${value}`);
  log("hags", { enabled, ok: r.ok, restartRequired: true });
  return { ok: r.ok, restartRequired: true, message: r.ok ? "HAGS setting changed. Windows restart may be required." : r.stderr };
}

async function powerPlans() {
  const r = await ps(`powercfg /list`);
  if (!r.ok) return { ok: false, error: r.stderr };
  const lines = r.stdout.split(/\r?\n/).filter(Boolean);
  const plans = lines.map(line => {
    const m = line.match(/([0-9a-fA-F-]{36}).*\\((.*?)\\)(\\s*\\*)?$/);
    return m ? { guid: m[1], name: m[2], active: Boolean(m[3]) } : null;
  }).filter(Boolean);
  return { ok: true, plans, raw: r.stdout };
}

async function setHighPerformance() {
  const r = await ps(`$out=(powercfg /list | Out-String); $m=[regex]::Match($out,'High performance.*?([0-9a-fA-F-]{36})'); if($m.Success){powercfg /setactive $m.Groups[1].Value; 'High performance selected'} else {powercfg /setactive SCHEME_MAX; 'High performance alias selected'}`);
  log("power_plan_high_performance", { ok: r.ok });
  return { ok: r.ok, message: r.ok ? r.stdout : r.stderr };
}

async function flushDns() {
  const r = await ps(`ipconfig /flushdns`);
  log("flush_dns", { ok: r.ok });
  return { ok: r.ok, message: r.ok ? r.stdout : r.stderr };
}

async function networkDiagnostics() {
  const r = await ps(`
    $cfg=Get-NetIPConfiguration | Where-Object {$_.IPv4DefaultGateway -ne $null} | Select-Object -First 1;
    $dns=(Get-DnsClientServerAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object {$_.ServerAddresses} | Select-Object -First 3).ServerAddresses -join ', ';
    $ping=Test-Connection 1.1.1.1 -Count 4 -ErrorAction SilentlyContinue;
    [pscustomobject]@{
      adapter=$cfg.InterfaceAlias;
      ipv4=$cfg.IPv4Address.IPAddress;
      gateway=$cfg.IPv4DefaultGateway.NextHop;
      dns=$dns;
      packetLoss=if($ping){[math]::Round((($ping | Where-Object {$_.StatusCode -ne 0}).Count / 4)*100,0)}else{$null};
      averageMs=if($ping){[math]::Round(($ping | Measure-Object ResponseTime -Average).Average,1)}else{$null}
    } | ConvertTo-Json
  `, 20000);
  if (!r.ok) return { ok: false, error: r.stderr };
  try { return { ok: true, data: JSON.parse(r.stdout) }; }
  catch { return { ok: false, error: "Network diagnostic parsing failed." }; }
}

async function cleanupScan() {
  const r = await ps(`
    $paths=@($env:TEMP,"$env:WINDIR\\Temp");
    $items=@();
    foreach($p in $paths){
      if(Test-Path $p){
        $items += Get-ChildItem -LiteralPath $p -Force -ErrorAction SilentlyContinue |
          Where-Object {-not $_.PSIsContainer}
      }
    }
    $bytes=($items | Measure-Object Length -Sum).Sum;
    [pscustomobject]@{files=$items.Count; bytes=[int64]($bytes ?? 0)} | ConvertTo-Json
  `);
  if (!r.ok) return { ok: false, error: r.stderr };
  return { ok: true, data: JSON.parse(r.stdout) };
}

async function cleanupApply() {
  const r = await ps(`
    $paths=@($env:TEMP,"$env:WINDIR\\Temp"); $deleted=0;
    foreach($p in $paths){
      if(Test-Path $p){
        $items=Get-ChildItem -LiteralPath $p -Force -ErrorAction SilentlyContinue | Where-Object {-not $_.PSIsContainer};
        foreach($i in $items){
          try{Remove-Item -LiteralPath $i.FullName -Force -ErrorAction Stop; $deleted++}catch{}
        }
      }
    }
    "Deleted $deleted temporary files."
  `, 60000);
  log("temp_cleanup", { ok: r.ok, output: r.stdout });
  return { ok: r.ok, message: r.ok ? r.stdout : r.stderr };
}

async function startupList() {
  const r = await ps(`
    $a=Get-CimInstance Win32_StartupCommand | Select-Object Name,Command,Location,User;
    $a | ConvertTo-Json -Depth 4
  `);
  if (!r.ok) return { ok: false, error: r.stderr };
  let data = [];
  try { data = JSON.parse(r.stdout || "[]"); if (!Array.isArray(data)) data=[data]; } catch {}
  return { ok: true, data };
}

async function createRestorePoint() {
  const r = await ps(`Checkpoint-Computer -Description 'HAMRITA TWEAKS Safety Backup' -RestorePointType 'MODIFY_SETTINGS'`, 45000);
  log("restore_point", { ok: r.ok });
  return { ok: r.ok, message: r.ok ? "Restore point created." : r.stderr };
}

ipcMain.handle("system:summary", summary);
ipcMain.handle("gaming:status", async () => ({ gameMode: await gameModeStatus(), hags: await hagsStatus() }));
ipcMain.handle("gaming:gameMode", (_e, enabled) => setGameMode(Boolean(enabled)));
ipcMain.handle("gaming:hags", (_e, enabled) => setHags(Boolean(enabled)));
ipcMain.handle("power:plans", powerPlans);
ipcMain.handle("power:high", setHighPerformance);
ipcMain.handle("network:diagnostics", networkDiagnostics);
ipcMain.handle("network:flushDns", flushDns);
ipcMain.handle("cleanup:scan", cleanupScan);
ipcMain.handle("cleanup:apply", cleanupApply);
ipcMain.handle("startup:list", startupList);
ipcMain.handle("backup:create", createRestorePoint);
ipcMain.handle("logs:get", () => {
  if (!fs.existsSync(LOG_FILE)) return [];
  return fs.readFileSync(LOG_FILE, "utf8").trim().split("\n").filter(Boolean).slice(-100).reverse().map(x => {
    try { return JSON.parse(x); } catch { return { action: x }; }
  });
});
ipcMain.handle("app:openGithub", () => shell.openExternal("https://github.com/"));
ipcMain.handle("app:version", () => app.getVersion());

function createWindow() {
  win = new BrowserWindow({
    width: 1450, height: 920, minWidth: 1180, minHeight: 720,
    backgroundColor: "#080b12", autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true, nodeIntegration: false
    }
  });
  if (!app.isPackaged) win.loadURL("http://localhost:5173");
  else win.loadFile(path.join(__dirname, "../dist/index.html"));
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });