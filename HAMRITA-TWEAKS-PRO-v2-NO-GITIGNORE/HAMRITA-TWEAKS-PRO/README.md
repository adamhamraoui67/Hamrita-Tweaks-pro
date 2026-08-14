# HAMRITA TWEAKS PRO

A Windows-first performance utility designed around **real system actions**, not fake FPS claims.

## Included in v2

- Live CPU/RAM monitoring
- CPU/GPU/Windows hardware detection
- Windows Game Mode status and toggle
- Hardware Accelerated GPU Scheduling status and toggle where supported
- Power-plan detection and High Performance profile
- DNS flush
- Network diagnostics
- Temporary-file scan and cleanup
- Windows startup inspection
- Restore-point protection
- Per-action logging
- Compatibility/risk labels
- React + Vite frontend
- Electron desktop shell
- GitHub Actions Windows build
- NSIS installer + portable EXE

## Philosophy

HAMRITA TWEAKS deliberately avoids undocumented "magic" registry packs and fake benchmark numbers. Each action has a purpose, a risk level, and a verification step when practical.

## Run

```bash
npm install
npm run dev
```

## Build EXE

```bash
npm run dist
```

Output is generated in `build/`.

## Windows

Some actions require Administrator privileges. The application detects this and explains when elevation is needed.
