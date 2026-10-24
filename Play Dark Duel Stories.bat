@echo off
cd /d "%~dp0"
echo Starting the Dark Duel Stories server... (close this window to stop it)
start "Dark Duel Stories server" /min python game\tools\serve.py 8765
timeout /t 2 /nobreak >nul
start "" http://localhost:8765/
