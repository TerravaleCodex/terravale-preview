# Launch the existing V4 source folder directly; no live-site importer.
$ErrorActionPreference='Stop'
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)
$python=Get-Command py -ErrorAction SilentlyContinue
Start-Process 'http://127.0.0.1:8765/'
if($python){ & py -3 -m http.server 8765 --bind 127.0.0.1 }
else { & python -m http.server 8765 --bind 127.0.0.1 }
