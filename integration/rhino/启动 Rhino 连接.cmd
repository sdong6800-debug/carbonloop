@echo off
chcp 65001 >nul
title CarbonLoop Rhino Bridge
where node >nul 2>nul
if errorlevel 1 (
  echo 启动失败：这台电脑还没有安装 Node.js。
  echo 请先安装 Node.js LTS，然后重新双击本文件。
  pause
  exit /b 1
)
echo CarbonLoop 正在启动……
echo 启动后请在浏览器打开：http://127.0.0.1:8513/demo.html
echo 请保持这个窗口打开。
echo.
node "%~dp0..\rhino-bridge.cjs"
if errorlevel 1 (
  echo.
  echo 启动失败：请把本窗口的文字截图发给项目负责人。
  pause
)
