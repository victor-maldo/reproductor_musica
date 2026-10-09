const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const fsPromises = require('fs').promises; // Para calcular el tamaño de los directorios
const ytSearch = require('yt-search');
const { exec } = require('child_process');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Servir la carpeta public (tu HTML)
app.use(express.static(path.join(__dirname, 'public')));
// Servir la música para que el HTML pueda reproducirla
app.use('/musica', express.static(path.join(__dirname, 'datos', 'descargas')));

// Configuración de la base de datos
const dbPath = path.join(__dirname, 'datos', 'canciones.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error al conectar con SQLite:', err.message);
    } else {
        console.log('Conectado a la base de datos local SQLite.');
        db.run(`CREATE TABLE IF NOT EXISTS canciones (
            id TEXT PRIMARY KEY,
            titulo TEXT,
            artista TEXT,
            duracion TEXT,
            portada TEXT,
            archivo TEXT,
            fecha_descarga DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

// --- RUTA 1: ESTADO DEL ALMACENAMIENTO ---
app.get('/api/almacenamiento', async (req, res) => {
    try {
        const dirPath = path.join(__dirname, 'datos', 'descargas');
        let totalSize = 0;
        
        // Calcular el peso de la carpeta de descargas
        if (fs.existsSync(dirPath)) {
            const files = await fsPromises.readdir(dirPath);
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const stats = await fsPromises.stat(filePath);
                if (stats.isFile()) totalSize += stats.size;
            }
        }
        
        // Contar cuántas canciones hay en la BD
        db.get('SELECT COUNT(*) as total FROM canciones', [], (err, row) => {
            if (err) return res.status(500).json({ error: 'Error al contar canciones' });
            
            res.json({
                archivos_peso_bytes: totalSize,
                archivos_peso_mb: (totalSize / (1024 * 1024)).toFixed(2),
                canciones_totales: row.total
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Error calculando almacenamiento' });
    }
});


// --- RUTA 2: DESCARGAR (Directamente con tu yt-dlp.exe local) ---
app.post('/api/descargar', (req, res) => {
    const { videoId, titulo, artista, portada, duracion } = req.body;
    
    if (!videoId) return res.status(400).json({ error: 'Falta el videoId' });

    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const archivoNombre = `${videoId}.m4a`;
    const archivoDestino = path.join(__dirname, 'datos', 'descargas', archivoNombre);

    try {
        console.log(`Arrancando motores... Descargando: ${titulo}`);
        
        // El comando mágico que le pasamos a yt-dlp.exe
        // -x = Solo audio
        // --audio-format m4a = Formato nativo
        // --audio-quality 128K = Máxima compresión
        // --no-warnings = Que no ensucie la consola con avisos
        const comando = `yt-dlp.exe -x --audio-format m4a --audio-quality 128K --no-warnings -o "${archivoDestino}" ${youtubeUrl}`;

        // Ejecutamos el comando de forma nativa en tu Windows
        exec(comando, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error de yt-dlp: ${error.message}`);
                return res.status(500).json({ error: 'Fallo en la descarga física' });
            }

            console.log(`¡Archivo descargado con éxito!: ${archivoNombre}`);
            
            // Guardamos los datos en SQLite
            db.run(
                `INSERT OR REPLACE INTO canciones (id, titulo, artista, duracion, portada, archivo) VALUES (?, ?, ?, ?, ?, ?)`,
                [videoId, titulo, artista, duracion, portada, archivoNombre],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Error al guardar en base de datos' });
                    }
                    res.json({ mensaje: 'Descargado y guardado correctamente', archivo: archivoNombre });
                }
            );
        });

    } catch (error) {
        console.error('Error general de descarga:', error.message);
        res.status(500).json({ error: 'Fallo al procesar la descarga' });
    }
});


// --- RUTA 3: LISTAR CANCIONES DESCARGADAS ---
app.get('/api/canciones', (req, res) => {
    db.all('SELECT * FROM canciones ORDER BY fecha_descarga DESC', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: 'Error al leer la base de datos' });
        } else {
            res.json(rows);
        }
    });
});

// --- RUTA 4: BUSCAR EN YOUTUBE (Directo y sin caídas) ---
app.get('/api/buscar', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Falta el término de búsqueda' });

    try {
        console.log(`Buscando: ${query}...`);
        
        // Buscamos directamente en YouTube usando el paquete yt-search
        const resultado = await ytSearch(query);
        
        // Cogemos solo los primeros 10 vídeos musicales
        const videos = resultado.videos.slice(0, 10);
        
        // Devolvemos la lista limpia
        res.json(videos);
    } catch (error) {
        console.error('Error buscando música:', error.message);
        res.status(500).json({ error: 'Fallo al buscar en YouTube' });
    }
});

// --- RUTA 5: ABRIR CARPETA LOCAL ---
app.get('/api/abrir-carpeta', (req, res) => {
    const dirPath = path.join(__dirname, 'datos', 'descargas');
    let comando = '';
    
    // Detectamos el sistema operativo para usar el comando correcto (en tu caso Windows)
    if (process.platform === 'win32') {
        comando = `explorer "${dirPath}"`;
    } else if (process.platform === 'darwin') {
        comando = `open "${dirPath}"`;
    } else {
        comando = `xdg-open "${dirPath}"`;
    }

    exec(comando, (error) => {
        if (error) return res.status(500).json({ error: 'Fallo al abrir carpeta' });
        res.json({ mensaje: 'Carpeta abierta' });
    });
});

app.listen(PORT, () => {
    console.log(`Servidor interno corriendo en http://localhost:${PORT}`);
});
// --- RUTA 6: ELIMINAR CANCIÓN (Borrado total) ---
app.delete('/api/canciones/:id', (req, res) => {
    const videoId = req.params.id;
    
    // 1. Buscamos cómo se llama el archivo en la base de datos
    db.get('SELECT archivo FROM canciones WHERE id = ?', [videoId], (err, row) => {
        if (err) return res.status(500).json({ error: 'Error en la base de datos' });
        if (!row) return res.status(404).json({ error: 'Canción no encontrada' });

        const archivoDestino = path.join(__dirname, 'datos', 'descargas', row.archivo);

        // 2. Eliminamos el archivo físico del disco duro de Windows
        fs.unlink(archivoDestino, (err) => {
            // Si hay error pero es porque el archivo ya no existía, lo ignoramos
            if (err && err.code !== 'ENOENT') {
                console.error('Error borrando archivo físico:', err);
                return res.status(500).json({ error: 'No se pudo borrar el archivo físico' });
            }

            // 3. Eliminamos el registro de la base de datos SQLite
            db.run('DELETE FROM canciones WHERE id = ?', [videoId], function(err) {
                if (err) return res.status(500).json({ error: 'Error borrando de la BD' });
                
                console.log(`¡Canción fulminada con éxito!: ${row.archivo}`);
                res.json({ mensaje: 'Canción eliminada correctamente' });
            });
        });
    });
});