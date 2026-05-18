import firebaseConfig from './firebase-config.js';

let firestoreDb = null;

// Inicializar Firebase
async function initFirebase() {
    try {
        if (window.firebase && window.firebase.apps.length > 0) {
            firestoreDb = window.firebase.firestore();
            return { db: firestoreDb };
        }
        window.firebase.initializeApp(firebaseConfig);
        firestoreDb = window.firebase.firestore();
        return { db: firestoreDb };
    } catch (error) {
        console.error('Error al inicializar Firebase:', error);
        throw error;
    }
}

// Obtener descripción del producto de la URL
function obtenerIdProducto() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}


// Precarga de imágenes de variantes
// en el cambio de imagen al pasar el mouse o al hacer swipe. Se almacena una referencia en
// window._preloadedVariantImages para evitar duplicados y permitir que el GC libere si es necesario.
function preloadVariantImages(variantes) {
    try {
        if (!variantes || typeof variantes !== 'object') return;
        window._preloadedVariantImages = window._preloadedVariantImages || {};

        Object.values(variantes).forEach((url) => {
            if (typeof url !== 'string' || !url) return;
            if (window._preloadedVariantImages[url]) return;

            const img = new Image();
            // Sugerimos decodificación asíncrona para no bloquear render
            img.decoding = 'async';
            // Indicamos carga ansiosa para priorizar la descarga inmediata
            img.loading = 'eager';
            img.src = url;

            window._preloadedVariantImages[url] = img;
        });
    } catch (e) {
        console.warn('Precarga de variantes: se ignoró un error no crítico', e);
    }
}



// Cargar datos del producto
async function cargarProducto() {
    try {
        const descripcionCorta = decodeURIComponent(obtenerIdProducto());
        
        if (!descripcionCorta) {
            throw new Error('No se proporcionó ID del producto');
        }

        const { db } = await initFirebase();
        
        // Intentar buscar en ambas colecciones
        const colecciones = ['productos-piercing', 'productos'];
        let producto = null;
        let origen = '';

        for (const coleccion of colecciones) {
            const snapshot = await db.collection(coleccion)
                .where('descripcion_corta', '==', descripcionCorta)
                .limit(1)
                .get();

            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                producto = doc.data();
                origen = coleccion;
                break;
            }
        }

        if (!producto) {
            throw new Error('Producto no encontrado');
        }
        // Función para volver al catálogo apropiado

    
    const btnVolver = document.getElementById('btn-volver');
    if (origen === 'productos-piercing') {
        btnVolver.href = 'catalogo-piercing.html';
    } else if (origen === 'productos') {
        btnVolver.href = 'catalogo-tattoo.html';
    } else {
        btnVolver.href = 'index.html';
    }
        cargarProductosRandoms(origen);
        mostrarProducto(producto, origen);

    } catch (error) {
        console.error('Error al cargar el producto:', error);
        alert('No se pudo cargar el producto. Volviendo al catálogo...');
        // Redirigir al catálogo apropiado basado en el referrer
        const referrer = document.referrer;
        if (referrer.includes('catalogo-piercing.html')) {
            window.location.href = 'catalogo-piercing.html';
        } else if (referrer.includes('catalogo-tattoo.html')) {
            window.location.href = 'catalogo-tattoo.html';
        } else {
            window.location.href = 'index.html';
        }
    }
}

// Mostrar datos del producto en la página
function mostrarProducto(producto, origen) {
    // Guardar el producto actual globalmente
    window.productoActual = producto;

    if (producto.variantes && Object.keys(producto.variantes).length > 0) {
        preloadVariantImages(producto.variantes);
    }

    document.title = `${producto.descripcion_corta} - SmaguieTT`;
    
    const imagenProducto = document.getElementById('producto-imagen');
    imagenProducto.src = producto.imagen;
    imagenProducto.alt = producto.descripcion_corta;
    
    document.getElementById('producto-titulo').textContent = producto.descripcion_corta;
    document.getElementById('producto-precio').textContent = producto.precio;
    document.getElementById('producto-descripcion').textContent = producto.descripcion_larga;

    const caracteristicas = document.getElementById('producto-caracteristicas');
    const seccionCaracteristicas = document.querySelector('.producto-detalle__caracteristicas');
    caracteristicas.innerHTML = '';

    if (producto.caracteristicas && producto.caracteristicas.length > 0) {
        producto.caracteristicas.forEach(caracteristica => {
            const li = document.createElement('li');
            li.textContent = caracteristica;
            caracteristicas.appendChild(li);
        });
        seccionCaracteristicas.style.display = 'block';
    } else {
        seccionCaracteristicas.style.display = 'none';
    }

    const variantes = document.getElementById('producto-variantes');
    const seccionVariantes = document.querySelector('.producto-detalle__variantes');
    variantes.innerHTML = '';

    let enlaceBase = producto.enlace || '';
    const imagenPrincipal = document.getElementById('producto-imagen');
    let imagenOriginal = imagenPrincipal.src;
    
    let touchStartX = 0;
    let touchEndX = 0;
    let variantesArray = [];
    
    function handleSwipe() {
        if (!variantesArray.length) return;
        
        const currentActiveIndex = variantesArray.findIndex(li => 
            li.classList.contains('active')
        );
        
        if (Math.abs(touchEndX - touchStartX) < 50) return; 
        
        let nextIndex;
        if (touchEndX < touchStartX) {
            nextIndex = (currentActiveIndex + 1) % variantesArray.length;
        } else {
            nextIndex = (currentActiveIndex - 1 + variantesArray.length) % variantesArray.length;
        }
        
        variantesArray[nextIndex].click();
    }
    
    imagenPrincipal.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, false);
    
    imagenPrincipal.addEventListener('click', () => {
        const varianteActiva = document.querySelector('#producto-variantes li.active');
        if (varianteActiva) {
            varianteActiva.classList.remove('active');
            imagenPrincipal.src = window.productoActual.imagen;
            const btnComprarYa = document.getElementById('comprar-ya');
            if (window.productoActual.enlace) {
                btnComprarYa.href = window.productoActual.enlace;
            }
        }
    });
    
    imagenPrincipal.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, false);
    
    let isMouseDown = false;
    let mouseStartX = 0;
    
    imagenPrincipal.addEventListener('mousedown', (e) => {
        isMouseDown = true;
        mouseStartX = e.clientX;
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isMouseDown) return;
        touchStartX = mouseStartX;
        touchEndX = e.clientX;
    });
    
    document.addEventListener('mouseup', () => {
        if (isMouseDown) {
            isMouseDown = false;
            handleSwipe();
        }
    });

    const btnComprarYa = document.getElementById('comprar-ya');
    let enlaceActual = producto.enlace || '';

    if (producto.enlace) {
        btnComprarYa.style.display = 'block';
    } else {
        btnComprarYa.style.display = 'none';
    }

    btnComprarYa.addEventListener('click', () => {
        window.open(enlaceActual, '_blank');
    });

    if (producto.variantes && Object.keys(producto.variantes).length > 0) {
        let hoverTimeout;
        
        variantesArray = []; // Reiniciar el array de variantes
        Object.entries(producto.variantes).forEach(([nombre, imagenUrl]) => {
            const li = document.createElement('li');
            li.textContent = nombre;
            variantesArray.push(li); // Agregar al array de variantes

            li.addEventListener('mouseenter', () => {
                clearTimeout(hoverTimeout);
                if (imagenUrl && !li.classList.contains('active')) {
                    imagenPrincipal.src = imagenUrl;
                }
            });

            li.addEventListener('mouseleave', () => {
                if (!li.classList.contains('active')) {
                    hoverTimeout = setTimeout(() => {
                        imagenPrincipal.src = imagenOriginal;
                    }, 500);
                }
            });

            li.addEventListener('click', () => {
                const wasActive = li.classList.contains('active');
                variantes.querySelectorAll('li').forEach(item => {
                    item.classList.remove('active');
                });

                if (!wasActive) {
                    li.classList.add('active');
                    if (imagenUrl) {
                        imagenOriginal = imagenUrl;
                        imagenPrincipal.src = imagenUrl;
                    }
                    enlaceActual = enlaceBase + ' ' + nombre;
                } else {
                    imagenPrincipal.src = producto.imagen;
                    imagenOriginal = producto.imagen;
                    enlaceActual = enlaceBase;
                }
            });
            variantes.appendChild(li);
        });
        seccionVariantes.style.display = 'block';
    } else {
        seccionVariantes.style.display = 'none';
    }

    const btnAgregarCarrito = document.getElementById('agregar-carrito');
    btnAgregarCarrito.setAttribute('data-id', producto.id);
    const nuevoBtn = btnAgregarCarrito.cloneNode(true);
    btnAgregarCarrito.parentNode.replaceChild(nuevoBtn, btnAgregarCarrito);
    nuevoBtn.addEventListener('click', () => agregarAlCarrito(producto.id));

    // Ocultar loading y mostrar el contenedor del producto
    document.querySelector('.producto-detalle__loading').classList.add('oculto');
    document.querySelector('.producto-detalle__contenedor').classList.add('activo');

    // Sincronizar contador del botón al cargar el producto (sumando variantes)
    try {
        mostrarContadorEnBoton(producto.id);
    } catch (e) { console.warn('No se pudo actualizar el contador en carga:', e); }
}

// Función para agregar al carrito
// FUNCIONES DEL CARRITO

let carrito = JSON.parse(localStorage.getItem("carrito")) || [];


function agregarAlCarrito(productoOId) {
    // Determinar ID
    const productoId = typeof productoOId === 'string' ? productoOId : productoOId.id;

    const base = typeof productoOId === 'string' ? window.productoActual : productoOId;
    const varianteActiva = document.querySelector('#producto-variantes li.active');
    const variante = varianteActiva ? varianteActiva.textContent.trim() : undefined;

    let targetId = base.id;
    let descripcion = base.descripcion_corta;
    if (variante) {
        const slug = variante.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        targetId = `${base.id}-${slug}`;
        descripcion = `${base.descripcion_corta} - Variante: ${variante}`;
    }

    let productoEnCarrito = carrito.find(item => item.id == targetId);

    if (productoEnCarrito) {
        productoEnCarrito.cantidad += 1;
    } else {
        const item = {
            id: targetId,
            descripcion_corta: descripcion,
            precio: base.precio,
            cantidad: 1
        };
        // Si hay variante, intenta adjuntar imagen específica de la variante
        if (variante && base.variantes && typeof base.variantes === 'object') {
            // Buscar por nombre exacto de variante
            const entrada = Object.entries(base.variantes).find(([nombre]) => nombre === variante);
            if (entrada) {
                const [, variantImg] = entrada;
                if (variantImg) item.imagen = variantImg;
            }
        }
        // Si no hay variante o no se encontró imagen de variante, usar imagen base
        if (!item.imagen && base.imagen) {
            item.imagen = base.imagen;
        }
        carrito.push(item);
    }

    const contenedorCarrito = document.getElementById("carrito-container");
    if (contenedorCarrito) {
        contenedorCarrito.classList.add("carrito-click");
        setTimeout(() => {
            contenedorCarrito.classList.remove("carrito-click");
        }, 300); 
    }

    guardarCarrito();
    actualizarContadorCarrito();
    // Actualizar contador del botón por ID base (sumando todas las variantes)
    const cantidadActual = obtenerCantidadPorIdBase(productoId);
    mostrarContadorEnBoton(productoId, cantidadActual);
}


function guardarCarrito() {
    localStorage.setItem("carrito", JSON.stringify(carrito));
}


function actualizarContadorCarrito() {
    const contador = document.getElementById("contador-carrito");
    let totalProductos = carrito.reduce((acc, producto) => acc + producto.cantidad, 0);
    contador.textContent = totalProductos;
}




// Suma la cantidad total en carrito para un ID base (incluye variantes con sufijo)
function obtenerCantidadPorIdBase(idBase) {
    try {
        const prefijo = `${idBase}-`;
        return carrito.reduce((acc, item) => {
            if (item.id === idBase || (typeof item.id === 'string' && item.id.startsWith(prefijo))) {
                return acc + (item.cantidad || 0);
            }
            return acc;
        }, 0);
    } catch { return 0; }
}

// contador carrito en el botón (por producto base)
function mostrarContadorEnBoton(idProducto, cantidad) {
    const boton = document.querySelector(`#agregar-carrito[data-id="${idProducto}"]`);
    if (!boton) return;

    let contador = boton.querySelector(".contador-circulo");

    if (!contador) {
        contador = document.createElement("div");
        contador.className = "contador-circulo";
        boton.appendChild(contador);
    }

    // Si no se pasó cantidad, calcular por ID base
    const qty = (typeof cantidad === 'number') ? cantidad : obtenerCantidadPorIdBase(idProducto);
    contador.innerHTML = `<span>(${qty})</span>`;
    contador.classList.add("mostrar");

    void contador.offsetWidth;
    contador.querySelector("span").style.animation = "rueda 0.4s ease";
}


// Iniciar la carga del producto cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    cargarProducto();
    actualizarContadorCarrito();
});

const h2otros = document.querySelector('.otros_productos h2');

const opcionesTitulo = [
    'Otros productos:',
    'También te puede interesar:',
    'Mira también:'
];

const indiceAleatorio = Math.floor(Math.random() * opcionesTitulo.length);

h2otros.textContent = opcionesTitulo[indiceAleatorio];

//generar productos randoms del cache 
function generarProductosRandoms(origen) {
    let coleccion = 'productosCache';
    if (origen === 'productos-piercing') {
        coleccion = 'productosCache-piercing';
    }
    const productosCache = JSON.parse(localStorage.getItem(coleccion)) || [];
    const productosRandom = [];
    const maxProductos = Math.min(10, productosCache.length);
    
    if (maxProductos === 0) return [];

    while (productosRandom.length < maxProductos) {
        const indiceAleatorio = Math.floor(Math.random() * productosCache.length);
        const producto = productosCache[indiceAleatorio];
        if (!productosRandom.some(p => p.descripcion_corta === producto.descripcion_corta) && 
            producto.descripcion_corta !== decodeURIComponent(obtenerIdProducto())) {
            productosRandom.push(producto);
        }
        
        if (productosRandom.length === productosCache.length - 1) break;
    }
    
    
    return productosRandom;
}

//cargar los productos randoms
function cargarProductosRandoms(origen) {
    const productosRandom = generarProductosRandoms(origen);
    const contenedor = document.querySelector('.otros_productos .productos');
    contenedor.innerHTML = '';
    
    productosRandom.forEach(producto => {
        const tieneDescuento = producto.descuento && producto.descuento > 0;
        
        const article = document.createElement('article');
        article.className = 'producto';
        article.setAttribute('data-id', producto.descripcion_corta);
        
        article.innerHTML = `
            <div class="producto__imagen-contenedor producto-link" data-id="${producto.descripcion_corta}">
                ${tieneDescuento ? `<span class="producto__descuento">-${producto.descuento}%</span>` : ""}
                <img class="producto__imagen" src="${producto.imagen}" title="${producto.descripcion_corta}" alt="${producto.descripcion_corta}" loading="lazy">
            </div>
            <div class="producto__info">
                <p class="producto__precio producto-link" data-id="${producto.descripcion_corta}">
                    ${tieneDescuento 
                        ? `<span class="precio-original" style="text-decoration: line-through; color: #999; ">${producto.precio}</span> <br>
                           <span class="precio-descuento" style="color: #3ce746; font-weight: bold;">${calcularPrecioDescuento(producto.precio, producto.descuento)}</span>`
                        : producto.precio
                    }
                </p>
                <p class="producto__descripcion corta">
                    <span class="texto-descripcion producto-link" data-id="${producto.descripcion_corta}">${producto.descripcion_corta}</span>
                </p>
                <button class="ver-mas-producto producto-link" data-id="${producto.descripcion_corta}">Ver más</button>
            </div>
        `;
        
        contenedor.appendChild(article);
    });
    
    // Agregar event listeners para los links
    contenedor.querySelectorAll('.producto-link').forEach(el => {
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => {
            const descripcion = el.dataset.id;
            window.location.href = `producto.html?id=${encodeURIComponent(descripcion)}`;
        });
    });
}

// Función auxiliar para calcular precio con descuento
function calcularPrecioDescuento(precioOriginal, descuento) {
    const valorNumerico = parseFloat(precioOriginal.replace(/[^0-9]/g, ''));
    const precioConDescuento = valorNumerico - (valorNumerico * descuento / 100);
    const formatter = new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
    return formatter.format(precioConDescuento).replace('CLP', '').trim();
}

