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
    document.getElementById('spotify-input').value = ''; // Limpiamos el texto anterior
}

// 2. Cierra la ventana si le damos a Cancelar
function cerrarSpotifyModal() {
    document.getElementById('spotify-modal').classList.remove('show');
}

// 3. Procesa el enlace cuando le damos a "Importar"
async function procesarSpotifyUrl() {
    const url = document.getElementById('spotify-input').value;
    cerrarSpotifyModal(); // Cerramos la ventanita

    if (!url || !url.includes('spotify')) {
        alert("Por favor, introduce un enlace válido de Spotify.");
        return;
    }

    document.getElementById('loading-search').style.display = 'block';
    document.getElementById('loading-search').innerText = 'Extrayendo canciones de Spotify... (puede tardar unos segundos)';
    
    const grid = document.getElementById('resultados-busqueda');
    grid.innerHTML = '';

    try {
        const res = await fetch(`${URL_API_LOCAL}/spotify?url=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error("Error en el servidor");
        const canciones = await res.json();

        document.getElementById('loading-search').style.display = 'none';

        canciones.forEach(item => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <img src="${item.portada}" alt="Portada">
                <h3>${item.titulo}</h3>
                <p>${item.artista}</p>
                <button class="btn-descargar" onclick="descargarMagico(event, '${item.titulo.replace(/'/g, "\\'")}', '${item.artista.replace(/'/g, "\\'")}', '${item.portada}')">
                    Descargar
                </button>
            `;
            grid.appendChild(card);
        });
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