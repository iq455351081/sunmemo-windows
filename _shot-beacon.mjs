'use strict';
// Hover the beacon with the real cursor and screenshot the expanded pill.
import { execSync } from 'node:child_process';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const E = String.fromCharCode(92);
const APP = ['E:', 'Agentic_Engineering', 'ZCode', 'sunidea'].join(E);
const PS = c => execSync(`powershell -NoProfile -Command "${c}"`, { stdio: 'ignore' });
PS(`& '${APP + E}scripts-input.ps1' -x 1280 -y 20 -moveonly`);
await sleep(800);
PS(`Add-Type -AssemblyName System.Drawing; $b = New-Object System.Drawing.Bitmap(560, 160); $g = [System.Drawing.Graphics]::FromImage($b); $g.CopyFromScreen(1000, 0, 0, 0, $b.Size); $b.Save('${APP + E}_shots${E}beacon-hover.png'); $g.Dispose(); $b.Dispose()`);
console.log('beacon shot saved');
process.exit(0);
