const URL_API_LOCAL = 'http://localhost:3000/api';
let audio = document.getElementById('audio-player');
let bibliotecaActual = []; // Guarda las canciones en memoria para filtrarlas rápido

// Al iniciar, cargamos la biblioteca y el almacenamiento
window.onload = () => {
    actualizarAlmacenamiento();
    cargarBiblioteca();
};

// --- NAVEGACIÓN ---
function mostrarVista(vista) {
    document.getElementById('vista-buscar').style.display = vista === 'buscar' ? 'block' : 'none';
    document.getElementById('vista-biblioteca').style.display = vista === 'biblioteca' ? 'block' : 'none';
    document.getElementById('vista-playlists').style.display = vista === 'playlists' ? 'block' : 'none';
    
    if (vista === 'biblioteca') cargarBiblioteca();
}

// --- MONITOR DE ALMACENAMIENTO ---
async function actualizarAlmacenamiento() {
    try {
        const respuesta = await fetch(`${URL_API_LOCAL}/almacenamiento`);
        const datos = await respuesta.json();
        
        document.getElementById('storage-text').innerText = `${datos.archivos_peso_mb} MB ocupados`;
        document.getElementById('songs-count').innerText = `${datos.canciones_totales} canciones`;
        
        // Simulación visual: Si tu móvil/PC tiene un máximo, pongamos 1GB para llenar la barra como ejemplo
        const maximoMB = 1000; 
        const porcentaje = Math.min((datos.archivos_peso_mb / maximoMB) * 100, 100);
        document.getElementById('storage-fill').style.width = `${porcentaje}%`;
    } catch (error) {
        console.error("Error al obtener almacenamiento", error);
    }
}

// --- BÚSQUEDA (CON LA NUEVA LIBRERÍA DIRECTA) ---
async function buscarCancion() {
    const query = document.getElementById('input-busqueda').value;
    if (!query) return;

    document.getElementById('loading-search').style.display = 'block';
    const grid = document.getElementById('resultados-busqueda');
    grid.innerHTML = '';

    try {
        const res = await fetch(`${URL_API_LOCAL}/buscar?q=${encodeURIComponent(query)}`);
        
        // Si el servidor da error, paramos aquí para evitar que salte el TypeError de la consola
        if (!res.ok) throw new Error("Error en la conexión con el servidor");
        
        const videos = await res.json();
        document.getElementById('loading-search').style.display = 'none';

        if (videos.length === 0) {
            grid.innerHTML = '<p>No se encontraron resultados.</p>';
            return;
        }

        videos.forEach(item => {
            const card = document.createElement('div');
            card.className = 'card';
            // yt-search nos da los nombres de las variables así: item.videoId, item.title, item.author.name
            card.innerHTML = `
                <img src="${item.image}" alt="Portada">
                <h3>${item.title}</h3>
                <p>${item.author.name}</p>
                <button class="btn-descargar" onclick="descargar('${item.videoId}', '${item.title.replace(/'/g, "")}', '${item.author.name.replace(/'/g, "")}', '${item.image}', '${item.timestamp}')">
                    Descargar
                </button>
            `;
            grid.appendChild(card);
        });
    } catch (error) {
        document.getElementById('loading-search').innerText = 'Error buscando música.';
        console.error("Error capturado:", error);
    }
}

// --- DESCARGAR USANDO COBALT (Vía nuestro servidor) ---
async function descargar(videoId, titulo, artista, portada, duracion) {
    const boton = event.target;
    boton.innerText = "Descargando...";
    boton.disabled = true;

    try {
        const respuesta = await fetch(`${URL_API_LOCAL}/descargar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoId, titulo, artista, portada, duracion })
        });

        if (respuesta.ok) {
            boton.innerText = "¡Descargada!";
            boton.style.backgroundColor = "#28a745"; // Verde más oscuro
            actualizarAlmacenamiento(); // Refrescar el disco duro
        } else {
            boton.innerText = "Error";
            boton.style.backgroundColor = "#dc3545"; // Rojo
        }
    } catch (error) {
        boton.innerText = "Fallo red";
    }
}

// --- BIBLIOTECA Y FILTROS ---
async function cargarBiblioteca() {
    const grid = document.getElementById('lista-biblioteca');
    grid.innerHTML = 'Cargando biblioteca...';

    try {
        const res = await fetch(`${URL_API_LOCAL}/canciones`);
        bibliotecaActual = await res.json(); // Lo guardamos en nuestra variable
        renderizarBiblioteca(bibliotecaActual);
    } catch (error) {
        grid.innerHTML = 'Error cargando tu música.';
    }
}

function renderizarBiblioteca(lista) {
    const grid = document.getElementById('lista-biblioteca');
    grid.innerHTML = '';
    
    if (lista.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1;">No hay canciones que coincidan.</p>';
        return;
    }

    lista.forEach(cancion => {
        const card = document.createElement('div');
        card.className = 'card';
        card.onclick = () => reproducir(cancion); // Clic normal reproduce la canción
        
        // CUIDADO AQUÍ: Hemos inyectado el botón de puntitos y el menú rojo
        card.innerHTML = `
            <button class="card-menu-btn" onclick="toggleMenu(event, '${cancion.id}')" title="Opciones">
                <i class="fa-solid fa-ellipsis-vertical"></i>
            </button>
            <div class="dropdown-menu" id="menu-${cancion.id}">
                <button class="dropdown-item" onclick="eliminarCancion(event, '${cancion.id}')">
                    <i class="fa-solid fa-trash"></i> Eliminar
                </button>
            </div>
            
            <img src="${cancion.portada}" alt="Portada">
            <h3>${cancion.titulo}</h3>
            <p>${cancion.artista}</p>
        `;
        grid.appendChild(card);
    });
}

function filtrarBiblioteca() {
    const texto = document.getElementById('input-filtro').value.toLowerCase();
    
    // Filtramos buscando en el título o en el artista
    const filtradas = bibliotecaActual.filter(c => 
        c.titulo.toLowerCase().includes(texto) || 
        c.artista.toLowerCase().includes(texto)
    );
    
    renderizarBiblioteca(filtradas);
}

// --- REPRODUCTOR AUDIO ---
function reproducir(cancion) {
    document.getElementById('player-title').innerText = cancion.titulo;
    document.getElementById('player-artist').innerText = cancion.artista;
    document.getElementById('player-cover').src = cancion.portada;
    
    // Le decimos al audio tag dónde está el archivo físico (nuestro puerto 3000 sirve la carpeta)
    audio.src = `http://localhost:3000/musica/${cancion.archivo}`;
    audio.play();
    document.getElementById('btn-play').innerHTML = '<i class="fa-solid fa-circle-pause fa-2x"></i>';
}

function togglePlay() {
    if (!audio.src) return;
    if (audio.paused) {
        audio.play();
        document.getElementById('btn-play').innerHTML = '<i class="fa-solid fa-circle-pause fa-2x"></i>';
    } else {
        audio.pause();
        document.getElementById('btn-play').innerHTML = '<i class="fa-solid fa-circle-play fa-2x"></i>';
    }
}

function actualizarBarraTiempo() {
    const barra = document.getElementById('progress-bar');
    const tiempoActual = document.getElementById('time-current');
    const tiempoTotal = document.getElementById('time-total');

    if (audio.duration) {
        barra.max = audio.duration;
        barra.value = audio.currentTime;
        
        // Formatear a minutos:segundos
        let currentMins = Math.floor(audio.currentTime / 60);
        let currentSecs = Math.floor(audio.currentTime % 60);
        let totalMins = Math.floor(audio.duration / 60);
        let totalSecs = Math.floor(audio.duration % 60);
        
        if (currentSecs < 10) currentSecs = "0" + currentSecs;
        if (totalSecs < 10) totalSecs = "0" + totalSecs;

        tiempoActual.innerText = `${currentMins}:${currentSecs}`;
        tiempoTotal.innerText = `${totalMins}:${totalSecs}`;
    }
}

function saltarTiempo() {
    audio.currentTime = document.getElementById('progress-bar').value;
}
// --- NUEVAS FUNCIONES ---
async function abrirCarpeta() {
    try {
        await fetch(`${URL_API_LOCAL}/abrir-carpeta`);
    } catch (error) {
        console.error("Error abriendo carpeta", error);
    }
}

function cambiarVolumen() {
    const vol = document.getElementById('volume-bar').value;
    audio.volume = vol / 100; // HTML Audio funciona de 0.0 a 1.0
    
    // Cambiamos el icono según el volumen
    const icono = document.getElementById('icon-vol');
    if (vol == 0) icono.className = 'fa-solid fa-volume-xmark';
    else if (vol < 50) icono.className = 'fa-solid fa-volume-low';
    else icono.className = 'fa-solid fa-volume-high';
}
// --- FUNCIONES PARA ELIMINAR CANCIONES ---

// 1. Abrir/Cerrar los 3 puntitos
function toggleMenu(event, id) {
    event.stopPropagation(); // EL TRUCO: Evita que al hacer clic en los puntos, suene la canción
    
    // Cerramos todos los menús que estuvieran abiertos
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        if (menu.id !== `menu-${id}`) menu.classList.remove('show');
    });
    
    // Abrimos o cerramos el nuestro
    const menu = document.getElementById(`menu-${id}`);
    menu.classList.toggle('show');
}

// 2. Cerrar el menú si hacemos clic en cualquier otra parte de la pantalla
document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.classList.remove('show');
    });
});

// 3. La ejecución real de borrar
async function eliminarCancion(event, id) {
    event.stopPropagation(); // Evita que suene la canción al darle al botón rojo
    
    // Preguntamos para no borrar por accidente
    if (!confirm("¿Estás seguro de que quieres borrar esta canción para siempre?")) return;

    try {
        const res = await fetch(`${URL_API_LOCAL}/canciones/${id}`, { method: 'DELETE' });
        
        if (res.ok) {
            // Si la borramos bien, refrescamos la biblioteca y el monitor de disco duro
            cargarBiblioteca();
            actualizarAlmacenamiento();
            
            // Detalle PRO: Si la canción que acabamos de borrar estaba sonando ahora mismo, paramos el reproductor
            if (audio.src && audio.src.includes(id)) {
                audio.pause();
                audio.src = "";
                document.getElementById('player-title').innerText = "Ninguna canción";
                document.getElementById('player-artist').innerText = "-";
                document.getElementById('btn-play').innerHTML = '<i class="fa-solid fa-circle-play fa-2x"></i>';
            }
        } else {
            alert("Hubo un error al eliminar la canción.");
        }
    } catch (error) {
        console.error("Error de conexión al eliminar", error);
    }
}

// --- FUNCIONES DE SPOTIFY CORREGIDAS ---

// 1. Abre nuestra ventana visual
function importarSpotify() {
    document.getElementById('spotify-modal').classList.add('show');
    document.getElementById('spotify-input').value = ''; 
}

// 2. Cierra la ventana si le damos a Cancelar
function cerrarSpotifyModal() {
    document.getElementById('spotify-modal').classList.remove('show');
}

// 3. Procesa el enlace cuando le damos a "Importar"
// --- VARIABLES GLOBALES PARA EL GESTOR DE DESCARGAS ---
let colaDescarga = []; // Lista de canciones pendientes
let descargando = false; // Estado del gestor
let pausaDescarga = false; // Estado de pausa
let playlistActualId = null; // ID de la playlist que estamos bajando

async function procesarSpotifyUrl() {
    const url = document.getElementById('spotify-input').value;
    cerrarSpotifyModal();

    if (!url || !url.includes('spotify')) {
        alert("Por favor, introduce un enlace válido de Spotify.");
        return;
    }

    document.getElementById('loading-search').style.display = 'block';
    document.getElementById('loading-search').innerText = 'Analizando Playlist de Spotify...';
    
    const grid = document.getElementById('resultados-busqueda');
    grid.innerHTML = '';

    try {
        const res = await fetch(`${URL_API_LOCAL}/spotify?url=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error("Error en el servidor");
        const datosSpotify = await res.json(); 
        
        const canciones = datosSpotify.canciones;
        const nombrePlaylist = datosSpotify.nombreLista; // ¡Ahora sí usamos el nombre original!

        const resBiblio = await fetch(`${URL_API_LOCAL}/canciones`);
        const bibliotecaLocal = await resBiblio.json();

        document.getElementById('loading-search').style.display = 'none';

        playlistActualId = 'pl_' + Date.now(); 
        const portadaPlaylist = canciones[0].portada; 

        // 1. DIBUJAMOS LA CABECERA CON EL NUEVO BOTÓN
        const headerDiv = document.createElement('div');
        headerDiv.style.cssText = "grid-column: 1/-1; display: flex; gap: 20px; background: #282828; padding: 20px; border-radius: 10px; align-items: center; margin-bottom: 20px;";
        headerDiv.innerHTML = `
            <img src="${portadaPlaylist}" style="width: 150px; height: 150px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
            <div>
                <p style="color: #b3b3b3; text-transform: uppercase; font-size: 12px; font-weight: bold;">Playlist</p>
                <h2 style="margin-bottom: 10px; font-size: 2.5em;">${nombrePlaylist}</h2>
                <p style="color: #b3b3b3; margin-bottom: 15px;" id="gestor-estado">${canciones.length} canciones</p>
                
                <div style="display: flex; gap: 10px;">
                    <button id="btn-gestor-play" class="btn-verde" style="padding: 12px 24px; font-size: 16px; cursor: pointer; border: none; border-radius: 25px; background: #1db954; color: white; font-weight: bold; transition: 0.2s;">
                        <i class="fa-solid fa-play"></i> Iniciar Descarga
                    </button>
                    <!-- NUEVO BOTÓN: GUARDAR EN MI BIBLIOTECA -->
                    <button id="btn-gestor-guardar" style="padding: 12px 24px; font-size: 16px; cursor: pointer; border: 1px solid white; border-radius: 25px; background: transparent; color: white; font-weight: bold; transition: 0.2s;">
                        <i class="fa-regular fa-heart"></i> Guardar en Mis Playlists
                    </button>
                    <button id="btn-gestor-cancelar" style="display: none; padding: 12px 24px; font-size: 16px; cursor: pointer; border: none; border-radius: 25px; background: transparent; border: 1px solid #dc3545; color: #dc3545; font-weight: bold; transition: 0.2s;">
                        <i class="fa-solid fa-stop"></i> Cancelar
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(headerDiv);

        const cancionesGrid = document.createElement('div');
        cancionesGrid.id = "grid-gestor-canciones";
        cancionesGrid.style.cssText = "grid-column: 1/-1; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 20px;";
        grid.appendChild(cancionesGrid);

        // 2. PREPARAMOS LA COLA 
        colaDescarga = []; 
        let playlistGuardadaEnBD = false; // Variable para saber si ya la guardamos
        
        canciones.forEach((c, index) => {
            const cancionLocal = bibliotecaLocal.find(local => local.titulo.toLowerCase() === c.titulo.toLowerCase());
            const yaDescargada = !!cancionLocal;

            colaDescarga.push({
                ...c,
                idInterno: 'song_' + index,
                estado: yaDescargada ? 'ya_descargada' : 'pendiente',
                videoIdExistente: yaDescargada ? cancionLocal.id : null
            });

            const card = document.createElement('div');
            card.className = 'card';
            card.id = `card-${colaDescarga[colaDescarga.length-1].idInterno}`;
            
            if (!yaDescargada) {
                card.title = "Haz clic para priorizar esta canción";
                card.onclick = () => priorizarCancion(colaDescarga[colaDescarga.length-1].idInterno);
            }

            const iconHtml = yaDescargada ? '<i class="fa-solid fa-check" style="color: #1db954;"></i>' : '<i class="fa-solid fa-clock" style="color: #b3b3b3;"></i>';
            const imgOpacity = yaDescargada ? '1' : '0.5';

            card.innerHTML = `
                <div id="icon-${colaDescarga[colaDescarga.length-1].idInterno}" style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.8); border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; z-index: 5;">
                    ${iconHtml}
                </div>
                <img src="${c.portada}" alt="Portada" style="opacity: ${imgOpacity};" id="img-${colaDescarga[colaDescarga.length-1].idInterno}">
                <h3>${c.titulo}</h3>
                <p>${c.artista}</p>
            `;
            cancionesGrid.appendChild(card);
        });

        // 3. LA LÓGICA DE GUARDAR MANUALMENTE
        const btnPlay = document.getElementById('btn-gestor-play');
        const btnGuardar = document.getElementById('btn-gestor-guardar');
        const btnCancelar = document.getElementById('btn-gestor-cancelar');

        // Función que registra la Playlist oficial en la Base de Datos
        async function asegurarPlaylistGuardada() {
            if (playlistGuardadaEnBD) return;
            
            // Creamos la carpeta virtual de la playlist
            await fetch(`${URL_API_LOCAL}/playlists`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: playlistActualId, nombre: nombrePlaylist, portada: portadaPlaylist })
            });

            // Y vinculamos las canciones que ya tuviéramos de antes
            for(let i = 0; i < colaDescarga.length; i++) {
                if (colaDescarga[i].estado === 'ya_descargada') {
                    await fetch(`${URL_API_LOCAL}/playlists/${playlistActualId}/canciones`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ cancionId: colaDescarga[i].videoIdExistente, orden: i })
                    });
                    colaDescarga[i].estado = 'completada'; 
                }
            }

            cargarPlaylists(); // Refrescamos el menú lateral
            playlistGuardadaEnBD = true;
            
            // Cambiamos el aspecto del botón a "Guardado"
            btnGuardar.innerHTML = `<i class="fa-solid fa-heart" style="color: #1db954;"></i> Guardada en Playlists`;
            btnGuardar.style.borderColor = "#1db954";
            btnGuardar.disabled = true;
        }

        // Si el usuario hace clic en Guardar de forma manual
        btnGuardar.onclick = asegurarPlaylistGuardada;

        // 4. LÓGICA DEL MOTOR DE DESCARGA
        btnPlay.onclick = async () => {
            if (descargando && !pausaDescarga) {
                pausaDescarga = true;
                btnPlay.innerHTML = `<i class="fa-solid fa-play"></i> Reanudar`;
                btnPlay.style.backgroundColor = "#1db954";
                document.getElementById('gestor-estado').innerText = "Descarga Pausada";
            } else {
                if (!descargando) {
                    btnPlay.disabled = true; 
                    // Si inicias la descarga, asumimos que quieres guardar la lista automáticamente
                    await asegurarPlaylistGuardada(); 
                    btnPlay.disabled = false;
                }

                pausaDescarga = false;
                descargando = true;
                btnPlay.innerHTML = `<i class="fa-solid fa-pause"></i> Pausar Descarga`;
                btnPlay.style.backgroundColor = "#ffc107"; 
                btnPlay.style.color = "black";
                btnCancelar.style.display = 'block'; 
                
                procesarColaDescarga(); 
            }
        };

        btnCancelar.onclick = () => {
            pausaDescarga = true;
            descargando = false;
            colaDescarga = colaDescarga.filter(c => c.estado === 'completada'); 
            btnPlay.style.display = 'none';
            btnCancelar.style.display = 'none';
            document.getElementById('gestor-estado').innerText = "Descarga Cancelada";
        };

    } catch (error) {
        document.getElementById('loading-search').innerText = 'Error al leer la playlist. Verifica que el enlace sea público.';
    }
}
// Esta función busca la canción en YouTube automáticamente antes de descargarla
async function descargarMagico(event, titulo, artista, portada) {
    const boton = event.target;
    boton.innerText = "Buscando en YT...";
    boton.disabled = true;

    try {
        // 1. Buscamos en secreto en YouTube usando nuestro servidor
        const query = `${titulo} ${artista} official audio`;
        const resBusqueda = await fetch(`${URL_API_LOCAL}/buscar?q=${encodeURIComponent(query)}`);
        const videos = await resBusqueda.json();

        if (videos.length === 0) {
            boton.innerText = "No encontrada";
            return;
        }

        // 2. Tomamos el primer video de los resultados de YouTube
        const videoId = videos[0].videoId;
        const duracion = videos[0].timestamp; 

        boton.innerText = "Descargando...";

        // 3. Mandamos a descargar físicamente (igual que una descarga normal)
        const resDescarga = await fetch(`${URL_API_LOCAL}/descargar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoId, titulo, artista, portada, duracion })
        });

        if (resDescarga.ok) {
            boton.innerText = "¡Descargada!";
            boton.style.backgroundColor = "#28a745";
            actualizarAlmacenamiento();
        } else {
            boton.innerText = "Error";
            boton.style.backgroundColor = "#dc3545";
        }
    } catch (error) {
        boton.innerText = "Fallo de red";
    }
}

// --- FUNCIONES DE PLAYLISTS ---

async function cargarPlaylists() {
    const grid = document.getElementById('lista-playlists-guardadas');
    grid.innerHTML = 'Cargando tus playlists...';

    try {
        const res = await fetch(`${URL_API_LOCAL}/playlists`);
        const playlists = await res.json();

        grid.innerHTML = '';
        
        if (playlists.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; color: #b3b3b3;">Aún no tienes ninguna Playlist. Importa una desde Spotify o crea la tuya propia.</p>';
            return;
        }

        playlists.forEach(lista => {
            const card = document.createElement('div');
            card.className = 'card';
            card.onclick = () => abrirInteriorPlaylist(lista.id); 
            
            // NUEVO: Añadimos el menú de los 3 puntitos igual que en la biblioteca
            card.innerHTML = `
                <button class="card-menu-btn" onclick="toggleMenu(event, '${lista.id}')" title="Opciones">
                    <i class="fa-solid fa-ellipsis-vertical"></i>
                </button>
                <div class="dropdown-menu" id="menu-${lista.id}">
                    <button class="dropdown-item" onclick="eliminarPlaylist(event, '${lista.id}')">
                        <i class="fa-solid fa-trash"></i> Eliminar Lista
                    </button>
                </div>
                
                <img src="${lista.portada}" alt="Portada Playlist">
                <h3>${lista.nombre}</h3>
                <p>Playlist</p>
            `;
            grid.appendChild(card);
        });
    } catch (error) {
        grid.innerHTML = 'Error cargando las Playlists.';
        console.error(error);
    }
}

// --- MOTOR DEL GESTOR DE DESCARGAS ---

async function procesarColaDescarga() {
    // Buscamos la siguiente canción pendiente en la lista
    let indexActual = colaDescarga.findIndex(c => c.estado === 'pendiente');
    
    // Si no hay más pendientes, hemos terminado
    if (indexActual === -1) {
        descargando = false;
        document.getElementById('btn-gestor-play').style.display = 'none';
        document.getElementById('btn-gestor-cancelar').style.display = 'none';
        document.getElementById('gestor-estado').innerText = "¡Playlist Descargada Completamente!";
        document.getElementById('gestor-estado').style.color = "#1db954";
        return;
    }

    // Si pulsaron Pausa o Cancelar, detenemos el motor temporalmente
    if (pausaDescarga) return;

    // Cogemos la canción y le cambiamos el estado visual a "Descargando"
    const c = colaDescarga[indexActual];
    c.estado = 'descargando';
    
    document.getElementById('gestor-estado').innerText = `Descargando: ${c.titulo}...`;
    document.getElementById(`icon-${c.idInterno}`).innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="color: #ffc107;"></i>';
    document.getElementById(`img-${c.idInterno}`).style.opacity = '1'; // Iluminamos la portada
    document.getElementById(`card-${c.idInterno}`).style.borderColor = "#ffc107";

    try {
        // 1. Buscar
        const resBusqueda = await fetch(`${URL_API_LOCAL}/buscar?q=${encodeURIComponent(c.titulo + ' ' + c.artista + ' official audio')}`);
        const videos = await resBusqueda.json();
        
        if (videos.length > 0) {
            const videoId = videos[0].videoId;
            const duracion = videos[0].timestamp;
            
            // 2. Descargar
            await fetch(`${URL_API_LOCAL}/descargar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoId, titulo: c.titulo, artista: c.artista, portada: c.portada, duracion })
            });

            // 3. Vincular a la Playlist
            await fetch(`${URL_API_LOCAL}/playlists/${playlistActualId}/canciones`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cancionId: videoId, orden: indexActual })
            });
            
            actualizarAlmacenamiento();
            
            // 4. Éxito visual (Icono de check verde)
            c.estado = 'completada';
            document.getElementById(`icon-${c.idInterno}`).innerHTML = '<i class="fa-solid fa-check" style="color: #1db954;"></i>';
            document.getElementById(`card-${c.idInterno}`).style.borderColor = "transparent";
            document.getElementById(`card-${c.idInterno}`).onclick = null; // Ya no se puede priorizar
        } else {
            throw new Error("No encontrada en YT");
        }
    } catch (err) {
        // Error visual (Icono de cruz roja)
        c.estado = 'error';
        document.getElementById(`icon-${c.idInterno}`).innerHTML = '<i class="fa-solid fa-xmark" style="color: #dc3545;"></i>';
        document.getElementById(`card-${c.idInterno}`).style.borderColor = "transparent";
        console.error(`Error con ${c.titulo}:`, err);
    }

    // Al terminar con esta canción, el motor se vuelve a llamar a sí mismo (recursividad)
    // para seguir con la siguiente si no está en pausa.
    procesarColaDescarga();
}

// Función para cuando el usuario hace CLIC en una tarjeta pendiente
function priorizarCancion(idInterno) {
    // Solo podemos priorizar si hay canciones pendientes
    const index = colaDescarga.findIndex(c => c.idInterno === idInterno);
    if (index === -1 || colaDescarga[index].estado !== 'pendiente') return;

    // Buscamos cuál es el primer hueco disponible de las "pendientes"
    const primerPendienteIndex = colaDescarga.findIndex(c => c.estado === 'pendiente');
    
    if (index > primerPendienteIndex) {
        // Cortamos la canción de su sitio y la pegamos al principio de la cola
        const cancion = colaDescarga.splice(index, 1)[0];
        colaDescarga.splice(primerPendienteIndex, 0, cancion);
        
        // Reordenamos visualmente el panel de HTML para que suba arriba
        const grid = document.getElementById('grid-gestor-canciones');
        const tarjetaHtml = document.getElementById(`card-${idInterno}`);
        // La insertamos justo antes de la que era la "primera pendiente"
        grid.insertBefore(tarjetaHtml, grid.children[primerPendienteIndex]);
        
        // Un pequeño efecto visual para que el usuario vea que ha funcionado
        tarjetaHtml.style.transform = "scale(1.05)";
        setTimeout(() => tarjetaHtml.style.transform = "scale(1)", 200);
    }
}
// Llamada inicial para cargar las listas guardadas al abrir la app
cargarPlaylists();

// Función temporal para que las tarjetas no den error al hacerles clic
function abrirInteriorPlaylist(id) {
    console.log("Próximamente abriremos la playlist con ID:", id);
}

// --- FUNCION PARA BORRAR PLAYLISTS ---
async function eliminarPlaylist(event, id) {
    event.stopPropagation(); // Evita que se abra la playlist al intentar borrarla
    
    // Un aviso doble para mayor seguridad
    if (!confirm("¿Estás seguro de que quieres borrar esta playlist? \n(Tranquilo, tus canciones descargadas seguirán a salvo en 'Tu Biblioteca')")) return;

    try {
        const res = await fetch(`${URL_API_LOCAL}/playlists/${id}`, { method: 'DELETE' });
        
        if (res.ok) {
            cargarPlaylists(); // Recargamos la pantalla al instante
        } else {
            alert("Hubo un error al eliminar la playlist.");
        }
    } catch (error) {
        console.error("Error de conexión al eliminar", error);
    }
}