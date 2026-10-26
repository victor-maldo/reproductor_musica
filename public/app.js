const URL_API_LOCAL = 'http://localhost:3000/api';
let audio = document.getElementById('audio-player');
let bibliotecaActual = []; // Guarda las canciones en memoria para filtrarlas rápido

// Al iniciar, cargamos la biblioteca y el almacenamiento
window.onload = () => {
    actualizarAlmacenamiento();
    cargarBiblioteca();
    cargarEstadoReproductor();
};

// --- NAVEGACIÓN ---
function mostrarVista(vista) {
    document.getElementById('vista-buscar').style.display = vista === 'buscar' ? 'block' : 'none';
    document.getElementById('vista-biblioteca').style.display = vista === 'biblioteca' ? 'block' : 'none';
    document.getElementById('vista-playlists').style.display = vista === 'playlists' ? 'block' : 'none';
    document.getElementById('vista-interior-playlist').style.display = vista === 'interior-playlist' ? 'block' : 'none';
    
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
        // 1. Buscamos en la red
        const res = await fetch(`${URL_API_LOCAL}/buscar?q=${encodeURIComponent(query)}`);
        
        if (!res.ok) throw new Error("Error en la conexión con el servidor");
        const videos = await res.json();
        
        // 2. NUEVO: Pedimos nuestra biblioteca para comparar qué tenemos ya
        const resBiblio = await fetch(`${URL_API_LOCAL}/canciones`);
        const bibliotecaLocal = await resBiblio.json();

        document.getElementById('loading-search').style.display = 'none';

        if (videos.length === 0) {
            grid.innerHTML = '<p>No se encontraron resultados.</p>';
            return;
        }

        videos.forEach(item => {
            // Comprobamos si la canción de YouTube coincide (por ID de vídeo o por título exacto) con algo de tu disco duro
            const cancionLocal = bibliotecaLocal.find(local => local.id === item.videoId || local.titulo.toLowerCase() === item.title.toLowerCase());
            const yaDescargada = !!cancionLocal; // True si existe, False si no existe

            const card = document.createElement('div');
            card.className = 'card';
            
            // Limpiamos caracteres raros (como comillas simples o dobles) para no romper el código HTML
            const tituloLimpio = item.title.replace(/['"]/g, "");
            const artistaLimpio = item.author.name.replace(/['"]/g, "");

            // Preparamos el HTML del check verde si ya la tenemos
            const iconoCheck = yaDescargada 
                ? `<div style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.8); border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; z-index: 5;">
                       <i class="fa-solid fa-check" style="color: #1db954;"></i>
                   </div>` 
                : '';

            // Dibujamos la tarjeta (sin el botón todavía)
            card.innerHTML = `
                ${iconoCheck}
                <img src="${item.image}" alt="Portada">
                <h3>${item.title}</h3>
                <p>${item.author.name}</p>
            `;

            // Creamos el botón de forma inteligente
            const btn = document.createElement('button');
            btn.className = 'btn-descargar';
            
            if (yaDescargada) {
                // SI YA LA TIENES: El botón se vuelve verde y sirve para escucharla
                btn.innerHTML = '<i class="fa-solid fa-play"></i> Reproducir';
                btn.style.backgroundColor = '#1db954';
                btn.style.cursor = 'pointer';
                // Usamos la función nativa que ya tenías para reproducir música
                btn.onclick = () => reproducir(cancionLocal);
            } else {
                // SI NO LA TIENES: Se queda tu botón de "Descargar" normal
                btn.innerHTML = '<i class="fa-solid fa-download"></i> Descargar';
                btn.setAttribute('onclick', `descargar('${item.videoId}', '${tituloLimpio}', '${artistaLimpio}', '${item.image}', '${item.timestamp}')`);
            }

            card.appendChild(btn);
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
    contextoActual = lista; // Guardamos la lista que se está mostrando en pantalla para el reproductor contextual
    lista.forEach((cancion, index) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.onclick = () => reproducirDesdeContexto(index); // Clic normal reproduce la canción
        
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
// --- VARIABLES DE LA COLA DE REPRODUCCIÓN ---
let colaReproduccion = []; // Aquí meteremos la lista de canciones a sonar
let indiceActual = -1;     // Saber por qué número de la cola vamos
let contextoActual = [];   // Guardamos la lista de canciones que se están mostrando en pantalla

// NUEVA FUNCIÓN: Reproducir respetando el contexto (tus vecinas de lista)
function reproducirDesdeContexto(index) {
    // 1. Copiamos TODAS las canciones de la pantalla actual a la cola
    colaReproduccion = [...contextoActual];
    // 2. Le decimos al reproductor que empiece en la posición que has clicado
    indiceActual = index;
    // 3. Le damos al Play (el 'false' evita que se vuelva a borrar la cola)
    reproducir(colaReproduccion[indiceActual], false);
}
// Esta es la función maestra que le da al Play
function reproducir(cancion, forzarInicioCola = true) {
    // Si hacemos clic en una canción suelta, creamos una cola nueva de 1 sola canción
    if (forzarInicioCola) {
        colaReproduccion = [cancion];
        indiceActual = 0;
    }

    document.getElementById('player-title').innerText = cancion.titulo;
    document.getElementById('player-artist').innerText = cancion.artista;
    document.getElementById('player-cover').src = cancion.portada;
    
    // Si la canción ya la tenemos en el disco duro, la ponemos. 
    // (En la Fase 3, aquí meteremos la lógica de descargar si no la tenemos)
    if (cancion.archivo) {
        audio.src = `http://localhost:3000/musica/${cancion.archivo}`;
        audio.play();
        document.getElementById('btn-play').innerHTML = '<i class="fa-solid fa-circle-pause fa-2x"></i>';
    } else {
        alert("Esta canción aún no está descargada. ¡Lo programaremos en la Fase 3!");
        siguienteCancion(); // Saltamos a la siguiente por ahora
    }
    guardarEstadoReproductor();
}

// Saltar a la siguiente canción
function siguienteCancion() {
    if (colaReproduccion.length === 0) return;
    
    indiceActual++;
    
    // Si hemos llegado al final de la cola
    if (indiceActual >= colaReproduccion.length) {
        indiceActual = -1;
        colaReproduccion = [];
        audio.src = "";
        document.getElementById('btn-play').innerHTML = '<i class="fa-solid fa-circle-play fa-2x"></i>';
        document.getElementById('player-title').innerText = "Fin de la lista";
        document.getElementById('player-artist').innerText = "-";
        return;
    }

    // Reproducimos la siguiente (le pasamos false para que no borre la cola actual)
    reproducir(colaReproduccion[indiceActual], false);
}

// Volver a la canción anterior
function cancionAnterior() {
    // Si la canción lleva más de 3 segundos sonando, al darle a anterior simplemente la reinicia (como Spotify)
    if (audio.currentTime > 3) {
        audio.currentTime = 0;
        audio.play();
        return;
    }

    if (colaReproduccion.length === 0 || indiceActual <= 0) return;
    
    indiceActual--;
    reproducir(colaReproduccion[indiceActual], false);
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
    guardarEstadoReproductor();
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
    guardarEstadoReproductor();
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

    // NUEVO 1: Extraemos el ID original de Spotify desde la URL.
    // Ej: https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M -> Sacamos "37i9dQZF1DXcBWIGoYBM5M"
    const matchId = url.match(/playlist\/([a-zA-Z0-9]+)/);
    // Si por algún motivo la URL es rara, caemos en el Date.now() como seguro de vida
    playlistActualId = matchId ? `spotify_${matchId[1]}` : 'pl_' + Date.now();

    document.getElementById('loading-search').style.display = 'block';
    document.getElementById('loading-search').innerText = 'Analizando Playlist de Spotify...';
    
    const grid = document.getElementById('resultados-busqueda');
    grid.innerHTML = '';

    try {
        const res = await fetch(`${URL_API_LOCAL}/spotify?url=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error("Error en el servidor");
        const datosSpotify = await res.json(); 
        
        const canciones = datosSpotify.canciones;
        const nombrePlaylist = datosSpotify.nombreLista; 

        // Descargamos TODAS nuestras listas guardadas para comprobar si ya existe
        const resPlaylists = await fetch(`${URL_API_LOCAL}/playlists`);
        const misPlaylistsGuardadas = await resPlaylists.json();
        
        // Comprobamos si el ID de Spotify ya está en nuestra base de datos
        let playlistGuardadaEnBD = misPlaylistsGuardadas.some(pl => pl.id === playlistActualId);

        const resBiblio = await fetch(`${URL_API_LOCAL}/canciones`);
        const bibliotecaLocal = await resBiblio.json();

        document.getElementById('loading-search').style.display = 'none';

        const portadaPlaylist = canciones[0].portada; 

        // 1. DIBUJAMOS LA CABECERA (Con el corazón condicionado)
        const headerDiv = document.createElement('div');
        headerDiv.style.cssText = "grid-column: 1/-1; display: flex; gap: 20px; background: #282828; padding: 20px; border-radius: 10px; align-items: center; margin-bottom: 20px;";
        
        // NUEVO 2: HTML del botón de guardar que cambia según si ya la tenemos
        const botonGuardarHTML = playlistGuardadaEnBD 
            ? `<button id="btn-gestor-guardar" disabled style="padding: 12px 24px; font-size: 16px; cursor: default; border: 1px solid #1db954; border-radius: 25px; background: transparent; color: white; font-weight: bold;">
                 <i class="fa-solid fa-heart" style="color: #1db954;"></i> Guardada en Playlists
               </button>`
            : `<button id="btn-gestor-guardar" style="padding: 12px 24px; font-size: 16px; cursor: pointer; border: 1px solid white; border-radius: 25px; background: transparent; color: white; font-weight: bold; transition: 0.2s;">
                 <i class="fa-regular fa-heart"></i> Guardar en Mis Playlists
               </button>`;

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
                    ${botonGuardarHTML}
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
        
        canciones.forEach((c, index) => {
            const cancionLocal = bibliotecaLocal.find(local => local.titulo.toLowerCase() === c.titulo.toLowerCase());
            const yaDescargada = !!cancionLocal;
            
            const idUnico = 'song_' + index;

            colaDescarga.push({
                ...c,
                idInterno: idUnico,
                estado: yaDescargada ? 'ya_descargada' : 'pendiente',
                videoIdExistente: yaDescargada ? cancionLocal.id : null,
                prioridad: false 
            });

            const card = document.createElement('div');
            card.className = 'card';
            card.id = `card-${idUnico}`;
            
            if (!yaDescargada) {
                card.title = "Haz clic para priorizar esta canción";
                card.onclick = () => priorizarCancion(idUnico);
            }

            const iconHtml = yaDescargada ? '<i class="fa-solid fa-check" style="color: #1db954;"></i>' : '<i class="fa-solid fa-clock" style="color: #b3b3b3;"></i>';
            const imgOpacity = yaDescargada ? '1' : '0.5';

            card.innerHTML = `
                <div id="icon-${idUnico}" style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.8); border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; z-index: 5;">
                    ${iconHtml}
                </div>
                <img src="${c.portada}" alt="Portada" style="opacity: ${imgOpacity};" id="img-${idUnico}">
                <h3>${c.titulo}</h3>
                <p>${c.artista}</p>
            `;
            cancionesGrid.appendChild(card);
        });

        // 3. LA LÓGICA DE LOS BOTONES
        const btnPlay = document.getElementById('btn-gestor-play');
        const btnGuardar = document.getElementById('btn-gestor-guardar');
        const btnCancelar = document.getElementById('btn-gestor-cancelar');

        async function asegurarPlaylistGuardada() {
            if (playlistGuardadaEnBD) return;
            
            // Preparamos TODAS las canciones (las descargadas y las que no) para enviarlas
            const pistasParaGuardar = colaDescarga.map(c => ({
                titulo: c.titulo,
                artista: c.artista,
                portada: c.portada
            }));

            // Enviamos todo en un solo paquete
            await fetch(`${URL_API_LOCAL}/playlists`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    id: playlistActualId, 
                    nombre: nombrePlaylist, 
                    portada: portadaPlaylist,
                    pistas: pistasParaGuardar // ¡Aquí viaja el plano entero!
                })
            });

            // Hemos eliminado el bucle 'for' que había aquí porque el servidor ya hace la magia solo

            cargarPlaylists(); 
            playlistGuardadaEnBD = true;
            
            if (btnGuardar) {
                btnGuardar.innerHTML = `<i class="fa-solid fa-heart" style="color: #1db954;"></i> Guardada en Playlists`;
                btnGuardar.style.borderColor = "#1db954";
                btnGuardar.disabled = true;
                btnGuardar.style.cursor = "default";
            }
        }

        // Si el botón no está deshabilitado de fábrica, le ponemos el evento
        if (!playlistGuardadaEnBD) {
            btnGuardar.onclick = asegurarPlaylistGuardada;
        }

        btnPlay.onclick = async () => {
            if (descargando && !pausaDescarga) {
                pausaDescarga = true;
                btnPlay.innerHTML = `<i class="fa-solid fa-play"></i> Reanudar`;
                btnPlay.style.backgroundColor = "#1db954";
                document.getElementById('gestor-estado').innerText = "Descarga Pausada";
            } else {
                if (!descargando) {
                    btnPlay.disabled = true; 
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
        console.error(error);
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
    // 1. NUEVO: Buscamos primero si hay alguna canción con "Pase VIP" (priorizada manualmente)
    let indexActual = colaDescarga.findIndex(c => c.estado === 'pendiente' && c.prioridad === true);
    
    // 2. Si no hay ninguna priorizada, seguimos el orden cronológico normal (la primera pendiente)
    if (indexActual === -1) {
        indexActual = colaDescarga.findIndex(c => c.estado === 'pendiente');
    }
    
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
    document.getElementById(`img-${c.idInterno}`).style.opacity = '1'; 
    document.getElementById(`card-${c.idInterno}`).style.borderColor = "#ffc107";

    try {
        const resBusqueda = await fetch(`${URL_API_LOCAL}/buscar?q=${encodeURIComponent(c.titulo + ' ' + c.artista + ' official audio')}`);
        const videos = await resBusqueda.json();
        
        if (videos.length > 0) {
            const videoId = videos[0].videoId;
            const duracion = videos[0].timestamp;
            
            await fetch(`${URL_API_LOCAL}/descargar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoId, titulo: c.titulo, artista: c.artista, portada: c.portada, duracion })
            });

            // Como NO hemos movido la canción de su sitio, indexActual sigue siendo su orden original de Spotify
            await fetch(`${URL_API_LOCAL}/playlists/${playlistActualId}/canciones`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cancionId: videoId, orden: indexActual })
            });
            
            actualizarAlmacenamiento();
            
            c.estado = 'completada';
            document.getElementById(`icon-${c.idInterno}`).innerHTML = '<i class="fa-solid fa-check" style="color: #1db954;"></i>';
            document.getElementById(`card-${c.idInterno}`).style.borderColor = "transparent";
            document.getElementById(`card-${c.idInterno}`).onclick = null; 
        } else {
            throw new Error("No encontrada en YT");
        }
    } catch (err) {
        c.estado = 'error';
        document.getElementById(`icon-${c.idInterno}`).innerHTML = '<i class="fa-solid fa-xmark" style="color: #dc3545;"></i>';
        document.getElementById(`card-${c.idInterno}`).style.borderColor = "transparent";
        console.error(`Error con ${c.titulo}:`, err);
    }

    // El motor vuelve a llamarse a sí mismo
    procesarColaDescarga();
}

// --- Función para priorizar SIN romper el orden visual ni la base de datos ---
// --- Función para priorizar o desmarcar (Interruptor) ---
function priorizarCancion(idInterno) {
    const cancion = colaDescarga.find(c => c.idInterno === idInterno);
    
    // Solo podemos interactuar si está pendiente
    if (!cancion || cancion.estado !== 'pendiente') return;

    const tarjetaHtml = document.getElementById(`card-${idInterno}`);
    const iconoDiv = document.getElementById(`icon-${idInterno}`);

    // Alternamos el estado de prioridad (Toggle)
    if (cancion.prioridad) {
        // SI YA ERA VIP: Se lo quitamos y volvemos al estado normal
        cancion.prioridad = false;
        tarjetaHtml.style.borderColor = "transparent"; // Quitamos el borde
        iconoDiv.innerHTML = '<i class="fa-solid fa-clock" style="color: #b3b3b3;"></i>'; // Vuelve el reloj gris
    } else {
        // SI NO ERA VIP: Se lo ponemos
        cancion.prioridad = true;
        tarjetaHtml.style.borderColor = "#1db954"; // Borde verde
        iconoDiv.innerHTML = '<i class="fa-solid fa-star" style="color: #1db954;"></i>'; // Estrella verde
    }
    
    // Pequeño bote visual para que notes el clic en ambos casos
    tarjetaHtml.style.transform = "scale(1.05)";
    setTimeout(() => tarjetaHtml.style.transform = "scale(1)", 200);
}
// Llamada inicial para cargar las listas guardadas al abrir la app
cargarPlaylists();

// --- VISTA INTERIOR DE LA PLAYLIST ---
async function abrirInteriorPlaylist(id) {
    // 1. Cambiamos a la nueva pantalla
    mostrarVista('interior-playlist');
    
    const cabecera = document.getElementById('cabecera-interior-playlist');
    const grid = document.getElementById('lista-interior-playlist');
    
    cabecera.innerHTML = 'Cargando playlist...';
    grid.innerHTML = '';

    try {
        // 2. Pedimos los datos completos de esta lista al servidor
        const res = await fetch(`${URL_API_LOCAL}/playlists/${id}/completa`);
        const playlistCompleta = await res.json();

        // 3. Dibujamos la cabecera estilo Spotify
        cabecera.style.cssText = "display: flex; gap: 20px; background: #282828; padding: 20px; border-radius: 10px; align-items: center;";
        cabecera.innerHTML = `
            <img src="${playlistCompleta.portada}" style="width: 150px; height: 150px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
            <div>
                <p style="color: #b3b3b3; text-transform: uppercase; font-size: 12px; font-weight: bold;">Playlist Local</p>
                <h2 style="margin-bottom: 10px; font-size: 2.5em;">${playlistCompleta.nombre}</h2>
                <p style="color: #b3b3b3; margin-bottom: 15px;">${playlistCompleta.canciones.length} canciones guardadas</p>
                <button class="btn-verde" style="padding: 12px 24px; font-size: 16px; cursor: pointer; border: none; border-radius: 25px; background: #1db954; color: white; font-weight: bold; transition: 0.2s;" onclick="reproducirPlaylistCompleta()">
                    <i class="fa-solid fa-play"></i> Reproducir desde el principio
                </button>
            </div>
        `;

        // 4. Dibujamos las canciones una por una
        if (playlistCompleta.canciones.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; color: #b3b3b3;">No hay canciones descargadas en esta lista todavía.</p>';
            return;
        }

        // GUARDAMOS EL CONTEXTO: Le decimos a la memoria global qué lista estamos viendo
        contextoActual = playlistCompleta.canciones;

        // Fíjate: Hemos añadido "index" al forEach para saber la posición (0, 1, 2...)
        playlistCompleta.canciones.forEach((cancion, index) => {
            const card = document.createElement('div');
            card.className = 'card';
            
            const yaDescargada = cancion.archivo != null;

            const tituloLimpio = cancion.titulo.replace(/['"]/g, "");
            const artistaLimpio = cancion.artista.replace(/['"]/g, "");

            let botonHtml = '';
            let iconoEsquina = '';

            if (yaDescargada) {
                // LA MAGIA ESTÁ AQUÍ: Ahora al hacer clic le pasamos la posición exacta
                card.onclick = () => reproducirDesdeContexto(index);
                
                iconoEsquina = `<div style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.8); border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; z-index: 5;">
                                    <i class="fa-solid fa-check" style="color: #1db954;"></i>
                                </div>`;
                
                // El botón verde también usa el contexto y el index
                botonHtml = `<button class="btn-descargar" style="background-color: #1db954; color: white;" onclick="event.stopPropagation(); reproducirDesdeContexto(${index})">
                                <i class="fa-solid fa-play"></i> Reproducir
                             </button>`;
            } else {
                // Si no está descargada, se queda igual
                iconoEsquina = `<div style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.8); border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; z-index: 5;">
                                    <i class="fa-solid fa-clock" style="color: #b3b3b3;"></i>
                                </div>`;
                botonHtml = `<button class="btn-descargar" style="background-color: transparent; border: 1px solid white; color: white;" onclick="descargarMagico(event, '${tituloLimpio}', '${artistaLimpio}', '${cancion.portada}')">
                                <i class="fa-solid fa-download"></i> Descargar
                             </button>`;
                card.style.opacity = "0.7"; 
            }

            card.innerHTML = `
                ${iconoEsquina}
                <img src="${cancion.portada}" alt="Portada">
                <h3 style="margin-top: 10px;">${cancion.titulo}</h3>
                <p>${cancion.artista}</p>
                ${botonHtml}
            `;
            grid.appendChild(card);
        });

    } catch (error) {
        cabecera.innerHTML = '<h3 style="color: #dc3545;">Error cargando la playlist.</h3>';
        console.error(error);
    }
}

// --- Carga toda la lista en el reproductor de golpe ---
function reproducirPlaylistCompleta() {
    // Como la función abrirInteriorPlaylist ya guardó las canciones en contextoActual, 
    // no necesitamos volver a pedírselas al servidor. ¡Es instantáneo!
    
    if (contextoActual.length === 0) {
        alert("No hay canciones en esta vista para reproducir.");
        return;
    }

    // Cargamos todas las canciones de la pantalla actual en nuestra cola
    colaReproduccion = [...contextoActual];
    indiceActual = 0; // Empezamos por la pista 1 (índice 0)
    
    // Empezamos a reproducir la primera sin borrar la cola
    reproducir(colaReproduccion[indiceActual], false);
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

// --- MEMORIA DE SESIÓN (LocalStorage) ---

function guardarEstadoReproductor() {
    const estado = {
        cola: colaReproduccion,
        indice: indiceActual,
        volumen: document.getElementById('volume-bar').value,
        tiempo: audio.currentTime || 0 // Guardamos el segundo exacto
    };
    localStorage.setItem('miniSpotifyEstado', JSON.stringify(estado));
}

function cargarEstadoReproductor() {
    const estadoGuardado = localStorage.getItem('miniSpotifyEstado');
    
    if (estadoGuardado) {
        try {
            const estado = JSON.parse(estadoGuardado);
            
            // 1. Restauramos el Volumen
            if (estado.volumen !== undefined) {
                document.getElementById('volume-bar').value = estado.volumen;
                audio.volume = estado.volumen / 100;
                
                const icono = document.getElementById('icon-vol');
                if (estado.volumen == 0) icono.className = 'fa-solid fa-volume-xmark';
                else if (estado.volumen < 50) icono.className = 'fa-solid fa-volume-low';
                else icono.className = 'fa-solid fa-volume-high';
            }

            // 2. Restauramos la Cola y la Canción
            if (estado.cola && estado.cola.length > 0 && estado.indice >= 0) {
                colaReproduccion = estado.cola;
                indiceActual = estado.indice;
                
                const cancion = colaReproduccion[indiceActual];
                
                // Pintamos la interfaz
                document.getElementById('player-title').innerText = cancion.titulo;
                document.getElementById('player-artist').innerText = cancion.artista;
                document.getElementById('player-cover').src = cancion.portada;
                
                if (cancion.archivo) {
                    audio.src = `http://localhost:3000/musica/${cancion.archivo}`;
                    
                    // IMPORTANTE: Hay que esperar a que el archivo cargue un poco antes de saltar al minuto en el que estábamos
                    audio.addEventListener('loadedmetadata', function onLoaded() {
                        audio.currentTime = estado.tiempo || 0;
                        actualizarBarraTiempo();
                        audio.removeEventListener('loadedmetadata', onLoaded); // Limpiamos el evento
                    });
                }
                
                // Lo dejamos en pausa (no asustamos al usuario poniendo música de golpe al abrir)
                document.getElementById('btn-play').innerHTML = '<i class="fa-solid fa-circle-play fa-2x"></i>';
            }
        } catch (e) {
            console.error("Error cargando la memoria del reproductor", e);
        }
    }
}

// 3. Guardamos el segundo exacto JUSTO antes de que el usuario cierre o recargue la aplicación
window.addEventListener('beforeunload', guardarEstadoReproductor);