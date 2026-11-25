/**
 * "¿Quién eres?" — RF-21 y PA-03.
 *
 * Se guarda **en el dispositivo**, nunca en el servidor, y se puede cambiar cuando se
 * quiera. No es autenticación y la interfaz lo dice con todas las letras: sirve para
 * mostrarte lo tuyo primero y para rellenar "quién registra", no para probar nada (RN-17).
 */

const CLAVE = 'deudas-familiares:identidad';

interface Guardado {
  [tokenCorto: string]: { miembroId: string; nombre: string };
}

/**
 * La identidad se guarda por grupo, indexada por un prefijo del token y no por el token
 * entero: alcanza para distinguir grupos y deja menos secreto en el almacenamiento del
 * navegador.
 */
function clave(token: string): string {
  return token.slice(0, 8);
}

function leerTodo(): Guardado {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? '{}') as Guardado;
  } catch {
    return {};
  }
}

export function leerIdentidad(token: string): { miembroId: string; nombre: string } | null {
  return leerTodo()[clave(token)] ?? null;
}

export function guardarIdentidad(token: string, miembroId: string, nombre: string): void {
  try {
    const todo = leerTodo();
    todo[clave(token)] = { miembroId, nombre };
    localStorage.setItem(CLAVE, JSON.stringify(todo));
  } catch {
    // Navegación privada o almacenamiento lleno: se sigue pudiendo usar la app sin recordar.
  }
}

export function olvidarIdentidad(token: string): void {
  try {
    const todo = leerTodo();
    delete todo[clave(token)];
    localStorage.setItem(CLAVE, JSON.stringify(todo));
  } catch {
    /* nada que hacer */
  }
}
