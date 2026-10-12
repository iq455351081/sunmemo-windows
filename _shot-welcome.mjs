'use strict';
// Screenshot the welcome window (buttons must be fully visible).
import { execSync } from 'node:child_process';
const E = String.fromCharCode(92);
const APP = ['E:', 'Agentic_Engineering', 'ZCode', 'sunidea'].join(E);
const out = APP + E + '_shots' + E + 'welcome-v16.png';
execSync(`powershell -NoProfile -Command "Add-Type -AssemblyName System.Drawing; $b = New-Object System.Drawing.Bitmap(600, 900); $g = [System.Drawing.Graphics]::FromImage($b); $g.CopyFromScreen(480, 60, 0, 0, $b.Size); $b.Save('${out}'); $g.Dispose(); $b.Dispose()"`, { stdio: 'ignore' });
console.log('welcome shot saved');
process.exit(0);
