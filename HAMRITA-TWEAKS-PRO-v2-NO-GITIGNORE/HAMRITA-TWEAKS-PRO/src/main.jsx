import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity, Gauge, Gamepad2, Settings, ShieldCheck, Zap, Cpu, MonitorCog,
  HardDrive, Network, Trash2, Rocket, ChevronRight, RefreshCw, CircleCheck,
  AlertTriangle, ListChecks, Power, Wifi, Database
} from "lucide-react";
import "./styles/globals.css";

const nav = [
  ["Dashboard", Activity],
  ["Gaming", Gamepad2],
  ["Performance", Gauge],
  ["Network", Network],
  ["Cleaner", Trash2],
  ["Startup", Rocket],
  ["Advanced", MonitorCog],
  ["Logs", ListChecks]
];

export default function App() {
  const [page, setPage] = useState("Dashboard");
  const [system, setSystem] = useState(null);
  const [gaming, setGaming] = useState(null);
  const [power, setPower] = useState(null);
  const [clean, setClean] = useState(null);
  const [network, setNetwork] = useState(null);
  const [startup, setStartup] = useState([]);
  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  async function refresh() {
    const s = await window.hamrita.system.summary();
    if (s) setSystem(s);
    const g = await window.hamrita.gaming.status();
    setGaming(g);
    const p = await window.hamrita.power.plans();
    setPower(p);
    setLogs(await window.hamrita.logs.get());
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, []);

  async function action(fn, success = "Completed") {
    setBusy(true);
    const r = await fn();
    setToast(r?.message || r?.error || success);
    await refresh();
    setBusy(false);
    setTimeout(() => setToast(""), 4000);
    return r;
  }

  const score = useMemo(() => {
    if (!system) return 0;
    let score = 92;
    score -= Math.max(0, system.cpu.load - 70) * 0.25;
    score -= Math.max(0, system.memory.percent - 80) * 0.18;
    const disk = system.disks?.[0]?.percent || 0;
    score -= Math.max(0, disk - 90) * 0.2;
    return Math.round(Math.max(55, Math.min(99, score)));
  }, [system]);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">H</div>
          <div><b>HAMRITA</b><small>TWEAKS</small></div>
        </div>
        <div className="section-label">CONTROL CENTER</div>
        <nav>{nav.map(([name, Icon]) =>
          <button key={name} className={`nav ${page === name ? "selected" : ""}`} onClick={() => setPage(name)}>
            <Icon size={18}/><span>{name}</span><ChevronRight size={14} className="nav-arrow"/>
          </button>
        )}</nav>
        <div className="side-bottom">
          <div className="protection"><ShieldCheck size={18}/><div><b>Protected mode</b><small>Safety-first changes</small></div></div>
          <small className="version">HAMRITA TWEAKS PRO • v2.0.0</small>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div><span className="eyebrow">HAMRITA ENGINE</span><h1>{page}</h1></div>
          <div className="top-actions"><span className="online"><i/> SYSTEM ONLINE</span><button className="refresh" onClick={refresh}><RefreshCw size={16}/></button></div>
        </header>

        {toast && <div className="toast"><CircleCheck size={17}/>{toast}</div>}

        {page === "Dashboard" && <Dashboard system={system} score={score} busy={busy} action={action} />}
        {page === "Gaming" && <Gaming gaming={gaming} busy={busy} action={action}/>}
        {page === "Performance" && <Performance power={power} busy={busy} action={action}/>}
        {page === "Network" && <NetworkPage network={network} setNetwork={setNetwork} busy={busy} action={action}/>}
        {page === "Cleaner" && <Cleaner clean={clean} setClean={setClean} busy={busy} action={action}/>}
        {page === "Startup" && <Startup startup={startup} setStartup={setStartup}/>}
        {page === "Advanced" && <Advanced busy={busy} action={action}/>}
        {page === "Logs" && <Logs logs={logs}/>}
      </main>
    </div>
  );
}

function Dashboard({system, score, busy, action}) {
  if (!system) return <Loading/>;
  return <>
    <section className="hero">
      <div>
        <span className="hero-tag">SYSTEM ANALYSIS</span>
        <h2>Performance under control.</h2>
        <p>HAMRITA analyzes your Windows configuration before making a change.</p>
        <button className="primary" disabled={busy} onClick={() => action(async () => {
          const b = await window.hamrita.backup.create();
          if (!b.ok) return b;
          return window.hamrita.cleaner.apply();
        }, "Safe optimization completed")}>
          <Zap size={18}/>{busy ? "WORKING..." : "OPTIMIZE SAFELY"}
        </button>
      </div>
      <div className="score"><div className="ring"><b>{score}</b><span>/100</span></div><small>OPTIMIZATION HEALTH</small></div>
    </section>
    <div className="metrics">
      <Metric icon={Cpu} title="CPU" value={system.cpu.brand} sub={`${system.cpu.load}% current load`}/>
      <Metric icon={MonitorCog} title="GPU" value={system.gpu?.[0]?.model || "Not detected"} sub={system.gpu?.[0]?.driver ? `Driver ${system.gpu[0].driver}` : "Detected"}/>
      <Metric icon={Activity} title="MEMORY" value={`${system.memory.usedGB} / ${system.memory.totalGB} GB`} sub={`${system.memory.percent}% used`}/>
      <Metric icon={HardDrive} title="WINDOWS" value={`Build ${system.windows.build}`} sub={`${system.windows.distro} • ${system.windows.arch}`}/>
    </div>
    <div className="two">
      <Panel title="What HAMRITA can optimize" icon={Gauge}>
        <Feature icon={Gamepad2} title="Gaming" text="Game Mode, HAGS and gaming-focused Windows settings."/>
        <Feature icon={Power} title="Performance" text="Power-plan analysis and High Performance selection."/>
        <Feature icon={Wifi} title="Network" text="Latency diagnostics and DNS cache operations."/>
        <Feature icon={Trash2} title="Cleaner" text="Scans and removes safe temporary files."/>
      </Panel>
      <Panel title="Safety model" icon={ShieldCheck}>
        <div className="safety"><b>Before</b><span>Backup / restore point when needed</span><b>During</b><span>Only explicit supported Windows actions</span><b>After</b><span>Verify result and write an audit log</span></div>
      </Panel>
    </div>
  </>;
}

function Gaming({gaming,busy,action}) {
  const gm = gaming?.gameMode;
  const hags = gaming?.hags;
  return <Page title="Gaming optimization" subtitle="Real Windows gaming controls with clear restart requirements.">
    <div className="two">
      <ToggleCard title="Windows Game Mode" icon={Gamepad2} status={gm?.enabled} description="Lets Windows prioritize game workloads and gaming behavior." busy={busy} onToggle={(v)=>action(()=>window.hamrita.gaming.setGameMode(v))}/>
      <ToggleCard title="Hardware-accelerated GPU scheduling" icon={MonitorCog} status={hags?.enabled} description="Uses the Windows GPU scheduling mode when supported by the graphics driver." busy={busy} onToggle={(v)=>action(()=>window.hamrita.gaming.setHags(v))} warning="A Windows restart may be required."/>
    </div>
    <Notice text="Do not expect a guaranteed FPS increase. Results depend on the game, driver, CPU/GPU and Windows version."/>
  </Page>;
}

function Performance({power,busy,action}) {
  return <Page title="Performance" subtitle="Power configuration and system performance controls.">
    <Panel title="Power plans" icon={Power}>
      {power?.plans?.length ? power.plans.map(p=><div className="list-row" key={p.guid}><div><b>{p.name}</b><small>{p.guid}</small></div><span className={p.active ? "active-pill":"pill"}>{p.active ? "ACTIVE":"AVAILABLE"}</span></div>) : <Loading/>}
      <button className="secondary" disabled={busy} onClick={()=>action(()=>window.hamrita.power.high())}><Zap size={16}/> USE HIGH PERFORMANCE</button>
    </Panel>
    <Notice text="High Performance can increase power use, heat and fan activity. Use it when you actually need sustained performance."/>
  </Page>;
}

function NetworkPage({network,setNetwork,busy,action}) {
  return <Page title="Network" subtitle="Measure the connection before changing it.">
    <Panel title="Connection diagnostics" icon={Network}>
      <button className="secondary" disabled={busy} onClick={async()=>{setNetwork(null); const r=await window.hamrita.network.diagnostics(); setNetwork(r);}}><Activity size={16}/> RUN DIAGNOSTIC</button>
      {network?.ok && <div className="network-grid">
        <MetricSmall label="ADAPTER" value={network.data.adapter || "-"}/>
        <MetricSmall label="GATEWAY" value={network.data.gateway || "-"}/>
        <MetricSmall label="AVERAGE PING" value={`${network.data.averageMs ?? "-"} ms`}/>
        <MetricSmall label="PACKET LOSS" value={`${network.data.packetLoss ?? "-"}%`}/>
      </div>}
    </Panel>
    <Panel title="DNS cache" icon={Database}>
      <p className="muted">Flushes the Windows DNS resolver cache. This is a diagnostic operation, not a magic ping reduction.</p>
      <button className="secondary" onClick={()=>action(()=>window.hamrita.network.flushDns())}>FLUSH DNS CACHE</button>
    </Panel>
  </Page>;
}

function Cleaner({clean,setClean,busy,action}) {
  const gb = clean?.data ? (clean.data.bytes/1073741824).toFixed(2) : "0.00";
  return <Page title="Cleaner" subtitle="Scan first. Delete only what you approve.">
    <Panel title="Temporary files" icon={Trash2}>
      <div className="clean-number">{gb}<small> GB potentially removable</small></div>
      <p className="muted">{clean?.data?.files ?? 0} removable temporary files detected.</p>
      <div className="buttons">
        <button className="secondary" onClick={async()=>setClean(await window.hamrita.cleaner.scan())}>SCAN</button>
        <button className="primary" disabled={busy} onClick={()=>action(()=>window.hamrita.cleaner.apply())}>CLEAN SAFE TEMP FILES</button>
      </div>
    </Panel>
  </Page>;
}

function Startup({startup,setStartup}) {
  return <Page title="Startup" subtitle="Inspect applications that Windows launches at startup.">
    <Panel title="Startup inventory" icon={Rocket}>
      <button className="secondary" onClick={async()=>{const r=await window.hamrita.startup.list(); if(r.ok)setStartup(r.data);}}>SCAN STARTUP</button>
      <div className="startup-list">{startup.slice(0,40).map((x,i)=><div className="list-row" key={i}><div><b>{x.Name || "Unknown"}</b><small>{x.Command || "-"}</small></div><span className="pill">{x.Location || "Windows"}</span></div>)}</div>
    </Panel>
  </Page>;
}

function Advanced({busy,action}) {
  return <Page title="Advanced" subtitle="Safety and system protection.">
    <Panel title="Restore protection" icon={ShieldCheck}>
      <p className="muted">Create a Windows restore point before significant system changes. Windows may require System Protection to be enabled.</p>
      <button className="secondary" disabled={busy} onClick={()=>action(()=>window.hamrita.backup.create())}>CREATE RESTORE POINT</button>
    </Panel>
  </Page>;
}

function Logs({logs}) {
  return <Page title="Audit logs" subtitle="Every HAMRITA action is recorded locally.">
    <Panel title="Recent activity" icon={ListChecks}>
      {logs.length ? logs.map((x,i)=><div className="list-row" key={i}><div><b>{x.action || "Action"}</b><small>{x.time || ""}</small></div><span className={x.ok ? "active-pill":"pill"}>{x.ok ? "OK":"CHECK"}</span></div>) : <p className="muted">No actions logged yet.</p>}
    </Panel>
  </Page>;
}

function Page({title,subtitle,children}) { return <><div className="page-intro"><span className="eyebrow">MODULE</span><h2>{title}</h2><p>{subtitle}</p></div>{children}</>; }
function Metric({icon:Icon,title,value,sub}) { return <div className="metric"><div className="metric-icon"><Icon size={18}/></div><span>{title}</span><b title={value}>{value}</b><small>{sub}</small></div>; }
function MetricSmall({label,value}) { return <div className="metric-small"><span>{label}</span><b>{value}</b></div>; }
function Feature({icon:Icon,title,text}) { return <div className="feature"><Icon size={17}/><div><b>{title}</b><small>{text}</small></div></div>; }
function ToggleCard({title,icon:Icon,status,description,busy,onToggle,warning}) { return <div className="toggle-card"><div className="toggle-head"><Icon size={22}/><span className={status ? "good":"off"}>{status ? "ON":"OFF"}</span></div><h3>{title}</h3><p>{description}</p>{warning&&<small className="warning"><AlertTriangle size={13}/>{warning}</small>}<button className={status ? "secondary":"primary"} disabled={busy} onClick={()=>onToggle(!status)}>{status ? "DISABLE":"ENABLE"}</button></div>; }
function Panel({title,icon:Icon,children}) { return <section className="panel"><div className="panel-title"><Icon size={18}/><b>{title}</b></div>{children}</section>; }
function Notice({text}) { return <div className="notice"><AlertTriangle size={17}/>{text}</div>; }
function Loading() { return <div className="loading"><RefreshCw size={20}/> Reading Windows system data...</div>; }