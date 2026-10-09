const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Mini Spotify",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Cargamos el frontend desde el servidor interno
  mainWindow.loadURL('http://localhost:3000');

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', () => {
  // Encendemos el servidor invisible
  serverProcess = spawn('node', [path.join(__dirname, 'server.js')], {
    stdio: 'inherit'
  });

  // Le damos un segundo para arrancar y abrimos la ventana
  setTimeout(createWindow, 1000);
});

app.on('window-all-closed', function () {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});