@echo off
rem Latam B2B - dev server launcher
rem Clears NODE_OPTIONS to avoid the safe-delete shim, then starts Next.js
cd /d D:\latam-b2b
set NODE_OPTIONS=
call npm run dev
