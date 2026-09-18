import { useState, useEffect, useMemo, useRef } from "react";
import {
  Home, CheckSquare, Wallet, Dumbbell, Target, Heart, Calendar as CalendarIcon,
  Plus, Trash2, X, ChevronLeft, ChevronRight, Check, Loader2, ArrowUpRight,
  Zap, Footprints, Flame, Mountain, Bike, Snowflake, PersonStanding, Waves, ChevronDown, ChevronUp,
  Plane, MapPin, Star, Globe, Utensils, Eye, EyeOff, BookOpen, ShoppingCart, Copy, Moon, Sun, Luggage, ClipboardList, Receipt, Repeat, GripVertical,
  Stethoscope, FolderKanban, Sparkles, Briefcase, Pencil, Sunrise, CloudSun, Pill, Droplet, ListChecks,
  Shield, Upload, Download, Save, Percent, Info, MoreVertical, Settings
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ---------- helpers ----------
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
// Convierte un objeto Date a "YYYY-MM-DD" usando SIEMPRE la fecha local (nunca UTC), para que
// nunca se desplace un día según la hora o el huso horario del usuario.
const dateToStr = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const todayStr = () => dateToStr(new Date());
const fmtEUR = (n) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) => {
  if (!d) return "";
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
};
const fmtDateShort = (d) => {
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
};
const fmtBackupTime = (isoTs) => {
  const date = new Date(isoTs);
  return date.toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};
const USER_NAME = "Ruben";
const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return `Buenos días, ${USER_NAME}`;
  if (h < 20) return `Buenas tardes, ${USER_NAME}`;
  return `Buenas noches, ${USER_NAME}`;
};
const MOTIVATIONAL_QUOTES = [
  "Un lunes más para construir la semana que quieres tener.",
  "Poco a poco también es avanzar. Sigue así.",
  "A mitad de semana ya has recorrido más de lo que crees.",
  "Lo constante gana a lo intenso. Hoy toca ser constante.",
  "Viernes: cierra la semana con la misma energía que la empezaste.",
  "El fin de semana también cuenta para cuidarte.",
  "Domingo para mirar atrás con calma y coger impulso.",
];
const motivationalQuote = () => MOTIVATIONAL_QUOTES[(new Date().getDay() + 6) % 7];

async function loadKey(key, fallback) {
  try {
    const r = await window.storage.get(key);
    return r && r.value ? JSON.parse(r.value) : fallback;
  } catch (e) {
    return fallback;
  }
}
async function saveKey(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), false);
  } catch (e) {
    console.error("Error guardando " + key, e);
  }
}
// Guardado a prueba de pestañas duplicadas/desincronizadas: antes de escribir, relee lo que
// haya AHORA MISMO en el servidor y fusiona por id (une lo remoto con lo local en vez de
// sobrescribir sin más). Así, aunque una pestaña vieja intente guardar una foto antigua, no
// puede borrar elementos nuevos creados en otra pestaña — como mucho, un borrado reciente podría
// no quedar fijado si coincide justo con la escritura de una pestaña vieja, pero nunca se pierde
// algo creado. Devuelve el array final ya fusionado.
async function safeMergeSave(key, localArray, removedIds) {
  try {
    const remoteRes = await window.storage.get(key);
    const remoteArray = remoteRes && remoteRes.value ? JSON.parse(remoteRes.value) : [];
    const map = new Map();
    (Array.isArray(remoteArray) ? remoteArray : []).forEach((item) => item && item.id && map.set(item.id, item));
    (Array.isArray(localArray) ? localArray : []).forEach((item) => item && item.id && map.set(item.id, item));
    if (removedIds && removedIds.length) removedIds.forEach((id) => map.delete(id));
    const merged = [...map.values()];
    await window.storage.set(key, JSON.stringify(merged), false);
    return merged;
  } catch (e) {
    console.error("Error en guardado seguro de " + key, e);
    await saveKey(key, localArray);
    return localArray;
  }
}

// ---------- copias de seguridad ----------
const BACKUP_DATA_KEYS = ["tasks", "calendar-events", "savings", "gym", "goals", "hobbies", "travel", "nutrition", "pantry", "expenses", "routine"];
const MAX_BACKUPS = 5;
async function saveAutoBackup(snapshot, label) {
  let index = [];
  try {
    const idxRes = await window.storage.get("backups-index");
    index = idxRes && idxRes.value ? JSON.parse(idxRes.value) : [];
  } catch (e) {
    index = []; // todavía no existía ninguna copia — empezamos de cero, no es un fallo real
  }
  try {
    const id = uid();
    index.unshift({ id, ts: new Date().toISOString(), label: label || "Automática" });
    const toRemove = index.slice(MAX_BACKUPS);
    index = index.slice(0, MAX_BACKUPS);
    await window.storage.set(`backup-data:${id}`, JSON.stringify(snapshot), false);
    await window.storage.set("backups-index", JSON.stringify(index), false);
    for (const old of toRemove) {
      try { await window.storage.delete(`backup-data:${old.id}`); } catch (e) { /* noop */ }
    }
    return index;
  } catch (e) {
    console.error("Error creando copia de seguridad", e);
    return null;
  }
}
async function loadBackupIndex() {
  try {
    const idxRes = await window.storage.get("backups-index");
    return idxRes && idxRes.value ? JSON.parse(idxRes.value) : [];
  } catch (e) {
    return [];
  }
}
async function loadBackupData(id) {
  try {
    const res = await window.storage.get(`backup-data:${id}`);
    return res && res.value ? JSON.parse(res.value) : null;
  } catch (e) {
    return null;
  }
}


// ---------- catálogo de entrenamiento ----------
const WORKOUT_LIBRARY = {
  push: {
    name: "Push", icon: Dumbbell, gradient: "linear-gradient(135deg,#F2762E,#FDB876)",
    exercises: [
      "Press banca", "Press banca con mancuernas", "Press inclinado con mancuernas", "Press inclinado con barra", "Press declinado con barra",
      "Press militar con mancuernas", "Press militar con barra", "Press Arnold", "Press de hombros en polea",
      "Fondos en paralelas", "Flexiones de brazos", "Elevaciones laterales", "Elevaciones frontales con mancuernas", "Aperturas con mancuernas",
      "Cruce de poleas (crossover)", "Extensión de tríceps en polea", "Push down de tríceps en polea", "Patada de tríceps en polea", "Press francés",
      "Press de pecho en máquina", "Press inclinado en máquina", "Press banca en multipower (Smith)", "Press de hombro en máquina",
      "Máquina de aperturas (Pec Deck)", "Elevaciones laterales en máquina", "Máquina de tríceps", "Fondos en máquina asistida",
    ],
  },
  pull: {
    name: "Pull", icon: Dumbbell, gradient: "linear-gradient(135deg,#E0592A,#F4956B)",
    exercises: [
      "Dominadas", "Dominadas supinas", "Remo con barra", "Remo con mancuerna", "Remo T", "Remo invertido",
      "Jalón al pecho", "Jalón tras nuca", "Remo en polea baja", "Pull-through en polea",
      "Curl de bíceps con barra", "Curl con mancuernas", "Curl de bíceps en polea baja", "Curl araña",
      "Face pull", "Encogimientos de hombros (Shrugs)", "Peso muerto", "Peso muerto rumano",
      "Dominadas asistidas en máquina", "Remo en máquina", "Remo en máquina Hammer", "Jalón al pecho en máquina",
      "Remo horizontal en máquina", "Curl de bíceps en máquina", "Pull-over en máquina", "Máquina de espalda alta (Reverse fly)",
    ],
  },
  brazos: {
    name: "Brazos", icon: Zap, gradient: "linear-gradient(135deg,#F59E0B,#FCD34D)",
    exercises: [
      "Curl de bíceps con mancuernas", "Curl martillo", "Curl en polea", "Curl 21s", "Curl inverso", "Curl Zottman", "Curl de muñeca",
      "Press francés", "Press francés en polea", "Extensión de tríceps con cuerda", "Extensión de tríceps sobre la cabeza", "Kickback de tríceps",
      "Fondos entre bancos", "Curl concentrado", "Press cerrado en banca",
      "Curl de bíceps en máquina", "Curl predicador en máquina", "Extensión de tríceps en máquina", "Press de tríceps en máquina",
      "Máquina de fondos asistidos", "Máquina de antebrazo", "Push down de tríceps en polea",
      "Press militar con mancuernas", "Press militar con barra", "Press Arnold", "Elevaciones laterales", "Elevaciones frontales con mancuernas",
      "Elevaciones posteriores (pájaros)", "Face pull", "Remo al mentón", "Press de hombro en máquina", "Elevaciones laterales en máquina",
      "Máquina de espalda alta (Reverse fly)",
    ],
  },
  piernas: {
    name: "Piernas", icon: Footprints, gradient: "linear-gradient(135deg,#EA580C,#FCA56A)",
    exercises: [
      "Sentadilla", "Sentadilla búlgara", "Sentadilla frontal", "Sentadilla goblet", "Peso muerto sumo",
      "Prensa de piernas", "Prensa horizontal", "Zancadas", "Zancadas caminando", "Step up",
      "Peso muerto rumano", "Curl femoral", "Extensión de cuádriceps", "Elevación de talones", "Hip thrust", "Puente de glúteo",
      "Abducción de cadera en polea",
      "Sentadilla en máquina Smith", "Hack squat", "Curl femoral en máquina (tumbado)", "Extensión de cuádriceps en máquina",
      "Máquina de aductores", "Máquina de abductores", "Gemelos en máquina (de pie)", "Gemelos en máquina sentado", "Máquina de hip thrust",
    ],
  },
  fullbody: {
    name: "Full Body", icon: Flame, gradient: "linear-gradient(135deg,#DC2626,#F87171)",
    exercises: [
      "Peso muerto", "Sentadilla con salto", "Sentadilla con press", "Burpees", "Press banca", "Remo con mancuerna",
      "Kettlebell swing", "Thruster", "Clean and press", "Turkish get-up", "Man makers", "Wall ball",
      "Battle rope", "Farmer's walk", "Snatch con mancuerna", "Box jump",
      "Circuito prensa + press en máquina", "Remo en máquina", "Press de pecho en máquina", "Jalón al pecho en máquina",
      "Sentadilla en máquina Smith", "Máquina de remo (Row machine)",
    ],
  },
};
const CARDIO_LIBRARY = {
  hiking: { name: "Hiking", icon: Mountain, gradient: "linear-gradient(135deg,#0EA5A4,#5EEAD4)" },
  paseo: { name: "Paseo", icon: PersonStanding, gradient: "linear-gradient(135deg,#0284C7,#7DD3FC)" },
  bicicleta: { name: "Bicicleta", icon: Bike, gradient: "linear-gradient(135deg,#2563EB,#93C5FD)" },
  running: { name: "Running", icon: Zap, gradient: "linear-gradient(135deg,#0891B2,#67E8F9)" },
  snowboard: { name: "Snowboard", icon: Snowflake, gradient: "linear-gradient(135deg,#4338CA,#A5B4FC)" },
  skate: { name: "Skate", icon: Waves, gradient: "linear-gradient(135deg,#7C3AED,#C4B5FD)" },
};
const ALL_TYPES = {
  ...Object.fromEntries(Object.entries(WORKOUT_LIBRARY).map(([id, v]) => [id, { ...v, id, kind: "fuerza" }])),
  ...Object.fromEntries(Object.entries(CARDIO_LIBRARY).map(([id, v]) => [id, { ...v, id, kind: "cardio" }])),
};
function guessTypeIdFromName(name) {
  if (!name) return null;
  const entry = Object.entries(ALL_TYPES).find(([, def]) => def.name.toLowerCase() === name.trim().toLowerCase());
  return entry ? entry[0] : null;
}
function getWeekRange(d) {
  const day = (d.getDay() + 6) % 7;
  const start = new Date(d); start.setDate(d.getDate() - day); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
  return { start, end };
}
function isInRange(dateStr, range) {
  const d = new Date(dateStr + "T12:00:00");
  return d >= range.start && d <= range.end;
}
function countByType(list) {
  const map = {};
  list.forEach((s) => { map[s.typeId] = (map[s.typeId] || 0) + 1; });
  return map;
}
function sessionSummary(session) {
  if (session.kind === "fuerza") {
    return session.exercises.map((e) => `${e.name}: ${e.sets.map((s) => `${s.weight || 0}kg×${s.reps || 0}`).join(", ")}`).join("\n");
  }
  return `${session.duration} min${session.distance ? ` · ${session.distance} km` : ""}${session.note ? ` · ${session.note}` : ""}`;
}
// Reconstruye los ejercicios/series de una sesión a partir del texto generado por sessionSummary.
function parseFuerzaDescription(desc) {
  if (!desc) return null;
  const lines = desc.split("\n").map((l) => l.trim()).filter(Boolean);
  const exercises = lines.map((line) => {
    const idx = line.search(/[:\-–]/);
    const name = (idx === -1 ? line : line.slice(0, idx)).trim();
    const setsStr = idx === -1 ? line : line.slice(idx + 1);
    const sets = [...setsStr.matchAll(/(\d+(?:[.,]\d+)?)\s*kg?\s*[x×]\s*(\d+)/gi)]
      .map((m) => ({ id: uid(), weight: Number(m[1].replace(",", ".")), reps: Number(m[2]) }));
    return sets.length ? { id: uid(), name: name || "Ejercicio", sets } : null;
  }).filter(Boolean);
  return exercises.length ? exercises : null;
}
function parseCardioDescription(desc) {
  if (!desc) return null;
  const durMatch = desc.match(/(\d+)\s*min/);
  if (!durMatch) return null;
  const distMatch = desc.match(/([\d.]+)\s*km/);
  const noteMatch = desc.match(/km\s*·\s*(.+)$/) || desc.match(/min\s*·\s*(.+)$/);
  return { duration: Number(durMatch[1]), distance: distMatch ? Number(distMatch[1]) : 0, note: noteMatch ? noteMatch[1].trim() : "" };
}
function buildGymLinks(sessionId, typeId, date, description) {
  const def = ALL_TYPES[typeId];
  const isPast = date < todayStr();
  const event = { id: uid(), date, title: def.name, time: "", note: "", workoutTypeId: typeId, done: isPast, sessionId, description };
  const task = { id: uid(), text: def.name, date, done: isPast, category: "deporte", workoutTypeId: typeId, sessionId, description };
  return { event, task };
}

// ---------- catálogo de viajes ----------
const CONTINENTS = ["Europa", "África", "Asia", "Oceanía", "América del Norte", "América del Sur"];
const COUNTRIES = [
  { id: "es", name: "España", continent: "Europa", lat: 40, lon: -4 },
  { id: "fr", name: "Francia", continent: "Europa", lat: 46, lon: 2 },
  { id: "it", name: "Italia", continent: "Europa", lat: 43, lon: 12 },
  { id: "ch", name: "Suiza", continent: "Europa", lat: 47, lon: 8 },
  { id: "gb", name: "Inglaterra", continent: "Europa", lat: 54, lon: -2 },
  { id: "pt", name: "Portugal", continent: "Europa", lat: 39, lon: -8 },
  { id: "de", name: "Alemania", continent: "Europa", lat: 51, lon: 10 },
  { id: "be", name: "Bélgica", continent: "Europa", lat: 50, lon: 4 },
  { id: "at", name: "Austria", continent: "Europa", lat: 47, lon: 14 },
  { id: "gr", name: "Grecia", continent: "Europa", lat: 39, lon: 22 },
  { id: "ie", name: "Irlanda", continent: "Europa", lat: 53, lon: -8 },
  { id: "no", name: "Noruega", continent: "Europa", lat: 61, lon: 9 },
  { id: "se", name: "Suecia", continent: "Europa", lat: 62, lon: 15 },
  { id: "dk", name: "Dinamarca", continent: "Europa", lat: 56, lon: 10 },
  { id: "pl", name: "Polonia", continent: "Europa", lat: 52, lon: 20 },
  { id: "hr", name: "Croacia", continent: "Europa", lat: 45, lon: 16 },
  { id: "nl", name: "Holanda", continent: "Europa", lat: 52, lon: 5 },
  { id: "ru", name: "Rusia", continent: "Europa", lat: 55, lon: 37 },
  { id: "tn", name: "Túnez", continent: "África", lat: 34, lon: 9 },
  { id: "ma", name: "Marruecos", continent: "África", lat: 32, lon: -5 },
  { id: "eg", name: "Egipto", continent: "África", lat: 26, lon: 30 },
  { id: "za", name: "Sudáfrica", continent: "África", lat: -29, lon: 24 },
  { id: "ke", name: "Kenia", continent: "África", lat: 1, lon: 38 },
  { id: "sn", name: "Senegal", continent: "África", lat: 14, lon: -14 },
  { id: "ng", name: "Nigeria", continent: "África", lat: 9, lon: 8 },
  { id: "id", name: "Indonesia", continent: "Asia", lat: -2, lon: 118 },
  { id: "ph", name: "Filipinas", continent: "Asia", lat: 13, lon: 122 },
  { id: "th", name: "Tailandia", continent: "Asia", lat: 15, lon: 101 },
  { id: "cn", name: "China", continent: "Asia", lat: 35, lon: 105 },
  { id: "jp", name: "Japón", continent: "Asia", lat: 36, lon: 138 },
  { id: "kr", name: "Corea del Sur", continent: "Asia", lat: 36, lon: 128 },
  { id: "in", name: "India", continent: "Asia", lat: 21, lon: 78 },
  { id: "vn", name: "Vietnam", continent: "Asia", lat: 16, lon: 106 },
  { id: "kh", name: "Camboya", continent: "Asia", lat: 13, lon: 105 },
  { id: "my", name: "Malasia", continent: "Asia", lat: 4, lon: 102 },
  { id: "sg", name: "Singapur", continent: "Asia", lat: 1, lon: 104 },
  { id: "np", name: "Nepal", continent: "Asia", lat: 28, lon: 84 },
  { id: "ae", name: "Emiratos Árabes Unidos", continent: "Asia", lat: 24, lon: 54 },
  { id: "il", name: "Israel", continent: "Asia", lat: 31, lon: 35 },
  { id: "jo", name: "Jordania", continent: "Asia", lat: 31, lon: 36 },
  { id: "tr", name: "Turquía", continent: "Asia", lat: 39, lon: 35 },
  { id: "au", name: "Australia", continent: "Oceanía", lat: -25, lon: 133 },
  { id: "nz", name: "Nueva Zelanda", continent: "Oceanía", lat: -41, lon: 174 },
  { id: "us", name: "Estados Unidos", continent: "América del Norte", lat: 39, lon: -98 },
  { id: "ca", name: "Canadá", continent: "América del Norte", lat: 56, lon: -106 },
  { id: "mx", name: "México", continent: "América del Norte", lat: 23, lon: -102 },
  { id: "cu", name: "Cuba", continent: "América del Norte", lat: 22, lon: -80 },
  { id: "cr", name: "Costa Rica", continent: "América del Norte", lat: 10, lon: -84 },
  { id: "pe", name: "Perú", continent: "América del Sur", lat: -10, lon: -76 },
  { id: "ar", name: "Argentina", continent: "América del Sur", lat: -34, lon: -64 },
  { id: "br", name: "Brasil", continent: "América del Sur", lat: -10, lon: -55 },
  { id: "co", name: "Colombia", continent: "América del Sur", lat: 4, lon: -72 },
  { id: "ec", name: "Ecuador", continent: "América del Sur", lat: -1, lon: -78 },
  { id: "uy", name: "Uruguay", continent: "América del Sur", lat: -33, lon: -56 },
  { id: "py", name: "Paraguay", continent: "América del Sur", lat: -23, lon: -58 },
  { id: "cl", name: "Chile", continent: "América del Sur", lat: -30, lon: -71 },
  { id: "bo", name: "Bolivia", continent: "América del Sur", lat: -17, lon: -65 },
];
const COUNTRY_BY_ID = Object.fromEntries(COUNTRIES.map((c) => [c.id, c]));
const DEFAULT_VISITED_IDS = ["es", "fr", "it", "ch", "gb", "tn", "ma", "id", "ph", "th", "cn", "cl", "bo", "nl", "tr"];
const TOTAL_WORLD_COUNTRIES = 195;
function flagEmoji(code) {
  return code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}
function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
function fmtFlightTime(km) {
  const hours = km / 850 + 0.5; // velocidad crucero media + margen de despegue/aterrizaje
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

// ---------- catálogo de nutrición ----------
const WEEK_DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const MEAL_SLOTS = [
  { id: "almuerzo", label: "Almuerzo" },
  { id: "comida", label: "Comida" },
  { id: "merienda", label: "Merienda" },
  { id: "cena", label: "Cena" },
];
const MEAL_CATALOG = [
  { id: "tostada-aguacate", name: "Tostada con aguacate", time: "10 min", ingredients: ["Pan", "Aguacate", "Sal", "Limón", "Aceite de oliva"] },
  { id: "yogur-fruta", name: "Yogur con fruta y granola", time: "5 min", ingredients: ["Yogur natural", "Fruta variada", "Granola", "Miel"] },
  { id: "bocadillo-jamon", name: "Bocadillo de jamón", time: "5 min", ingredients: ["Pan", "Jamón serrano", "Tomate", "Aceite de oliva"] },
  { id: "tortilla-patatas", name: "Tortilla de patatas", time: "40 min", ingredients: ["Patatas", "Huevos", "Cebolla", "Aceite", "Sal"] },
  { id: "pasta-bolonesa", name: "Pasta boloñesa", time: "30 min", ingredients: ["Pasta", "Carne picada", "Tomate triturado", "Cebolla", "Ajo"] },
  { id: "pollo-horno", name: "Pollo al horno con patatas", time: "45 min", ingredients: ["Pechuga de pollo", "Patatas", "Pimiento", "Calabacín", "Aceite"] },
  { id: "salmon-pure", name: "Salmón con puré de patata", time: "30 min", ingredients: ["Salmón", "Patatas", "Mantequilla", "Leche", "Eneldo"] },
  { id: "lentejas", name: "Lentejas estofadas", time: "45 min", ingredients: ["Lentejas", "Zanahoria", "Patata", "Chorizo", "Cebolla"] },
  { id: "arroz-pollo", name: "Arroz con pollo", time: "35 min", ingredients: ["Arroz", "Pollo", "Pimiento", "Guisantes", "Caldo"] },
  { id: "pizza-casera", name: "Pizza casera", time: "25 min", ingredients: ["Masa de pizza", "Tomate", "Mozzarella", "Orégano", "Ingredientes al gusto"] },
  { id: "tacos-carne", name: "Tacos de carne", time: "20 min", ingredients: ["Tortillas", "Carne picada", "Cebolla", "Cilantro", "Lima"] },
  { id: "sopa-verduras", name: "Sopa de verduras", time: "30 min", ingredients: ["Verduras variadas", "Caldo", "Sal", "Aceite"] },
  { id: "hamburguesa", name: "Hamburguesa casera", time: "20 min", ingredients: ["Pan de hamburguesa", "Carne picada", "Queso", "Lechuga", "Tomate"] },
  { id: "pescado-plancha", name: "Pescado a la plancha con patatas", time: "25 min", ingredients: ["Pescado blanco", "Patatas", "Limón", "Perejil", "Aceite de oliva"] },
  { id: "revuelto-champis", name: "Revuelto de champiñones", time: "10 min", ingredients: ["Huevos", "Champiñones", "Ajo", "Perejil", "Aceite"] },
  { id: "fruta-variada", name: "Fruta variada", time: "2 min", ingredients: ["Pieza de fruta al gusto"] },
  { id: "batido-proteinas", name: "Batido de proteínas", time: "5 min", ingredients: ["Leche o bebida vegetal", "Proteína en polvo", "Fruta"] },
  { id: "wok-tofu", name: "Wok de verduras y tofu", time: "20 min", ingredients: ["Tofu", "Brócoli", "Zanahoria", "Salsa de soja", "Jengibre"] },
  { id: "boniato-horno", name: "Boniato al horno con especias", time: "35 min", ingredients: ["Boniato", "Aceite de oliva", "Pimentón dulce", "Comino", "Sal"] },
  { id: "pure-boniato", name: "Puré de boniato", time: "25 min", ingredients: ["Boniato", "Leche o bebida vegetal", "Mantequilla", "Sal", "Nuez moscada"] },
  { id: "patatas-bravas", name: "Patatas bravas caseras", time: "30 min", ingredients: ["Patatas", "Tomate frito", "Pimentón picante", "Mayonesa 0%", "Ajo"] },
  { id: "boniato-relleno", name: "Boniato relleno de pollo y queso", time: "40 min", ingredients: ["Boniato", "Pollo", "Queso rallado", "Pimiento", "Comino"] },
];
const MEAL_BY_ID = Object.fromEntries(MEAL_CATALOG.map((m) => [m.id, m]));
const BASIC_INGREDIENTS = [
  "Sal", "Pimienta negra", "Aceite de oliva", "Vinagre", "Ketchup 0%", "Mayonesa 0%", "Mostaza",
  "Salsa de soja", "Orégano", "Pimentón dulce", "Comino", "Canela", "Azúcar", "Harina", "Pan rallado", "Caldo de verduras",
];

// ---------- catálogo de la maleta ----------
const PACKING_LIST = {
  "Ropa": ["Ropa interior", "Calcetines", "Camisetas", "Pantalones", "Vaqueros", "Chaqueta ligera", "Bañador", "Pijama", "Calzado cómodo", "Chanclas"],
  "Aseo": ["Cepillo de dientes", "Pasta de dientes", "Champú", "Gel de ducha", "Desodorante", "Crema hidratante", "Protector solar", "Maquinilla de afeitar", "Ibuprofeno", "Repelente de mosquitos"],
  "Equipaje de mano": ["Pasaporte / DNI", "Billetes / tarjetas de embarque", "Cartera", "Tarjetas y efectivo", "Móvil y cargador", "Auriculares", "Powerbank", "Llaves de casa", "Gafas de sol", "Seguro de viaje"],
};

// ---------- catálogo de gastos ----------
const EXPENSE_CATEGORIES = ["Vivienda", "Suministros", "Suscripciones", "Seguros", "Transporte", "Compras", "Comida", "Ocio", "Restaurantes", "Belleza", "Cosmética y suplementos", "Otros"];
const INCOME_CATEGORIES = ["Nómina", "Freelance", "Inversiones", "Alquiler cobrado", "Regalo", "Otros"];
// Propuesta orientativa de reparto del presupuesto (% de tus ingresos), editable por el usuario.
// ---------- catálogo de horóscopo (por probar) ----------
const ZODIAC_SIGNS = [
  { id: "aries", name: "Aries", emoji: "♈" },
  { id: "tauro", name: "Tauro", emoji: "♉" },
  { id: "geminis", name: "Géminis", emoji: "♊" },
  { id: "cancer", name: "Cáncer", emoji: "♋" },
  { id: "leo", name: "Leo", emoji: "♌" },
  { id: "virgo", name: "Virgo", emoji: "♍" },
  { id: "libra", name: "Libra", emoji: "♎" },
  { id: "escorpio", name: "Escorpio", emoji: "♏" },
  { id: "sagitario", name: "Sagitario", emoji: "♐" },
  { id: "capricornio", name: "Capricornio", emoji: "♑" },
  { id: "acuario", name: "Acuario", emoji: "♒" },
  { id: "piscis", name: "Piscis", emoji: "♓" },
];
const HOROSCOPE_PHRASES = {
  general: [
    "Hoy es un buen día para simplificar en vez de sumar más cosas.",
    "Algo que llevas posponiendo se resolverá solo si le dedicas 10 minutos.",
    "Confía más en lo que ya sabes hacer bien.",
    "El orden externo hoy te va a despejar la cabeza.",
    "Una conversación pendiente puede esperar un día más sin problema.",
    "Hoy rinde más la constancia que la intensidad.",
    "Vas a tener más energía de la que esperas por la tarde.",
    "Es un buen momento para decir que no a algo que no te aporta.",
    "Lo que hoy parece un contratiempo, mañana será anécdota.",
    "Escucha más de lo que hablas hoy — hay algo que se te puede escapar.",
    "Hoy conviene soltar el control de algo que no depende de ti.",
    "Una idea que te ronda la cabeza merece salir del cajón hoy.",
    "El plan más sencillo es probablemente el que mejor te va a salir.",
    "Hoy es buen día para cerrar algo a medias, aunque no sea perfecto.",
    "Cuidado con comprometerte a más de lo que puedes sostener hoy.",
    "Una pequeña señal de hoy merece más atención de la que le das.",
    "Hoy te sienta bien salir de la rutina, aunque sea un rato.",
    "Lo urgente de hoy puede esperar más de lo que crees.",
    "Confía en tu primera impresión sobre algo que decidas hoy.",
    "Hoy es un buen momento para pedir lo que necesitas, sin rodeos.",
  ],
  amor: [
    "En lo sentimental, hoy toca escuchar más que hablar.",
    "Un gesto pequeño hoy vale más que una gran declaración.",
    "Buen día para reconectar con alguien que tenías un poco olvidado.",
    "Evita las decisiones importantes del corazón antes de comer.",
    "Hoy te sienta bien mostrarte tal cual eres, sin filtros.",
    "Una conversación pendiente en pareja hoy puede aclarar más de lo que esperas.",
    "Hoy el silencio dice más que cualquier palabra que fuerces.",
    "Buen día para proponer un plan en vez de esperar a que surja solo.",
    "Cuidado con interpretar de más algo que hoy dice alguien.",
    "Hoy te conviene más dar espacio que insistir.",
    "Un detalle inesperado hoy cae mejor que uno planeado.",
    "Hoy es buen momento para perdonar algo pequeño y seguir adelante.",
  ],
  trabajo: [
    "En lo profesional, hoy es mejor terminar una cosa que empezar tres.",
    "Una idea que descartaste hace tiempo podría merecer una segunda mirada.",
    "Hoy conviene pedir ayuda en vez de cargarlo todo tú solo.",
    "Buen día para poner por escrito algo que solo tienes en la cabeza.",
    "La paciencia de hoy es la que evita el error de mañana.",
    "Hoy rinde más ordenar lo que ya tienes que empezar algo nuevo.",
    "Una reunión de hoy puede dar más de sí si vas con una pregunta clara.",
    "Buen día para delegar algo que llevas cargando solo demasiado tiempo.",
    "Hoy conviene revisar los números antes de dar algo por cerrado.",
    "Una crítica de hoy, aunque incómoda, te va a servir más de lo que crees.",
    "Hoy es buen día para proponer esa idea que llevas guardando.",
    "No fuerces hoy una decisión que puede esperar a mañana con más información.",
  ],
  salud: [
    "El cuerpo te va a pedir moverte más de lo habitual — hazle caso.",
    "Hoy es buen día para dormir un poco antes de lo normal.",
    "Cuida la hidratación, más de lo que crees que necesitas.",
    "Un rato al aire libre hoy te sienta mejor que cualquier otra cosa.",
    "Hoy el cuerpo pide algo de calma, no de más exigencia.",
    "Evita hoy saltarte una comida por las prisas.",
    "Un estiramiento de cinco minutos hoy te cambia el resto del día.",
    "Hoy conviene bajar el ritmo si notas más cansancio de lo normal.",
    "Buen día para dejar el móvil un rato antes de dormir.",
    "Hoy el cuerpo agradece algo dulce menos y algo de agua más.",
    "Una caminata corta hoy vale más que quedarte dándole vueltas a la cabeza.",
    "Hoy toca escuchar al cuerpo antes de que se queje él solo.",
  ],
};
function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function dailyPhrase(category, signId, salt) {
  const pool = HOROSCOPE_PHRASES[category];
  const seed = hashStr(`${signId}-${todayStr()}-${salt}`);
  return pool[seed % pool.length];
}

const DEFAULT_BUDGET_PCT = {
  "Vivienda": 25, "Suministros": 5, "Suscripciones": 3, "Seguros": 5, "Transporte": 8,
  "Compras": 5, "Comida": 12, "Ocio": 4, "Restaurantes": 4, "Belleza": 2, "Cosmética y suplementos": 3, "Ahorro": 20, "Otros": 3,
};
const BUDGET_CAT_INFO = {
  "Vivienda": "Alquiler o hipoteca. Suele ser la partida más grande, ~25% de tus ingresos es un objetivo razonable.",
  "Suministros": "Luz, agua, gas, internet, móvil. Gastos casi fijos, ~5%.",
  "Suscripciones": "Streaming, apps, gimnasio online, etc. Fácil de recortar si otras categorías se disparan, ~3%.",
  "Seguros": "Seguro médico, hogar, vida. ~5%.",
  "Transporte": "Transporte público, gasolina, mantenimiento del coche, ~8%.",
  "Compras": "Compras no alimentarias: ropa, tecnología, hogar, ~5%.",
  "Comida": "La compra de alimentación del día a día — una de las partidas más importantes, ~12%.",
  "Ocio": "Planes, actividades, hobbies con coste, ~4%.",
  "Restaurantes": "Comer o cenar fuera, ~4%.",
  "Belleza": "Peluquería, estética y cuidado personal en general, ~2%.",
  "Cosmética y suplementos": "Cremas, protector solar, creatina, vitaminas y demás cuidado facial, corporal y suplementación, ~3%.",
  "Otros": "Imprevistos y lo que no encaja en ninguna otra categoría, ~3%.",
  "Ahorro": "Lo ideal es apartar esto antes de gastar el resto — trátalo como una \"factura\" más, no como lo que sobra a fin de mes. ~20%.",
};
const BUDGET_CAT_COLORS = {
  "Vivienda": "var(--acc-work)", "Suministros": "var(--acc-day)", "Suscripciones": "var(--acc-travel)",
  "Seguros": "var(--acc-health)", "Transporte": "var(--acc-hobbies)", "Compras": "var(--acc-nutrition)",
  "Comida": "var(--acc-gym)", "Ocio": "var(--acc-aesthetic)", "Restaurantes": "var(--acc-projects)", "Ahorro": "var(--acc-savings)",
  "Belleza": "var(--acc-cardio)", "Cosmética y suplementos": "var(--acc-routine)",
  "Otros": "var(--ink-soft)",
};

// ---------- catálogo de rutina diaria ----------
const ROUTINE_SECTIONS = [
  {
    id: "manana", label: "Mañana", icon: Sunrise, accent: "var(--acc-goals)", soft: "var(--acc-goals-soft)",
    items: [
      {
        id: "movilidad", name: "Movilidad articular y estiramientos", type: "Ejercicio", freq: "Diario",
        details: [
          {
            id: "klapp",
            name: "Gimnasia de Klapp — 20 repeticiones",
            explanation: "Gateo terapéutico apoyando manos y rodillas, avanzando de forma cruzada (brazo derecho con rodilla izquierda y viceversa) con la espalda recta. Fortalece la musculatura paravertebral y descarga la columna.",
          },
          {
            id: "bascula",
            name: "Báscula pélvica (retroversión/anteversión) — 15 repeticiones",
            explanation: "Tumbado boca arriba con las rodillas flexionadas, contrae el abdomen y bascula la pelvis hacia atrás (retroversión) y luego relaja hacia delante (anteversión). Mejora el control lumbo-pélvico y ayuda a corregir la postura.",
          },
          {
            id: "flexores-cadera",
            name: "Estiramiento de flexores de cadera — 2 series x 30 seg por lado",
            explanation: "En posición de zancada, con la rodilla trasera apoyada en el suelo, empuja la cadera hacia delante manteniendo el tronco recto. Estira el psoas-ilíaco, muy útil si pasas muchas horas sentado.",
          },
          {
            id: "isquios",
            name: "Estiramiento de isquiotibiales — 2 series x 30 seg por pierna",
            explanation: "Sentado o tumbado, con la pierna extendida, inclina el tronco hacia el pie manteniendo la espalda recta (sin redondear). Mejora la movilidad de cadera y reduce la tensión en la zona lumbar.",
          },
          {
            id: "toracica",
            name: "Movilidad torácica (corrección postural) — 10 repeticiones por lado",
            explanation: "En cuadrupedia o sentado, con una mano en la nuca, gira la parte alta de la espalda llevando el codo hacia arriba y atrás. Mejora la rotación torácica y quita carga a cervicales y lumbares.",
          },
        ],
      },
      { id: "hipopresivos", name: "Respiración hipopresiva (5 min)", type: "Ejercicio", freq: "Diario" },
      { id: "gr7", name: "GR7", type: "Suplemento", freq: "3x semana" },
      { id: "minoxidil", name: "Minoxidil tópico", type: "Tópico", freq: "Diario" },
      { id: "limpiador-am", name: "Limpiador facial", type: "Cosmética", freq: "Diario" },
      { id: "vitc", name: "Vitamina C tópica", type: "Cosmética", freq: "Diario" },
      { id: "hidratante-am", name: "Crema hidratante", type: "Cosmética", freq: "Diario" },
      { id: "spf", name: "Protección solar", type: "Cosmética", freq: "Diario" },
      { id: "espermidina", name: "Espermidina (1 comprimido)", type: "Suplemento", freq: "Diario" },
      { id: "finasteride", name: "Finasteride", type: "Suplemento", freq: "Diario" },
      { id: "creatina", name: "Creatina", type: "Suplemento", freq: "Diario" },
    ],
  },
  {
    id: "tarde", label: "Tarde", icon: CloudSun, accent: "var(--acc-cardio)", soft: "var(--acc-cardio-soft)",
    items: [
      { id: "nac", name: "NAC (1 comprimido)", type: "Suplemento", freq: "Diario" },
      { id: "omega3", name: "Omega 3 (1 comprimido, después de cenar)", type: "Suplemento", freq: "Diario" },
    ],
  },
  {
    id: "noche", label: "Noche", icon: Moon, accent: "var(--acc-projects)", soft: "var(--acc-projects-soft)",
    items: [
      { id: "magnesio", name: "Magnesio (2 comprimidos)", type: "Suplemento", freq: "Diario" },
      { id: "limpiador-pm", name: "Limpiador facial", type: "Cosmética", freq: "Diario" },
      { id: "niacinamida", name: "Niacinamida tópica", type: "Cosmética", freq: "Diario" },
      { id: "retinol", name: "Retinol", type: "Cosmética", freq: "2x semana" },
      { id: "hidratante-pm", name: "Crema hidratante", type: "Cosmética", freq: "Diario" },
    ],
  },
];
const ROUTINE_ITEM_COUNT = ROUTINE_SECTIONS.reduce((a, s) => a + s.items.length, 0);
const ROUTINE_TYPE_ICON = { Ejercicio: PersonStanding, Suplemento: Pill, Tópico: Droplet, Cosmética: Sparkles };
const STEPS_GOAL_DAILY = 8000;
const STEPS_GOAL_WEEKLY = 56000;

// ---------- catálogo de tipos de tarea ----------
const TASK_CATEGORIES = [
  { id: "general", label: "General", icon: CheckSquare, color: "var(--acc-day)", bg: "var(--acc-day-soft)" },
  { id: "salud", label: "Salud", icon: Stethoscope, color: "var(--acc-health)", bg: "var(--acc-health-soft)" },
  { id: "deporte", label: "Deporte", icon: Dumbbell, color: "var(--acc-gym)", bg: "var(--acc-gym-soft)" },
  { id: "compra", label: "Compra", icon: ShoppingCart, color: "var(--acc-nutrition)", bg: "var(--acc-nutrition-soft)" },
  { id: "proyectos", label: "Proyectos", icon: FolderKanban, color: "var(--acc-projects)", bg: "var(--acc-projects-soft)" },
  { id: "hobbies", label: "Hobbies", icon: Heart, color: "var(--acc-hobbies)", bg: "var(--acc-hobbies-soft)" },
  { id: "estetica", label: "Estética", icon: Sparkles, color: "var(--acc-aesthetic)", bg: "var(--acc-aesthetic-soft)" },
  { id: "trabajo", label: "Trabajo", icon: Briefcase, color: "var(--acc-work)", bg: "var(--acc-work-soft)" },
  { id: "viaje", label: "Viaje", icon: Plane, color: "var(--acc-travel)", bg: "var(--acc-travel-soft)" },
];
const TASK_CAT_BY_ID = Object.fromEntries(TASK_CATEGORIES.map((c) => [c.id, c]));
function taskBadge(t) {
  if (t.workoutTypeId) {
    const def = ALL_TYPES[t.workoutTypeId];
    return { id: "deporte", label: "Deporte", icon: def?.icon || Dumbbell, color: "var(--acc-gym)", bg: "var(--acc-gym-soft)" };
  }
  return TASK_CAT_BY_ID[t.category] || TASK_CAT_BY_ID.general;
}


const TABS = [
  { id: "resumen", label: "Resumen", icon: Home, accent: "var(--primary)", soft: "var(--primary-soft)" },
  { id: "rutina", label: "Rutina diaria", icon: ListChecks, accent: "var(--acc-routine)", soft: "var(--acc-routine-soft)" },
  { id: "dia", label: "Tareas", icon: CheckSquare, accent: "var(--acc-day)", soft: "var(--acc-day-soft)" },
  { id: "calendario", label: "Calendario", icon: CalendarIcon, accent: "var(--acc-day)", soft: "var(--acc-day-soft)" },
  { id: "ahorros", label: "Ahorros", icon: Wallet, accent: "var(--acc-savings)", soft: "var(--acc-savings-soft)" },
  { id: "gimnasio", label: "Gimnasio", icon: Dumbbell, accent: "var(--acc-gym)", soft: "var(--acc-gym-soft)" },
  { id: "objetivos", label: "Objetivos", icon: Target, accent: "var(--acc-goals)", soft: "var(--acc-goals-soft)" },
  { id: "hobbies", label: "Hobbies", icon: Heart, accent: "var(--acc-hobbies)", soft: "var(--acc-hobbies-soft)" },
  { id: "viajes", label: "Viajes", icon: Plane, accent: "var(--acc-travel)", soft: "var(--acc-travel-soft)" },
  { id: "nutricion", label: "Nutrición", icon: Utensils, accent: "var(--acc-nutrition)", soft: "var(--acc-nutrition-soft)" },
  { id: "gastos", label: "Flujo de caja", icon: Receipt, accent: "var(--acc-expense)", soft: "var(--acc-expense-soft)" },
  { id: "horoscopo", label: "Horóscopo", icon: Sparkles, accent: "var(--acc-aesthetic)", soft: "var(--acc-aesthetic-soft)" },
];

export default function App() {
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState("resumen");
  const [darkMode, setDarkMode] = useState(false);
  useEffect(() => {
    const bg = darkMode ? "#14151C" : "#F6F5FB";
    document.documentElement.style.background = bg;
    document.body.style.background = bg;
  }, [darkMode]);

  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [savings, setSavings] = useState({ goalName: "", goalAmount: 0, movements: [] });
  const [gym, setGym] = useState([]);
  const [goals, setGoals] = useState([]);
  const [hobbies, setHobbies] = useState([]);
  const [travel, setTravel] = useState({ visited: {}, wishlist: [], packing: {} });
  const [nutrition, setNutrition] = useState({ days: {}, lastBySlot: {} });
  const [pantry, setPantry] = useState({});
  const [expenses, setExpenses] = useState({ fixed: [], variable: [], incomeFixed: [], incomeVariable: [] });
  const [horoscope, setHoroscope] = useState({ sign: "" });
  const [tabOrder, setTabOrder] = useState(TABS.map((t) => t.id));
  const [hiddenTabs, setHiddenTabs] = useState([]);
  const [reorderMenuOpen, setReorderMenuOpen] = useState(null);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth <= 680 : false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 680);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const [routine, setRoutine] = useState({ checklist: {}, steps: {} });
  const [backupIndex, setBackupIndex] = useState([]);
  const [backupMsg, setBackupMsg] = useState("");
  const [importText, setImportText] = useState("");

  const refreshBackupIndex = () => loadBackupIndex().then(setBackupIndex);

  useEffect(() => {
    (async () => {
      const defaultTravel = { visited: Object.fromEntries(DEFAULT_VISITED_IDS.map((id) => [id, { year: "" }])), wishlist: [], packing: {} };
      const [t, e, s, g, go, h, tr, nu, pa, ex, ro, hs, to, ht] = await Promise.all([
        loadKey("tasks", []),
        loadKey("calendar-events", []),
        loadKey("savings", { goalName: "", goalAmount: 0, movements: [] }),
        loadKey("gym", []),
        loadKey("goals", []),
        loadKey("hobbies", []),
        loadKey("travel", defaultTravel),
        loadKey("nutrition", { days: {}, lastBySlot: {} }),
        loadKey("pantry", {}),
        loadKey("expenses", { fixed: [], variable: [], incomeFixed: [], incomeVariable: [] }),
        loadKey("routine", { checklist: {}, steps: {} }),
        loadKey("horoscope", { sign: "" }),
        loadKey("tab-order", TABS.map((t) => t.id)),
        loadKey("tab-hidden", []),
      ]);
      setTasks(t); setEvents(e); setSavings(s); setGym(g); setGoals(go); setHobbies(h); setTravel(tr); setNutrition(nu); setPantry(pa); setExpenses(ex); setRoutine(ro); setHoroscope(hs); setTabOrder(to); setHiddenTabs(ht);
      setLoading(false);

      // Copia de seguridad automática de TODO tal cual estaba justo al cargar, antes de que
      // cualquier lógica de la app (incluida la reconciliación) toque nada. Es el punto de
      // restauración más fiable si algo llegara a fallar más adelante.
      const snapshot = {
        tasks: t, "calendar-events": e, savings: s, gym: g, goals: go, hobbies: h,
        travel: tr, nutrition: nu, pantry: pa, expenses: ex, routine: ro,
      };
      const newIndex = await saveAutoBackup(snapshot, "Al cargar la app");
      if (newIndex) setBackupIndex(newIndex);
    })();
  }, []);

  // Copia de seguridad automática cada vez que cambian tareas, calendario o gimnasio — no solo
  // al abrir la app. Espera unos segundos tras el último cambio para no crear una copia por cada
  // pulsación, pero SIEMPRE termina creándose.
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      const snapshot = {
        tasks, "calendar-events": events, savings, gym, goals, hobbies,
        travel, nutrition, pantry, expenses, routine,
      };
      saveAutoBackup(snapshot, "Guardado automático").then((newIndex) => {
        if (newIndex) setBackupIndex(newIndex);
      });
    }, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, events, gym, loading]);

  const persist = {
    tasks: (v) => { setTasks(v); saveKey("tasks", v); },
    events: (v) => { setEvents(v); saveKey("calendar-events", v); },
    savings: (v) => { setSavings(v); saveKey("savings", v); },
    gym: (v) => { setGym(v); saveKey("gym", v); },
    goals: (v) => { setGoals(v); saveKey("goals", v); },
    hobbies: (v) => { setHobbies(v); saveKey("hobbies", v); },
    travel: (v) => { setTravel(v); saveKey("travel", v); },
    nutrition: (v) => { setNutrition(v); saveKey("nutrition", v); },
    pantry: (v) => { setPantry(v); saveKey("pantry", v); },
    expenses: (v) => { setExpenses(v); saveKey("expenses", v); },
    routine: (v) => { setRoutine(v); saveKey("routine", v); },
    horoscope: (v) => { setHoroscope(v); saveKey("horoscope", v); },
    tabOrder: (v) => { setTabOrder(v); saveKey("tab-order", v); },
    hiddenTabs: (v) => { setHiddenTabs(v); saveKey("tab-hidden", v); },
  };
  const persistRemove = {
    tasks: (v) => { setTasks(v); saveKey("tasks", v); },
    events: (v) => { setEvents(v); saveKey("calendar-events", v); },
    gym: (v) => { setGym(v); saveKey("gym", v); },
  };
  const persistDirect = {
    tasks: (v) => { setTasks(v); saveKey("tasks", v); },
    events: (v) => { setEvents(v); saveKey("calendar-events", v); },
    gym: (v) => { setGym(v); saveKey("gym", v); },
  };

  const applySnapshot = (snap) => {
    if (!snap) return;
    if (snap.tasks) persistDirect.tasks(snap.tasks);
    if (snap["calendar-events"]) persistDirect.events(snap["calendar-events"]);
    if (snap.savings) persist.savings(snap.savings);
    if (snap.gym) persistDirect.gym(snap.gym);
    if (snap.goals) persist.goals(snap.goals);
    if (snap.hobbies) persist.hobbies(snap.hobbies);
    if (snap.travel) persist.travel(snap.travel);
    if (snap.nutrition) persist.nutrition(snap.nutrition);
    if (snap.pantry) persist.pantry(snap.pantry);
    if (snap.expenses) persist.expenses(snap.expenses);
    if (snap.routine) persist.routine(snap.routine);
  };
  const restoreBackup = async (id) => {
    const snap = await loadBackupData(id);
    if (!snap) { setBackupMsg("No se pudo leer esa copia."); setTimeout(() => setBackupMsg(""), 4000); return; }
    applySnapshot(snap);
    setBackupMsg("✓ Datos restaurados desde la copia seleccionada.");
    setTimeout(() => setBackupMsg(""), 5000);
  };
  const restoreBackupPartial = async (id) => {
    const snap = await loadBackupData(id);
    if (!snap) { setBackupMsg("No se pudo leer esa copia."); setTimeout(() => setBackupMsg(""), 4000); return; }
    if (snap.tasks) persistDirect.tasks(snap.tasks);
    if (snap["calendar-events"]) persistDirect.events(snap["calendar-events"]);
    if (snap.gym) persistDirect.gym(snap.gym);
    setBackupMsg("✓ Restauradas solo Tareas, Calendario y Gimnasio (el resto no se ha tocado).");
    setTimeout(() => setBackupMsg(""), 6000);
  };
  const mergeBackup = async (id) => {
    const snap = await loadBackupData(id);
    if (!snap) { setBackupMsg("No se pudo leer esa copia."); setTimeout(() => setBackupMsg(""), 4000); return; }
    const mergeArr = (current, old) => {
      const existingIds = new Set((current || []).map((x) => x.id));
      const toAdd = (old || []).filter((x) => !existingIds.has(x.id));
      return [...(current || []), ...toAdd];
    };
    const mergedGym = mergeArr(gym, snap.gym);
    const mergedTasks = mergeArr(tasks, snap.tasks);
    const mergedEvents = mergeArr(events, snap["calendar-events"]);
    const addedGym = mergedGym.length - gym.length;
    const addedTasks = mergedTasks.length - tasks.length;
    const addedEvents = mergedEvents.length - events.length;
    persist.gym(mergedGym);
    persist.tasks(mergedTasks);
    persist.events(mergedEvents);
    setBackupMsg(`✓ Fusionado: añadidas ${addedGym} sesiones, ${addedTasks} tareas y ${addedEvents} eventos que faltaban. Lo que ya tenías (incluido lo de hoy) no se ha tocado.`);
    setTimeout(() => setBackupMsg(""), 8000);
  };
  const currentSnapshotJSON = () => JSON.stringify({
    tasks, "calendar-events": events, savings, gym, goals, hobbies,
    travel, nutrition, pantry, expenses, routine,
  }, null, 2);

  const [savingAll, setSavingAll] = useState(false);
  const [saveAllMsg, setSaveAllMsg] = useState("");
  const saveAllNow = async () => {
    setSavingAll(true);
    try {
      await Promise.all([
        saveKey("tasks", tasks),
        saveKey("calendar-events", events),
        saveKey("savings", savings),
        saveKey("gym", gym),
        saveKey("goals", goals),
        saveKey("hobbies", hobbies),
        saveKey("travel", travel),
        saveKey("nutrition", nutrition),
        saveKey("pantry", pantry),
        saveKey("expenses", expenses),
        saveKey("routine", routine),
      ]);
      const snapshot = {
        tasks, "calendar-events": events, savings, gym, goals, hobbies,
        travel, nutrition, pantry, expenses, routine,
      };
      const newIndex = await saveAutoBackup(snapshot, "Guardado manual");
      if (newIndex) setBackupIndex(newIndex);
      setSaveAllMsg("✓ Todo guardado ahora mismo, con copia de seguridad nueva.");
    } catch (e) {
      setSaveAllMsg("Hubo un problema guardando. Prueba a exportar el texto como respaldo.");
    }
    setSavingAll(false);
    setTimeout(() => setSaveAllMsg(""), 6000);
  };

  const exportRef = useRef(null);
  const exportAll = async () => {
    if (exportRef.current) {
      exportRef.current.focus();
      exportRef.current.select();
      exportRef.current.setSelectionRange(0, 999999);
    }
    let copied = false;
    try {
      await navigator.clipboard.writeText(currentSnapshotJSON());
      copied = true;
    } catch (e) { /* el navegador bloquea el portapapeles automático en este entorno; no pasa nada */ }
    if (!copied) {
      try { copied = document.execCommand("copy"); } catch (e) { /* noop */ }
    }
    setBackupMsg(copied
      ? "✓ Texto copiado. Pégalo en Notas, un email, etc."
      : "Ya está todo seleccionado arriba — ahora pulsa \"Copiar\" en el menú de tu teléfono o Ctrl+C.");
    setTimeout(() => setBackupMsg(""), 7000);
  };
  const importAll = (text) => {
    try {
      const snap = JSON.parse(text);
      applySnapshot(snap);
      setBackupMsg("✓ Copia importada y restaurada.");
    } catch (e) {
      setBackupMsg("Ese texto no es una copia válida (JSON incorrecto).");
    }
    setTimeout(() => setBackupMsg(""), 5000);
  };

  const [undoSnapshot, setUndoSnapshot] = useState(null); // { gym, events, tasks, label }
  const snapshotBeforeDelete = (label) => setUndoSnapshot({ gym, events, tasks, label });

  const deleteLinked = (linkId) => {
    snapshotBeforeDelete("Sesión eliminada");
    const removedGymIds = gym.filter((s) => s.id === linkId).map((s) => s.id);
    const removedEventIds = events.filter((e) => e.sessionId === linkId).map((e) => e.id);
    const removedTaskIds = tasks.filter((t) => t.sessionId === linkId).map((t) => t.id);
    persistRemove.gym(gym.filter((s) => s.id !== linkId), removedGymIds);
    persistRemove.events(events.filter((e) => e.sessionId !== linkId), removedEventIds);
    persistRemove.tasks(tasks.filter((t) => t.sessionId !== linkId), removedTaskIds);
  };
  const removeTaskGeneric = (id) => {
    snapshotBeforeDelete("Tarea eliminada");
    persistRemove.tasks(tasks.filter((t) => t.id !== id), [id]);
  };
  const removeEventGeneric = (id) => {
    snapshotBeforeDelete("Evento eliminado");
    persistRemove.events(events.filter((e) => e.id !== id), [id]);
  };
  const undoDelete = () => {
    if (!undoSnapshot) return;
    persistDirect.gym(undoSnapshot.gym);
    persistDirect.events(undoSnapshot.events);
    persistDirect.tasks(undoSnapshot.tasks);
    setUndoSnapshot(null);
  };
  useEffect(() => {
    if (!undoSnapshot) return;
    const t = setTimeout(() => setUndoSnapshot(null), 10000);
    return () => clearTimeout(t);
  }, [undoSnapshot]);

  // Reconciliación automática entre Calendario, Tareas y Gimnasio.
  // Agrupa todo por su identificador de enlace (sessionId) y, para cada grupo, crea lo que falte
  // (evento, tarea, o la sesión de gimnasio reconstruida desde la descripción si aplica). Funciona
  // para CUALQUIER tarea con fecha, no solo las de gimnasio.
  // Ocurre en cuanto la app carga, sin depender de qué pestaña esté abierta.
  useEffect(() => {
    if (loading) return;
    (async () => {
      let workEvents = [...events];
      let workTasks = [...tasks];
      let workGym = [...gym];
      let changed = false;

      workEvents.forEach((e, idx) => {
        if (e.date && !e.sessionId) { workEvents[idx] = { ...e, sessionId: uid() }; changed = true; }
      });
      workTasks.forEach((t, idx) => {
        if (t.date && !t.sessionId) { workTasks[idx] = { ...t, sessionId: uid() }; changed = true; }
      });

      const linkIds = new Set([
        ...workEvents.filter((e) => e.sessionId).map((e) => e.sessionId),
        ...workTasks.filter((t) => t.sessionId).map((t) => t.sessionId),
        ...workGym.map((s) => s.id),
      ]);

      linkIds.forEach((linkId) => {
        const ev = workEvents.find((e) => e.sessionId === linkId);
        const tk = workTasks.find((t) => t.sessionId === linkId);
        const gy = workGym.find((s) => s.id === linkId);
        const date = ev?.date || tk?.date || gy?.date;
        if (!date) return;
        const typeId = ev?.workoutTypeId || tk?.workoutTypeId || gy?.typeId || guessTypeIdFromName(ev?.title || tk?.text);
        const isGym = typeId && ALL_TYPES[typeId];
        const description = ev?.description || tk?.description;
        const isPast = date < todayStr();
        const title = ev?.title || tk?.text || (isGym ? ALL_TYPES[typeId].name : "Tarea");
        const category = tk?.category ?? ev?.category ?? (isGym ? "deporte" : undefined);

        if (!tk) {
          workTasks.push({
            id: uid(), text: title, date, done: ev ? !!ev.done : isPast,
            category, workoutTypeId: isGym ? typeId : undefined, sessionId: linkId, description,
          });
          changed = true;
        }
        if (!ev) {
          workEvents.push({
            id: uid(), date, title, time: "", note: "",
            workoutTypeId: isGym ? typeId : undefined, done: tk ? !!tk.done : isPast, sessionId: linkId, description, category,
          });
          changed = true;
        }
        if (isGym && !gy && description) {
          const kind = ALL_TYPES[typeId].kind;
          let sessionObj = null;
          if (kind === "fuerza") {
            const exercises = parseFuerzaDescription(description);
            if (exercises) sessionObj = { id: linkId, date, kind: "fuerza", typeId, exercises };
          } else {
            const cardio = parseCardioDescription(description);
            if (cardio) sessionObj = { id: linkId, date, kind: "cardio", typeId, ...cardio };
          }
          if (sessionObj) { workGym.push(sessionObj); changed = true; }
        }
      });

      if (changed) {
        setEvents(workEvents); await saveKey("calendar-events", workEvents);
        setTasks(workTasks); await saveKey("tasks", workTasks);
        setGym(workGym); await saveKey("gym", workGym);
      }
    })();
    // Se ejecuta solo una vez, justo al terminar de cargar. Antes se repetía con cada cambio de
    // gym/tasks/events, lo que podía solapar ejecuciones y sobrescribir cambios nuevos con una foto
    // vieja de los datos (la causa real de que desaparecieran tareas/sesiones recién creadas).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const activeTab = TABS.find((t) => t.id === active) || (active === "configuracion" ? { label: "Configuración", accent: "var(--ink-soft)" } : null);
  const fullOrderedTabs = [
    ...tabOrder.map((id) => TABS.find((t) => t.id === id)).filter(Boolean),
    ...TABS.filter((t) => !tabOrder.includes(t.id)),
  ];
  const fullOrderIds = fullOrderedTabs.map((t) => t.id);
  const orderedTabs = fullOrderedTabs.filter((t) => !hiddenTabs.includes(t.id));
  const moveTabOrder = (id, dir) => {
    const idx = fullOrderIds.indexOf(id);
    const newIdx = dir === "up" ? idx - 1 : idx + 1;
    if (idx === -1 || newIdx < 0 || newIdx >= fullOrderIds.length) return;
    const newOrder = [...fullOrderIds];
    [newOrder[idx], newOrder[newIdx]] = [newOrder[newIdx], newOrder[idx]];
    persist.tabOrder(newOrder);
  };

  const renderBackupContent = () => (
    <>
      {backupMsg && <p className="logger-hint" style={{ color: "var(--primary)" }}>{backupMsg}</p>}

      <div className="recipe-modal-subtitle" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Restaurar una copia automática ({backupIndex.length})</span>
        <button className="link-btn" onClick={() => loadBackupIndex().then(setBackupIndex)}>Refrescar</button>
      </div>
      {backupIndex.length === 0 ? (
        <Empty text="Todavía no hay copias guardadas." />
      ) : (
        <div className="list-card" style={{ marginBottom: 16 }}>
          {backupIndex.map((b) => (
            <div key={b.id} className="list-row list-row-stack">
              <div className="list-row-main">
                <span className="list-text">{fmtBackupTime(b.ts)}</span>
                <span className="mono-tag">{b.label}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                <button className="link-btn" onClick={() => mergeBackup(b.id)}>Fusionar (añade lo que falte)</button>
                <button className="link-btn" onClick={() => restoreBackupPartial(b.id)}>Solo tareas/gym</button>
                <button className="link-btn" onClick={() => restoreBackup(b.id)}>Restaurar todo</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="recipe-modal-subtitle">Exportar copia completa</div>
      <p className="logger-hint" style={{ margin: "0 0 10px" }}>
        Toca el cuadro de abajo, elige "Seleccionar todo" (o pulsa el botón) y luego "Copiar" desde el menú de tu teléfono/navegador. Pega ese texto en Notas, un email, etc.
      </p>
      <textarea
        ref={exportRef} className="input" readOnly
        style={{ width: "100%", minHeight: 110, resize: "vertical", fontFamily: "monospace", fontSize: 10 }}
        value={currentSnapshotJSON()}
        onClick={(e) => e.target.select()}
      />
      <button className="btn btn-wide" style={{ "--btn-accent": "var(--primary)", marginTop: 10 }} onClick={exportAll}>
        <Download size={14} style={{ marginRight: 6 }} />Seleccionar todo el texto
      </button>

      <div className="recipe-modal-subtitle" style={{ marginTop: 18 }}>Importar copia</div>
      <p className="logger-hint" style={{ margin: "0 0 10px" }}>Pega aquí un texto exportado antes para restaurarlo.</p>
      <textarea className="input" style={{ width: "100%", minHeight: 80, resize: "vertical", fontFamily: "monospace", fontSize: 11 }}
        placeholder="Pega aquí la copia exportada…" value={importText} onChange={(e) => setImportText(e.target.value)} />
      <button className="btn btn-wide" style={{ "--btn-accent": "var(--acc-gym)", marginTop: 10 }} onClick={() => importAll(importText)}>
        <Upload size={14} style={{ marginRight: 6 }} />Importar y restaurar
      </button>
    </>
  );

  return (
    <div className={"wrap" + (darkMode ? " dark" : "")}>
      <Styles />
      <nav className="nav">
        <div className="nav-brand">
          <span className="nav-brand-label" style={{ display: "flex", alignItems: "center", gap: 8 }}><div className="nav-brand-dot" />Vida</span>
          <span className="nav-brand-actions" style={{ display: "flex", gap: 4 }}>
            <button className="dark-toggle" onClick={() => setDarkMode(!darkMode)} title={darkMode ? "Modo claro" : "Modo oscuro"}>
              {darkMode ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button className={"dark-toggle" + (active === "configuracion" ? " dark-toggle-active" : "")} onClick={() => setActive("configuracion")} title="Configuración">
              <Settings size={14} />
            </button>
          </span>
        </div>
        <button className="save-all-btn" onClick={saveAllNow} disabled={savingAll}>
          {savingAll ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
          <span className="save-all-label">{savingAll ? "Guardando…" : "Guardar todo ahora"}</span>
        </button>
        {saveAllMsg && <p className="save-all-msg">{saveAllMsg}</p>}
        <div className="nav-list">
          {orderedTabs.map((t, idx) => {
            const Icon = t.icon;
            const isActive = active === t.id;
            return (
              <div
                key={t.id}
                className={"nav-item" + (isActive ? " nav-item-active" : "")}
                style={{ "--tab-accent": t.accent, "--tab-soft": t.soft }}
              >
                <button className="nav-item-main" onClick={() => setActive(t.id)}>
                  <span className="nav-icon"><Icon size={17} strokeWidth={2} /></span>
                  <span className="nav-label">{t.label}</span>
                </button>
                <button className="nav-item-dots" onClick={(e) => { e.stopPropagation(); setReorderMenuOpen(reorderMenuOpen === t.id ? null : t.id); }}>
                  <MoreVertical size={14} />
                </button>
                {reorderMenuOpen === t.id && (
                  <div className="nav-reorder-menu">
                    {isMobile ? (
                      <>
                        <button disabled={fullOrderIds.indexOf(t.id) === 0} onClick={() => { moveTabOrder(t.id, "up"); setReorderMenuOpen(null); }}><ChevronLeft size={13} /> Mover a la izquierda</button>
                        <button disabled={fullOrderIds.indexOf(t.id) === fullOrderIds.length - 1} onClick={() => { moveTabOrder(t.id, "down"); setReorderMenuOpen(null); }}><ChevronRight size={13} /> Mover a la derecha</button>
                      </>
                    ) : (
                      <>
                        <button disabled={fullOrderIds.indexOf(t.id) === 0} onClick={() => { moveTabOrder(t.id, "up"); setReorderMenuOpen(null); }}><ChevronUp size={13} /> Subir</button>
                        <button disabled={fullOrderIds.indexOf(t.id) === fullOrderIds.length - 1} onClick={() => { moveTabOrder(t.id, "down"); setReorderMenuOpen(null); }}><ChevronDown size={13} /> Bajar</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      <main className="content">
        {loading ? (
          <div className="loading"><Loader2 className="spin" size={20} /> Cargando tu app…</div>
        ) : active === "resumen" ? (
          <Resumen tasks={tasks} savings={savings} gym={gym} goals={goals} events={events} hobbies={hobbies} expenses={expenses} routine={routine} goTo={setActive} />
        ) : active === "dia" ? (
          <DiaADia tasks={tasks} setTasks={persist.tasks} events={events} setEvents={persist.events} gym={gym} onDeleteSession={deleteLinked} onRemoveTask={removeTaskGeneric} />
        ) : active === "calendario" ? (
          <Calendario events={events} setEvents={persist.events} tasks={tasks} setTasks={persist.tasks} gym={gym} onDeleteSession={deleteLinked} onRemoveEvent={removeEventGeneric} />
        ) : active === "ahorros" ? (
          <Ahorros savings={savings} setSavings={persist.savings} objectives={goals} setObjectives={persist.goals} />
        ) : active === "gimnasio" ? (
          <Gimnasio gym={gym} setGym={persist.gym} events={events} setEvents={persist.events} tasks={tasks} setTasks={persist.tasks} onDeleteSession={deleteLinked} />
        ) : active === "objetivos" ? (
          <Objetivos goals={goals} setGoals={persist.goals} tasks={tasks} setTasks={persist.tasks} events={events} setEvents={persist.events} />
        ) : active === "hobbies" ? (
          <Hobbies hobbies={hobbies} setHobbies={persist.hobbies} tasks={tasks} setTasks={persist.tasks} events={events} setEvents={persist.events} />
        ) : active === "viajes" ? (
          <Viajes travel={travel} setTravel={persist.travel} tasks={tasks} setTasks={persist.tasks} events={events} setEvents={persist.events} onDeleteSession={deleteLinked} />
        ) : active === "nutricion" ? (
          <Nutricion nutrition={nutrition} setNutrition={persist.nutrition} pantry={pantry} setPantry={persist.pantry} tasks={tasks} setTasks={persist.tasks} events={events} setEvents={persist.events} />
        ) : active === "gastos" ? (
          <Gastos expenses={expenses} setExpenses={persist.expenses} savings={savings} setSavings={persist.savings} />
        ) : active === "rutina" ? (
          <RutinaDiaria routine={routine} setRoutine={persist.routine} />
        ) : active === "horoscopo" ? (
          <Horoscopo horoscope={horoscope} setHoroscope={persist.horoscope} />
        ) : active === "configuracion" ? (
          <Configuracion
            fullOrderedTabs={fullOrderedTabs}
            hiddenTabs={hiddenTabs}
            onMove={moveTabOrder}
            onToggleHidden={(id) => persist.hiddenTabs(hiddenTabs.includes(id) ? hiddenTabs.filter((x) => x !== id) : [...hiddenTabs, id])}
            darkMode={darkMode} setDarkMode={setDarkMode}
            renderBackupContent={renderBackupContent}
            onOpenBackups={refreshBackupIndex}
          />
        ) : null}
      </main>

      {undoSnapshot && (
        <div className="undo-toast">
          <span>{undoSnapshot.label}</span>
          <button onClick={undoDelete}>Deshacer</button>
        </div>
      )}
    </div>
  );
}

// ---------- shared bits ----------
function Page({ title, subtitle, children }) {
  return (
    <div className="page">
      <header className="page-head">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </header>
      {children}
    </div>
  );
}
function Empty({ text }) {
  return <div className="empty">{text}</div>;
}
function Badge({ children, tone = "primary" }) {
  return <span className={"badge badge-" + tone}>{children}</span>;
}
function Donut({ pct, accent, size = 132, label, sub }) {
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--line)" strokeWidth="14" fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={accent} strokeWidth="14" fill="none"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="donut-label">
        <strong>{Math.round(pct)}%</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
function Card({ children, className = "", style }) {
  return <div className={"card " + className} style={style}>{children}</div>;
}
function TaskDetailModal({ item, gym, onClose, onSaveDescription }) {
  const [desc, setDesc] = useState(item.description || "");
  useEffect(() => { setDesc(item.description || ""); }, [item.id]);
  const cat = taskBadge(item);
  const Icon = cat.icon;
  const gymSession = item.sessionId ? gym.find((s) => s.id === item.sessionId) : null;

  return (
    <>
      <div className="recipe-backdrop" onClick={onClose} />
      <div className="recipe-modal" style={{ width: "min(400px, 90vw)" }}>
        <div className="recipe-modal-head">
          <div>
            <span className="event-type-badge" style={{ background: cat.bg, color: cat.color }}>
              <Icon size={11} strokeWidth={2.5} />{cat.label}
            </span>
            <div className="recipe-modal-title" style={{ marginTop: 6 }}>{item.title}</div>
            <div className="recipe-modal-time">{fmtDate(item.date)}{item.time ? ` · ${item.time}` : ""}{item.done ? " · Completada" : ""}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        {gymSession && (
          <div style={{ marginBottom: 14 }}>
            <div className="recipe-modal-subtitle">Detalle de la sesión</div>
            {gymSession.kind === "fuerza" ? (
              <ul className="recipe-ingredients">
                {gymSession.exercises.map((e) => (
                  <li key={e.id}>{e.name} — {e.sets.map((s) => `${s.weight || 0}kg×${s.reps || 0}`).join(", ")}</li>
                ))}
              </ul>
            ) : (
              <div className="stat-label">{gymSession.duration} min{gymSession.distance ? ` · ${gymSession.distance} km` : ""}{gymSession.note ? ` · ${gymSession.note}` : ""}</div>
            )}
          </div>
        )}
        {item.workoutTypeId && !gymSession && (
          <p className="logger-hint">No se encontró la sesión de entrenamiento asociada (puede que no llegara a guardarse). Puedes registrarla desde Gimnasio.</p>
        )}
        {item.category === "compra" && !item.workoutTypeId && (
          <p className="logger-hint">Creada automáticamente al generar tu lista de la compra en Nutrición.</p>
        )}
        {item.category === "viaje" && (
          <p className="logger-hint">Creada automáticamente desde "Programar viaje" en Viajes.</p>
        )}

        <div className="recipe-modal-subtitle" style={{ marginTop: 10 }}>Descripción</div>
        <textarea className="input" style={{ width: "100%", minHeight: 72, resize: "vertical", fontFamily: "inherit" }}
          placeholder="Añade una nota o descripción…" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <button className="btn btn-wide" style={{ "--btn-accent": cat.color, marginTop: 10 }} onClick={() => onSaveDescription(desc)}>Guardar</button>
      </div>
    </>
  );
}
function DatePicker({ value, onChange, accent = "var(--acc-gym)", label }) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => { const d = new Date(value + "T00:00:00"); d.setDate(1); return d; });
  const year = viewMonth.getFullYear(), m = viewMonth.getMonth();
  const first = new Date(year, m, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const toggle = () => {
    if (!open) { const d = new Date(value + "T00:00:00"); d.setDate(1); setViewMonth(d); }
    setOpen(!open);
  };

  return (
    <div className="datepicker">
      <button type="button" className="datepicker-trigger" onClick={toggle}>
        <CalendarIcon size={14} />
        <span>{label || fmtDate(value)}</span>
      </button>
      {open && (
        <>
          <div className="datepicker-backdrop" onClick={() => setOpen(false)} />
          <div className="datepicker-panel">
            <div className="cal-head">
              <button type="button" className="chip" onClick={() => setViewMonth(new Date(year, m - 1, 1))}><ChevronLeft size={14} /></button>
              <span className="chip-label cal-month">{viewMonth.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}</span>
              <button type="button" className="chip" onClick={() => setViewMonth(new Date(year, m + 1, 1))}><ChevronRight size={14} /></button>
            </div>
            <div className="cal-grid">
              {["L", "M", "X", "J", "V", "S", "D"].map((d) => <div key={d} className="cal-dow">{d}</div>)}
              {cells.map((d, i) => {
                if (!d) return <div key={i} className="cal-cell cal-cell-empty" />;
                const dateStr = `${year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                const isSel = dateStr === value;
                const isToday = dateStr === todayStr();
                return (
                  <button key={i} type="button" className={"cal-cell" + (isSel ? " cal-cell-sel" : "") + (isToday && !isSel ? " cal-cell-today" : "")}
                    style={isSel ? { background: accent } : undefined}
                    onClick={() => { onChange(dateStr); setOpen(false); }}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Resumen ----------
function Resumen({ tasks, savings, gym, goals, events, hobbies, expenses, routine, goTo }) {
  const [hidden, setHidden] = useState(true);
  const todayTasks = tasks.filter((t) => t.date === todayStr());
  const doneToday = todayTasks.filter((t) => t.done).length;
  const totalSaved = (savings.movements || []).reduce((a, m) => a + (m.type === "in" ? m.amount : -m.amount), 0);
  const totalGoalAmount = (savings.goals || []).reduce((a, g) => a + (g.targetAmount || 0), 0) || (savings.goalAmount || 0);
  const pct = totalGoalAmount ? Math.min(100, (totalSaved / totalGoalAmount) * 100) : 0;
  const goalCount = (savings.goals || []).length;
  const upcomingGym = [...gym].filter((s) => s.date >= todayStr()).sort((a, b) => a.date.localeCompare(b.date))[0];
  const lastCompletedGym = [...gym].filter((s) => s.date < todayStr()).sort((a, b) => b.date.localeCompare(a.date))[0];
  const gymCardSession = upcomingGym || lastCompletedGym;
  const lastGymType = gymCardSession ? ALL_TYPES[gymCardSession.typeId] : null;
  const gymCardIsUpcoming = !!upcomingGym;
  const weekRange = getWeekRange(new Date());
  const gymThisWeek = gym.filter((s) => isInRange(s.date, weekRange)).length;
  const activeGoals = goals.filter((g) => goalProgress(g) < 100);
  const avgGoalProgress = goals.length ? Math.round(goals.reduce((a, g) => a + goalProgress(g), 0) / goals.length) : 0;
  const taskOrderIndex = {};
  tasks.forEach((t, idx) => { if (t.sessionId) taskOrderIndex[t.sessionId] = idx; });
  const nextEvent = events
    .filter((e) => e.date >= todayStr() && !e.done)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      const ao = a.sessionId && taskOrderIndex[a.sessionId] !== undefined ? taskOrderIndex[a.sessionId] : Infinity;
      const bo = b.sessionId && taskOrderIndex[b.sessionId] !== undefined ? taskOrderIndex[b.sessionId] : Infinity;
      if (ao !== bo) return ao - bo;
      return (a.time || "").localeCompare(b.time || "");
    })[0];
  const totalHobbyHours = hobbies.reduce(
    (a, h) => a + (h.sessions || []).reduce((s, ses) => s + (ses.duration || 0), 0) / 60, 0
  );

  const monthKey = todayStr().slice(0, 7);
  const fixedActiveExp = (expenses.fixed || []).filter((f) => !isExpenseExpired(f) && f.active && f.category !== "Ahorro").reduce((a, f) => a + f.amount, 0);
  const varExpMonth = (expenses.variable || []).filter((v) => v.date.slice(0, 7) === monthKey && v.category !== "Ahorro").reduce((a, v) => a + v.amount, 0);
  const fixedActiveInc = (expenses.incomeFixed || []).filter((f) => !isExpenseExpired(f) && f.active).reduce((a, f) => a + f.amount, 0);
  const varIncMonth = (expenses.incomeVariable || []).filter((v) => v.date.slice(0, 7) === monthKey).reduce((a, v) => a + v.amount, 0);
  const fixedAhorroMonth = (expenses.fixed || []).filter((f) => !isExpenseExpired(f) && f.active && f.category === "Ahorro").reduce((a, f) => a + f.amount, 0);
  const varAhorroMonth = (expenses.variable || []).filter((v) => v.date.slice(0, 7) === monthKey && v.category === "Ahorro").reduce((a, v) => a + v.amount, 0);
  const cashFlowMonth = (fixedActiveInc + varIncMonth) - (fixedActiveExp + varExpMonth) - (fixedAhorroMonth + varAhorroMonth);

  const routineChecklist = (routine.checklist || {})[todayStr()] || {};
  const routineAllItems = ROUTINE_SECTIONS.flatMap((s) => s.items);
  const isRoutineItemDone = (item, data) => (item.details ? item.details.every((d) => data[`${item.id}__${d.id}`]) : !!data[item.id]);
  const routineDoneToday = routineAllItems.filter((it) => isRoutineItemDone(it, routineChecklist)).length;
  const routineDailyItems = routineAllItems.filter((it) => it.freq === "Diario");
  const routineStreak = (() => {
    let count = 0;
    let d = new Date();
    for (let i = 0; i < 400; i++) {
      const ds = dateToStr(d);
      const data = (routine.checklist || {})[ds] || {};
      const allDone = routineDailyItems.length > 0 && routineDailyItems.every((it) => isRoutineItemDone(it, data));
      if (allDone) { count++; d.setDate(d.getDate() - 1); } else break;
    }
    return count;
  })();

  return (
    <Page title={`${greeting()} 👋`} subtitle={new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}>
      <p className="motivational-quote">{motivationalQuote()}</p>
      <div className="grid-2">
        <Card className="hero-card" style={{ background: "var(--primary)" }}>
          <div className="hero-top">
            <span>Tareas de hoy</span>
            <span className="hero-pill"><ArrowUpRight size={13} /></span>
          </div>
          <div className="hero-value">{doneToday}<span className="hero-value-sub">/{todayTasks.length || 0}</span></div>
          <div className="hero-foot">completadas · <button className="hero-link" onClick={() => goTo("dia")}>ver todas</button></div>
        </Card>

        <Card style={{ position: "relative" }}>
          <div className="stat-top">
            <span className="stat-icon" style={{ background: "var(--acc-savings-soft)", color: "var(--acc-savings)" }}><Wallet size={16} /></span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {totalGoalAmount > 0 && <Badge tone="savings">{Math.round(pct)}%</Badge>}
              <button className="icon-btn" style={{ background: "var(--bg)" }} onClick={() => setHidden(!hidden)} title={hidden ? "Mostrar cifras" : "Ocultar cifras"}>
                {hidden ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
            </div>
          </div>
          <div className={"blur-wrap" + (hidden ? " blur-wrap-hidden" : "")}>
            <div className="stat-value">{fmtEUR(totalSaved)}</div>
            <div className="stat-label">{goalCount > 0 ? `ahorrado en ${goalCount} meta${goalCount > 1 ? "s" : ""}` : "ahorrado"}</div>
          </div>
          <button className="stat-cta" onClick={() => goTo("ahorros")}>Ver ahorros</button>
        </Card>
      </div>

      <div className="grid-2">
        <Card>
          <div className="stat-top">
            <span className="stat-icon" style={{ background: cashFlowMonth >= 0 ? "var(--acc-savings-soft)" : "var(--acc-gym-soft)", color: cashFlowMonth >= 0 ? "var(--acc-savings)" : "var(--acc-gym)" }}><Receipt size={16} /></span>
          </div>
          <div className={"blur-wrap" + (hidden ? " blur-wrap-hidden" : "")}>
            <div className="stat-value">{cashFlowMonth >= 0 ? "+" : ""}{fmtEUR(cashFlowMonth)}</div>
          </div>
          <div className="stat-label">flujo de caja este mes</div>
          <button className="stat-cta" onClick={() => goTo("gastos")}>Ver flujo de caja</button>
        </Card>

        <Card>
          <div className="stat-top">
            <span className="stat-icon" style={{ background: "var(--acc-routine-soft)", color: "var(--acc-routine)" }}><ListChecks size={16} /></span>
          </div>
          <div className="stat-value">{routineDoneToday}<span className="hero-value-sub">/{ROUTINE_ITEM_COUNT}</span></div>
          <div className="stat-label">rutina de hoy{routineStreak > 0 ? ` · 🔥 ${routineStreak} día${routineStreak > 1 ? "s" : ""}` : ""}</div>
          <button className="stat-cta" onClick={() => goTo("rutina")}>Ver rutina</button>
        </Card>
      </div>

      <div className="grid-2">
        <Card>
          <div className="stat-top">
            <span className="stat-icon" style={{ background: "var(--acc-gym-soft)", color: "var(--acc-gym)" }}><Dumbbell size={16} /></span>
          </div>
          <div className="stat-value stat-value-sm">{lastGymType ? lastGymType.name : "Sin registros"}</div>
          <div className="stat-label">{gymCardSession ? `${gymCardIsUpcoming ? "próxima" : "última"}: ${fmtDateShort(gymCardSession.date)} · ${gymThisWeek}/${WEEKLY_GOAL} esta semana` : "aún no hay sesiones"}</div>
          <button className="stat-cta" onClick={() => goTo("gimnasio")}>Ir al gimnasio</button>
        </Card>

        <Card>
          <div className="stat-top">
            <span className="stat-icon" style={{ background: "var(--acc-day-soft)", color: "var(--acc-day)" }}><CalendarIcon size={16} /></span>
          </div>
          <div className="stat-value stat-value-sm">{nextEvent ? nextEvent.title : "Nada próximo"}</div>
          <div className="stat-label">{nextEvent ? fmtDate(nextEvent.date) : "agenda libre"}</div>
          <button className="stat-cta" onClick={() => goTo("calendario")}>Ver calendario</button>
        </Card>
      </div>

      <Card className="wide-card">
        <div className="wide-row">
          <div className="wide-item">
            <span className="stat-icon" style={{ background: "var(--acc-goals-soft)", color: "var(--acc-goals)" }}><Target size={16} /></span>
            <div>
              <div className="wide-value">{activeGoals.length}</div>
              <div className="stat-label">objetivos activos · {avgGoalProgress}% media</div>
            </div>
          </div>
          <button className="stat-cta" onClick={() => goTo("objetivos")}>Ver</button>
        </div>
        <div className="wide-row">
          <div className="wide-item">
            <span className="stat-icon" style={{ background: "var(--acc-hobbies-soft)", color: "var(--acc-hobbies)" }}><Heart size={16} /></span>
            <div>
              <div className="wide-value">{totalHobbyHours.toFixed(1)} h</div>
              <div className="stat-label">dedicadas a tus hobbies</div>
            </div>
          </div>
          <button className="stat-cta" onClick={() => goTo("hobbies")}>Ver</button>
        </div>
      </Card>
    </Page>
  );
}

// ---------- Día a día ----------
function DiaADia({ tasks, setTasks, events, setEvents, gym, onDeleteSession, onRemoveTask }) {
  const [text, setText] = useState("");
  const [date, setDate] = useState(todayStr());
  const [noDate, setNoDate] = useState(false);
  const [time, setTime] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [filterDate, setFilterDate] = useState(todayStr());
  const [allOpen, setAllOpen] = useState(false);
  const [backlogOpen, setBacklogOpen] = useState(true);
  const [detailId, setDetailId] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [editCategory, setEditCategory] = useState("general");
  const [editDate, setEditDate] = useState(todayStr());
  const [editTime, setEditTime] = useState("");
  const [dragTaskId, setDragTaskId] = useState(null);
  const [formError, setFormError] = useState("");

  const moveTask = (taskId, direction, listForDate) => {
    const idx = listForDate.findIndex((t) => t.id === taskId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (idx === -1 || swapIdx < 0 || swapIdx >= listForDate.length) return;
    const idA = listForDate[idx].id, idB = listForDate[swapIdx].id;
    const newTasks = [...tasks];
    const posA = newTasks.findIndex((t) => t.id === idA);
    const posB = newTasks.findIndex((t) => t.id === idB);
    [newTasks[posA], newTasks[posB]] = [newTasks[posB], newTasks[posA]];
    setTasks(newTasks);
  };
  const moveTaskDrag = (fromId, toId, listForDate) => {
    if (fromId === toId) return;
    const order = listForDate.map((t) => t.id);
    const fromIdx = order.indexOf(fromId);
    const toIdx = order.indexOf(toId);
    if (fromIdx === -1 || toIdx === -1) return;
    order.splice(toIdx, 0, order.splice(fromIdx, 1)[0]);
    const idToTask = Object.fromEntries(listForDate.map((t) => [t.id, t]));
    const reordered = order.map((id) => idToTask[id]);
    const newTasks = [...tasks];
    const positions = reordered.map((t) => newTasks.findIndex((x) => x.id === t.id)).sort((a, b) => a - b);
    positions.forEach((pos, i) => { newTasks[pos] = reordered[i]; });
    setTasks(newTasks);
  };

  const add = () => {
    if (!text.trim()) { setFormError("Escribe el texto de la tarea antes de añadirla."); return; }
    if (!description.trim()) { setFormError("Añade una descripción antes de crear la tarea."); return; }
    setFormError("");
    const cat = category === "general" ? undefined : category;
    if (noDate) {
      setTasks([...tasks, { id: uid(), text: text.trim(), date: null, done: false, category: cat, description: description.trim() }]);
    } else {
      const linkId = uid();
      setTasks([...tasks, { id: uid(), text: text.trim(), date, time, done: false, category: cat, sessionId: linkId, description: description.trim() }]);
      setEvents([...events, { id: uid(), date, title: text.trim(), time, note: "", sessionId: linkId, description: description.trim() }]);
    }
    setText(""); setTime(""); setDescription("");
  };
  const toggle = (id) => {
    const t = tasks.find((x) => x.id === id);
    const newDone = !t.done;
    setTasks(tasks.map((x) => (x.id === id ? { ...x, done: newDone } : x)));
    if (t.sessionId) {
      setEvents(events.map((e) => (e.sessionId === t.sessionId ? { ...e, done: newDone } : e)));
    }
  };
  const remove = (id) => onRemoveTask(id);
  const removeTask = (t) => (t.sessionId ? onDeleteSession(t.sessionId) : remove(t.id));
  const duplicateTask = (t) => {
    const linkId = t.date ? uid() : null;
    setTasks([...tasks, { id: uid(), text: t.text, date: t.date, time: t.time, done: false, category: t.category, workoutTypeId: t.date ? t.workoutTypeId : undefined, sessionId: linkId, description: t.description }]);
    if (t.date) {
      setEvents([...events, { id: uid(), date: t.date, title: t.text, time: t.time || "", note: "", workoutTypeId: t.workoutTypeId, sessionId: linkId, category: t.category, description: t.description }]);
    }
  };
  const assignDate = (t, newDate) => {
    if (t.sessionId) {
      setTasks(tasks.map((x) => (x.id === t.id ? { ...x, date: newDate } : x)));
      setEvents(events.map((e) => (e.sessionId === t.sessionId ? { ...e, date: newDate } : e)));
    } else {
      const linkId = uid();
      setTasks(tasks.map((x) => (x.id === t.id ? { ...x, date: newDate, sessionId: linkId } : x)));
      setEvents([...events, { id: uid(), date: newDate, title: t.text, time: "", note: "", sessionId: linkId, category: t.category, workoutTypeId: t.workoutTypeId, description: t.description }]);
    }
  };

  const startEdit = (t) => {
    setEditingId(t.id);
    setEditText(t.text);
    setEditCategory(t.category || "general");
    setEditDate(t.date);
    setEditTime(t.time || "");
  };
  const cancelEdit = () => setEditingId(null);
  const saveEdit = (t) => {
    if (!editText.trim()) { setFormError("Escribe el texto de la tarea antes de guardar."); return; }
    setFormError("");
    const cat = editCategory === "general" ? undefined : editCategory;
    const newDate = editDate || null;
    if (!t.sessionId && newDate) {
      const linkId = uid();
      setTasks(tasks.map((x) => (x.id === t.id ? { ...x, text: editText.trim(), category: cat, date: newDate, time: editTime, sessionId: linkId } : x)));
      setEvents([...events, { id: uid(), date: newDate, title: editText.trim(), time: editTime, note: "", sessionId: linkId, category: cat }]);
    } else {
      setTasks(tasks.map((x) => (x.id === t.id ? { ...x, text: editText.trim(), category: cat, date: newDate, time: editTime } : x)));
      if (t.sessionId) {
        setEvents(events.map((e) => (e.sessionId === t.sessionId ? { ...e, title: editText.trim(), date: newDate, time: editTime } : e)));
      }
    }
    setEditingId(null);
  };

  const shown = tasks.filter((t) => t.date === filterDate);
  const doneCount = shown.filter((t) => t.done).length;
  const allSorted = [...tasks].filter((t) => t.date).sort((a, b) => a.date.localeCompare(b.date));
  const backlog = tasks.filter((t) => !t.date);

  const renderRow = (t, showDate, reorderCtx) => {
    if (editingId === t.id) {
      return (
        <div key={t.id} className="list-row task-edit-row">
          <input className="input" value={editText} onChange={(e) => setEditText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveEdit(t)} autoFocus />
          <select className="select" value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
            {TASK_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <input className="input input-date" type="date" value={editDate || ""} onChange={(e) => setEditDate(e.target.value)} />
          <input className="input input-time" type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
          <button className="icon-btn" onClick={() => saveEdit(t)}><Check size={14} /></button>
          <button className="icon-btn" onClick={cancelEdit}><X size={14} /></button>
        </div>
      );
    }
    const badge = taskBadge(t);
    const BadgeIcon = badge.icon;
    return (
      <div
        key={t.id}
        className={"list-row" + (reorderCtx && dragTaskId === t.id ? " exercise-block-dragging" : "")}
        draggable={!!reorderCtx}
        onDragStart={reorderCtx ? () => setDragTaskId(t.id) : undefined}
        onDragOver={reorderCtx ? (e) => e.preventDefault() : undefined}
        onDrop={reorderCtx ? (e) => { e.preventDefault(); if (dragTaskId) moveTaskDrag(dragTaskId, t.id, reorderCtx.list); setDragTaskId(null); } : undefined}
        onDragEnd={reorderCtx ? () => setDragTaskId(null) : undefined}
      >
        {reorderCtx && <span className="drag-handle" title="Arrastra para reordenar"><GripVertical size={15} /></span>}
        {reorderCtx && (
          <div className="reorder-btns">
            <button type="button" className="icon-btn" disabled={reorderCtx.idx === 0} onClick={() => moveTask(t.id, "up", reorderCtx.list)}><ChevronUp size={13} /></button>
            <button type="button" className="icon-btn" disabled={reorderCtx.idx === reorderCtx.list.length - 1} onClick={() => moveTask(t.id, "down", reorderCtx.list)}><ChevronDown size={13} /></button>
          </div>
        )}
        <button className={"check" + (t.done ? " check-done" : "")} style={{ "--check-accent": badge.color }} onClick={() => toggle(t.id)}>
          {t.done && <Check size={12} strokeWidth={3} />}
        </button>
        {showDate && t.date && <span className="mono-tag">{fmtDateShort(t.date)}</span>}
        {t.time && <span className="mono-tag">{t.time}</span>}
        <span className="event-type-badge" style={{ background: badge.bg, color: badge.color }}>
          <BadgeIcon size={11} strokeWidth={2.5} />{badge.label}
        </span>
        <span className={"list-text" + (t.done ? " list-text-done" : "")} style={{ cursor: "pointer" }} onClick={() => setDetailId(t.id)}>{t.text}</span>
        {!t.date && <DatePicker value={todayStr()} onChange={(d) => assignDate(t, d)} accent={badge.color} label="Asignar fecha" />}
        <button className="icon-btn" onClick={() => duplicateTask(t)} title="Duplicar"><Copy size={13} /></button>
        <button className="icon-btn" onClick={() => startEdit(t)}><Pencil size={13} /></button>
        <button className="icon-btn" onClick={() => removeTask(t)}><Trash2 size={14} /></button>
      </div>
    );
  };

  const detailTask = detailId ? tasks.find((t) => t.id === detailId) : null;
  const saveDescription = (desc) => {
    setTasks(tasks.map((t) => (t.id === detailId ? { ...t, description: desc } : t)));
    if (detailTask?.sessionId) {
      setEvents(events.map((e) => (e.sessionId === detailTask.sessionId ? { ...e, description: desc } : e)));
    }
    setDetailId(null);
  };

  return (
    <Page title="Tareas" subtitle="Lo que toca hoy, sin dar vueltas.">
      <Card className="form-card">
        <div className="form-row">
          <input className="input" placeholder="Añade una tarea…" value={text}
            onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
            {TASK_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          {!noDate && <input className="input input-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
          {!noDate && <input className="input input-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />}
          <button className="btn" style={{ "--btn-accent": "var(--acc-day)" }} onClick={add}><Plus size={16} /></button>
        </div>
        <textarea className="input" placeholder="Descripción (obligatoria)…" value={description}
          onChange={(e) => setDescription(e.target.value)} style={{ width: "100%", minHeight: 44, resize: "vertical", marginBottom: 10 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-soft)", cursor: "pointer" }}>
          <input type="checkbox" checked={noDate} onChange={(e) => setNoDate(e.target.checked)} />
          Sin fecha (va al backlog)
        </label>
        {formError && <p className="form-error" style={{ marginBottom: 0, marginTop: 8 }}>{formError}</p>}
      </Card>

      <div className="date-switch">
        <button className="chip" onClick={() => setFilterDate(shiftDate(filterDate, -1))}><ChevronLeft size={14} /></button>
        <span className="chip-label">{fmtDate(filterDate)}{filterDate === todayStr() ? " · hoy" : ""}{shown.length ? ` · ${doneCount}/${shown.length}` : ""}</span>
        <button className="chip" onClick={() => setFilterDate(shiftDate(filterDate, 1))}><ChevronRight size={14} /></button>
      </div>

      {shown.length === 0 ? (
        <Empty text="No hay tareas para este día. Añade la primera arriba." />
      ) : (
        <div className="list-card">
          {shown.map((t, idx) => renderRow(t, false, { idx, list: shown }))}
        </div>
      )}

      <div className="section-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setBacklogOpen(!backlogOpen)}>
        <span>Backlog · sin fecha ({backlog.length})</span>
        {backlogOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>
      {backlogOpen && (
        backlog.length === 0 ? (
          <Empty text="No tienes tareas pendientes de fecha." />
        ) : (
          <div className="list-card">
            {backlog.map((t) => renderRow(t, false))}
          </div>
        )
      )}

      <div className="section-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setAllOpen(!allOpen)}>
        <span>Todas las tareas ({allSorted.length})</span>
        {allOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>
      {allOpen && (
        allSorted.length === 0 ? (
          <Empty text="Todavía no tienes ninguna tarea." />
        ) : (
          <div className="list-card">
            {allSorted.map((t) => renderRow(t, true))}
          </div>
        )
      )}

      {detailTask && (
        <TaskDetailModal item={{ ...detailTask, title: detailTask.text }} gym={gym} onClose={() => setDetailId(null)} onSaveDescription={saveDescription} />
      )}
    </Page>
  );
}
function shiftDate(d, delta) {
  const date = new Date(d + "T00:00:00");
  date.setDate(date.getDate() + delta);
  return dateToStr(date);
}

// ---------- Calendario ----------
function Calendario({ events, setEvents, tasks, setTasks, gym, onDeleteSession, onRemoveEvent }) {
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selected, setSelected] = useState(todayStr());
  const [detailId, setDetailId] = useState(null);

  const year = month.getFullYear(), m = month.getMonth();
  const first = new Date(year, m, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const eventsByDate = useMemo(() => {
    const map = {};
    events.forEach((e) => { (map[e.date] ||= []).push(e); });
    return map;
  }, [events]);

  const remove = (id) => onRemoveEvent(id);
  const removeEvent = (e) => (e.sessionId ? onDeleteSession(e.sessionId) : remove(e.id));
  const toggleDone = (e) => {
    const newDone = !e.done;
    setEvents(events.map((ev) => (ev.id === e.id ? { ...ev, done: newDone } : ev)));
    if (e.sessionId) {
      setTasks(tasks.map((t) => (t.sessionId === e.sessionId ? { ...t, done: newDone } : t)));
    }
  };

  const taskOrderIndex = useMemo(() => {
    const map = {};
    tasks.forEach((t, idx) => { if (t.sessionId) map[t.sessionId] = idx; });
    return map;
  }, [tasks]);
  const dayEvents = (eventsByDate[selected] || []).slice().sort((a, b) => {
    const ao = a.sessionId && taskOrderIndex[a.sessionId] !== undefined ? taskOrderIndex[a.sessionId] : Infinity;
    const bo = b.sessionId && taskOrderIndex[b.sessionId] !== undefined ? taskOrderIndex[b.sessionId] : Infinity;
    if (ao !== bo) return ao - bo;
    return (a.time || "").localeCompare(b.time || "");
  });

  return (
    <Page title="Calendario" subtitle="Vista mensual de tus eventos (créalos desde Tareas, Gimnasio, Nutrición o Viajes).">
      <Card>
        <div className="cal-head">
          <button className="chip" onClick={() => setMonth(new Date(year, m - 1, 1))}><ChevronLeft size={14} /></button>
          <span className="chip-label cal-month">{month.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}</span>
          <button className="chip" onClick={() => setMonth(new Date(year, m + 1, 1))}><ChevronRight size={14} /></button>
        </div>

        <div className="cal-grid">
          {["L", "M", "X", "J", "V", "S", "D"].map((d) => <div key={d} className="cal-dow">{d}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div key={i} className="cal-cell cal-cell-empty" />;
            const dateStr = `${year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const dayList = eventsByDate[dateStr] || [];
            const isToday = dateStr === todayStr();
            const isSel = dateStr === selected;
            const dotColor = dayList.find((e) => e.workoutTypeId) ? "var(--acc-gym)" : "var(--acc-day)";
            return (
              <button key={i} className={"cal-cell" + (isSel ? " cal-cell-sel" : "") + (isToday && !isSel ? " cal-cell-today" : "")}
                onClick={() => setSelected(dateStr)}>
                <span>{d}</span>
                {dayList.length ? <span className="cal-dot" style={{ background: isSel ? "#fff" : dotColor }} /> : null}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="cal-day-title">{fmtDate(selected)}</div>
      {dayEvents.length === 0 ? (
        <Empty text="Sin eventos este día." />
      ) : (
        <div className="list-card">
          {dayEvents.map((e) => {
            const linked = e.workoutTypeId ? ALL_TYPES[e.workoutTypeId] : null;
            const LinkedIcon = linked?.icon;
            const badge = taskBadge(e);
            const BadgeIcon = badge.icon;
            return (
              <div key={e.id} className="list-row">
                <button className={"check" + (e.done ? " check-done" : "")} style={{ "--check-accent": badge.color }} onClick={() => toggleDone(e)}>
                  {e.done && <Check size={12} strokeWidth={3} />}
                </button>
                {e.time && <span className="mono-tag">{e.time}</span>}
                <span className={"list-text" + (e.done ? " list-text-done" : "")} style={{ cursor: "pointer" }} onClick={() => setDetailId(e.id)}>{e.title}</span>
                {linked ? (
                  <span className="event-type-badge" style={{ background: "var(--acc-gym-soft)", color: "var(--acc-gym)" }}>
                    <LinkedIcon size={11} strokeWidth={2.5} />{linked.name}
                  </span>
                ) : (
                  <span className="event-type-badge" style={{ background: badge.bg, color: badge.color }}>
                    <BadgeIcon size={11} strokeWidth={2.5} />{badge.label}
                  </span>
                )}
                <button className="icon-btn" onClick={() => removeEvent(e)}><Trash2 size={14} /></button>
              </div>
            );
          })}
        </div>
      )}

      {detailId && events.find((e) => e.id === detailId) && (
        <TaskDetailModal
          item={events.find((e) => e.id === detailId)}
          gym={gym}
          onClose={() => setDetailId(null)}
          onSaveDescription={(desc) => {
            const target = events.find((e) => e.id === detailId);
            setEvents(events.map((e) => (e.id === detailId ? { ...e, description: desc } : e)));
            if (target?.sessionId && setTasks) {
              setTasks(tasks.map((t) => (t.sessionId === target.sessionId ? { ...t, description: desc } : t)));
            }
            setDetailId(null);
          }}
        />
      )}
    </Page>
  );
}

// ---------- Ahorros ----------
function goalMilestones(pct) {
  return [25, 50, 75, 100].map((m) => ({ m, reached: pct >= m }));
}
function overallMonthlyRate(movements) {
  const byMonth = {};
  movements.forEach((m) => { const mk = m.date.slice(0, 7); byMonth[mk] = (byMonth[mk] || 0) + (m.type === "in" ? m.amount : -m.amount); });
  const months = Object.keys(byMonth).sort();
  const recent = months.slice(-3);
  if (!recent.length) return null;
  return recent.reduce((a, mk) => a + byMonth[mk], 0) / recent.length;
}
function projectMonthsForGoal(goal, rate) {
  const remaining = (goal.targetAmount || 0) - (goal.allocatedAmount || 0);
  if (remaining <= 0) return 0;
  if (!rate || rate <= 0) return null;
  return Math.ceil(remaining / rate);
}
function Ahorros({ savings, setSavings, objectives, setObjectives }) {
  useEffect(() => {
    if (savings.goals) return;
    const totalSoFar = (savings.movements || []).reduce((a, m) => a + (m.type === "in" ? m.amount : -m.amount), 0);
    if (!savings.goalName && !savings.goalAmount && totalSoFar === 0) {
      setSavings({ ...savings, goals: [] });
      return;
    }
    const migratedGoal = { id: uid(), name: savings.goalName || "Mi ahorro", targetAmount: Number(savings.goalAmount) || 0, allocatedAmount: Math.max(0, totalSoFar) };
    const migratedMovements = (savings.movements || []).map((m) => ({ ...m, source: m.source || "manual" }));
    setSavings({ ...savings, goals: [migratedGoal], movements: migratedMovements });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goals = savings.goals || [];
  const movements = savings.movements || [];
  const totalPool = movements.reduce((a, m) => a + (m.type === "in" ? m.amount : -m.amount), 0);
  const totalAllocated = goals.reduce((a, g) => a + (g.allocatedAmount || 0), 0);
  const unallocated = totalPool - totalAllocated;
  const monthlyRate = overallMonthlyRate(movements);

  const [hidden, setHidden] = useState(true);
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalAmount, setNewGoalAmount] = useState("");
  const [alsoObjective, setAlsoObjective] = useState(true);
  const [formError, setFormError] = useState("");
  const [movementFor, setMovementFor] = useState(false);
  const [mType, setMType] = useState("in");
  const [mAmount, setMAmount] = useState("");
  const [mNote, setMNote] = useState("");
  const [mError, setMError] = useState("");
  const [editingMovement, setEditingMovement] = useState(null);
  const [editType, setEditType] = useState("in");
  const [editAmount, setEditAmount] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editDate, setEditDate] = useState(todayStr());

  const addGoal = () => {
    if (!newGoalName.trim()) { setFormError("Escribe el nombre de la meta antes de añadirla."); return; }
    if (!Number(newGoalAmount)) { setFormError("Escribe un importe objetivo mayor que 0."); return; }
    setFormError("");
    const newSavingsGoalId = uid();
    setSavings({ ...savings, goals: [...goals, { id: newSavingsGoalId, name: newGoalName.trim(), targetAmount: Number(newGoalAmount), allocatedAmount: 0 }] });
    if (alsoObjective && objectives && setObjectives) {
      setObjectives([...objectives, {
        id: uid(), title: `Ahorrar para ${newGoalName.trim()}`, category: "Ahorro", targetDate: "",
        actions: [{ id: uid(), name: `Reunir ${fmtEUR(Number(newGoalAmount))}`, stage: "not_started", blocked: false, blockReason: "", taskId: null, description: "" }],
        linkedSavingsGoalId: newSavingsGoalId,
      }]);
    }
    setNewGoalName(""); setNewGoalAmount("");
  };
  const removeGoal = (id) => setSavings({ ...savings, goals: goals.filter((g) => g.id !== id) });
  const setAllocated = (id, val) => {
    const n = Math.max(0, Number(val) || 0);
    setSavings({ ...savings, goals: goals.map((g) => (g.id === id ? { ...g, allocatedAmount: n } : g)) });
  };

  const addMovement = () => {
    const n = Number(mAmount);
    if (!n) { setMError("Escribe un importe mayor que 0 antes de añadirlo."); return; }
    setMError("");
    setSavings({ ...savings, movements: [...movements, { id: uid(), type: mType, amount: n, note: mNote.trim(), date: todayStr(), source: "manual" }] });
    setMAmount(""); setMNote(""); setMovementFor(false);
  };
  const removeMovement = (id) => setSavings({ ...savings, movements: movements.filter((m) => m.id !== id) });
  const startEditMovement = (m) => { setEditingMovement(m.id); setEditType(m.type); setEditAmount(m.amount); setEditNote(m.note || ""); setEditDate(m.date); };
  const saveEditMovement = (id) => {
    if (!Number(editAmount)) return;
    setSavings({ ...savings, movements: movements.map((m) => (m.id === id ? { ...m, type: editType, amount: Number(editAmount), note: editNote.trim(), date: editDate } : m)) });
    setEditingMovement(null);
  };

  const sortedMovements = [...movements].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Page title="Ahorros" subtitle="Tu fondo total, repartido entre tus metas.">
      <Card className="form-card" style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="icon-btn" style={{ background: "var(--bg)" }} onClick={() => setHidden(!hidden)} title={hidden ? "Mostrar cifras" : "Ocultar cifras"}>
          {hidden ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </Card>

      <div className="grid-2">
        <Card className="hero-card" style={{ background: "var(--acc-savings)" }}>
          <div className="hero-top"><span>Ahorros totales</span></div>
          <div className={"blur-wrap" + (hidden ? " blur-wrap-hidden" : "")}>
            <div className="hero-value" style={{ fontSize: 26 }}>{fmtEUR(totalPool)}</div>
          </div>
          <div className="hero-foot">{movementFor ? "" : ""}<button className="hero-link" onClick={() => setMovementFor(!movementFor)}>+ registrar movimiento suelto</button></div>
        </Card>
        <Card>
          <div className="stat-top">
            <span className="stat-icon" style={{ background: unallocated < 0 ? "var(--acc-gym-soft)" : "var(--primary-soft)", color: unallocated < 0 ? "var(--acc-gym)" : "var(--primary)" }}><Wallet size={16} /></span>
          </div>
          <div className={"blur-wrap" + (hidden ? " blur-wrap-hidden" : "")}>
            <div className="stat-value">{fmtEUR(unallocated)}</div>
          </div>
          <div className="stat-label">{unallocated < 0 ? "asignado de más — revisa tus metas" : "sin asignar a ninguna meta"}</div>
        </Card>
      </div>

      {movementFor && (
        <Card className="form-card">
          <div className="form-row form-row-tight">
            <div className="toggle">
              <button className={"toggle-btn" + (mType === "in" ? " toggle-btn-active" : "")} onClick={() => setMType("in")}>Ingreso</button>
              <button className={"toggle-btn" + (mType === "out" ? " toggle-btn-active" : "")} onClick={() => setMType("out")}>Retiro</button>
            </div>
            <input className="input input-amount" type="number" placeholder="Importe €" value={mAmount} onChange={(e) => setMAmount(e.target.value)} autoFocus />
            <input className="input" placeholder="Nota (opcional)" value={mNote} onChange={(e) => setMNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMovement()} />
            <button className="btn" style={{ "--btn-accent": "var(--acc-savings)" }} onClick={addMovement}><Check size={16} /></button>
            <button className="icon-btn" onClick={() => { setMovementFor(false); setMError(""); }}><X size={14} /></button>
          </div>
          {mError && <p className="form-error" style={{ margin: "4px 0 0" }}>{mError}</p>}
        </Card>
      )}

      <div className="section-heading">Repartir entre metas</div>
      <Card className="form-card">
        <div className="form-row">
          <input className="input" placeholder="Nueva meta (ej. Viaje a Japón)" value={newGoalName} onChange={(e) => setNewGoalName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addGoal()} />
          <input className={"input input-amount" + (hidden ? " blur-wrap-hidden" : "")} type="number" placeholder="Importe objetivo €" value={newGoalAmount} onChange={(e) => setNewGoalAmount(e.target.value)} />
          <button className="btn" style={{ "--btn-accent": "var(--acc-savings)" }} onClick={addGoal}><Plus size={16} /></button>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-soft)", cursor: "pointer" }}>
          <input type="checkbox" checked={alsoObjective} onChange={(e) => setAlsoObjective(e.target.checked)} />
          Crear también un objetivo en Objetivos para hacerle seguimiento
        </label>
        {formError && <p className="form-error" style={{ marginBottom: 0, marginTop: 6 }}>{formError}</p>}
      </Card>

      {goals.length === 0 ? (
        <Empty text="Añade tu primera meta de ahorro arriba." />
      ) : (
        <div className="goal-list">
          {goals.map((g) => {
            const allocated = g.allocatedAmount || 0;
            const pct = g.targetAmount ? Math.min(100, Math.max(0, (allocated / g.targetAmount) * 100)) : 0;
            const months = projectMonthsForGoal(g, monthlyRate);
            const milestones = goalMilestones(pct);
            return (
              <Card key={g.id} className="goal-card">
                <div className="goal-card-top">
                  <div>
                    <div className={"goal-card-title" + (hidden ? " blur-wrap-hidden" : "")}>{g.name}</div>
                    <div className="goal-card-meta">objetivo: <span className={hidden ? "blur-wrap-hidden" : ""}>{fmtEUR(g.targetAmount)}</span></div>
                  </div>
                  <button className="icon-btn" onClick={() => removeGoal(g.id)}><Trash2 size={14} /></button>
                </div>

                <div className={"savings-goal-body" + (hidden ? " blur-wrap-hidden" : "")}>
                  <Donut pct={pct} accent="var(--acc-savings)" label="asignado" />
                  <div>
                    <div className="donut-side-value">{fmtEUR(allocated)} <span>de {fmtEUR(g.targetAmount)}</span></div>
                    {months === 0 && <div className="stat-label">🎉 ¡Meta conseguida!</div>}
                    {months !== null && months !== undefined && months > 0 && (
                      <div className="stat-label">A tu ritmo actual de ahorro, ~{months} mes{months > 1 ? "es" : ""}</div>
                    )}
                    {months === null && <div className="stat-label">Ahorra en varios meses para ver una previsión.</div>}
                  </div>
                </div>

                <div className="milestone-row">
                  {milestones.map(({ m, reached }) => (
                    <span key={m} className={"milestone-badge" + (reached ? " milestone-badge-done" : "")}>{m}%</span>
                  ))}
                </div>

                <div className="form-row form-row-tight" style={{ marginBottom: 0 }}>
                  <span className="stat-label" style={{ flexShrink: 0 }}>Asignado</span>
                  <input className={"input input-amount" + (hidden ? " blur-wrap-hidden" : "")} type="number" min="0" value={g.allocatedAmount || 0} onChange={(e) => setAllocated(g.id, e.target.value)} />
                  <button className="link-btn" onClick={() => setAllocated(g.id, allocated + Math.max(0, unallocated))}>Asignar todo lo que sobra</button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="section-heading">Movimientos del fondo total</div>
      {sortedMovements.length === 0 ? (
        <Empty text="Todavía no hay movimientos registrados." />
      ) : (
        <div className="list-card">
          {sortedMovements.slice(0, 15).map((m) => {
            if (editingMovement === m.id) {
              return (
                <div key={m.id} className="list-row task-edit-row">
                  <input className="input input-date" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                  <select className="select" value={editType} onChange={(e) => setEditType(e.target.value)}>
                    <option value="in">Ingreso</option>
                    <option value="out">Retiro</option>
                  </select>
                  <input className="input input-amount" type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
                  <input className="input" placeholder="Nota" value={editNote} onChange={(e) => setEditNote(e.target.value)} />
                  <button className="icon-btn" onClick={() => saveEditMovement(m.id)}><Check size={14} /></button>
                  <button className="icon-btn" onClick={() => setEditingMovement(null)}><X size={14} /></button>
                </div>
              );
            }
            return (
              <div key={m.id} className="list-row">
                <span className="mono-tag">{fmtDateShort(m.date)}</span>
                <span className="list-text">{m.note || (m.type === "in" ? "Ingreso" : "Retiro")}</span>
                {m.source === "auto" && <span className="mono-tag">automático</span>}
                <span className={(m.type === "in" ? "amount-in" : "amount-out") + (hidden ? " blur-wrap-hidden" : "")}>{m.type === "in" ? "+" : "−"}{fmtEUR(m.amount)}</span>
                <button className="icon-btn" onClick={() => startEditMovement(m)}><Pencil size={12} /></button>
                <button className="icon-btn" onClick={() => removeMovement(m.id)}><Trash2 size={12} /></button>
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}

// ---------- Gimnasio ----------
const WEEKLY_GOAL = 4;

function TypeCard({
  id, def, kind, weekCount, monthCount, isOpen, onToggle,
  logDate, setLogDate,
  exerciseRows, updateRow, addRow, removeRow, moveRow, toggleExpand, updateSet, addSet, removeSet, onApplyRepsToAll, onApplyKgToAll, saveFuerza,
  hasLastSession, onAutofill, onAutofillRowSets, isEditingSession, isRecovering,
  cardioDuration, setCardioDuration, cardioDistance, setCardioDistance, cardioNote, setCardioNote, saveCardio,
}) {
  const [dragIndex, setDragIndex] = useState(null);
  const [customMode, setCustomMode] = useState({});
  const [quickReps, setQuickReps] = useState({});
  const [quickKg, setQuickKg] = useState({});
  const Icon = def.icon;
  const accent = kind === "fuerza" ? "var(--acc-gym)" : "var(--acc-cardio)";
  return (
    <div id={`workout-card-${id}`} className={"type-card" + (isOpen ? " type-card-open" : "") + (isRecovering ? " type-card-highlight" : "")}>
      <div className="type-banner" style={{ background: def.gradient }}>
        <Icon size={38} strokeWidth={1.6} className="type-banner-icon" />
      </div>
      <div className="type-body">
        <div className="type-name">{def.name}</div>
        {def.exercises && (
          <div className="type-exercises">
            {def.exercises.slice(0, 3).map((ex) => <span key={ex} className="type-chip">{ex}</span>)}
            {def.exercises.length > 3 && <span className="type-chip">+{def.exercises.length - 3}</span>}
          </div>
        )}
        <div className="type-counts">Semana: <strong>{weekCount}</strong> · Mes: <strong>{monthCount}</strong></div>
        <button className="type-cta" onClick={() => onToggle(id)}>
          {isOpen ? "Cerrar" : "Registrar sesión"} {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {isOpen && (
          <div className="type-logger">
            <div className="form-row">
              <DatePicker value={logDate} onChange={setLogDate} accent={accent} />
              {kind === "cardio" && (
                <input className="input input-num" type="number" placeholder="Min" value={cardioDuration} onChange={(e) => setCardioDuration(e.target.value)} />
              )}
              {kind === "fuerza" && hasLastSession && (
                <button type="button" className="link-btn" onClick={onAutofill} style={{ whiteSpace: "nowrap" }}>
                  <Repeat size={12} style={{ marginRight: 4, verticalAlign: "-2px" }} />Autocompletar con última sesión
                </button>
              )}
            </div>

            {kind === "cardio" && (
              <div className="form-row">
                <input className="input input-amount" type="number" placeholder="Km (opcional)" value={cardioDistance} onChange={(e) => setCardioDistance(e.target.value)} />
                <input className="input" placeholder="Nota (opcional)" value={cardioNote} onChange={(e) => setCardioNote(e.target.value)} />
              </div>
            )}

            {kind === "fuerza" && exerciseRows.map((r, idx) => {
              const isCustom = customMode[r.id] || (r.name !== "" && !def.exercises.includes(r.name));
              return (
              <div
                key={r.id}
                className={"exercise-block" + (dragIndex === idx ? " exercise-block-dragging" : "")}
                draggable
                onDragStart={(e) => { setDragIndex(idx); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(idx)); }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = Number(e.dataTransfer.getData("text/plain"));
                  moveRow(from, idx);
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
              >
                <div className="exercise-row-top">
                  <span className="drag-handle" title="Arrastra para reordenar"><GripVertical size={15} /></span>
                  <select
                    className="input"
                    value={isCustom ? "__custom__" : r.name}
                    onChange={(e) => {
                      if (e.target.value === "__custom__") {
                        setCustomMode({ ...customMode, [r.id]: true });
                        updateRow(r.id, { name: "" });
                      } else {
                        setCustomMode({ ...customMode, [r.id]: false });
                        updateRow(r.id, { name: e.target.value });
                      }
                    }}
                  >
                    <option value="">Elige ejercicio…</option>
                    {def.exercises.map((ex) => <option key={ex} value={ex}>{ex}</option>)}
                    <option value="__custom__">Otro…</option>
                  </select>
                  <div className="reorder-btns">
                    <button type="button" className="icon-btn" disabled={idx === 0} onClick={() => moveRow(idx, idx - 1)}><ChevronUp size={13} /></button>
                    <button type="button" className="icon-btn" disabled={idx === exerciseRows.length - 1} onClick={() => moveRow(idx, idx + 1)}><ChevronDown size={13} /></button>
                  </div>
                  {r.name && (
                    <button type="button" className="icon-btn" title="Autocompletar series con la última vez" onClick={() => onAutofillRowSets(r.id, r.name)}>
                      <Repeat size={13} />
                    </button>
                  )}
                  <button type="button" className="icon-btn" onClick={() => toggleExpand(r.id)}>
                    {r.expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <button type="button" className="icon-btn" onClick={() => removeRow(r.id)}><Trash2 size={14} /></button>
                </div>

                {isCustom && (
                  <input className="input" style={{ marginTop: 6 }} placeholder="Nombre del ejercicio" value={r.name} onChange={(e) => updateRow(r.id, { name: e.target.value })} />
                )}

                {!r.expanded && r.sets.length > 0 && (
                  <div className="exercise-summary" onClick={() => toggleExpand(r.id)}>
                    {r.sets.length} series · {r.sets.map((s) => `${s.weight || 0}kg×${s.reps || 0}`).join(", ")}
                  </div>
                )}

                {r.expanded && (
                  <div className="set-rows">
                    {r.sets.map((s, sIdx) => (
                      <div key={s.id} className="set-row">
                        <span className="set-index">S{sIdx + 1}</span>
                        <input className="input input-num" type="number" placeholder="Kg" value={s.weight} onChange={(e) => updateSet(r.id, s.id, { weight: e.target.value })} />
                        <input className="input input-num" type="number" placeholder="Reps" value={s.reps} onChange={(e) => updateSet(r.id, s.id, { reps: e.target.value })} />
                        <button type="button" className="icon-btn" onClick={() => removeSet(r.id, s.id)}><X size={13} /></button>
                      </div>
                    ))}
                    <div className="quick-reps-row">
                      <input className="input input-num" type="number" placeholder="Kg" value={quickKg[r.id] || ""} onChange={(e) => setQuickKg({ ...quickKg, [r.id]: e.target.value })} />
                      <button type="button" className="link-btn" onClick={() => onApplyKgToAll(r.id, quickKg[r.id])}>
                        Aplicar kg a todas
                      </button>
                    </div>
                    <div className="quick-reps-row">
                      <input className="input input-num" type="number" placeholder="Reps" value={quickReps[r.id] || ""} onChange={(e) => setQuickReps({ ...quickReps, [r.id]: e.target.value })} />
                      <button type="button" className="link-btn" onClick={() => onApplyRepsToAll(r.id, quickReps[r.id])}>
                        Aplicar reps a todas
                      </button>
                    </div>
                    <button type="button" className="link-btn" onClick={() => addSet(r.id)}>+ Añadir serie</button>
                  </div>
                )}
              </div>
            );})}
            {kind === "fuerza" && <button type="button" className="link-btn" onClick={addRow}>+ Añadir ejercicio</button>}

            <p className="logger-hint">Se añadirá al calendario y a tus tareas{logDate < todayStr() ? " (se marcará como completada, es una fecha pasada)" : ""}.</p>
            <button className="btn btn-wide" style={{ "--btn-accent": accent }} onClick={kind === "fuerza" ? saveFuerza : saveCardio}>{isEditingSession ? "Guardar cambios" : "Guardar sesión"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Gimnasio({ gym, setGym, events, setEvents, tasks, setTasks, onDeleteSession }) {
  const [openLogger, setOpenLogger] = useState(null); // typeId
  const [logDate, setLogDate] = useState(todayStr());
  const [exerciseRows, setExerciseRows] = useState([]);
  const [cardioDuration, setCardioDuration] = useState("");
  const [cardioDistance, setCardioDistance] = useState("");
  const [cardioNote, setCardioNote] = useState("");
  const [chartExercise, setChartExercise] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  const weekRange = useMemo(() => getWeekRange(new Date()), []);
  const monthKey = todayStr().slice(0, 7);
  const sessionsThisWeek = gym.filter((s) => isInRange(s.date, weekRange));
  const sessionsThisMonth = gym.filter((s) => s.date.slice(0, 7) === monthKey);
  const fuerzaWeek = sessionsThisWeek.filter((s) => s.kind === "fuerza");
  const fuerzaMonth = sessionsThisMonth.filter((s) => s.kind === "fuerza");
  const cardioWeek = sessionsThisWeek.filter((s) => s.kind === "cardio");
  const cardioMonth = sessionsThisMonth.filter((s) => s.kind === "cardio");
  const weekByType = countByType(sessionsThisWeek);
  const monthByType = countByType(sessionsThisMonth);
  const weekPct = Math.min(100, (fuerzaWeek.length / WEEKLY_GOAL) * 100);

  const breakdownFuerza = Object.entries(WORKOUT_LIBRARY)
    .map(([id, def]) => ({ id, def, week: weekByType[id] || 0, month: monthByType[id] || 0 }))
    .filter((b) => b.month > 0)
    .sort((a, b) => b.month - a.month);
  const breakdownCardio = Object.entries(CARDIO_LIBRARY)
    .map(([id, def]) => ({ id, def, week: weekByType[id] || 0, month: monthByType[id] || 0 }))
    .filter((b) => b.month > 0)
    .sort((a, b) => b.month - a.month);

  const lastSessionOf = (id, kind) => [...gym].filter((s) => s.kind === kind && s.typeId === id).sort((a, b) => b.date.localeCompare(a.date))[0];
  const lastSetsForExercise = (name) => {
    const sessions = [...gym].filter((s) => s.kind === "fuerza").sort((a, b) => b.date.localeCompare(a.date));
    for (const s of sessions) {
      const ex = s.exercises.find((e) => e.name === name);
      if (ex && ex.sets && ex.sets.length) return ex.sets;
    }
    return null;
  };
  const autofillRowSets = (rowId, exerciseName) => {
    const sets = lastSetsForExercise(exerciseName);
    if (!sets) return;
    setExerciseRows(exerciseRows.map((r) => (r.id === rowId
      ? { ...r, expanded: true, sets: sets.map((s) => ({ id: uid(), reps: s.reps || "", weight: s.weight || "" })) }
      : r)));
  };

  const makeDefaultSets = () => Array.from({ length: 4 }, () => ({ id: uid(), reps: "", weight: "" }));
  const rowsFromSession = (session) => session.exercises.map((e) => ({
    id: uid(), name: e.name, expanded: false,
    sets: (e.sets || []).map((s) => ({ id: uid(), reps: s.reps || "", weight: s.weight || "" })),
  }));

  // ---- recuperación de tareas de gimnasio sin sesión guardada ----
  const [recoverTarget, setRecoverTarget] = useState(null); // { sessionId, typeId, date }
  const orphanLinks = useMemo(() => {
    const seen = new Set();
    return tasks
      .filter((t) => t.sessionId && !gym.some((s) => s.id === t.sessionId))
      .map((t) => ({ ...t, workoutTypeId: t.workoutTypeId || guessTypeIdFromName(t.text) }))
      .filter((t) => t.workoutTypeId)
      .filter((t) => { if (seen.has(t.sessionId)) return false; seen.add(t.sessionId); return true; })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [tasks, gym]);

  // Grupos de sesiones que comparten fecha + tipo + clase — candidatas a duplicado.
  // No se borra nada solo; se te enseñan agrupadas para que decidas tú cuál(es) sobran.
  const duplicateGroups = useMemo(() => {
    const groups = {};
    gym.forEach((s) => {
      const key = `${s.date}__${s.typeId}__${s.kind}`;
      (groups[key] ||= []).push(s);
    });
    return Object.values(groups).filter((g) => g.length > 1).sort((a, b) => b[0].date.localeCompare(a[0].date));
  }, [gym]);
  const [auditOpen, setAuditOpen] = useState(false);

  const scrollToCard = (typeId) => {
    setTimeout(() => {
      document.getElementById(`workout-card-${typeId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  };
  const startRecover = (orphan) => {
    const typeId = orphan.workoutTypeId;
    const kind = ALL_TYPES[typeId]?.kind || "fuerza";
    setRecoverTarget({ sessionId: orphan.sessionId, typeId, date: orphan.date });
    setOpenLogger(typeId);
    setLogDate(orphan.date);
    if (kind === "fuerza") {
      const last = lastSessionOf(typeId, "fuerza");
      setExerciseRows(last ? rowsFromSession(last) : WORKOUT_LIBRARY[typeId].exercises.slice(0, 5).map((name) => ({ id: uid(), name, expanded: false, sets: [] })));
    } else {
      const last = lastSessionOf(typeId, "cardio");
      setCardioDuration(last ? last.duration || "" : "");
      setCardioDistance(last ? last.distance || "" : "");
      setCardioNote("");
    }
    scrollToCard(typeId);
  };
  const discardOrphan = (orphan) => onDeleteSession(orphan.sessionId);
  const reconstructOrphan = async (orphan) => {
    const typeId = orphan.workoutTypeId;
    const kind = ALL_TYPES[typeId]?.kind || "fuerza";
    let sessionObj = null;
    if (kind === "fuerza") {
      const exercises = parseFuerzaDescription(orphan.description);
      if (exercises) sessionObj = { id: orphan.sessionId, date: orphan.date, kind: "fuerza", typeId, exercises };
    } else {
      const cardio = parseCardioDescription(orphan.description);
      if (cardio) sessionObj = { id: orphan.sessionId, date: orphan.date, kind: "cardio", typeId, ...cardio };
    }
    if (!sessionObj) {
      setFillMsg(`No hay suficiente información guardada en la descripción de la tarea de ${ALL_TYPES[typeId]?.name || "gimnasio"} del ${fmtDate(orphan.date)} (probablemente se creó antes de que la app guardara ese detalle). Usa "Registrar ahora" para introducirla a mano.`);
      setTimeout(() => setFillMsg(""), 8000);
      return;
    }
    const newGym = [...gym, sessionObj];
    setGym(newGym);
    await saveKey("gym", newGym);
    setFillMsg(`✓ Sesión de ${ALL_TYPES[typeId]?.name} del ${fmtDate(orphan.date)} reconstruida desde la descripción de la tarea.`);
    setTimeout(() => setFillMsg(""), 6000);
  };

  // ---- rellenar esta semana copiando la semana pasada ----
  const [fillMsg, setFillMsg] = useState("");
  const fillThisWeekFromLastWeek = async () => {
    const today = new Date();
    const dow = (today.getDay() + 6) % 7; // 0 = lunes
    const thisMonday = new Date(today); thisMonday.setDate(today.getDate() - dow);
    const lastMonday = new Date(thisMonday); lastMonday.setDate(thisMonday.getDate() - 7);
    const lastSunday = new Date(lastMonday); lastSunday.setDate(lastMonday.getDate() + 6);
    const lastMondayStr = dateToStr(lastMonday);
    const lastSundayStr = dateToStr(lastSunday);

    const lastWeekSessions = gym.filter((s) => s.date >= lastMondayStr && s.date <= lastSundayStr);
    if (!lastWeekSessions.length) {
      setFillMsg("No encontré ninguna sesión registrada la semana pasada para copiar.");
      setTimeout(() => setFillMsg(""), 5000);
      return;
    }

    let newGym = [...gym], newEvents = [...events], newTasks = [...tasks];
    lastWeekSessions.forEach((s) => {
      const oldDayOffset = (new Date(s.date + "T00:00:00").getDay() + 6) % 7;
      const newDate = new Date(thisMonday); newDate.setDate(thisMonday.getDate() + oldDayOffset);
      const newDateStr = dateToStr(newDate);
      const sessionId = uid();
      const sessionObj = s.kind === "fuerza"
        ? { id: sessionId, date: newDateStr, kind: "fuerza", typeId: s.typeId, exercises: s.exercises.map((e) => ({ id: uid(), name: e.name, sets: e.sets.map((st) => ({ id: uid(), reps: st.reps, weight: st.weight })) })) }
        : { id: sessionId, date: newDateStr, kind: "cardio", typeId: s.typeId, duration: s.duration, distance: s.distance, note: s.note };
      newGym.push(sessionObj);
      const { event, task } = buildGymLinks(sessionId, s.typeId, newDateStr, sessionSummary(sessionObj));
      newEvents.push(event); newTasks.push(task);
    });
    setGym(newGym);
    await saveKey("gym", newGym);
    setEvents(newEvents);
    setTasks(newTasks);
    setFillMsg(`✓ Copiadas ${lastWeekSessions.length} sesión${lastWeekSessions.length > 1 ? "es" : ""} de la semana pasada a esta semana (mismo día, mismos ejercicios y pesos). Puedes editarlas cuando quieras.`);
    setTimeout(() => setFillMsg(""), 6500);
  };


  // ---- editar una sesión ya guardada ----
  const [editingSessionId, setEditingSessionId] = useState(null);
  const editSession = (session) => {
    const typeId = session.typeId;
    setRecoverTarget(null);
    setEditingSessionId(session.id);
    setOpenLogger(typeId);
    setLogDate(session.date);
    if (session.kind === "fuerza") {
      setExerciseRows(rowsFromSession(session));
    } else {
      setCardioDuration(session.duration || "");
      setCardioDistance(session.distance || "");
      setCardioNote(session.note || "");
    }
    scrollToCard(typeId);
  };
  const cancelEditSession = () => { setEditingSessionId(null); setOpenLogger(null); };

  const openFuerza = (id) => {
    setRecoverTarget(null);
    setEditingSessionId(null);
    if (openLogger === id) { setOpenLogger(null); return; }
    setOpenLogger(id);
    setLogDate(todayStr());
    const last = lastSessionOf(id, "fuerza");
    if (last) {
      setExerciseRows(rowsFromSession(last));
    } else {
      setExerciseRows(WORKOUT_LIBRARY[id].exercises.slice(0, 5).map((name) => ({ id: uid(), name, expanded: false, sets: [] })));
    }
  };
  const autofillLast = () => {
    const last = lastSessionOf(openLogger, "fuerza");
    if (last) setExerciseRows(rowsFromSession(last));
  };
  const openCardio = (id) => {
    setRecoverTarget(null);
    setEditingSessionId(null);
    if (openLogger === id) { setOpenLogger(null); return; }
    setOpenLogger(id);
    setLogDate(todayStr());
    const last = lastSessionOf(id, "cardio");
    setCardioDuration(last ? last.duration || "" : "");
    setCardioDistance(last ? last.distance || "" : "");
    setCardioNote("");
  };
  const updateRow = (id, patch) => setExerciseRows(exerciseRows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addRow = () => setExerciseRows([...exerciseRows, { id: uid(), name: "", expanded: false, sets: [] }]);
  const removeRow = (id) => setExerciseRows(exerciseRows.filter((r) => r.id !== id));
  const moveRow = (fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= exerciseRows.length || fromIdx === toIdx) return;
    const rows = [...exerciseRows];
    const [moved] = rows.splice(fromIdx, 1);
    rows.splice(toIdx, 0, moved);
    setExerciseRows(rows);
  };
  const toggleExpand = (id) => setExerciseRows(exerciseRows.map((r) => {
    if (r.id !== id) return r;
    const willOpen = !r.expanded;
    return { ...r, expanded: willOpen, sets: willOpen && r.sets.length === 0 ? makeDefaultSets() : r.sets };
  }));
  const updateSet = (rowId, setId, patch) => setExerciseRows(exerciseRows.map((r) => (
    r.id === rowId ? { ...r, sets: r.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) } : r
  )));
  const addSet = (rowId) => setExerciseRows(exerciseRows.map((r) => (
    r.id === rowId ? { ...r, sets: [...r.sets, { id: uid(), reps: "", weight: "" }] } : r
  )));
  const removeSet = (rowId, setId) => setExerciseRows(exerciseRows.map((r) => (
    r.id === rowId ? { ...r, sets: r.sets.filter((s) => s.id !== setId) } : r
  )));
  const applyRepsToAll = (rowId, reps) => {
    if (reps === "" || reps === undefined) return;
    setExerciseRows(exerciseRows.map((r) => (
      r.id === rowId ? { ...r, sets: r.sets.map((s) => ({ ...s, reps })) } : r
    )));
  };
  const applyKgToAll = (rowId, weight) => {
    if (weight === "" || weight === undefined) return;
    setExerciseRows(exerciseRows.map((r) => (
      r.id === rowId ? { ...r, sets: r.sets.map((s) => ({ ...s, weight })) } : r
    )));
  };

  const saveFuerza = async () => {
    const cleaned = exerciseRows
      .filter((r) => r.name.trim())
      .map((r) => ({
        id: r.id, name: r.name.trim(),
        sets: r.sets.filter((s) => s.reps !== "" || s.weight !== "").map((s) => ({ id: s.id, reps: Number(s.reps) || 0, weight: Number(s.weight) || 0 })),
      }))
      .filter((r) => r.sets.length > 0);
    if (!cleaned.length) return;
    const isEditing = editingSessionId && gym.some((s) => s.id === editingSessionId);
    const isRecovering = !isEditing && recoverTarget && recoverTarget.typeId === openLogger;
    const sessionId = isEditing ? editingSessionId : (isRecovering ? recoverTarget.sessionId : uid());
    const sessionObj = { id: sessionId, date: logDate, kind: "fuerza", typeId: openLogger, exercises: cleaned };
    const newGym = isEditing ? gym.map((s) => (s.id === sessionId ? sessionObj : s)) : [...gym, sessionObj];
    setGym(newGym);
    await saveKey("gym", newGym);
    const summary = sessionSummary(sessionObj);
    if (isEditing || isRecovering) {
      setEvents(events.map((e) => (e.sessionId === sessionId ? { ...e, date: logDate, description: summary } : e)));
      setTasks(tasks.map((t) => (t.sessionId === sessionId ? { ...t, date: logDate, description: summary } : t)));
    } else {
      const { event, task } = buildGymLinks(sessionId, openLogger, logDate, summary);
      setEvents([...events, event]);
      setTasks([...tasks, task]);
    }
    setFillMsg(`✓ Guardada la sesión de ${ALL_TYPES[openLogger]?.name} del ${fmtDate(logDate)} — creadas su tarea en Tareas y su evento en Calendario.`);
    setTimeout(() => setFillMsg(""), 7000);
    setRecoverTarget(null);
    setEditingSessionId(null);
    setOpenLogger(null);
  };
  const saveCardio = async () => {
    if (!cardioDuration) return;
    const isEditing = editingSessionId && gym.some((s) => s.id === editingSessionId);
    const isRecovering = !isEditing && recoverTarget && recoverTarget.typeId === openLogger;
    const sessionId = isEditing ? editingSessionId : (isRecovering ? recoverTarget.sessionId : uid());
    const cardioData = { duration: Number(cardioDuration) || 0, distance: Number(cardioDistance) || 0, note: cardioNote.trim() };
    const sessionObj = { id: sessionId, date: logDate, kind: "cardio", typeId: openLogger, ...cardioData };
    const newGym = isEditing ? gym.map((s) => (s.id === sessionId ? sessionObj : s)) : [...gym, sessionObj];
    setGym(newGym);
    await saveKey("gym", newGym);
    const summary = sessionSummary(sessionObj);
    if (isEditing || isRecovering) {
      setEvents(events.map((e) => (e.sessionId === sessionId ? { ...e, date: logDate, description: summary } : e)));
      setTasks(tasks.map((t) => (t.sessionId === sessionId ? { ...t, date: logDate, description: summary } : t)));
    } else {
      const { event, task } = buildGymLinks(sessionId, openLogger, logDate, summary);
      setEvents([...events, event]);
      setTasks([...tasks, task]);
    }
    setFillMsg(`✓ Guardada la sesión de ${ALL_TYPES[openLogger]?.name} del ${fmtDate(logDate)} — creadas su tarea en Tareas y su evento en Calendario.`);
    setTimeout(() => setFillMsg(""), 7000);
    setRecoverTarget(null);
    setEditingSessionId(null);
    setOpenLogger(null);
  };
  const removeSession = (id) => onDeleteSession(id);
  const duplicateSession = async (session) => {
    const sessionId = uid();
    const newDate = todayStr();
    const sessionObj = session.kind === "fuerza"
      ? { id: sessionId, date: newDate, kind: "fuerza", typeId: session.typeId, exercises: session.exercises.map((e) => ({ id: uid(), name: e.name, sets: e.sets.map((s) => ({ id: uid(), reps: s.reps, weight: s.weight })) })) }
      : { id: sessionId, date: newDate, kind: "cardio", typeId: session.typeId, duration: session.duration, distance: session.distance, note: session.note };
    const newGym = [...gym, sessionObj];
    setGym(newGym);
    await saveKey("gym", newGym);
    const { event, task } = buildGymLinks(sessionId, session.typeId, newDate, sessionSummary(sessionObj));
    setEvents([...events, event]);
    setTasks([...tasks, task]);
    setFillMsg(`✓ Duplicada la sesión de ${ALL_TYPES[session.typeId]?.name || "gimnasio"} para hoy (${fmtDate(newDate)}).`);
    setTimeout(() => setFillMsg(""), 5000);
  };

  const exerciseNames = useMemo(() => {
    const set = new Set();
    gym.filter((s) => s.kind === "fuerza").forEach((s) => s.exercises.forEach((e) => set.add(e.name)));
    return [...set];
  }, [gym]);
  const activeChartExercise = chartExercise || exerciseNames[0] || "";
  const chartData = gym
    .filter((s) => s.kind === "fuerza")
    .flatMap((s) => s.exercises.filter((e) => e.name === activeChartExercise).map((e) => ({
      date: s.date, peso: e.sets && e.sets.length ? Math.max(...e.sets.map((st) => st.weight || 0)) : 0,
    })))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ date: fmtDateShort(d.date), peso: d.peso }));

  const historySorted = [...gym].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Page title="Gimnasio" subtitle="Fuerza mínimo 4 días por semana, cardio aparte.">
      <Card className="form-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div className="stat-label">Herramientas rápidas</div>
        <button className="link-btn" onClick={fillThisWeekFromLastWeek}>
          <Repeat size={12} style={{ marginRight: 4, verticalAlign: "-2px" }} />Rellenar esta semana con la semana pasada
        </button>
      </Card>
      {fillMsg && <p className="logger-hint" style={{ marginTop: -8 }}>{fillMsg}</p>}

      {editingSessionId && (
        <Card style={{ border: "1px solid var(--primary)" }}>
          <div className="chart-title" style={{ color: "var(--primary)" }}>✎ Editando una sesión guardada</div>
          <p className="logger-hint" style={{ margin: "4px 0 8px" }}>Modifica los datos en la tarjeta abierta más abajo y pulsa "Guardar cambios".</p>
          <button className="link-btn" onClick={cancelEditSession}>Cancelar edición</button>
        </Card>
      )}

      {recoverTarget && (
        <Card style={{ border: "1px solid var(--acc-gym)" }}>
          <div className="chart-title" style={{ color: "var(--acc-gym)" }}>📝 Completando sesión de {ALL_TYPES[recoverTarget.typeId]?.name} · {fmtDate(recoverTarget.date)}</div>
          <p className="logger-hint" style={{ margin: "4px 0 8px" }}>
            Rellena los ejercicios en la tarjeta resaltada más abajo y pulsa "Guardar sesión". No toques otras tarjetas mientras tanto o se cancelará esto.
          </p>
          <div className="form-row" style={{ marginBottom: 0 }}>
            <button className="link-btn" onClick={() => scrollToCard(recoverTarget.typeId)}>Ir a la tarjeta</button>
            <button className="link-btn" onClick={() => { setRecoverTarget(null); setOpenLogger(null); }}>Cancelar</button>
          </div>
        </Card>
      )}

      {duplicateGroups.length > 0 && (
        <Card style={{ border: "1px solid var(--acc-work)" }}>
          <div className="chart-title" style={{ marginBottom: 6, color: "var(--acc-work)" }}>
            ⚠ {duplicateGroups.length} posible{duplicateGroups.length > 1 ? "s" : ""} grupo{duplicateGroups.length > 1 ? "s" : ""} de sesiones duplicadas
          </div>
          <p className="logger-hint" style={{ margin: "0 0 10px" }}>
            Mismo día y mismo tipo de entreno registrados más de una vez (probablemente de alguna recuperación anterior). No se borra nada solo — revisa y elimina tú las que sobren.
          </p>
          {duplicateGroups.map((group, gi) => (
            <div key={gi} className="list-card" style={{ marginBottom: 10 }}>
              {group.map((s) => {
                const def = ALL_TYPES[s.typeId];
                const Icon = def?.icon;
                const summary = s.kind === "fuerza"
                  ? `${s.exercises?.length || 0} ejercicios`
                  : `${s.duration || 0} min`;
                return (
                  <div key={s.id} className="list-row">
                    <span className="mono-tag">{fmtDateShort(s.date)}</span>
                    {Icon && <Icon size={13} style={{ color: "var(--ink-soft)", flexShrink: 0 }} />}
                    <span className="list-text">{def?.name} · {summary}</span>
                    <button className="link-btn" onClick={() => editSession(s)}>Ver</button>
                    <button className="icon-btn" onClick={() => removeSession(s.id)}><Trash2 size={14} /></button>
                  </div>
                );
              })}
            </div>
          ))}
        </Card>
      )}

      {orphanLinks.length > 0 && (
        <Card style={{ border: "1px solid var(--acc-gym)" }}>
          <div className="chart-title" style={{ marginBottom: 6, color: "var(--acc-gym)" }}>⚠ Tienes {orphanLinks.length} tarea{orphanLinks.length > 1 ? "s" : ""} de gimnasio sin sesión guardada</div>
          <p className="logger-hint" style={{ margin: "0 0 10px" }}>Aparecen en el calendario y en tareas, pero la sesión (ejercicios/series) no está guardada en Gimnasio. Prueba primero "Reconstruir desde tarea" (usa la descripción guardada); si no hay datos suficientes, regístrala a mano.</p>
          <div className="list-card" style={{ boxShadow: "none", padding: "0 0" }}>
            {orphanLinks.map((o) => {
              const def = ALL_TYPES[o.workoutTypeId];
              const OIcon = def?.icon;
              return (
                <div key={o.sessionId} className="list-row">
                  <span className="mono-tag">{fmtDateShort(o.date)}</span>
                  {OIcon && <OIcon size={13} style={{ color: "var(--ink-soft)", flexShrink: 0 }} />}
                  <span className="list-text">{def?.name || "Entreno"}</span>
                  <button className="link-btn" onClick={() => reconstructOrphan(o)}>Reconstruir desde tarea</button>
                  <button className="link-btn" onClick={() => startRecover(o)}>Registrar a mano</button>
                  <button className="icon-btn" onClick={() => discardOrphan(o)}><Trash2 size={14} /></button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid-2">
        <Card className="hero-card" style={{ background: "var(--acc-gym)" }}>
          <div className="hero-top"><span>Fuerza esta semana</span><span className="hero-pill"><Dumbbell size={13} /></span></div>
          <div className="hero-value">{fuerzaWeek.length}<span className="hero-value-sub">/{WEEKLY_GOAL}</span></div>
          <div className="progress-track" style={{ background: "rgba(255,255,255,0.3)", marginTop: 10 }}>
            <div className="progress-fill" style={{ width: weekPct + "%", background: "#fff" }} />
          </div>
          <div className="hero-foot">{fuerzaWeek.length >= WEEKLY_GOAL ? "¡Meta semanal cumplida! 💪" : `Te faltan ${WEEKLY_GOAL - fuerzaWeek.length} para tu meta`}</div>
        </Card>
        <Card>
          <div className="stat-top">
            <span className="stat-icon" style={{ background: "var(--acc-gym-soft)", color: "var(--acc-gym)" }}><Flame size={16} /></span>
          </div>
          <div className="stat-value">{fuerzaMonth.length}</div>
          <div className="stat-label">sesiones de fuerza este mes</div>
          <button className="stat-cta" onClick={() => setAuditOpen(!auditOpen)}>{auditOpen ? "Ocultar lista" : "Ver las " + fuerzaMonth.length}</button>
        </Card>
      </div>

      {auditOpen && (
        <Card>
          <div className="chart-title" style={{ marginBottom: 10 }}>Sesiones de fuerza de este mes ({fuerzaMonth.length})</div>
          {fuerzaMonth.length === 0 ? (
            <Empty text="No hay ninguna." />
          ) : (
            <div className="list-card">
              {[...fuerzaMonth].sort((a, b) => b.date.localeCompare(a.date)).map((s) => {
                const def = ALL_TYPES[s.typeId];
                const Icon = def?.icon;
                return (
                  <div key={s.id} className="list-row">
                    <span className="mono-tag">{fmtDateShort(s.date)}</span>
                    {Icon && <Icon size={13} style={{ color: "var(--ink-soft)", flexShrink: 0 }} />}
                    <span className="list-text">{def?.name} · {s.exercises?.length || 0} ejercicios · id: {s.id}</span>
                    <button className="link-btn" onClick={() => editSession(s)}>Ver</button>
                    <button className="icon-btn" onClick={() => removeSession(s.id)}><Trash2 size={14} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      <div className="grid-2">
        <Card className="hero-card" style={{ background: "var(--acc-cardio)" }}>
          <div className="hero-top"><span>Cardio esta semana</span><span className="hero-pill"><Waves size={13} /></span></div>
          <div className="hero-value">{cardioWeek.length}</div>
          <div className="hero-foot">sesiones de cardio, no cuentan como fuerza</div>
        </Card>
        <Card>
          <div className="stat-top">
            <span className="stat-icon" style={{ background: "var(--acc-cardio-soft)", color: "var(--acc-cardio)" }}><Flame size={16} /></span>
          </div>
          <div className="stat-value">{cardioMonth.length}</div>
          <div className="stat-label">sesiones de cardio este mes</div>
        </Card>
      </div>

      {breakdownFuerza.length > 0 && (
        <Card>
          <div className="chart-title" style={{ marginBottom: 10 }}>Desglose de fuerza</div>
          <div className="breakdown-list">
            {breakdownFuerza.map((b) => {
              const Icon = b.def.icon;
              return (
                <div key={b.id} className="breakdown-row">
                  <span className="breakdown-dot" style={{ background: b.def.gradient }} />
                  <Icon size={14} style={{ color: "var(--ink-soft)" }} />
                  <span className="breakdown-name">{b.def.name}</span>
                  <span className="breakdown-count">{b.week} sem · {b.month} mes</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {breakdownCardio.length > 0 && (
        <Card>
          <div className="chart-title" style={{ marginBottom: 10 }}>Desglose de cardio</div>
          <div className="breakdown-list">
            {breakdownCardio.map((b) => {
              const Icon = b.def.icon;
              return (
                <div key={b.id} className="breakdown-row">
                  <span className="breakdown-dot" style={{ background: b.def.gradient }} />
                  <Icon size={14} style={{ color: "var(--ink-soft)" }} />
                  <span className="breakdown-name">{b.def.name}</span>
                  <span className="breakdown-count">{b.week} sem · {b.month} mes</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="section-heading">Fuerza</div>
      <div className="type-grid">
        {Object.entries(WORKOUT_LIBRARY).map(([id, def]) => (
          <TypeCard key={id} id={id} def={def} kind="fuerza" weekCount={weekByType[id] || 0} monthCount={monthByType[id] || 0}
            isOpen={openLogger === id} onToggle={openFuerza}
            logDate={logDate} setLogDate={setLogDate}
            exerciseRows={exerciseRows} updateRow={updateRow} addRow={addRow} removeRow={removeRow} moveRow={moveRow}
            toggleExpand={toggleExpand} updateSet={updateSet} addSet={addSet} removeSet={removeSet} onApplyRepsToAll={applyRepsToAll} onApplyKgToAll={applyKgToAll} saveFuerza={saveFuerza}
            hasLastSession={!!lastSessionOf(id, "fuerza")} onAutofill={autofillLast} onAutofillRowSets={autofillRowSets}
            isEditingSession={!!editingSessionId && openLogger === id}
            isRecovering={!!recoverTarget && recoverTarget.typeId === id}
          />
        ))}
      </div>

      {exerciseNames.length > 0 && (
        <Card>
          <div className="chart-head">
            <span className="chart-title">Progreso de peso</span>
            <select className="select" value={activeChartExercise} onChange={(e) => setChartExercise(e.target.value)}>
              {exerciseNames.map((ex) => <option key={ex} value={ex}>{ex}</option>)}
            </select>
          </div>
          {chartData.length < 2 ? (
            <Empty text="Registra al menos dos sesiones de este ejercicio para ver la curva." />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--ink-soft)" fontSize={12} tickLine={false} axisLine={{ stroke: "var(--line)" }} />
                <YAxis stroke="var(--ink-soft)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, fontFamily: "Inter, sans-serif", fontSize: 12 }} />
                <Line type="monotone" dataKey="peso" stroke="var(--acc-gym)" strokeWidth={3} dot={{ r: 4, fill: "var(--acc-gym)" }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      )}

      <div className="section-heading">Cardio</div>
      <div className="type-grid">
        {Object.entries(CARDIO_LIBRARY).map(([id, def]) => (
          <TypeCard key={id} id={id} def={def} kind="cardio" weekCount={weekByType[id] || 0} monthCount={monthByType[id] || 0}
            isOpen={openLogger === id} onToggle={openCardio}
            logDate={logDate} setLogDate={setLogDate}
            cardioDuration={cardioDuration} setCardioDuration={setCardioDuration}
            cardioDistance={cardioDistance} setCardioDistance={setCardioDistance}
            cardioNote={cardioNote} setCardioNote={setCardioNote} saveCardio={saveCardio}
            isEditingSession={!!editingSessionId && openLogger === id}
            isRecovering={!!recoverTarget && recoverTarget.typeId === id}
          />
        ))}
      </div>

      <div className="section-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setHistoryOpen(!historyOpen)}>
        <span>Historial ({gym.length})</span>
        {historyOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>
      {historyOpen && (
        historySorted.length === 0 ? (
          <Empty text="Sin sesiones todavía. Registra la primera arriba." />
        ) : (
          <div className="list-card">
            {historySorted.map((s) => {
              const def = ALL_TYPES[s.typeId];
              const Icon = def?.icon;
              const summary = s.kind === "fuerza"
                ? `${s.exercises.length} ejercicios · ${s.exercises.reduce((a, e) => a + (e.sets?.length || 0), 0)} series`
                : `${s.duration} min${s.distance ? ` · ${s.distance} km` : ""}`;
              return (
                <div key={s.id} className="list-row">
                  <span className="mono-tag">{fmtDateShort(s.date)}</span>
                  {Icon && <Icon size={13} style={{ color: "var(--ink-soft)", flexShrink: 0 }} />}
                  <span className="list-text">{def?.name || "—"} · {summary}</span>
                  <button className="icon-btn" onClick={() => duplicateSession(s)} title="Duplicar para hoy"><Copy size={13} /></button>
                  <button className="icon-btn" onClick={() => editSession(s)}><Pencil size={13} /></button>
                  <button className="icon-btn" onClick={() => removeSession(s.id)}><Trash2 size={14} /></button>
                </div>
              );
            })}
          </div>
        )
      )}
    </Page>
  );
}

// ---------- Objetivos ----------
const CATEGORIES = ["Personal", "Profesional", "Salud", "Aprendizaje", "Ahorro", "Otro"];
const ACTION_STAGES = [
  { id: "ideas", label: "Ideas" },
  { id: "not_started", label: "Not started" },
  { id: "started", label: "Started" },
  { id: "done", label: "Done" },
];
function goalProgress(g) {
  const backlog = (g.actions || []).filter((a) => a.stage !== "ideas");
  if (!backlog.length) return 0;
  const done = backlog.filter((a) => a.stage === "done").length;
  return Math.round((done / backlog.length) * 100);
}

function GoalBoard({ goal, onUpdateActions, onClose, tasks, setTasks, events, setEvents, hidden }) {
  const actions = goal.actions || [];
  const [newAction, setNewAction] = useState("");
  const [blockDraftId, setBlockDraftId] = useState(null);
  const [blockDraftText, setBlockDraftText] = useState("");
  const [descDraftId, setDescDraftId] = useState(null);
  const [descDraftText, setDescDraftText] = useState("");
  const [formError, setFormError] = useState("");
  const backlog = actions.filter((a) => a.stage !== "ideas");
  const doneCount = backlog.filter((a) => a.stage === "done").length;

  const setActions = (newActions) => onUpdateActions(goal.id, newActions);
  const addAction = () => {
    if (!newAction.trim()) { setFormError("Escribe el nombre de la acción antes de añadirla."); return; }
    setFormError("");
    setActions([...actions, { id: uid(), name: newAction.trim(), stage: "ideas", blocked: false, blockReason: "", taskId: null, description: "" }]);
    setNewAction("");
  };
  const startDesc = (a) => { setDescDraftId(a.id); setDescDraftText(a.description || ""); };
  const saveDesc = (id) => {
    setActions(actions.map((a) => (a.id === id ? { ...a, description: descDraftText.trim() } : a)));
    setDescDraftId(null); setDescDraftText("");
  };
  const removeAction = (id) => setActions(actions.filter((a) => a.id !== id));
  const moveStage = (id, dir) => {
    setActions(actions.map((a) => {
      if (a.id !== id) return a;
      const idx = ACTION_STAGES.findIndex((s) => s.id === a.stage);
      const newIdx = dir === "left" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= ACTION_STAGES.length) return a;
      return { ...a, stage: ACTION_STAGES[newIdx].id };
    }));
  };
  const startBlock = (a) => { setBlockDraftId(a.id); setBlockDraftText(a.blockReason || ""); };
  const confirmBlock = (id) => {
    setActions(actions.map((a) => (a.id === id ? { ...a, blocked: true, blockReason: blockDraftText.trim() } : a)));
    setBlockDraftId(null); setBlockDraftText("");
  };
  const unblock = (id) => setActions(actions.map((a) => (a.id === id ? { ...a, blocked: false } : a)));
  const convertToTask = (a) => {
    const linkId = uid();
    setTasks([...tasks, { id: uid(), text: a.name, date: todayStr(), done: a.stage === "done", category: "proyectos", sessionId: linkId }]);
    setEvents([...events, { id: uid(), date: todayStr(), title: a.name, time: "", note: "", sessionId: linkId, category: "proyectos" }]);
    setActions(actions.map((x) => (x.id === a.id ? { ...x, taskId: linkId } : x)));
  };
  const assignTask = (a, taskId) => {
    if (!taskId) return;
    setActions(actions.map((x) => (x.id === a.id ? { ...x, taskId } : x)));
  };
  const unlinkTask = (a) => setActions(actions.map((x) => (x.id === a.id ? { ...x, taskId: null } : x)));

  const unlinkedTasks = tasks.filter((t) => t.date && !actions.some((a) => a.taskId === t.id));

  return (
    <>
      <div className="recipe-backdrop" onClick={onClose} />
      <div className="recipe-modal" style={{ width: "min(920px, 94vw)" }}>
        <div className="recipe-modal-head">
          <div>
            <div className={"recipe-modal-title" + (hidden ? " blur-wrap-hidden" : "")}>{goal.title}</div>
            <div className="recipe-modal-time">
              <span className={hidden ? "blur-wrap-hidden" : ""}>{doneCount}/{backlog.length} acciones completadas</span> · Ideas no cuenta para la consecución
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="form-row">
          <input className="input" placeholder="Nueva acción…" value={newAction} onChange={(e) => setNewAction(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addAction()} />
          <button className="btn" style={{ "--btn-accent": "var(--acc-goals)" }} onClick={addAction}><Plus size={16} /></button>
        </div>
        {formError && <p className="form-error">{formError}</p>}

        <div className="kanban-board">
          {ACTION_STAGES.map((stage) => {
            const stageActions = actions.filter((a) => a.stage === stage.id);
            return (
              <div key={stage.id} className="kanban-col">
                <div className="kanban-col-head"><span>{stage.label}</span><span className="mono-tag">{stageActions.length}</span></div>
                {stage.id === "ideas" && <div className="kanban-col-note">No cuenta para el objetivo</div>}
                {stageActions.map((a) => {
                  const linkedTask = a.taskId ? tasks.find((t) => t.id === a.taskId) : null;
                  return (
                    <div key={a.id} className="action-card">
                      <div className="action-card-top">
                        <span className="action-name">{a.name}</span>
                        <button className="icon-btn" onClick={() => removeAction(a.id)}><Trash2 size={12} /></button>
                      </div>

                      {a.description && descDraftId !== a.id && (
                        <p className="action-description" onClick={() => startDesc(a)}>{a.description}</p>
                      )}
                      {!a.description && descDraftId !== a.id && (
                        <button className="link-btn" onClick={() => startDesc(a)}>+ Añadir descripción</button>
                      )}
                      {descDraftId === a.id && (
                        <div style={{ marginTop: 6 }}>
                          <textarea className="input" style={{ width: "100%", minHeight: 50, resize: "vertical" }} placeholder="Descripción…" value={descDraftText} onChange={(e) => setDescDraftText(e.target.value)} autoFocus />
                          <div className="form-row" style={{ marginTop: 6, marginBottom: 0 }}>
                            <button className="link-btn" onClick={() => saveDesc(a.id)}>Guardar</button>
                            <button className="link-btn" onClick={() => setDescDraftId(null)}>Cancelar</button>
                          </div>
                        </div>
                      )}

                      {a.blocked && (
                        <div className="action-blocked-note">
                          🔒 {a.blockReason || "Bloqueada"}
                          <button className="link-btn" style={{ marginLeft: 8 }} onClick={() => unblock(a.id)}>Desbloquear</button>
                        </div>
                      )}
                      {!a.blocked && blockDraftId === a.id && (
                        <div style={{ marginTop: 6 }}>
                          <input className="input" placeholder="¿Por qué está bloqueada?" value={blockDraftText} onChange={(e) => setBlockDraftText(e.target.value)} autoFocus />
                          <div className="form-row" style={{ marginTop: 6, marginBottom: 0 }}>
                            <button className="link-btn" onClick={() => confirmBlock(a.id)}>Confirmar bloqueo</button>
                            <button className="link-btn" onClick={() => setBlockDraftId(null)}>Cancelar</button>
                          </div>
                        </div>
                      )}

                      <div className="action-move-btns">
                        <button className="icon-btn" disabled={stage.id === "ideas"} onClick={() => moveStage(a.id, "left")}><ChevronLeft size={13} /></button>
                        <button className="icon-btn" disabled={stage.id === "done"} onClick={() => moveStage(a.id, "right")}><ChevronRight size={13} /></button>
                        {!a.blocked && blockDraftId !== a.id && (
                          <button className="link-btn" onClick={() => startBlock(a)}>Bloquear</button>
                        )}
                      </div>

                      <div className="action-task-row">
                        {linkedTask ? (
                          <span className="mono-tag" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            {linkedTask.done ? <Check size={11} /> : <CheckSquare size={11} />} {linkedTask.text}
                            <button className="icon-btn" onClick={() => unlinkTask(a)}><X size={11} /></button>
                          </span>
                        ) : (
                          <>
                            <button className="link-btn" onClick={() => convertToTask(a)}>Convertir en tarea</button>
                            {unlinkedTasks.length > 0 && (
                              <select className="select" style={{ fontSize: 11, padding: "5px 8px" }} value="" onChange={(e) => assignTask(a, e.target.value)}>
                                <option value="">Asignar tarea existente…</option>
                                {unlinkedTasks.map((t) => <option key={t.id} value={t.id}>{t.text}</option>)}
                              </select>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Objetivos({ goals, setGoals, tasks, setTasks, events, setEvents }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [targetDate, setTargetDate] = useState("");
  const [openGoalId, setOpenGoalId] = useState(null);
  const [hidden, setHidden] = useState(true);
  const [formError, setFormError] = useState("");

  const add = () => {
    if (!title.trim()) { setFormError("Escribe el nombre del objetivo antes de añadirlo."); return; }
    setFormError("");
    setGoals([...goals, { id: uid(), title: title.trim(), category, targetDate, actions: [], notes: "" }]);
    setTitle(""); setTargetDate("");
  };
  const remove = (id) => setGoals(goals.filter((g) => g.id !== id));
  const updateActions = (goalId, actions) => setGoals(goals.map((g) => (g.id === goalId ? { ...g, actions } : g)));

  const sorted = [...goals].sort((a, b) => goalProgress(a) - goalProgress(b));
  const openGoal = openGoalId ? goals.find((g) => g.id === openGoalId) : null;

  return (
    <Page title="Objetivos" subtitle="Lo que quieres conseguir, con seguimiento real.">
      <Card className="form-card" style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="icon-btn" style={{ background: "var(--bg)" }} onClick={() => setHidden(!hidden)} title={hidden ? "Mostrar progreso" : "Ocultar progreso"}>
          {hidden ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </Card>
      <Card className="form-card">
        <div className="form-row">
          <input className="input" placeholder="Nuevo objetivo…" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className="input input-date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          <button className="btn" style={{ "--btn-accent": "var(--acc-goals)" }} onClick={add}><Plus size={16} /></button>
        </div>
        {formError && <p className="form-error" style={{ marginBottom: 0 }}>{formError}</p>}
      </Card>

      {sorted.length === 0 ? (
        <Empty text="Sin objetivos todavía. Define el primero arriba." />
      ) : (
        <div className="goal-list">
          {sorted.map((g) => {
            const progress = goalProgress(g);
            const backlogCount = (g.actions || []).filter((a) => a.stage !== "ideas").length;
            return (
              <Card key={g.id} className="goal-card">
                <div className="goal-card-top">
                  <div>
                    <Badge tone="goals">{g.category}</Badge>
                    <div className={"goal-card-title" + (hidden ? " blur-wrap-hidden" : "")}>{g.title}</div>
                    {g.targetDate && <div className="goal-card-meta">antes del {fmtDate(g.targetDate)}</div>}
                  </div>
                  <button className="icon-btn" onClick={() => remove(g.id)}><Trash2 size={14} /></button>
                </div>
                <div className={"progress-wrap" + (hidden ? " blur-wrap-hidden" : "")}>
                  <div className="progress-track"><div className="progress-fill" style={{ width: progress + "%", background: "var(--acc-goals)" }} /></div>
                  <div className="progress-meta">
                    <span>{backlogCount === 0 ? "Añade acciones para medir el progreso" : `${progress}% conseguido`}</span>
                  </div>
                </div>
                <button className="stat-cta" style={{ marginTop: 10 }} onClick={() => setOpenGoalId(g.id)}>
                  Ver acciones ({(g.actions || []).length})
                </button>
              </Card>
            );
          })}
        </div>
      )}

      {openGoal && (
        <GoalBoard
          goal={openGoal}
          onUpdateActions={updateActions}
          onClose={() => setOpenGoalId(null)}
          tasks={tasks} setTasks={setTasks} events={events} setEvents={setEvents}
          hidden={hidden}
        />
      )}
    </Page>
  );
}

// ---------- Hobbies ----------
const HOBBY_COLORS = ["var(--acc-hobbies)", "var(--acc-day)", "var(--acc-gym)", "var(--acc-goals)", "var(--acc-savings)"];
function hobbyStreak(h) {
  let count = 0;
  let d = new Date();
  for (let i = 0; i < 400; i++) {
    const ds = dateToStr(d);
    if ((h.sessions || []).some((s) => s.date === ds)) { count++; d.setDate(d.getDate() - 1); } else break;
  }
  return count;
}

function Hobbies({ hobbies, setHobbies, tasks, setTasks, events, setEvents }) {
  const [name, setName] = useState("");
  const [sessionFor, setSessionFor] = useState(null);
  const [duration, setDuration] = useState("");
  const [note, setNote] = useState("");
  const [sessionDate, setSessionDate] = useState(todayStr());
  const [formError, setFormError] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [editingSession, setEditingSession] = useState(null); // { hobbyId, sessionId }
  const [editDuration, setEditDuration] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editDate, setEditDate] = useState(todayStr());

  const weekRange = getWeekRange(new Date());
  const inThisWeek = (ds) => { const d = new Date(ds + "T00:00:00"); return d >= weekRange.start && d <= weekRange.end; };

  const addHobby = () => {
    if (!name.trim()) { setFormError("Escribe el nombre del hobby antes de añadirlo."); return; }
    setFormError("");
    setHobbies([...hobbies, { id: uid(), name: name.trim(), weeklyGoalMinutes: null, sessions: [] }]);
    setName("");
  };
  const removeHobby = (id) => setHobbies(hobbies.filter((h) => h.id !== id));
  const setWeeklyGoal = (id, mins) => setHobbies(hobbies.map((h) => (h.id === id ? { ...h, weeklyGoalMinutes: mins ? Number(mins) : null } : h)));

  const addSession = (h) => {
    const n = Number(duration);
    if (!n) { setSessionError("Escribe la duración en minutos antes de registrar la sesión."); return; }
    setSessionError("");
    const linkId = uid();
    const newSession = { id: uid(), duration: n, date: sessionDate, note: note.trim(), sessionId: linkId };
    setHobbies(hobbies.map((x) => (x.id === h.id ? { ...x, sessions: [...x.sessions, newSession] } : x)));
    const isPast = sessionDate <= todayStr();
    const title = `${h.name} (${n} min)`;
    setTasks([...tasks, { id: uid(), text: title, date: sessionDate, done: isPast, category: "hobbies", sessionId: linkId, description: note.trim() }]);
    setEvents([...events, { id: uid(), date: sessionDate, title, time: "", note: note.trim(), category: "hobbies", sessionId: linkId, done: isPast }]);
    setDuration(""); setNote(""); setSessionFor(null); setSessionDate(todayStr());
  };
  const deleteSession = (h, s) => {
    setHobbies(hobbies.map((x) => (x.id === h.id ? { ...x, sessions: x.sessions.filter((y) => y.id !== s.id) } : x)));
    if (s.sessionId) {
      setTasks(tasks.filter((t) => t.sessionId !== s.sessionId));
      setEvents(events.filter((e) => e.sessionId !== s.sessionId));
    }
  };
  const startEditSession = (h, s) => {
    setEditingSession({ hobbyId: h.id, sessionId: s.id });
    setEditDuration(s.duration); setEditNote(s.note || ""); setEditDate(s.date);
  };
  const saveEditSession = (h, s) => {
    if (!Number(editDuration)) return;
    const newDuration = Number(editDuration);
    const newNote = editNote.trim();
    setHobbies(hobbies.map((x) => (x.id === h.id
      ? { ...x, sessions: x.sessions.map((y) => (y.id === s.id ? { ...y, duration: newDuration, note: newNote, date: editDate } : y)) }
      : x)));
    if (s.sessionId) {
      const title = `${h.name} (${newDuration} min)`;
      setTasks(tasks.map((t) => (t.sessionId === s.sessionId ? { ...t, text: title, date: editDate, description: newNote } : t)));
      setEvents(events.map((e) => (e.sessionId === s.sessionId ? { ...e, title, date: editDate, note: newNote } : e)));
    }
    setEditingSession(null);
  };

  const weeklySeries = useMemo(() => {
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const ref = new Date();
      ref.setDate(ref.getDate() - i * 7);
      const wr = getWeekRange(ref);
      const totalMin = hobbies.reduce((a, h) => a + (h.sessions || []).filter((s) => {
        const d = new Date(s.date + "T00:00:00");
        return d >= wr.start && d <= wr.end;
      }).reduce((b, s) => b + s.duration, 0), 0);
      weeks.push({ label: wr.start.toLocaleDateString("es-ES", { day: "numeric", month: "short" }), horas: Math.round((totalMin / 60) * 10) / 10 });
    }
    return weeks;
  }, [JSON.stringify(hobbies)]);

  return (
    <Page title="Hobbies" subtitle="El tiempo que dedicas a lo que te gusta.">
      <Card className="form-card">
        <div className="form-row">
          <input className="input" placeholder="Nuevo hobby (ej. Fotografía)" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addHobby()} />
          <button className="btn" style={{ "--btn-accent": "var(--acc-hobbies)" }} onClick={addHobby}><Plus size={16} /></button>
        </div>
        {formError && <p className="form-error" style={{ marginBottom: 0 }}>{formError}</p>}
      </Card>

      {hobbies.length > 0 && (
        <Card>
          <div className="chart-title" style={{ marginBottom: 10 }}>Evolución semanal (todas las horas juntas)</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={weeklySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} width={30} />
              <Tooltip formatter={(v) => v + " h"} />
              <Line type="monotone" dataKey="horas" stroke="var(--acc-hobbies)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {hobbies.length === 0 ? (
        <Empty text="Añade tu primer hobby arriba para empezar a registrar sesiones." />
      ) : (
        <div className="goal-list">
          {hobbies.map((h, idx) => {
            const totalMin = (h.sessions || []).reduce((a, s) => a + s.duration, 0);
            const weekMin = (h.sessions || []).filter((s) => inThisWeek(s.date)).reduce((a, s) => a + s.duration, 0);
            const lastSessions = [...(h.sessions || [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
            const color = HOBBY_COLORS[idx % HOBBY_COLORS.length];
            const streak = hobbyStreak(h);
            const goalPct = h.weeklyGoalMinutes ? Math.min(100, Math.round((weekMin / h.weeklyGoalMinutes) * 100)) : null;
            return (
              <Card key={h.id} className="goal-card">
                <div className="goal-card-top">
                  <div className="hobby-title-row">
                    <span className="avatar" style={{ background: color }}>{h.name.slice(0, 1).toUpperCase()}</span>
                    <div>
                      <div className="goal-card-title">{h.name}</div>
                      <div className="goal-card-meta">{(totalMin / 60).toFixed(1)} h · {h.sessions.length} sesiones{streak > 0 ? ` · 🔥 ${streak} día${streak > 1 ? "s" : ""} seguidos` : ""}</div>
                    </div>
                  </div>
                  <button className="icon-btn" onClick={() => removeHobby(h.id)}><Trash2 size={14} /></button>
                </div>

                <div className="hobby-goal-row">
                  <span className="stat-label" style={{ flexShrink: 0 }}>Meta semanal</span>
                  <input className="input input-num" type="number" min="0" placeholder="min" value={h.weeklyGoalMinutes || ""} onChange={(e) => setWeeklyGoal(h.id, e.target.value)} />
                  <span className="stat-label" style={{ flexShrink: 0 }}>min</span>
                  {h.weeklyGoalMinutes ? <span className="mono-tag">{weekMin}/{h.weeklyGoalMinutes} min esta semana</span> : null}
                </div>
                {goalPct !== null && (
                  <div className="progress-track" style={{ marginBottom: 10 }}>
                    <div className="progress-fill" style={{ width: goalPct + "%", background: color }} />
                  </div>
                )}

                {sessionFor === h.id ? (
                  <div>
                    <div className="form-row form-row-tight">
                      <input className="input input-num" type="number" placeholder="Minutos" value={duration} onChange={(e) => setDuration(e.target.value)} autoFocus />
                      <DatePicker value={sessionDate} onChange={setSessionDate} accent="var(--acc-hobbies)" />
                      <input className="input" placeholder="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSession(h)} />
                      <button className="btn" style={{ "--btn-accent": "var(--acc-hobbies)" }} onClick={() => addSession(h)}><Check size={16} /></button>
                      <button className="icon-btn" onClick={() => { setSessionFor(null); setSessionError(""); }}><X size={14} /></button>
                    </div>
                    {sessionError && <p className="form-error" style={{ margin: "4px 0 0" }}>{sessionError}</p>}
                  </div>
                ) : (
                  <button className="link-btn" onClick={() => { setSessionFor(h.id); setSessionDate(todayStr()); }}>+ Registrar sesión</button>
                )}

                {lastSessions.length > 0 && (
                  <div className="list-card list-compact" style={{ marginTop: 10 }}>
                    {lastSessions.map((s) => {
                      if (editingSession && editingSession.hobbyId === h.id && editingSession.sessionId === s.id) {
                        return (
                          <div key={s.id} className="list-row task-edit-row">
                            <input className="input input-date" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                            <input className="input input-num" type="number" value={editDuration} onChange={(e) => setEditDuration(e.target.value)} />
                            <input className="input" placeholder="Nota" value={editNote} onChange={(e) => setEditNote(e.target.value)} />
                            <button className="icon-btn" onClick={() => saveEditSession(h, s)}><Check size={14} /></button>
                            <button className="icon-btn" onClick={() => setEditingSession(null)}><X size={14} /></button>
                          </div>
                        );
                      }
                      return (
                        <div key={s.id} className="list-row">
                          <span className="mono-tag">{fmtDateShort(s.date)}</span>
                          <span className="list-text">{s.note || "Sesión"}</span>
                          <span className="mono-tag">{s.duration} min</span>
                          <button className="icon-btn" onClick={() => startEditSession(h, s)}><Pencil size={12} /></button>
                          <button className="icon-btn" onClick={() => deleteSession(h, s)}><Trash2 size={12} /></button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </Page>
  );
}

// ---------- Viajes ----------
// Contornos aproximados de cada continente (lat, lon). No son fronteras oficiales exactas,
// son una aproximación geográfica razonable para que el mapa se reconozca a simple vista.
const CONTINENT_SHAPES = [
  {
    name: "América del Norte", labelLat: 50, labelLon: -100,
    points: [
      [71, -156], [66, -168], [61, -150], [55, -130], [48, -125], [40, -124], [32, -117],
      [23, -106], [19, -105], [16, -99], [14, -92], [13, -87], [11, -85], [9, -83], [8, -78],
      [9, -77], [11, -84], [13, -83], [16, -88], [18, -95], [21, -97],
      [25, -97], [29, -89], [25, -80], [31, -81], [35, -76],
      [41, -70], [45, -67], [47, -60], [52, -56], [58, -68], [63, -78], [68, -95], [70, -110],
      [72, -125],
    ],
  },
  {
    name: "América del Sur", labelLat: -16, labelLon: -60,
    points: [
      [12, -72], [11, -74], [4, -77], [-2, -81], [-6, -81], [-18, -70], [-23, -70], [-33, -72],
      [-42, -74], [-52, -70], [-55, -68], [-52, -62], [-38, -58], [-23, -43], [-8, -35],
      [-2, -44], [2, -50], [5, -52], [8, -60], [10, -64],
    ],
  },
  {
    name: "Europa", labelLat: 54, labelLon: 18,
    points: [
      [71, 25], [68, 20], [63, 12], [58, 6], [52, 4], [50, -5], [43, -9], [37, -9], [36, -5],
      [38, 15], [40, 18], [45, 13], [45, 14], [44, 29], [41, 29], [45, 36], [50, 40], [55, 40],
      [60, 30], [66, 25],
    ],
  },
  {
    name: "África", labelLat: 4, labelLon: 20,
    points: [
      [37, 10], [33, 10], [31, 32], [27, 34], [22, 37], [12, 43], [11, 51], [2, 45], [-1, 41],
      [-11, 40], [-18, 35], [-26, 33], [-34, 19], [-33, 18], [-29, 17], [-17, 12], [-4, 9],
      [4, 9], [6, -3], [6, -11], [15, -17], [21, -17], [28, -13], [33, -9], [35, -6],
    ],
  },
  {
    name: "Asia", labelLat: 48, labelLon: 95,
    points: [
      [77, 105], [73, 140], [66, 170], [60, 163], [52, 158], [45, 142], [35, 130], [31, 121],
      [23, 113], [10, 104], [1, 104], [8, 98], [13, 100], [21, 92], [22, 89], [20, 73], [8, 77],
      [17, 83], [25, 67], [24, 63], [27, 50], [15, 43], [29, 48], [30, 49], [37, 49], [40, 53],
      [45, 60], [45, 48], [41, 29], [44, 34], [47, 39], [52, 50], [55, 60], [60, 70], [66, 76],
      [70, 80], [73, 90],
    ],
  },
  {
    name: "Oceanía", labelLat: -25, labelLon: 135,
    points: [
      [-11, 142], [-15, 145], [-17, 146], [-24, 153], [-28, 153], [-33, 151], [-38, 147],
      [-38, 140], [-35, 137], [-32, 134], [-31, 129], [-25, 113], [-20, 114], [-16, 123],
      [-14, 126], [-12, 131],
    ],
  },
];
// Archipiélagos e islas destacadas, sin etiqueta propia (van agrupadas visualmente con el continente más próximo).
const ISLAND_SHAPES = [
  { // Indonesia (Sumatra-Java-Borneo-Sulawesi, aproximado)
    points: [[6, 95], [3, 97], [-6, 105], [-8, 114], [-8, 119], [-5, 119], [-2, 120], [1, 125], [4, 122], [7, 125], [5, 119], [1, 109], [3, 102]],
  },
  { // Filipinas
    points: [[19, 121], [18, 122], [14, 124], [10, 125], [6, 126], [5, 120], [9, 118], [13, 120], [16, 120]],
  },
  { // Japón
    points: [[45, 142], [43, 145], [38, 141], [34, 135], [31, 130], [33, 130], [35, 133], [38, 139], [41, 141]],
  },
  { // Nueva Zelanda
    points: [[-34, 173], [-37, 178], [-41, 175], [-46, 167], [-44, 171], [-40, 174]],
  },
  { // Cuba y Caribe
    points: [[23, -82], [22, -79], [20, -74], [19, -76], [20, -79], [21, -83]],
  },
];
function smoothClosedPath(pts) {
  if (pts.length < 3) return "";
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let d = `M ${mid(pts[pts.length - 1], pts[0]).join(",")} `;
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
    const m = mid(p1, p2);
    d += `Q ${p1[0]},${p1[1]} ${m[0]},${m[1]} `;
  }
  return d + "Z";
}

function WorldMap({ travel, toggleVisited }) {
  const width = 720, height = 330;
  const latTop = 75, latBottom = -58;
  const projX = (lon) => ((lon + 180) / 360) * width;
  const projY = (lat) => ((latTop - lat) / (latTop - latBottom)) * height;
  const lonLines = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];
  const latLines = [60, 30, 0, -30, -60];
  const pins = COUNTRIES.filter((c) => travel.visited[c.id] || travel.wishlist.includes(c.id));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="travel-map">
      <rect x="0" y="0" width={width} height={height} rx="16" fill="var(--bg)" />
      {lonLines.map((lon) => (
        <line key={lon} x1={projX(lon)} y1="0" x2={projX(lon)} y2={height} stroke="var(--line)" strokeWidth="1" />
      ))}
      {latLines.map((lat) => (
        <line key={lat} x1="0" y1={projY(lat)} x2={width} y2={projY(lat)} stroke="var(--line)" strokeWidth="1" />
      ))}
      <line x1="0" y1={projY(0)} x2={width} y2={projY(0)} stroke="var(--line)" strokeWidth="1.5" />
      {CONTINENT_SHAPES.map((c) => (
        <path key={c.name} d={smoothClosedPath(c.points.map(([lat, lon]) => [projX(lon), projY(lat)]))}
          fill="var(--acc-travel-soft)" stroke="var(--acc-travel)" strokeOpacity="0.3" strokeWidth="1" opacity="0.7" />
      ))}
      {ISLAND_SHAPES.map((s, i) => (
        <path key={"island-" + i} d={smoothClosedPath(s.points.map(([lat, lon]) => [projX(lon), projY(lat)]))}
          fill="var(--acc-travel-soft)" stroke="var(--acc-travel)" strokeOpacity="0.3" strokeWidth="1" opacity="0.7" />
      ))}
      {CONTINENT_SHAPES.map((c) => (
        <text key={c.name + "-label"} x={projX(c.labelLon)} y={projY(c.labelLat)} className="map-label">{c.name}</text>
      ))}
      {pins.map((c) => {
        const visited = !!travel.visited[c.id];
        return (
          <circle
            key={c.id} cx={projX(c.lon)} cy={projY(c.lat)} r={visited ? 5.5 : 4.5}
            className="map-pin"
            fill={visited ? "var(--acc-travel)" : "var(--card)"}
            stroke="var(--acc-travel)" strokeWidth="1.5"
            onClick={() => toggleVisited(c.id)}
          >
            <title>{c.name}{visited ? " · visitado" : " · en tu lista"}</title>
          </circle>
        );
      })}
    </svg>
  );
}

function Viajes({ travel, setTravel, tasks, setTasks, events, setEvents }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [wishlistPick, setWishlistPick] = useState("");
  const [planOpen, setPlanOpen] = useState(false);
  const [taskText, setTaskText] = useState("");
  const [tripFormError, setTripFormError] = useState("");
  const [taskDate, setTaskDate] = useState(todayStr());
  const [taskCreatedMsg, setTaskCreatedMsg] = useState(false);
  const [packingDate, setPackingDate] = useState(todayStr());
  const [packingTaskCreated, setPackingTaskCreated] = useState(false);

  const packing = travel.packing || {};
  const togglePacked = (item) => setTravel({ ...travel, packing: { ...packing, [item]: !packing[item] } });
  const packedCount = Object.values(packing).filter(Boolean).length;
  const totalPackingItems = Object.values(PACKING_LIST).reduce((a, arr) => a + arr.length, 0);

  const addTripTask = () => {
    if (!taskText.trim()) { setTripFormError("Escribe el texto de la tarea antes de crearla."); return; }
    setTripFormError("");
    const linkId = uid();
    setTasks([...tasks, { id: uid(), text: taskText.trim(), date: taskDate, done: false, category: "viaje", sessionId: linkId }]);
    setEvents([...events, { id: uid(), date: taskDate, title: taskText.trim(), time: "", note: "", category: "viaje", sessionId: linkId }]);
    setTaskText("");
    setTaskCreatedMsg(true);
    setTimeout(() => setTaskCreatedMsg(false), 2000);
  };
  const createPackingTask = (date) => {
    setPackingDate(date);
    const linkId = uid();
    const desc = Object.entries(PACKING_LIST).map(([cat, items]) => `${cat}: ${items.join(", ")}`).join("\n");
    setTasks([...tasks, { id: uid(), text: "Hacer maleta", date, done: false, category: "viaje", sessionId: linkId, description: desc }]);
    setEvents([...events, { id: uid(), date, title: "Hacer maleta", time: "", note: "", category: "viaje", sessionId: linkId, description: desc }]);
    setPackingTaskCreated(true);
    setTimeout(() => setPackingTaskCreated(false), 2500);
  };

  const visitedIds = Object.keys(travel.visited);
  const visitedCount = visitedIds.length;
  const continentsVisited = new Set(visitedIds.map((id) => COUNTRY_BY_ID[id]?.continent).filter(Boolean));
  const worldPct = Math.round((visitedCount / TOTAL_WORLD_COUNTRIES) * 100);

  const toggleVisited = (id) => {
    if (travel.visited[id]) {
      const rest = { ...travel.visited };
      delete rest[id];
      setTravel({ ...travel, visited: rest });
    } else {
      setTravel({ ...travel, visited: { ...travel.visited, [id]: { year: "" } }, wishlist: travel.wishlist.filter((w) => w !== id) });
    }
  };
  const updateYear = (id, year) => setTravel({ ...travel, visited: { ...travel.visited, [id]: { ...travel.visited[id], year } } });
  const addWishlist = () => {
    if (!wishlistPick || travel.visited[wishlistPick] || travel.wishlist.includes(wishlistPick)) return;
    setTravel({ ...travel, wishlist: [...travel.wishlist, wishlistPick] });
    setWishlistPick("");
  };
  const removeWishlist = (id) => setTravel({ ...travel, wishlist: travel.wishlist.filter((w) => w !== id) });

  const wishlistOptions = COUNTRIES.filter((c) => !travel.visited[c.id] && !travel.wishlist.includes(c.id));
  const visitedSorted = COUNTRIES.filter((c) => travel.visited[c.id]).sort((a, b) => a.name.localeCompare(b.name));

  const visitedCountryObjs = COUNTRIES.filter((c) => travel.visited[c.id]);
  const curiosities = useMemo(() => {
    if (visitedCountryObjs.length < 2) return null;
    let farthest = null, closest = null;
    for (let i = 0; i < visitedCountryObjs.length; i++) {
      for (let j = i + 1; j < visitedCountryObjs.length; j++) {
        const km = haversineKm(visitedCountryObjs[i], visitedCountryObjs[j]);
        const pair = { a: visitedCountryObjs[i], b: visitedCountryObjs[j], km };
        if (!farthest || km > farthest.km) farthest = pair;
        if (!closest || km < closest.km) closest = pair;
      }
    }
    const home = COUNTRY_BY_ID["es"] && travel.visited["es"] ? COUNTRY_BY_ID["es"] : null;
    let farFromHome = null;
    if (home) {
      visitedCountryObjs.forEach((c) => {
        if (c.id === home.id) return;
        const km = haversineKm(home, c);
        if (!farFromHome || km > farFromHome.km) farFromHome = { country: c, km };
      });
    }
    return { farthest, closest, farFromHome };
  }, [visitedCountryObjs.map((c) => c.id).join(",")]);

  return (
    <Page title="Viajes" subtitle="Cada país que has pisado, en el mapa.">
      <Card className="form-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14.5 }}>¿Tienes un viaje en mente?</div>
          <div className="stat-label" style={{ marginTop: 2 }}>Crea tareas y prepara la maleta sin que se te olvide nada.</div>
        </div>
        <button className="btn btn-wide" style={{ "--btn-accent": "var(--acc-travel)" }} onClick={() => setPlanOpen(true)}>
          <Plane size={15} style={{ marginRight: 6 }} />Programar viaje
        </button>
      </Card>

      <div className="grid-2">
        <Card className="hero-card" style={{ background: "var(--acc-travel)" }}>
          <div className="hero-top"><span>Países visitados</span><span className="hero-pill"><MapPin size={13} /></span></div>
          <div className="hero-value">{visitedCount}</div>
          <div className="hero-foot">≈ {worldPct}% de los {TOTAL_WORLD_COUNTRIES} países del mundo</div>
        </Card>
        <Card>
          <div className="stat-top">
            <span className="stat-icon" style={{ background: "var(--acc-travel-soft)", color: "var(--acc-travel)" }}><Globe size={16} /></span>
          </div>
          <div className="stat-value">{continentsVisited.size}<span className="hero-value-sub">/{CONTINENTS.length}</span></div>
          <div className="stat-label">continentes visitados</div>
        </Card>
      </div>

      {curiosities && (
        <Card>
          <div className="chart-title" style={{ marginBottom: 4 }}>Curiosidades</div>
          <div className="curio-list">
            <div className="curio-row">
              <span className="curio-icon"><Plane size={16} /></span>
              <div className="curio-text">
                <div className="curio-title">Distancia más larga</div>
                <div className="curio-sub">{curiosities.farthest.a.name} ↔ {curiosities.farthest.b.name}</div>
              </div>
              <div className="curio-value">
                <div className="curio-km">{Math.round(curiosities.farthest.km).toLocaleString("es-ES")} km</div>
                <div className="curio-time">✈ {fmtFlightTime(curiosities.farthest.km)}</div>
              </div>
            </div>
            <div className="curio-row">
              <span className="curio-icon"><MapPin size={16} /></span>
              <div className="curio-text">
                <div className="curio-title">Distancia más corta</div>
                <div className="curio-sub">{curiosities.closest.a.name} ↔ {curiosities.closest.b.name}</div>
              </div>
              <div className="curio-value">
                <div className="curio-km">{Math.round(curiosities.closest.km).toLocaleString("es-ES")} km</div>
                <div className="curio-time">✈ {fmtFlightTime(curiosities.closest.km)}</div>
              </div>
            </div>
            {curiosities.farFromHome && (
              <div className="curio-row">
                <span className="curio-icon"><Globe size={16} /></span>
                <div className="curio-text">
                  <div className="curio-title">Más lejos de España</div>
                  <div className="curio-sub">{curiosities.farFromHome.country.name}</div>
                </div>
                <div className="curio-value">
                  <div className="curio-km">{Math.round(curiosities.farFromHome.km).toLocaleString("es-ES")} km</div>
                  <div className="curio-time">✈ {fmtFlightTime(curiosities.farFromHome.km)}</div>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card>
        <WorldMap travel={travel} toggleVisited={toggleVisited} />
        <div className="map-legend">
          <span><i className="map-legend-dot map-legend-dot-filled" />Visitado</span>
          <span><i className="map-legend-dot" />En tu lista</span>
          <span className="map-legend-hint">Toca un punto para marcarlo como visitado</span>
        </div>
      </Card>

      {CONTINENTS.map((cont) => {
        const inContinent = COUNTRIES.filter((c) => c.continent === cont);
        const visitedHere = inContinent.filter((c) => travel.visited[c.id]).length;
        return (
          <div key={cont}>
            <div className="section-heading">{cont} <span className="section-heading-count">{visitedHere}/{inContinent.length}</span></div>
            <div className="country-grid">
              {inContinent.map((c) => {
                const isVisited = !!travel.visited[c.id];
                return (
                  <button key={c.id} className={"country-chip" + (isVisited ? " country-chip-active" : "")} onClick={() => toggleVisited(c.id)}>
                    <span className="country-flag">{flagEmoji(c.id)}</span>{c.name}
                    {isVisited && <Check size={12} strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="section-heading">
        <span className="section-heading-gym" style={{ color: "var(--acc-travel)" }}><Star size={15} strokeWidth={2.2} /> Quiero ir</span>
      </div>
      <Card className="form-card">
        <div className="form-row">
          <select className="select select-wide" value={wishlistPick} onChange={(e) => setWishlistPick(e.target.value)}>
            <option value="">Elige un país…</option>
            {wishlistOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn" style={{ "--btn-accent": "var(--acc-travel)" }} onClick={addWishlist}><Plus size={16} /></button>
        </div>
      </Card>
      {travel.wishlist.length === 0 ? (
        <Empty text="Aún no has añadido países a tu lista de deseos." />
      ) : (
        <div className="type-exercises" style={{ marginBottom: 20 }}>
          {travel.wishlist.map((id) => {
            const c = COUNTRY_BY_ID[id];
            if (!c) return null;
            return (
              <span key={id} className="wishlist-chip">
                {flagEmoji(c.id)} {c.name}
                <button className="icon-btn" onClick={() => removeWishlist(id)}><X size={12} /></button>
              </span>
            );
          })}
        </div>
      )}

      <div className="section-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setDetailsOpen(!detailsOpen)}>
        <span>Detalles de tus viajes ({visitedCount})</span>
        {detailsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>
      {detailsOpen && (
        visitedSorted.length === 0 ? (
          <Empty text="Marca países como visitados para verlos aquí." />
        ) : (
          <div className="list-card">
            {visitedSorted.map((c) => (
              <div key={c.id} className="list-row">
                <span className="country-flag">{flagEmoji(c.id)}</span>
                <span className="list-text">{c.name}</span>
                <span className="mono-tag">{c.continent}</span>
                <input className="input input-num" type="number" placeholder="Año" value={travel.visited[c.id]?.year || ""} onChange={(e) => updateYear(c.id, e.target.value)} />
              </div>
            ))}
          </div>
        )
      )}

      {planOpen && (
        <>
          <div className="recipe-backdrop" onClick={() => setPlanOpen(false)} />
          <div className="recipe-modal" style={{ width: "min(420px, 90vw)" }}>
            <div className="recipe-modal-head">
              <div className="recipe-modal-title">Programar viaje</div>
              <button className="icon-btn" onClick={() => setPlanOpen(false)}><X size={16} /></button>
            </div>

            <div className="recipe-modal-subtitle">Crear tarea de viaje</div>
            <div className="form-row">
              <input className="input" placeholder="Ej. Reservar hotel" value={taskText}
                onChange={(e) => setTaskText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTripTask()} />
              <DatePicker value={taskDate} onChange={setTaskDate} accent="var(--acc-travel)" />
              <button className="btn" style={{ "--btn-accent": "var(--acc-travel)" }} onClick={addTripTask}><Plus size={16} /></button>
            </div>
            {taskCreatedMsg && <p className="logger-hint" style={{ margin: "0 0 10px" }}>✓ Tarea creada para el {fmtDate(taskDate)}</p>}
            {tripFormError && <p className="form-error" style={{ margin: "0 0 10px" }}>{tripFormError}</p>}

            <div className="recipe-modal-subtitle" style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Hacer la bolsa</span>
              <span className="mono-tag">{packedCount}/{totalPackingItems}</span>
            </div>
            {Object.entries(PACKING_LIST).map(([cat, items]) => (
              <div key={cat} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>{cat}</div>
                <div className="country-grid">
                  {items.map((item) => (
                    <button key={item} className={"country-chip" + (packing[item] ? " country-chip-active" : "")} onClick={() => togglePacked(item)}>
                      {item}{packing[item] && <Check size={12} strokeWidth={3} />}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="form-row" style={{ marginTop: 8 }}>
              <DatePicker value={packingDate} onChange={createPackingTask} accent="var(--acc-travel)" label="Crear tarea: Hacer maleta" />
            </div>
            {packingTaskCreated && <p className="logger-hint" style={{ margin: "8px 0 0" }}>✓ Tarea "Hacer maleta" creada para el {fmtDate(packingDate)}</p>}
          </div>
        </>
      )}
    </Page>
  );
}

// ---------- Nutrición ----------
function Nutricion({ nutrition, setNutrition, pantry, setPantry, tasks, setTasks, events, setEvents }) {
  const [recipeId, setRecipeId] = useState(null);
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [shoppingItems, setShoppingItems] = useState([]);
  const [copied, setCopied] = useState(false);
  const [taskDate, setTaskDate] = useState(todayStr());
  const [taskCreated, setTaskCreated] = useState(false);
  const days = nutrition.days || {};
  const lastBySlot = nutrition.lastBySlot || {};

  const updateMeal = (day, slot, dishId) => {
    setNutrition({
      ...nutrition,
      days: { ...days, [day]: { ...(days[day] || {}), [slot]: dishId } },
      lastBySlot: { ...lastBySlot, [slot]: dishId },
    });
  };
  const clearWeek = () => setNutrition({ days: {}, lastBySlot });

  const recipe = recipeId ? MEAL_BY_ID[recipeId] : null;

  const allIngredients = useMemo(() => {
    const set = new Set(BASIC_INGREDIENTS);
    MEAL_CATALOG.forEach((m) => m.ingredients.forEach((i) => set.add(i)));
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, []);
  const togglePantry = (ing) => setPantry({ ...pantry, [ing]: !pantry[ing] });

  const buildShoppingList = () => {
    const dishIds = new Set();
    WEEK_DAYS.forEach((day) => MEAL_SLOTS.forEach((slot) => {
      const id = days[day]?.[slot.id];
      if (id) dishIds.add(id);
    }));
    const needed = new Set();
    dishIds.forEach((id) => MEAL_BY_ID[id]?.ingredients.forEach((ing) => needed.add(ing)));
    return [...needed].filter((ing) => !pantry[ing]).sort((a, b) => a.localeCompare(b, "es"));
  };
  const openShopping = () => {
    setShoppingItems(buildShoppingList());
    setShoppingOpen(true);
  };
  const removeFromList = (ing) => setShoppingItems(shoppingItems.filter((i) => i !== ing));

  const copyList = async () => {
    try {
      await navigator.clipboard.writeText(shoppingItems.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) { /* clipboard no disponible */ }
  };
  const markDone = () => {
    const newPantry = { ...pantry };
    shoppingItems.forEach((ing) => { newPantry[ing] = true; });
    setPantry(newPantry);
    setShoppingItems([]);
  };
  const createShoppingTask = (date) => {
    setTaskDate(date);
    const linkId = uid();
    const desc = shoppingItems.length ? `Lista de la compra:\n${shoppingItems.join("\n")}` : "";
    setTasks([...tasks, { id: uid(), text: "Hacer la compra", date, done: false, category: "compra", sessionId: linkId, description: desc }]);
    setEvents([...events, { id: uid(), date, title: "Hacer la compra", time: "", note: "", category: "compra", sessionId: linkId, description: desc }]);
    setTaskCreated(true);
    setTimeout(() => setTaskCreated(false), 2500);
  };
  return (
    <Page title="Nutrición" subtitle="Tu plan de comidas de la semana.">
      <Card className="form-card">
        <div className="form-row" style={{ justifyContent: "flex-end", marginBottom: 0 }}>
          <button className="link-btn" onClick={clearWeek}>Vaciar semana</button>
        </div>
      </Card>

      <div className="nutrition-grid">
        {WEEK_DAYS.map((day) => (
          <Card key={day} className="nutrition-day">
            <div className="nutrition-day-title">{day}</div>
            {MEAL_SLOTS.map((slot) => {
              const value = days[day]?.[slot.id] ?? lastBySlot[slot.id] ?? "";
              return (
                <div key={slot.id} className="nutrition-slot">
                  <label className="nutrition-slot-label">{slot.label}</label>
                  <div className="nutrition-slot-row">
                    <select className="select" style={{ flex: 1 }} value={value} onChange={(e) => updateMeal(day, slot.id, e.target.value)}>
                      <option value="">Elige…</option>
                      {MEAL_CATALOG.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    {value && (
                      <button type="button" className="icon-btn" title="Ver receta" onClick={() => setRecipeId(value)}>
                        <BookOpen size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </Card>
        ))}
      </div>

      <div className="section-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <span>Ingredientes</span>
        <button className="btn btn-wide" style={{ "--btn-accent": "var(--acc-nutrition)" }} onClick={openShopping}>
          <ShoppingCart size={15} style={{ marginRight: 6 }} />Crear lista de la compra
        </button>
      </div>
      <p className="logger-hint" style={{ margin: "-6px 0 12px" }}>Marca lo que ya tienes en casa; el resto se excluye de tu lista de la compra.</p>
      <div className="country-grid">
        {allIngredients.map((ing) => (
          <button key={ing} className={"country-chip ingredient-chip" + (pantry[ing] ? " country-chip-active" : "")} onClick={() => togglePantry(ing)}>
            {ing}
            {pantry[ing] && <Check size={12} strokeWidth={3} />}
          </button>
        ))}
      </div>

      {recipe && (
        <>
          <div className="recipe-backdrop" onClick={() => setRecipeId(null)} />
          <div className="recipe-modal">
            <div className="recipe-modal-head">
              <div>
                <div className="recipe-modal-title">{recipe.name}</div>
                <div className="recipe-modal-time">{recipe.time}</div>
              </div>
              <button className="icon-btn" onClick={() => setRecipeId(null)}><X size={16} /></button>
            </div>
            <div className="recipe-modal-subtitle">Lo que necesitas</div>
            <ul className="recipe-ingredients">
              {recipe.ingredients.map((ing) => <li key={ing}>{ing}</li>)}
            </ul>
          </div>
        </>
      )}

      {shoppingOpen && (
        <>
          <div className="recipe-backdrop" onClick={() => setShoppingOpen(false)} />
          <div className="recipe-modal">
            <div className="recipe-modal-head">
              <div>
                <div className="recipe-modal-title">Lista de la compra</div>
                <div className="recipe-modal-time">Según tu semana y lo que ya tienes</div>
              </div>
              <button className="icon-btn" onClick={() => setShoppingOpen(false)}><X size={16} /></button>
            </div>
            {shoppingItems.length === 0 ? (
              <Empty text="No hace falta comprar nada: o no has planificado comidas, o ya tienes todo marcado." />
            ) : (
              <ul className="shopping-list">
                {shoppingItems.map((ing) => (
                  <li key={ing}>
                    <span>{ing}</span>
                    <button className="icon-btn" onClick={() => removeFromList(ing)}><X size={13} /></button>
                  </li>
                ))}
              </ul>
            )}

            {shoppingItems.length > 0 && (
              <>
                <div className="form-row" style={{ marginTop: 16 }}>
                  <button className="btn btn-wide" style={{ "--btn-accent": "var(--acc-nutrition)" }} onClick={copyList}>
                    <Copy size={14} style={{ marginRight: 6 }} />{copied ? "¡Copiado!" : "Copiar"}
                  </button>
                  <DatePicker value={taskDate} onChange={createShoppingTask} accent="var(--acc-nutrition)" label="Crear tarea" />
                </div>
                {taskCreated && <p className="logger-hint" style={{ margin: "8px 0 0" }}>✓ Tarea "Compra" creada para el {fmtDate(taskDate)}</p>}
                <button className="btn btn-wide" style={{ "--btn-accent": "var(--ink)", marginTop: 10 }} onClick={markDone}>
                  <Check size={14} style={{ marginRight: 6 }} />Compra hecha
                </button>
              </>
            )}
          </div>
        </>
      )}
    </Page>
  );
}

// ---------- Gastos ----------
function monthsBetween(startMonth, currentMonth) {
  if (!startMonth) return 0;
  const [sy, sm] = startMonth.split("-").map(Number);
  const [cy, cm] = currentMonth.split("-").map(Number);
  return (cy - sy) * 12 + (cm - sm);
}
function isExpenseExpired(f) {
  if (!f.totalMonths) return false;
  return monthsBetween(f.startMonth || todayStr().slice(0, 7), todayStr().slice(0, 7)) >= f.totalMonths;
}

// Lista reutilizable de partidas fijas mensuales (se usa tanto para gastos como para ingresos fijos).
function FixedMoneyList({ items, onChange, categories, accent, addLabel, emptyText, hidden, goalOptions }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [day, setDay] = useState("1");
  const [hasInstallments, setHasInstallments] = useState(false);
  const [totalMonths, setTotalMonths] = useState("12");
  const [goalId, setGoalId] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState(categories[0]);
  const [editDay, setEditDay] = useState("1");
  const [editHasInstallments, setEditHasInstallments] = useState(false);
  const [editTotalMonths, setEditTotalMonths] = useState("12");
  const [editGoalId, setEditGoalId] = useState("");
  const [formError, setFormError] = useState("");
  const [editError, setEditError] = useState("");

  const monthKey = todayStr().slice(0, 7);
  const activeItems = items.filter((f) => !isExpenseExpired(f));
  const finished = items.filter((f) => isExpenseExpired(f));
  const sorted = [...activeItems].sort((a, b) => a.day - b.day);

  const addItem = () => {
    if (!name.trim()) { setFormError("Escribe un nombre antes de añadirlo."); return; }
    if (!Number(amount)) { setFormError("Escribe un importe mayor que 0 antes de añadirlo."); return; }
    setFormError("");
    onChange([...items, {
      id: uid(), name: name.trim(), amount: Number(amount), category, day: Number(day) || 1, active: true,
      totalMonths: hasInstallments ? Number(totalMonths) || 1 : null,
      startMonth: hasInstallments ? monthKey : null,
      goalId: goalOptions ? (goalId || null) : undefined,
    }]);
    setName(""); setAmount(""); setHasInstallments(false); setTotalMonths("12"); setGoalId("");
  };
  const toggleActive = (id) => onChange(items.map((f) => (f.id === id ? { ...f, active: !f.active } : f)));
  const removeItem = (id) => onChange(items.filter((f) => f.id !== id));
  const startEdit = (f) => {
    setEditingId(f.id);
    setEditError("");
    setEditName(f.name); setEditAmount(f.amount); setEditCategory(f.category); setEditDay(String(f.day));
    setEditHasInstallments(!!f.totalMonths); setEditTotalMonths(String(f.totalMonths || 12));
    setEditGoalId(f.goalId || "");
  };
  const saveEdit = (id) => {
    if (!editName.trim()) { setEditError("Escribe un nombre antes de guardar."); return; }
    if (!Number(editAmount)) { setEditError("Escribe un importe mayor que 0 antes de guardar."); return; }
    setEditError("");
    onChange(items.map((f) => (f.id === id ? {
      ...f, name: editName.trim(), amount: Number(editAmount), category: editCategory, day: Number(editDay) || 1,
      totalMonths: editHasInstallments ? Number(editTotalMonths) || 1 : null,
      startMonth: editHasInstallments ? (f.startMonth || monthKey) : null,
      goalId: goalOptions ? (editGoalId || null) : f.goalId,
    } : f)));
    setEditingId(null);
  };

  return (
    <>
      <Card className="form-card">
        <div className="form-row">
          <input className="input" placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input input-amount" type="number" placeholder="Importe €" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="form-row">
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className="input input-num" type="number" min="1" max="31" placeholder="Día" value={day} onChange={(e) => setDay(e.target.value)} />
          <button className="btn" style={{ "--btn-accent": accent }} onClick={addItem}><Plus size={16} /></button>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-soft)", cursor: "pointer", marginBottom: hasInstallments ? 8 : 0 }}>
          <input type="checkbox" checked={hasInstallments} onChange={(e) => setHasInstallments(e.target.checked)} />
          Tiene fecha de fin (a plazos / temporal)
        </label>
        {hasInstallments && (
          <div className="form-row" style={{ marginBottom: 0 }}>
            <span className="stat-label" style={{ flexShrink: 0 }}>Durante</span>
            <input className="input input-num" type="number" min="1" value={totalMonths} onChange={(e) => setTotalMonths(e.target.value)} />
            <span className="stat-label" style={{ flexShrink: 0 }}>meses, empezando este mes</span>
          </div>
        )}
        {goalOptions && (
          <div className="form-row" style={{ marginTop: 8, marginBottom: 0 }}>
            <span className="stat-label" style={{ flexShrink: 0 }}>Meta a la que va</span>
            <select className="select" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
              <option value="">Sin asignar (decides luego)</option>
              {goalOptions.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        )}
        {formError && <p className="form-error" style={{ marginBottom: 0, marginTop: 8 }}>{formError}</p>}
      </Card>
      {sorted.length === 0 ? (
        <Empty text={emptyText} />
      ) : (
        <div className="list-card">
          {sorted.map((f) => {
            if (editingId === f.id) {
              return (
                <div key={f.id} className="list-row-stack" style={{ padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
                  <div className="list-row task-edit-row" style={{ padding: 0, border: "none" }}>
                    <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                    <input className="input input-amount" type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
                    <select className="select" value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                      {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input className="input input-num" type="number" min="1" max="31" placeholder="Día" value={editDay} onChange={(e) => setEditDay(e.target.value)} />
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-soft)" }}>
                      <input type="checkbox" checked={editHasInstallments} onChange={(e) => setEditHasInstallments(e.target.checked)} />
                      A plazos
                    </label>
                    {editHasInstallments && (
                      <input className="input input-num" type="number" min="1" placeholder="Meses" value={editTotalMonths} onChange={(e) => setEditTotalMonths(e.target.value)} />
                    )}
                    {goalOptions && (
                      <select className="select" value={editGoalId} onChange={(e) => setEditGoalId(e.target.value)}>
                        <option value="">Sin asignar</option>
                        {goalOptions.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    )}
                    <button className="icon-btn" onClick={() => saveEdit(f.id)}><Check size={14} /></button>
                    <button className="icon-btn" onClick={() => { setEditingId(null); setEditError(""); }}><X size={14} /></button>
                  </div>
                  {editError && <p className="form-error" style={{ margin: 0 }}>{editError}</p>}
                </div>
              );
            }
            const remaining = f.totalMonths ? f.totalMonths - monthsBetween(f.startMonth, monthKey) : null;
            const goalName = goalOptions && f.goalId ? goalOptions.find((g) => g.id === f.goalId)?.name : null;
            return (
              <div key={f.id} className="list-row">
                <button className={"check" + (f.active ? " check-done" : "")} style={{ "--check-accent": accent }} onClick={() => toggleActive(f.id)} title={f.active ? "Activo" : "Pausado"}>
                  {f.active && <Check size={12} strokeWidth={3} />}
                </button>
                <span className="mono-tag">Día {f.day}</span>
                <span className={"list-text" + (!f.active ? " list-text-done" : "")}>{f.name}</span>
                <span className="event-type-badge" style={{ background: accent + "22", color: accent }}>{f.category}</span>
                {f.totalMonths && <span className="mono-tag">quedan {Math.max(0, remaining)}/{f.totalMonths} meses</span>}
                {goalOptions && <span className="mono-tag">{goalName ? "→ " + goalName : "sin meta asignada"}</span>}
                <span className={"amount-out" + (hidden ? " blur-wrap-hidden" : "")}>{fmtEUR(f.amount)}</span>
                <button className="icon-btn" onClick={() => startEdit(f)}><Pencil size={13} /></button>
                <button className="icon-btn" onClick={() => removeItem(f.id)}><Trash2 size={14} /></button>
              </div>
            );
          })}
        </div>
      )}
      {finished.length > 0 && (
        <p className="logger-hint" style={{ marginTop: -6 }}>
          {finished.length} partida{finished.length > 1 ? "s" : ""} temporal{finished.length > 1 ? "es" : ""} ya terminada{finished.length > 1 ? "s" : ""} — dejaron de contar solas ({finished.map((f) => f.name).join(", ")}).
        </p>
      )}
    </>
  );
}

// Lista reutilizable de movimientos variables (gastos o ingresos puntuales).
function VariableMoneyList({ items, onChange, categories, accent, hidden, onAdd, defaultDate, goalOptions }) {
  const [vAmount, setVAmount] = useState("");
  const [vCategory, setVCategory] = useState(categories[0]);
  const [vNote, setVNote] = useState("");
  const [vGoalId, setVGoalId] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState(categories[0]);
  const [editNote, setEditNote] = useState("");
  const [editDate, setEditDate] = useState(todayStr());
  const [editGoalId, setEditGoalId] = useState("");
  const [formError, setFormError] = useState("");
  const [editError, setEditError] = useState("");

  const addItem = () => {
    const n = Number(vAmount);
    if (!n) { setFormError("Escribe un importe mayor que 0 antes de añadirlo."); return; }
    setFormError("");
    const newItem = { id: uid(), amount: n, category: vCategory, note: vNote.trim(), date: defaultDate || todayStr(), goalId: goalOptions ? (vGoalId || null) : undefined };
    onChange([...items, newItem]);
    if (onAdd) onAdd(newItem);
    setVAmount(""); setVNote(""); setVGoalId("");
  };
  const removeItem = (id) => onChange(items.filter((v) => v.id !== id));
  const startEdit = (v) => {
    setEditError("");
    setEditingId(v.id); setEditAmount(v.amount); setEditCategory(v.category); setEditNote(v.note || ""); setEditDate(v.date); setEditGoalId(v.goalId || "");
  };
  const saveEdit = (id) => {
    if (!Number(editAmount)) { setEditError("Escribe un importe mayor que 0 antes de guardar."); return; }
    setEditError("");
    onChange(items.map((v) => (v.id === id ? { ...v, amount: Number(editAmount), category: editCategory, note: editNote.trim(), date: editDate, goalId: goalOptions ? (editGoalId || null) : v.goalId } : v)));
    setEditingId(null);
  };

  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <Card className="form-card">
        <div className="form-row">
          <select className="select" value={vCategory} onChange={(e) => setVCategory(e.target.value)}>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className="input input-amount" type="number" placeholder="Importe €" value={vAmount} onChange={(e) => setVAmount(e.target.value)} />
          <input className="input" placeholder="Nota (opcional)" value={vNote} onChange={(e) => setVNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addItem()} />
          <button className="btn" style={{ "--btn-accent": accent }} onClick={addItem}><Plus size={16} /></button>
        </div>
        {goalOptions && (
          <div className="form-row" style={{ marginTop: 8, marginBottom: 0 }}>
            <span className="stat-label" style={{ flexShrink: 0 }}>Meta a la que va</span>
            <select className="select" value={vGoalId} onChange={(e) => setVGoalId(e.target.value)}>
              <option value="">Sin asignar (decides luego)</option>
              {goalOptions.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        )}
        {onAdd && vCategory === "Ahorro" && (
          <p className="logger-hint" style={{ margin: "8px 0 0" }}>Esto también se sumará como aportación en Ahorros.</p>
        )}
        {formError && <p className="form-error" style={{ margin: 0 }}>{formError}</p>}
      </Card>
      {sorted.length === 0 ? (
        <Empty text="Nada registrado todavía." />
      ) : (
        <div className="list-card">
          {sorted.map((v) => {
            if (editingId === v.id) {
              return (
                <div key={v.id} className="list-row-stack" style={{ padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
                  <div className="list-row task-edit-row" style={{ padding: 0, border: "none" }}>
                    <input className="input input-date" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                    <select className="select" value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                      {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input className="input input-amount" type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
                    <input className="input" placeholder="Nota" value={editNote} onChange={(e) => setEditNote(e.target.value)} />
                    {goalOptions && (
                      <select className="select" value={editGoalId} onChange={(e) => setEditGoalId(e.target.value)}>
                        <option value="">Sin asignar</option>
                        {goalOptions.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    )}
                    <button className="icon-btn" onClick={() => saveEdit(v.id)}><Check size={14} /></button>
                    <button className="icon-btn" onClick={() => { setEditingId(null); setEditError(""); }}><X size={14} /></button>
                  </div>
                  {editError && <p className="form-error" style={{ margin: 0 }}>{editError}</p>}
                </div>
              );
            }
            return (
              <div key={v.id} className="list-row">
                <span className="mono-tag">{fmtDateShort(v.date)}</span>
                <span className="list-text">{v.note || v.category}</span>
                <span className="event-type-badge" style={{ background: accent + "22", color: accent }}>{v.category}</span>
                <span className={"amount-out" + (hidden ? " blur-wrap-hidden" : "")}>{fmtEUR(v.amount)}</span>
                <button className="icon-btn" onClick={() => startEdit(v)}><Pencil size={13} /></button>
                <button className="icon-btn" onClick={() => removeItem(v.id)}><Trash2 size={14} /></button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function Configuracion({ fullOrderedTabs, hiddenTabs, onMove, onToggleHidden, darkMode, setDarkMode, renderBackupContent, onOpenBackups }) {
  const [openSection, setOpenSection] = useState(null);

  return (
    <Page title="Configuración" subtitle="Ajustes de la app.">
      <div className="section-heading">Apariencia</div>
      <Card>
        <div className="list-row" style={{ padding: 0, border: "none" }}>
          <span className="list-text">Modo oscuro</span>
          <button className={"check" + (darkMode ? " check-done" : "")} style={{ "--check-accent": "var(--primary)" }} onClick={() => setDarkMode(!darkMode)}>
            {darkMode && <Check size={12} strokeWidth={3} />}
          </button>
        </div>
      </Card>

      <div className="settings-section-head" onClick={() => setOpenSection(openSection === "layout" ? null : "layout")}>
        <span>Layout: ordenar menú</span>
        {openSection === "layout" ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>
      {openSection === "layout" && (
        <>
          <p className="logger-hint" style={{ margin: "0 0 10px" }}>Cambia el orden de las secciones o ocúltalas del menú lateral. Configuración siempre queda fija.</p>
          <div className="list-card">
            {fullOrderedTabs.map((t, idx) => {
              const Icon = t.icon;
              const isHidden = hiddenTabs.includes(t.id);
              return (
                <div key={t.id} className="list-row">
                  <span className="drag-handle"><Icon size={15} style={{ color: t.accent }} /></span>
                  <span className={"list-text" + (isHidden ? " list-text-done" : "")}>{t.label}</span>
                  <button className="icon-btn" disabled={idx === 0} onClick={() => onMove(t.id, "up")}><ChevronUp size={14} /></button>
                  <button className="icon-btn" disabled={idx === fullOrderedTabs.length - 1} onClick={() => onMove(t.id, "down")}><ChevronDown size={14} /></button>
                  <button className="icon-btn" onClick={() => onToggleHidden(t.id)} title={isHidden ? "Mostrar en el menú" : "Ocultar del menú"}>
                    {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="settings-section-head" onClick={() => { const next = openSection === "backups" ? null : "backups"; setOpenSection(next); if (next === "backups") onOpenBackups(); }}>
        <span>Copias de seguridad</span>
        {openSection === "backups" ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>
      {openSection === "backups" && (
        <Card>{renderBackupContent()}</Card>
      )}
    </Page>
  );
}

function Horoscopo({ horoscope, setHoroscope }) {
  const signId = horoscope?.sign || "";
  const sign = ZODIAC_SIGNS.find((s) => s.id === signId);

  return (
    <Page title="Horóscopo" subtitle="Solo son frases motivadoras — no te lo tomes muy en serio.">
      {!sign ? (
        <Card>
          <div className="chart-title" style={{ marginBottom: 12 }}>Elige tu signo</div>
          <div className="zodiac-grid">
            {ZODIAC_SIGNS.map((s) => (
              <button key={s.id} className="zodiac-btn" onClick={() => setHoroscope({ ...horoscope, sign: s.id })}>
                <span style={{ fontSize: 22 }}>{s.emoji}</span>
                <span>{s.name}</span>
              </button>
            ))}
          </div>
        </Card>
      ) : (
        <>
          <Card className="hero-card" style={{ background: "var(--acc-aesthetic)" }}>
            <div className="hero-top">
              <span>{sign.emoji} {sign.name}</span>
              <button className="link-btn" style={{ color: "#fff" }} onClick={() => setHoroscope({ ...horoscope, sign: "" })}>Cambiar signo</button>
            </div>
            <div className="hero-value" style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.5, marginTop: 6 }}>{dailyPhrase("general", sign.id, "general")}</div>
            <div className="hero-foot">{fmtDate(todayStr())}</div>
          </Card>

          <div className="goal-list">
            <Card className="goal-card">
              <div className="goal-card-top">
                <div className="hobby-title-row">
                  <span className="avatar" style={{ background: "var(--acc-hobbies)" }}>♥</span>
                  <div className="goal-card-title">Amor</div>
                </div>
              </div>
              <p className="action-description" style={{ cursor: "default", fontSize: 13 }}>{dailyPhrase("amor", sign.id, "amor")}</p>
            </Card>
            <Card className="goal-card">
              <div className="goal-card-top">
                <div className="hobby-title-row">
                  <span className="avatar" style={{ background: "var(--acc-work)" }}>💼</span>
                  <div className="goal-card-title">Trabajo</div>
                </div>
              </div>
              <p className="action-description" style={{ cursor: "default", fontSize: 13 }}>{dailyPhrase("trabajo", sign.id, "trabajo")}</p>
            </Card>
            <Card className="goal-card">
              <div className="goal-card-top">
                <div className="hobby-title-row">
                  <span className="avatar" style={{ background: "var(--acc-health)" }}>+</span>
                  <div className="goal-card-title">Salud</div>
                </div>
              </div>
              <p className="action-description" style={{ cursor: "default", fontSize: 13 }}>{dailyPhrase("salud", sign.id, "salud")}</p>
            </Card>
          </div>
        </>
      )}
    </Page>
  );
}

function Gastos({ expenses, setExpenses, savings, setSavings }) {
  const [hidden, setHidden] = useState(true);
  const [infoOpenCat, setInfoOpenCat] = useState(null);
  const fixed = (expenses.fixed || []).filter((f) => !isExpenseExpired(f));
  const variable = expenses.variable || [];
  const incomeFixed = (expenses.incomeFixed || []).filter((f) => !isExpenseExpired(f));
  const incomeVariable = expenses.incomeVariable || [];
  const monthKey = todayStr().slice(0, 7);
  const [viewMonth, setViewMonth] = useState(monthKey);
  const viewMonthDate = new Date(viewMonth + "-01T00:00:00");
  const shiftViewMonth = (delta) => {
    const d = new Date(viewMonthDate.getFullYear(), viewMonthDate.getMonth() + delta, 1);
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const defaultAddDate = viewMonth === monthKey ? todayStr() : `${viewMonth}-01`;

  // Al cambiar de mes: lo fijo (nómina, ahorro, suscripciones...) NUNCA se resetea, sigue igual.
  // Lo que sí se archiva a un historial (máx. 10) son los gastos/ingresos variables de meses
  // anteriores y los gastos fijos a plazos que ya han terminado. Además, el ahorro fijo activo
  // genera automáticamente su movimiento del mes en Ahorros (una vez por mes, sin duplicar).
  useEffect(() => {
    if (expenses.lastSeenMonth === monthKey) return;
    const rolledExpenseVar = (expenses.variable || []).filter((v) => v.date.slice(0, 7) !== monthKey);
    const keptExpenseVar = (expenses.variable || []).filter((v) => v.date.slice(0, 7) === monthKey);
    const rolledIncomeVar = (expenses.incomeVariable || []).filter((v) => v.date.slice(0, 7) !== monthKey);
    const keptIncomeVar = (expenses.incomeVariable || []).filter((v) => v.date.slice(0, 7) === monthKey);
    const expiredFixed = (expenses.fixed || []).filter((f) => isExpenseExpired(f));
    const activeFixed = (expenses.fixed || []).filter((f) => !isExpenseExpired(f));
    const expiredIncomeFixed = (expenses.incomeFixed || []).filter((f) => isExpenseExpired(f));
    const activeIncomeFixed = (expenses.incomeFixed || []).filter((f) => !isExpenseExpired(f));

    const newHistory = [
      ...rolledExpenseVar.map((v) => ({ id: v.id, kind: "gasto", name: v.note || v.category, category: v.category, amount: v.amount, date: v.date })),
      ...rolledIncomeVar.map((v) => ({ id: v.id, kind: "ingreso", name: v.note || v.category, category: v.category, amount: v.amount, date: v.date })),
      ...expiredFixed.map((f) => ({ id: f.id, kind: "gasto", name: f.name, category: f.category, amount: f.amount, date: todayStr() })),
      ...expiredIncomeFixed.map((f) => ({ id: f.id, kind: "ingreso", name: f.name, category: f.category, amount: f.amount, date: todayStr() })),
    ].sort((a, b) => b.date.localeCompare(a.date));

    // Ahorro fijo activo -> un movimiento "automático" en Ahorros por este mes, sin duplicar
    // (id determinista por partida+mes, así si esto ya se procesó no se vuelve a crear).
    const ahorroFixedActive = activeFixed.filter((f) => f.category === "Ahorro" && f.active);
    const existingIds = new Set((savings.movements || []).map((m) => m.id));
    const newAhorroMovements = ahorroFixedActive
      .map((f) => ({ id: `fixedsav-${f.id}-${monthKey}`, f }))
      .filter(({ id }) => !existingIds.has(id))
      .map(({ id, f }) => ({ id, type: "in", amount: f.amount, date: `${monthKey}-${String(f.day).padStart(2, "0")}`, note: `${f.name} (ahorro fijo)`, source: "auto" }));
    if (newAhorroMovements.length > 0) {
      setSavings({ ...savings, movements: [...(savings.movements || []), ...newAhorroMovements] });
    }

    if (newHistory.length === 0) {
      setExpenses({ ...expenses, lastSeenMonth: monthKey });
      return;
    }
    const mergedHistory = [...newHistory, ...(expenses.history || [])].slice(0, 10);
    setExpenses({
      ...expenses,
      variable: keptExpenseVar,
      incomeVariable: keptIncomeVar,
      fixed: activeFixed,
      incomeFixed: activeIncomeFixed,
      history: mergedHistory,
      lastSeenMonth: monthKey,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fixedActiveTotal = fixed.filter((f) => f.active && f.category !== "Ahorro").reduce((a, f) => a + f.amount, 0);
  const variableThisMonth = variable.filter((v) => v.date.slice(0, 7) === viewMonth && v.category !== "Ahorro").reduce((a, v) => a + v.amount, 0);
  const totalExpensesMonth = fixedActiveTotal + variableThisMonth;

  const ahorroFixedTotal = fixed.filter((f) => f.active && f.category === "Ahorro").reduce((a, f) => a + f.amount, 0);
  const ahorroVariableThisMonth = variable.filter((v) => v.date.slice(0, 7) === viewMonth && v.category === "Ahorro").reduce((a, v) => a + v.amount, 0);
  const ahorroThisMonth = ahorroFixedTotal + ahorroVariableThisMonth;

  const incomeFixedActiveTotal = incomeFixed.filter((f) => f.active).reduce((a, f) => a + f.amount, 0);
  const incomeVariableThisMonth = incomeVariable.filter((v) => v.date.slice(0, 7) === viewMonth).reduce((a, v) => a + v.amount, 0);
  const totalIncomeMonth = incomeFixedActiveTotal + incomeVariableThisMonth;

  const netMonth = totalIncomeMonth - totalExpensesMonth - ahorroThisMonth;
  const totalOutMonth = totalExpensesMonth + ahorroThisMonth;
  const pctOf = (n) => (totalIncomeMonth > 0 ? Math.round((n / totalIncomeMonth) * 100) : null);
  const totalOutPct = pctOf(totalOutMonth);
  const expensePct = pctOf(totalExpensesMonth);
  const ahorroPct = pctOf(ahorroThisMonth);

  const budgetPct = { ...DEFAULT_BUDGET_PCT, ...(expenses.budgetPct || {}) };
  const updateBudgetPct = (cat, pct) => setExpenses({ ...expenses, budgetPct: { ...budgetPct, [cat]: pct } });
  const budgetPctTotal = EXPENSE_CATEGORIES.reduce((a, c) => a + (Number(budgetPct[c]) || 0), 0) + (Number(budgetPct["Ahorro"]) || 0);
  const actualByCategory = useMemo(() => {
    const map = {};
    fixed.filter((f) => f.active).forEach((f) => { map[f.category] = (map[f.category] || 0) + f.amount; });
    variable.filter((v) => v.date.slice(0, 7) === viewMonth).forEach((v) => { map[v.category] = (map[v.category] || 0) + v.amount; });
    return map;
  }, [JSON.stringify(fixed), JSON.stringify(variable), viewMonth]);

  const monthlySeries = useMemo(() => {
    const months = [];
    const base = new Date(viewMonthDate);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return months.map((mk) => {
      const varExp = variable.filter((v) => v.date.slice(0, 7) === mk && v.category !== "Ahorro").reduce((a, v) => a + v.amount, 0);
      const varInc = incomeVariable.filter((v) => v.date.slice(0, 7) === mk).reduce((a, v) => a + v.amount, 0);
      return {
        mk,
        label: new Date(mk + "-01T00:00:00").toLocaleDateString("es-ES", { month: "short" }),
        gastos: Math.round((fixedActiveTotal + varExp) * 100) / 100,
        ingresos: Math.round((incomeFixedActiveTotal + varInc) * 100) / 100,
      };
    });
  }, [JSON.stringify(variable), JSON.stringify(incomeVariable), fixedActiveTotal, incomeFixedActiveTotal, viewMonth]);

  const byCategory = useMemo(() => {
    const map = {};
    fixed.filter((f) => f.active && f.category !== "Ahorro").forEach((f) => { map[f.category] = (map[f.category] || 0) + f.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [JSON.stringify(fixed)]);

  return (
    <Page title="Flujo de caja" subtitle="Ingresos y gastos del mes, para ver de un vistazo qué te queda.">
      <Card className="form-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="cal-head" style={{ margin: 0 }}>
          <button className="chip" onClick={() => shiftViewMonth(-1)}><ChevronLeft size={14} /></button>
          <span className="chip-label cal-month">{viewMonthDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}</span>
          <button className="chip" onClick={() => shiftViewMonth(1)}><ChevronRight size={14} /></button>
          {viewMonth !== monthKey && <button className="link-btn" onClick={() => setViewMonth(monthKey)}>Volver a hoy</button>}
        </div>
        <button className="icon-btn" style={{ background: "var(--bg)" }} onClick={() => setHidden(!hidden)} title={hidden ? "Mostrar cifras" : "Ocultar cifras"}>
          {hidden ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </Card>

      <div className="grid-2">
        <Card className="hero-card" style={{ background: netMonth >= 0 ? "var(--acc-savings)" : "var(--acc-gym)" }}>
          <div className="hero-top"><span>Flujo de caja {viewMonth === monthKey ? "este mes" : "de " + viewMonthDate.toLocaleDateString("es-ES", { month: "long" })}</span></div>
          <div className={"blur-wrap" + (hidden ? " blur-wrap-hidden" : "")}>
            <div className="hero-value" style={{ fontSize: 26 }}>{netMonth >= 0 ? "+" : ""}{fmtEUR(netMonth)}</div>
          </div>
          <div className="hero-foot">{netMonth >= 0 ? "Te sobra a fin de mes" : "Gastas más de lo que ingresas"}</div>
        </Card>
        <Card>
          <div className="stat-top">
            <span className="stat-icon" style={{ background: "var(--acc-savings-soft)", color: "var(--acc-savings)" }}><ArrowUpRight size={16} /></span>
          </div>
          <div className={"blur-wrap" + (hidden ? " blur-wrap-hidden" : "")}>
            <div className="stat-value">{fmtEUR(totalIncomeMonth)}</div>
          </div>
          <div className="stat-label">ingresos este mes</div>
        </Card>
        <Card>
          <div className="stat-top">
            <span className="stat-icon" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}><Receipt size={16} /></span>
          </div>
          <div className={"blur-wrap" + (hidden ? " blur-wrap-hidden" : "")}>
            <div className="stat-value">{fmtEUR(totalOutMonth)} <span className="stat-value-pct">{totalOutPct === null ? "" : "· " + totalOutPct + "%"}</span></div>
          </div>
          <div className="stat-label">gastos totales este mes (ahorro + gastos)</div>
        </Card>
        <Card>
          <div className="stat-top">
            <span className="stat-icon" style={{ background: "var(--acc-expense-soft)", color: "var(--acc-expense)" }}><Receipt size={16} /></span>
          </div>
          <div className={"blur-wrap" + (hidden ? " blur-wrap-hidden" : "")}>
            <div className="stat-value">{fmtEUR(totalExpensesMonth)} <span className="stat-value-pct">{expensePct === null ? "" : "· " + expensePct + "%"}</span></div>
          </div>
          <div className="stat-label">gastos este mes (sin el ahorro)</div>
        </Card>
        <Card>
          <div className="stat-top">
            <span className="stat-icon" style={{ background: "var(--acc-savings-soft)", color: "var(--acc-savings)" }}><Wallet size={16} /></span>
          </div>
          <div className={"blur-wrap" + (hidden ? " blur-wrap-hidden" : "")}>
            <div className="stat-value">{fmtEUR(ahorroThisMonth)} <span className="stat-value-pct">{ahorroPct === null ? "" : "· " + ahorroPct + "%"}</span></div>
          </div>
          <div className="stat-label">ahorrado este mes (aparte, no es un gasto)</div>
        </Card>
      </div>

      <Card>
        <div className="chart-title" style={{ marginBottom: 10 }}>Evolución mensual (últimos 6 meses)</div>
        <p className="logger-hint" style={{ margin: "0 0 10px" }}>Los fijos se aplican con el importe activo actual a cada mes, como aproximación — los variables sí son los reales de cada mes.</p>
        <div className={"chart-wrap" + (hidden ? " blur-wrap-hidden" : "")}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthlySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={40} />
              <Tooltip formatter={(v) => fmtEUR(v)} />
              <Line type="monotone" dataKey="ingresos" stroke="var(--acc-savings)" strokeWidth={2} dot={{ r: 3 }} name="Ingresos" />
              <Line type="monotone" dataKey="gastos" stroke="var(--acc-expense)" strokeWidth={2} dot={{ r: 3 }} name="Gastos" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="section-heading">Presupuesto recomendado por categoría</div>
      <Card>
        <p className="logger-hint" style={{ margin: "0 0 14px" }}>
          Propuesta orientativa de reparto sobre tus ingresos de este mes ({fmtEUR(totalIncomeMonth)}). Ajusta el % de cada una a tu gusto — se guarda para siempre.
          {budgetPctTotal !== 100 && <span style={{ color: "var(--acc-gym)", fontWeight: 600 }}> Entre ahorro y gastos suman {budgetPctTotal}% de tus ingresos (lo ideal es que no pase de 100%; el resto sería margen libre).</span>}
        </p>

        {(() => {
          const cat = "Ahorro";
          const pct = budgetPct[cat] ?? 0;
          const recommended = (totalIncomeMonth * pct) / 100;
          const actual = actualByCategory[cat] || 0;
          const barPct = recommended > 0 ? Math.min(100, (actual / recommended) * 100) : (actual > 0 ? 100 : 0);
          const modified = pct !== DEFAULT_BUDGET_PCT[cat];
          return (
            <div className="budget-card budget-card-savings" style={{ marginBottom: 14 }}>
              <div className="budget-card-top">
                <Wallet size={14} style={{ color: "var(--acc-savings)", flexShrink: 0 }} />
                <span className="budget-card-name">Ahorro <span style={{ fontWeight: 400, color: "var(--ink-soft)" }}>— esto no es un gasto, sigue siendo tuyo</span></span>
                <button className="icon-btn budget-info-btn" onClick={() => setInfoOpenCat(infoOpenCat === cat ? null : cat)}><Info size={13} /></button>
                <div className="budget-card-pct">
                  <input type="number" min="0" max="100" value={pct} onChange={(e) => updateBudgetPct(cat, Number(e.target.value))} />
                  <span>%</span>
                </div>
              </div>
              {infoOpenCat === cat && (
                <p className="budget-info-note">
                  {BUDGET_CAT_INFO[cat]}
                  {modified && <> <strong>Has cambiado el % — la recomendación original era {DEFAULT_BUDGET_PCT[cat]}%.</strong> <button className="link-btn" onClick={() => updateBudgetPct(cat, DEFAULT_BUDGET_PCT[cat])}>Restablecer</button></>}
                </p>
              )}
              <div className="budget-bar-track">
                <div className="budget-bar-fill" style={{ width: barPct + "%", background: "var(--acc-savings)" }} />
              </div>
              <div className={"budget-card-figures" + (hidden ? " blur-wrap-hidden" : "")}>
                <span style={{ color: "var(--acc-savings)", fontWeight: 700 }}>{fmtEUR(actual)} ahorrado</span>
                <span>meta: {fmtEUR(recommended)}</span>
              </div>
            </div>
          );
        })()}

        <div className="budget-grid">
          {EXPENSE_CATEGORIES.filter((cat) => cat !== "Ahorro").map((cat) => {
            const pct = budgetPct[cat] ?? 0;
            const recommended = (totalIncomeMonth * pct) / 100;
            const actual = actualByCategory[cat] || 0;
            const barPct = recommended > 0 ? Math.min(100, (actual / recommended) * 100) : (actual > 0 ? 100 : 0);
            const over = totalIncomeMonth > 0 && actual > recommended;
            const color = BUDGET_CAT_COLORS[cat] || "var(--ink-soft)";
            const modified = pct !== DEFAULT_BUDGET_PCT[cat];
            return (
              <div key={cat} className="budget-card">
                <div className="budget-card-top">
                  <span className="budget-card-dot" style={{ background: color }} />
                  <span className="budget-card-name">{cat}</span>
                  <button className="icon-btn budget-info-btn" onClick={() => setInfoOpenCat(infoOpenCat === cat ? null : cat)}><Info size={13} /></button>
                  <div className="budget-card-pct">
                    <input type="number" min="0" max="100" value={pct} onChange={(e) => updateBudgetPct(cat, Number(e.target.value))} />
                    <span>%</span>
                  </div>
                </div>
                {infoOpenCat === cat && (
                  <p className="budget-info-note">
                    {BUDGET_CAT_INFO[cat]}
                    {modified && <> <strong>Has cambiado el % — la recomendación original era {DEFAULT_BUDGET_PCT[cat]}%.</strong> <button className="link-btn" onClick={() => updateBudgetPct(cat, DEFAULT_BUDGET_PCT[cat])}>Restablecer</button></>}
                  </p>
                )}
                <div className="budget-bar-track">
                  <div className="budget-bar-fill" style={{ width: barPct + "%", background: over ? "var(--acc-gym)" : color }} />
                </div>
                <div className={"budget-card-figures" + (hidden ? " blur-wrap-hidden" : "")}>
                  <span style={{ color: over ? "var(--acc-gym)" : "var(--ink)", fontWeight: 700 }}>{fmtEUR(actual)}</span>
                  <span>de {fmtEUR(recommended)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {byCategory.length > 0 && (
        <Card>
          <div className="chart-title" style={{ marginBottom: 10 }}>Gastos fijos por categoría</div>
          <div className={"breakdown-list" + (hidden ? " blur-wrap-hidden" : "")}>
            {byCategory.map(([cat, amt]) => (
              <div key={cat} className="breakdown-row">
                <span className="breakdown-dot" style={{ background: "var(--acc-expense)" }} />
                <span className="breakdown-name">{cat}</span>
                <span className="breakdown-count">{fmtEUR(amt)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="section-heading">Ingresos fijos mensuales</div>
      <FixedMoneyList
        items={expenses.incomeFixed || []}
        onChange={(v) => setExpenses({ ...expenses, incomeFixed: v })}
        categories={INCOME_CATEGORIES}
        accent="var(--acc-savings)"
        emptyText="Añade tu nómina u otros ingresos fijos para verlos aquí."
        hidden={hidden}
      />

      <div className="section-heading">Ingresos variables</div>
      <VariableMoneyList
        items={expenses.incomeVariable || []}
        onChange={(v) => setExpenses({ ...expenses, incomeVariable: v })}
        categories={INCOME_CATEGORIES}
        accent="var(--acc-savings)"
        hidden={hidden}
        defaultDate={defaultAddDate}
      />

      <div className="section-heading">Ahorro mensual <span className="mono-tag" style={{ marginLeft: 6 }}>partida aparte, no es un gasto</span></div>
      <FixedMoneyList
        items={(expenses.fixed || []).filter((f) => f.category === "Ahorro")}
        onChange={(v) => setExpenses({ ...expenses, fixed: [...(expenses.fixed || []).filter((f) => f.category !== "Ahorro"), ...v] })}
        categories={["Ahorro"]}
        accent="var(--acc-savings)"
        emptyText="Define cuánto quieres apartar cada mes de forma fija."
        hidden={hidden}
      />
      <VariableMoneyList
        items={(expenses.variable || []).filter((v) => v.category === "Ahorro")}
        onChange={(v) => setExpenses({ ...expenses, variable: [...(expenses.variable || []).filter((x) => x.category !== "Ahorro"), ...v] })}
        categories={["Ahorro"]}
        accent="var(--acc-savings)"
        hidden={hidden}
        defaultDate={defaultAddDate}
        onAdd={(item) => {
          setSavings({ ...savings, movements: [...(savings.movements || []), { id: uid(), type: "in", amount: item.amount, date: item.date, note: item.note || "Desde Flujo de caja", source: "auto" }] });
        }}
      />

      <div className="section-heading">Gastos fijos mensuales</div>
      <FixedMoneyList
        items={expenses.fixed || []}
        onChange={(v) => setExpenses({ ...expenses, fixed: v })}
        categories={EXPENSE_CATEGORIES}
        accent="var(--acc-expense)"
        emptyText="Añade tus gastos fijos (alquiler, luz, suscripciones...) para verlos aquí."
        hidden={hidden}
      />

      <div className="section-heading">Gastos variables</div>
      {viewMonth !== monthKey && (
        <p className="logger-hint" style={{ marginTop: -8 }}>Lo que añadas aquí se registrará el {fmtDate(defaultAddDate)} (dentro del mes que estás viendo).</p>
      )}
      <VariableMoneyList
        items={expenses.variable || []}
        onChange={(v) => setExpenses({ ...expenses, variable: v })}
        categories={EXPENSE_CATEGORIES}
        accent="var(--acc-expense)"
        hidden={hidden}
        defaultDate={defaultAddDate}
      />

      <div className="section-heading">Historial <span className="mono-tag" style={{ marginLeft: 6 }}>últimos 10 que han vencido o cambiado de mes</span></div>
      {(expenses.history || []).length === 0 ? (
        <Empty text="Todavía no hay nada archivado. Aquí irán apareciendo los gastos/ingresos variables de meses pasados y los pagos a plazos ya terminados." />
      ) : (
        <div className="list-card">
          {(expenses.history || []).map((h) => (
            <div key={h.id + h.date} className="list-row">
              <span className="mono-tag">{fmtDateShort(h.date)}</span>
              <span className="list-text">{h.name}</span>
              <span className="event-type-badge" style={{ background: h.kind === "ingreso" ? "var(--acc-savings-soft)" : "var(--acc-expense-soft)", color: h.kind === "ingreso" ? "var(--acc-savings)" : "var(--acc-expense)" }}>{h.category}</span>
              <span className={(h.kind === "ingreso" ? "amount-in" : "amount-out") + (hidden ? " blur-wrap-hidden" : "")}>{h.kind === "ingreso" ? "+" : "−"}{fmtEUR(h.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}

// ---------- Rutina diaria ----------
function RutinaDiaria({ routine, setRoutine }) {
  const [filterDate, setFilterDate] = useState(todayStr());
  const [expandedDetail, setExpandedDetail] = useState(null);
  const checklist = routine.checklist || {};
  const steps = routine.steps || {};
  const dayData = checklist[filterDate] || {};

  const subKey = (itemId, detailId) => `${itemId}__${detailId}`;
  const isItemComplete = (item, data) => (
    item.details ? item.details.every((d) => data[subKey(item.id, d.id)]) : !!data[item.id]
  );
  const toggleItem = (id) => setRoutine({ ...routine, checklist: { ...checklist, [filterDate]: { ...dayData, [id]: !dayData[id] } } });
  const toggleParent = (item) => {
    const full = isItemComplete(item, dayData);
    const next = { ...dayData };
    item.details.forEach((d) => { next[subKey(item.id, d.id)] = !full; });
    setRoutine({ ...routine, checklist: { ...checklist, [filterDate]: next } });
  };
  const toggleSub = (item, detail) => {
    const key = subKey(item.id, detail.id);
    setRoutine({ ...routine, checklist: { ...checklist, [filterDate]: { ...dayData, [key]: !dayData[key] } } });
  };
  const updateSteps = (date, value) => setRoutine({ ...routine, steps: { ...steps, [date]: value === "" ? undefined : Number(value) } });

  const doneToday = ROUTINE_SECTIONS.flatMap((s) => s.items).filter((it) => isItemComplete(it, dayData)).length;
  const dailyItems = useMemo(() => ROUTINE_SECTIONS.flatMap((s) => s.items).filter((it) => it.freq === "Diario"), []);
  const streak = useMemo(() => {
    let count = 0;
    let d = new Date();
    for (let i = 0; i < 400; i++) {
      const ds = dateToStr(d);
      const data = checklist[ds] || {};
      const allDone = dailyItems.length > 0 && dailyItems.every((it) => isItemComplete(it, data));
      if (allDone) { count++; d.setDate(d.getDate() - 1); } else break;
    }
    return count;
  }, [checklist, dailyItems]);

  const stepsToday = steps[filterDate] ?? "";
  const stepsRealToday = steps[todayStr()] || 0;
  const weekRange = getWeekRange(new Date());
  const weekDates = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekRange.start); d.setDate(d.getDate() + i); return dateToStr(d); });
  const stepsThisWeek = weekDates.reduce((a, ds) => a + (steps[ds] || 0), 0);
  const dailyPct = Math.min(100, (stepsRealToday / STEPS_GOAL_DAILY) * 100);
  const weeklyPct = Math.min(100, (stepsThisWeek / STEPS_GOAL_WEEKLY) * 100);

  return (
    <Page title="Rutina diaria" subtitle="Ejercicios, cosmética y suplementos, cada día.">
      <div className="grid-2">
        <Card className="hero-card" style={{ background: "var(--acc-routine)" }}>
          <div className="hero-top"><span>Hoy</span><span className="hero-pill"><ListChecks size={13} /></span></div>
          <div className="hero-value">{doneToday}<span className="hero-value-sub">/{ROUTINE_ITEM_COUNT}</span></div>
          <div className="hero-foot">completado</div>
        </Card>
        <Card>
          <div className="stat-top">
            <span className="stat-icon" style={{ background: "var(--acc-routine-soft)", color: "var(--acc-routine)" }}><Flame size={16} /></span>
          </div>
          <div className="stat-value">{streak}</div>
          <div className="stat-label">días seguidos completando lo diario</div>
        </Card>
      </div>

      <div className="section-heading">Pasos diarios</div>
      <div className="grid-2">
        <Card>
          <div className="stat-top">
            <span className="stat-icon" style={{ background: "var(--acc-routine-soft)", color: "var(--acc-routine)" }}><Footprints size={16} /></span>
            <span className="stat-label">meta {STEPS_GOAL_DAILY.toLocaleString("es-ES")}</span>
          </div>
          <div className="stat-value">{stepsRealToday.toLocaleString("es-ES")}</div>
          <div className="stat-label">pasos hoy</div>
          <div className="progress-track" style={{ marginTop: 10 }}>
            <div className="progress-fill" style={{ width: dailyPct + "%", background: "var(--acc-routine)" }} />
          </div>
        </Card>
        <Card>
          <div className="stat-top">
            <span className="stat-icon" style={{ background: "var(--acc-routine-soft)", color: "var(--acc-routine)" }}><Footprints size={16} /></span>
            <span className="stat-label">meta {STEPS_GOAL_WEEKLY.toLocaleString("es-ES")}</span>
          </div>
          <div className="stat-value">{stepsThisWeek.toLocaleString("es-ES")}</div>
          <div className="stat-label">pasos esta semana</div>
          <div className="progress-track" style={{ marginTop: 10 }}>
            <div className="progress-fill" style={{ width: weeklyPct + "%", background: "var(--acc-routine)" }} />
          </div>
        </Card>
      </div>
      <Card className="form-card">
        <div className="form-row" style={{ marginBottom: 0, alignItems: "center" }}>
          <span className="stat-label" style={{ flexShrink: 0 }}>Pasos del {fmtDate(filterDate)}</span>
          <input className="input input-amount" type="number" placeholder="Pasos" value={stepsToday}
            onChange={(e) => updateSteps(filterDate, e.target.value)} />
        </div>
      </Card>

      <div className="date-switch">
        <button className="chip" onClick={() => setFilterDate(shiftDate(filterDate, -1))}><ChevronLeft size={14} /></button>
        <span className="chip-label">{fmtDate(filterDate)}{filterDate === todayStr() ? " · hoy" : ""}</span>
        <button className="chip" onClick={() => setFilterDate(shiftDate(filterDate, 1))}><ChevronRight size={14} /></button>
        <DatePicker value={filterDate} onChange={setFilterDate} accent="var(--acc-routine)" label="Ir a una fecha" />
      </div>

      {ROUTINE_SECTIONS.map((section) => {
        const SectionIcon = section.icon;
        const sectionDone = section.items.filter((it) => isItemComplete(it, dayData)).length;
        return (
          <div key={section.id}>
            <div className="section-heading" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <SectionIcon size={15} style={{ color: section.accent }} />
              <span>{section.label}</span>
              <span className="section-heading-count">{sectionDone}/{section.items.length}</span>
            </div>
            <div className="list-card">
              {section.items.map((item) => {
                const ItemIcon = ROUTINE_TYPE_ICON[item.type] || Pill;
                const subDoneCount = item.details ? item.details.filter((d) => dayData[subKey(item.id, d.id)]).length : 0;
                const checked = item.details ? subDoneCount === item.details.length : !!dayData[item.id];
                const partial = item.details ? subDoneCount > 0 && !checked : false;
                return (
                  <div key={item.id} className={"list-row" + (item.details ? " list-row-stack" : "")}>
                    <div className="list-row-main">
                      <button
                        className={"check" + (checked ? " check-done" : "") + (partial ? " check-partial" : "")}
                        style={{ "--check-accent": section.accent }}
                        onClick={() => (item.details ? toggleParent(item) : toggleItem(item.id))}
                      >
                        {checked && <Check size={12} strokeWidth={3} />}
                        {partial && <span className="check-dash" />}
                      </button>
                      <ItemIcon size={13} style={{ color: "var(--ink-soft)", flexShrink: 0 }} />
                      <span className={"list-text" + (checked ? " list-text-done" : "")}>{item.name}</span>
                      {item.details && <span className="mono-tag">{subDoneCount}/{item.details.length}</span>}
                      {item.freq !== "Diario" && <span className="mono-tag">{item.freq}</span>}
                    </div>
                    {item.details && (
                      <ul className="routine-details">
                        {item.details.map((d) => {
                          const key = `${item.id}-${d.id}`;
                          const isOpen = expandedDetail === key;
                          const subOn = !!dayData[subKey(item.id, d.id)];
                          return (
                            <li key={d.id}>
                              <div className="routine-sub-row">
                                <button
                                  className={"check check-sm" + (subOn ? " check-done" : "")}
                                  style={{ "--check-accent": section.accent }}
                                  onClick={() => toggleSub(item, d)}
                                >
                                  {subOn && <Check size={9} strokeWidth={3} />}
                                </button>
                                <button type="button" className="routine-detail-btn" onClick={() => setExpandedDetail(isOpen ? null : key)}>
                                  {d.name}
                                </button>
                              </div>
                              {isOpen && <p className="routine-detail-explain">{d.explanation}</p>}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </Page>
  );
}

function Styles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap');

      .wrap {
        --bg: #F6F5FB;
        --card: #FFFFFF;
        --primary: #6C5CE7;
        --primary-soft: #EEEBFC;
        --ink: #17172B;
        --ink-soft: #8C8FA3;
        --line: #EDEDF4;
        --shadow: 0 10px 30px rgba(30,28,60,0.07);

        --acc-day: #3D7BF2; --acc-day-soft: #E9F0FE;
        --acc-savings: #1FAA59; --acc-savings-soft: #E6F8EC;
        --acc-gym: #F2762E; --acc-gym-soft: #FDECE0;
        --acc-cardio: #0EA5A4; --acc-cardio-soft: #E1F5F4;
        --acc-goals: #D97706; --acc-goals-soft: #FBEEDA;
        --acc-hobbies: #E0529C; --acc-hobbies-soft: #FCE8F2;
        --acc-travel: #E11D48; --acc-travel-soft: #FDE6EA;
        --acc-nutrition: #65A30D; --acc-nutrition-soft: #EEF6DC;
        --acc-expense: #475569; --acc-expense-soft: #E7EAEE;
        --acc-health: #DC2626; --acc-health-soft: #FBE3E1;
        --acc-projects: #4F46E5; --acc-projects-soft: #E8E7FC;
        --acc-aesthetic: #D946EF; --acc-aesthetic-soft: #FBE6FC;
        --acc-work: #1E293B; --acc-work-soft: #E4E7EC;
        --acc-routine: #0EA5E9; --acc-routine-soft: #E0F2FE;

        display: flex;
        height: 100vh;
        height: 100dvh;
        min-height: 560px;
        width: 100%;
        background: var(--bg);
        color: var(--ink);
        font-family: 'Inter', sans-serif;
        overflow: hidden;
        transition: background .2s ease, color .2s ease;
      }
      .wrap * { box-sizing: border-box; }

      .wrap.dark {
        --bg: #14151C;
        --card: #1D1F29;
        --primary-soft: rgba(108,92,231,0.20);
        --ink: #F1F0EE;
        --ink-soft: #9A9CAC;
        --line: #2B2D38;
        --shadow: 0 10px 30px rgba(0,0,0,0.35);

        --acc-day-soft: rgba(61,123,242,0.18);
        --acc-savings-soft: rgba(31,170,89,0.18);
        --acc-gym-soft: rgba(242,118,46,0.18);
        --acc-cardio-soft: rgba(14,165,164,0.18);
        --acc-goals-soft: rgba(217,119,6,0.2);
        --acc-hobbies-soft: rgba(224,82,156,0.18);
        --acc-travel-soft: rgba(225,29,72,0.18);
        --acc-nutrition-soft: rgba(101,163,13,0.2);
        --acc-expense-soft: rgba(148,163,184,0.18);
        --acc-health-soft: rgba(220,38,38,0.18);
        --acc-projects-soft: rgba(79,70,229,0.2);
        --acc-aesthetic-soft: rgba(217,70,239,0.18);
        --acc-work-soft: rgba(148,163,184,0.16);
        --acc-routine-soft: rgba(14,165,233,0.18);
      }
      .wrap.dark .datepicker-trigger, .wrap.dark .chip, .wrap.dark .toggle { background: var(--bg); }

      .nav {
        width: 210px;
        flex-shrink: 0;
        background: var(--card);
        padding: 22px 14px;
        display: flex;
        flex-direction: column;
        gap: 22px;
      }
      .nav-brand { display: flex; align-items: center; gap: 8px; font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; font-size: 17px; padding: 0 8px; justify-content: space-between; }
      .dark-toggle { border: none; background: var(--bg); color: var(--ink-soft); width: 26px; height: 26px; border-radius: 9px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
      .dark-toggle:hover { color: var(--ink); }
      .dark-toggle-active { background: var(--primary-soft); color: var(--primary); }
      .settings-section-head {
        display: flex; justify-content: space-between; align-items: center; cursor: pointer;
        font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 14px;
        color: var(--ink); margin: 22px 0 10px; padding: 2px 0;
      }

      .save-all-btn {
        display: flex; align-items: center; justify-content: center; gap: 7px;
        margin: 4px 8px 10px; padding: 10px; border: none; border-radius: 12px;
        background: var(--acc-savings); color: #fff; font-family: inherit; font-weight: 700;
        font-size: 12.5px; cursor: pointer;
      }
      .save-all-btn:hover { filter: brightness(1.06); }
      .save-all-btn:disabled { opacity: 0.7; cursor: default; }
      .save-all-msg { margin: -6px 8px 8px; font-size: 11px; color: var(--acc-savings); font-weight: 600; text-align: center; }

      .undo-toast {
        position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 100;
        display: flex; align-items: center; gap: 14px;
        background: var(--ink); color: var(--bg); font-size: 13px; font-weight: 500;
        padding: 12px 16px; border-radius: 14px; box-shadow: 0 12px 30px rgba(0,0,0,0.25);
      }
      .undo-toast button {
        border: none; background: none; color: #B7AEFF; font-family: inherit;
        font-weight: 700; font-size: 13px; cursor: pointer; text-decoration: underline;
        text-underline-offset: 3px; padding: 0;
      }
      .nav-brand-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--primary); }
      .nav-list { display: flex; flex-direction: column; gap: 3px; }
      .nav-item {
        display: flex; align-items: center; gap: 2px; position: relative;
        border-radius: 14px; color: var(--ink-soft); font-family: 'Inter', sans-serif;
        font-size: 13.5px; font-weight: 500;
        transition: background .15s ease, color .15s ease;
      }
      .nav-item:hover { background: var(--bg); color: var(--ink); }
      .nav-item-active { background: var(--tab-soft); color: var(--tab-accent); font-weight: 600; }
      .nav-icon { display: flex; }
      .nav-item-main {
        flex: 1; display: flex; align-items: center; gap: 10px;
        padding: 10px 6px 10px 12px; border: none; background: transparent; color: inherit;
        font-family: inherit; font-size: inherit; font-weight: inherit; cursor: pointer; text-align: left;
      }
      .nav-item-dots {
        border: none; background: transparent; color: inherit; opacity: 0.5;
        padding: 8px 10px 8px 4px; cursor: pointer; display: flex; align-items: center;
      }
      .nav-item-dots:hover { opacity: 1; }
      .nav-reorder-menu {
        position: absolute; right: 4px; top: calc(100% + 2px); z-index: 20;
        background: var(--card); border-radius: 10px; box-shadow: var(--shadow); padding: 4px;
        display: flex; flex-direction: column; min-width: 110px;
      }
      .nav-reorder-menu button {
        display: flex; align-items: center; gap: 6px; border: none; background: transparent;
        padding: 7px 10px; border-radius: 7px; font-family: inherit; font-size: 12.5px; color: var(--ink);
        cursor: pointer; text-align: left;
      }
      .nav-reorder-menu button:hover { background: var(--bg); }
      .nav-reorder-menu button:disabled { opacity: 0.35; cursor: default; }
      .nav-reorder-menu button:disabled:hover { background: transparent; }

      .content { flex: 1; overflow-y: auto; padding: 28px 32px 48px; }
      .page { max-width: 1400px; }
      .page-head { margin-bottom: 20px; }
      .page-head h1 { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 25px; font-weight: 800; margin: 0 0 4px; }
      .page-head p { margin: 0; color: var(--ink-soft); font-size: 13.5px; }

      .loading { display: flex; align-items: center; gap: 8px; color: var(--ink-soft); padding-top: 40px; justify-content: center; }
      .spin { animation: spin 1s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }

      .card {
        background: var(--card); border-radius: 20px; padding: 18px 20px;
        box-shadow: var(--shadow); margin-bottom: 14px;
      }
      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
      .grid-2 .card, .grid-2 .hero-card { margin-bottom: 0; }

      .hero-card { color: #fff; }
      .hero-top { display: flex; justify-content: space-between; align-items: center; font-size: 13px; opacity: 0.9; margin-bottom: 10px; }
      .hero-pill { width: 22px; height: 22px; border-radius: 50%; background: rgba(255,255,255,0.18); display: flex; align-items: center; justify-content: center; }
      .hero-value { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 34px; font-weight: 800; line-height: 1; }
      .hero-value-sub { font-size: 18px; opacity: 0.7; font-weight: 600; }
      .hero-foot { font-size: 12px; opacity: 0.85; margin-top: 10px; }
      .motivational-quote { font-size: 13px; color: var(--ink-soft); font-style: italic; margin: -6px 0 16px; }
      .hero-link { background: none; border: none; color: #fff; text-decoration: underline; cursor: pointer; padding: 0; font-family: inherit; font-size: 12px; }

      .stat-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
      .stat-icon { width: 32px; height: 32px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
      .stat-value { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 22px; font-weight: 800; line-height: 1.15; }
      .stat-value-pct { font-size: 14px; font-weight: 700; color: var(--ink-soft); }
      .stat-value-sm { font-size: 16px; }
      .stat-label { color: var(--ink-soft); font-size: 12.5px; margin-top: 3px; text-transform: none; }
      .stat-cta { margin-top: 12px; border: none; background: var(--bg); color: var(--ink); font-family: inherit; font-size: 12px; font-weight: 600; padding: 7px 12px; border-radius: 10px; cursor: pointer; }
      .stat-cta:hover { background: var(--primary-soft); color: var(--primary); }

      .wide-card { display: flex; flex-direction: column; gap: 14px; }
      .wide-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .wide-item { display: flex; align-items: center; gap: 12px; }
      .wide-value { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 17px; font-weight: 800; }

      .badge { display: inline-block; padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 600; margin-bottom: 6px; }
      .badge-primary { background: var(--primary-soft); color: var(--primary); }
      .badge-savings { background: var(--acc-savings-soft); color: var(--acc-savings); }
      .badge-goals { background: var(--acc-goals-soft); color: var(--acc-goals); }

      .donut-card { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; }
      .donut { position: relative; flex-shrink: 0; }
      .donut svg { transform: rotate(0deg); }
      .donut-label { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
      .donut-label strong { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 22px; font-weight: 800; }
      .donut-label span { font-size: 11px; color: var(--ink-soft); }
      .donut-side { flex: 1; min-width: 160px; }
      .savings-goal-body { display: flex; align-items: center; gap: 16px; margin: 12px 0; flex-wrap: wrap; }
      .milestone-row { display: flex; gap: 6px; margin-bottom: 12px; }
      .milestone-badge { font-size: 10.5px; font-weight: 700; padding: 3px 8px; border-radius: 20px; background: var(--bg); color: var(--ink-soft); }
      .milestone-badge-done { background: var(--acc-savings); color: #fff; }
      .donut-side-title { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 15px; margin-bottom: 4px; }
      .donut-side-value { font-size: 14px; color: var(--ink); margin-bottom: 10px; }
      .donut-side-value span { color: var(--ink-soft); }
      .donut-legend { display: flex; gap: 14px; font-size: 12px; color: var(--ink-soft); }
      .donut-legend span { display: flex; align-items: center; gap: 6px; }
      .donut-legend i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }

      .form-card { padding: 16px 18px; }
      .form-row { display: flex; gap: 8px; flex-wrap: wrap; }
      .form-row-tight { margin-top: 10px; }
      .input, .select {
        font-family: inherit; font-size: 13.5px; padding: 10px 13px;
        border: 1px solid var(--line); background: var(--bg); color: var(--ink);
        border-radius: 12px; flex: 1; min-width: 120px;
      }
      .input-date, .input-time { flex: 0 0 130px; font-size: 12.5px; }
      .input-amount { flex: 0 0 110px; }
      .input-num { flex: 0 0 68px; min-width: 60px; }
      .select { flex: 0 0 140px; }
      .input:focus, .select:focus { outline: none; border-color: var(--primary); background: var(--card); }
      .btn {
        flex: 0 0 auto; display: flex; align-items: center; justify-content: center;
        width: 38px; border: none; background: var(--btn-accent);
        color: #fff; cursor: pointer; border-radius: 12px;
      }
      .btn:hover { filter: brightness(1.06); }
      .link-btn {
        border: none; background: none; color: var(--primary); font-family: inherit;
        font-size: 13px; font-weight: 600; cursor: pointer; padding: 4px 0;
      }

      .toggle { display: flex; background: var(--bg); border-radius: 12px; padding: 3px; flex: 0 0 auto; }
      .toggle-btn { border: none; background: transparent; padding: 7px 13px; border-radius: 9px; font-family: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; color: var(--ink-soft); }
      .toggle-btn-active { background: var(--acc-savings); color: #fff; }

      .list-card { background: var(--card); border-radius: 20px; padding: 4px 18px; box-shadow: var(--shadow); margin-bottom: 14px; }
      .list-compact { box-shadow: none; padding: 4px 0 0; margin-top: 10px; margin-bottom: 0; border-top: 1px solid var(--line); }
      .list-row { display: flex; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid var(--line); font-size: 13.5px; }
      .list-row-stack { flex-direction: column; align-items: stretch; gap: 6px; }
      .list-row-main { display: flex; align-items: center; gap: 10px; }
      .routine-details { margin: 0 0 0 30px; padding-left: 14px; font-size: 12px; color: var(--ink-soft); display: flex; flex-direction: column; gap: 3px; }
      .routine-detail-btn {
        border: none; background: none; padding: 0; margin: 0; text-align: left; cursor: pointer;
        font-family: inherit; font-size: 12px; color: var(--ink-soft); text-decoration: underline dotted;
        text-underline-offset: 3px;
      }
      .routine-detail-btn:hover { color: var(--acc-routine); }
      .routine-detail-explain { margin: 4px 0 2px; font-size: 11.5px; color: var(--ink); background: var(--bg); border-radius: 8px; padding: 8px 10px; line-height: 1.5; }
      .routine-sub-row { display: flex; align-items: center; gap: 8px; }
      .check-sm { width: 16px; height: 16px; border-radius: 5px; flex-shrink: 0; }
      .check-partial { background: color-mix(in srgb, var(--check-accent) 35%, var(--card)); border-color: var(--check-accent); }
      .check-dash { width: 8px; height: 2px; background: var(--check-accent); border-radius: 1px; display: block; }
      .task-edit-row { flex-wrap: wrap; }
      .task-edit-row .input, .task-edit-row .select { flex: 1 1 140px; }
      .list-row:last-child { border-bottom: none; }
      .list-text { flex: 1; }
      .list-text-done { text-decoration: line-through; color: var(--ink-soft); }
      .mono-tag { font-size: 11.5px; color: var(--ink-soft); flex-shrink: 0; background: var(--bg); padding: 3px 8px; border-radius: 8px; }
      .icon-btn { border: none; background: none; color: var(--ink-soft); cursor: pointer; padding: 4px; flex-shrink: 0; border-radius: 8px; }
      .icon-btn:hover { color: var(--ink); background: var(--bg); }
      .amount-in { font-weight: 700; color: var(--acc-savings); font-size: 13px; }
      .amount-out { font-weight: 700; color: var(--acc-gym); font-size: 13px; }

      .check { width: 20px; height: 20px; flex-shrink: 0; border-radius: 7px; border: 1.5px solid var(--line); background: #fff; display: flex; align-items: center; justify-content: center; color: #fff; cursor: pointer; padding: 0; }
      .check-done { background: var(--check-accent); border-color: var(--check-accent); }

      .empty { color: var(--ink-soft); font-size: 13.5px; padding: 24px 0; text-align: center; }

      .date-switch, .cal-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
      .date-switch { flex-wrap: wrap; row-gap: 8px; }
      .chip { border: none; background: var(--bg); width: 28px; height: 28px; border-radius: 9px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--ink); }
      .chip-label { font-size: 13.5px; color: var(--ink-soft); font-weight: 500; }
      .cal-month { text-transform: capitalize; font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 15px; color: var(--ink); }

      .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; max-width: 460px; }
      .cal-dow { text-align: center; font-size: 10.5px; color: var(--ink-soft); padding-bottom: 6px; font-weight: 600; }
      .cal-cell {
        aspect-ratio: 1; border: none; background: var(--bg); cursor: pointer; border-radius: 11px;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        font-size: 12px; color: var(--ink); gap: 3px; position: relative;
      }
      .cal-cell-empty { background: transparent; cursor: default; }
      .cal-cell-today { background: var(--acc-day-soft); color: var(--acc-day); font-weight: 700; }
      .cal-cell-sel { background: var(--acc-day); color: #fff; font-weight: 700; }
      .cal-dot { width: 3px; height: 3px; background: var(--acc-day); border-radius: 50%; }
      .cal-cell-sel .cal-dot { background: #fff; }
      .cal-day-title { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 15px; margin-bottom: 12px; }

      .visibility-toggle {
        position: absolute; top: 16px; right: 16px; z-index: 5; border: none; background: var(--bg);
        color: var(--ink-soft); width: 30px; height: 30px; border-radius: 10px; display: flex;
        align-items: center; justify-content: center; cursor: pointer;
      }
      .visibility-toggle:hover { background: var(--primary-soft); color: var(--primary); }
      .blur-wrap { transition: filter .2s ease; }
      .blur-wrap-hidden { filter: blur(7px); user-select: none; }

      .progress-wrap { margin-top: 4px; }
      .progress-track { height: 8px; background: var(--bg); border-radius: 999px; overflow: hidden; }
      .progress-fill { height: 100%; border-radius: 999px; }
      .progress-meta { display: flex; align-items: center; gap: 10px; margin-top: 8px; font-size: 12px; color: var(--ink-soft); font-weight: 600; }
      .range { flex: 1; accent-color: var(--range-accent); }

      .goal-list { display: flex; flex-direction: column; gap: 14px; }
      .goal-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 12px; }
      .goal-card-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 15.5px; font-weight: 700; }
      .goal-card-meta { font-size: 12px; color: var(--ink-soft); margin-top: 2px; }

      .kanban-board { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; margin-top: 14px; }
      .kanban-col { flex: 1 1 220px; min-width: 220px; background: var(--bg); border-radius: 14px; padding: 12px; }
      .kanban-col-head { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 13px; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center; }
      .kanban-col-note { font-size: 10px; color: var(--ink-soft); margin-bottom: 10px; }
      .action-card { background: var(--card); border-radius: 12px; padding: 10px 12px; margin-bottom: 8px; box-shadow: var(--shadow); }
      .action-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; }
      .action-name { font-size: 12.5px; font-weight: 600; line-height: 1.4; }
      .action-blocked-note { margin-top: 8px; font-size: 11px; color: var(--acc-gym); background: var(--acc-gym-soft); padding: 6px 8px; border-radius: 8px; }
      .action-description { margin: 6px 0 0; font-size: 11.5px; color: var(--ink-soft); line-height: 1.5; cursor: pointer; }
      .action-move-btns { display: flex; align-items: center; gap: 4px; margin-top: 8px; }
      .action-task-row { margin-top: 8px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
      .hobby-title-row { display: flex; align-items: center; gap: 12px; }
      .hobby-goal-row { display: flex; align-items: center; gap: 8px; margin: 10px 0; }
      .zodiac-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(85px, 1fr)); gap: 10px; }
      .zodiac-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 8px; border: 1px solid var(--line); background: var(--bg); border-radius: 12px; cursor: pointer; font-family: inherit; font-size: 12px; color: var(--ink); }
      .zodiac-btn:hover { border-color: var(--acc-aesthetic); }
      .hobby-goal-row .input-num { width: 60px; }
      .avatar { width: 38px; height: 38px; border-radius: 12px; color: #fff; display: flex; align-items: center; justify-content: center; font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 15px; flex-shrink: 0; }

      .chart-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
      .chart-title { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 14.5px; }

      .section-heading { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; font-size: 16px; margin: 24px 0 12px; }
      .section-heading-gym { display: inline-flex; align-items: center; gap: 7px; color: var(--acc-gym); }
      .select-wide { flex: 1; }
      .toggle-btn-gym.toggle-btn-active { background: var(--acc-gym); }
      .logger-hint { font-size: 12px; color: var(--ink-soft); margin: -4px 0 12px; }
      .form-error { font-size: 12px; color: var(--acc-gym); font-weight: 600; margin: -6px 0 12px; }
      .budget-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
      .budget-card { background: var(--bg); border-radius: 14px; padding: 14px; }
      .budget-card-savings { background: var(--acc-savings-soft); border: 1px solid var(--acc-savings); }
      .budget-card-top { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
      .budget-card-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
      .budget-card-name { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 12.5px; flex: 1; }
      .budget-info-btn { width: 22px; height: 22px; flex-shrink: 0; color: var(--ink-soft); }
      .budget-info-note { font-size: 11px; color: var(--ink); background: var(--card); padding: 8px 10px; border-radius: 8px; margin: 0 0 10px; line-height: 1.5; }
      .budget-card-pct { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
      .budget-card-pct input { width: 36px; border: none; background: var(--card); border-radius: 6px; padding: 3px 4px; font-size: 12px; text-align: right; font-weight: 700; color: var(--ink); font-family: inherit; }
      .budget-card-pct span { font-size: 11px; color: var(--ink-soft); }
      .budget-bar-track { height: 8px; background: var(--card); border-radius: 5px; overflow: hidden; }
      .budget-bar-fill { height: 100%; border-radius: 5px; transition: width 0.3s; }
      .budget-card-figures { display: flex; justify-content: space-between; align-items: baseline; font-size: 11px; color: var(--ink-soft); margin-top: 8px; }

      .datepicker { position: relative; flex: 0 0 auto; }
      .datepicker-trigger {
        display: flex; align-items: center; gap: 7px; border: 1px solid var(--line); background: var(--bg);
        color: var(--ink); font-family: inherit; font-size: 12.5px; font-weight: 500; padding: 10px 13px;
        border-radius: 12px; cursor: pointer; white-space: nowrap;
      }
      .datepicker-trigger:hover { border-color: var(--primary); }
      .datepicker-backdrop { position: fixed; inset: 0; z-index: 90; background: rgba(20,20,30,0.35); }
      .datepicker-panel {
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 95; width: min(300px, 88vw);
        background: var(--card); border-radius: 18px; box-shadow: 0 24px 60px rgba(20,20,40,0.25); padding: 16px 18px;
        max-height: 80vh; overflow-y: auto;
      }

      .type-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; margin-bottom: 16px; }
      .type-card { border-radius: 20px; overflow: hidden; background: var(--card); box-shadow: var(--shadow); display: flex; flex-direction: column; }
      .type-card-open { grid-column: 1 / -1; }
      .type-card-highlight { box-shadow: 0 0 0 3px var(--acc-gym), var(--shadow); }
      .type-banner { height: 110px; display: flex; align-items: center; justify-content: center; color: #fff; }
      .type-banner-icon { opacity: 0.95; }
      .type-body { padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 9px; }
      .type-name { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 16.5px; }
      .type-exercises { display: flex; flex-wrap: wrap; gap: 5px; }
      .type-chip { font-size: 11px; background: var(--bg); color: var(--ink-soft); padding: 4px 9px; border-radius: 999px; }
      .type-counts { font-size: 12.5px; color: var(--ink-soft); }
      .type-counts strong { color: var(--ink); }
      .type-cta { margin-top: 2px; border: none; background: var(--bg); color: var(--ink); font-family: inherit; font-weight: 600; font-size: 13px; padding: 10px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; }
      .type-cta:hover { background: var(--primary-soft); color: var(--primary); }
      .type-logger { margin-top: 10px; padding-top: 14px; border-top: 1px solid var(--line); }
      .btn-wide { width: auto; padding: 0 18px; margin-top: 4px; }

      .logger-panel { background: var(--card); border-radius: 20px; padding: 18px 20px; box-shadow: var(--shadow); margin-bottom: 18px; }
      .logger-title { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 14.5px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; }
      .exercise-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
      .exercise-row .input { flex: 2; min-width: 100px; }
      .exercise-row .input-num { flex: 1; min-width: 50px; }

      .exercise-block { border: 1px solid var(--line); border-radius: 14px; padding: 10px 12px; margin-bottom: 8px; transition: opacity .15s ease; }
      .exercise-block-dragging { opacity: 0.4; }
      .exercise-row-top { display: flex; gap: 6px; align-items: center; }
      .exercise-row-top .input { flex: 1; }
      .drag-handle { display: flex; align-items: center; color: var(--ink-soft); cursor: grab; flex-shrink: 0; touch-action: none; }
      .drag-handle:active { cursor: grabbing; }
      .reorder-btns { display: flex; flex-direction: column; flex-shrink: 0; }
      .reorder-btns .icon-btn { padding: 0; height: 13px; }
      .reorder-btns .icon-btn:disabled { opacity: 0.25; cursor: default; }
      .exercise-summary { font-size: 11.5px; color: var(--ink-soft); margin-top: 6px; cursor: pointer; }
      .set-rows { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; }
      .set-row { display: flex; gap: 8px; align-items: center; }
      .set-index { font-size: 11px; color: var(--ink-soft); font-weight: 600; width: 20px; flex-shrink: 0; }
      .set-row .input-num { flex: 1; min-width: 60px; }
      .quick-reps-row { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
      .quick-reps-row .input-num { flex: 0 0 70px; }

      .breakdown-list { display: flex; flex-direction: column; }
      .breakdown-row { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--line); font-size: 13px; }
      .breakdown-row:last-child { border-bottom: none; }
      .breakdown-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
      .breakdown-name { flex: 1; }
      .breakdown-count { font-weight: 700; font-size: 11.5px; color: var(--ink-soft); }

      .event-type-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; font-weight: 600; padding: 3px 8px; border-radius: 999px; flex-shrink: 0; }

      .travel-map { width: 100%; height: auto; display: block; }
      .map-label { font-size: 11px; fill: var(--ink-soft); font-family: 'Inter', sans-serif; text-anchor: middle; pointer-events: none; }
      .map-pin { cursor: pointer; transition: r .12s ease; }
      .map-pin:hover { stroke-width: 2.5; }
      .map-legend { display: flex; align-items: center; gap: 16px; margin-top: 12px; font-size: 12px; color: var(--ink-soft); flex-wrap: wrap; }
      .map-legend span { display: flex; align-items: center; gap: 6px; }
      .map-legend-dot { width: 9px; height: 9px; border-radius: 50%; border: 1.5px solid var(--acc-travel); background: var(--card); display: inline-block; }
      .map-legend-dot-filled { background: var(--acc-travel); }
      .map-legend-hint { margin-left: auto; font-size: 11px; }

      .section-heading-count { font-family: 'Inter', sans-serif; font-weight: 500; font-size: 12.5px; color: var(--ink-soft); }
      .country-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 4px; }
      .country-chip {
        display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--line); background: var(--card);
        color: var(--ink-soft); font-family: inherit; font-size: 12.5px; font-weight: 500; padding: 7px 12px;
        border-radius: 999px; cursor: pointer;
      }
      .country-chip-active { background: var(--acc-travel-soft); border-color: var(--acc-travel-soft); color: var(--acc-travel); font-weight: 600; }
      .country-flag { font-size: 15px; line-height: 1; }
      .wishlist-chip {
        display: inline-flex; align-items: center; gap: 6px; background: var(--acc-travel-soft); color: var(--acc-travel);
        font-size: 12.5px; font-weight: 600; padding: 6px 6px 6px 12px; border-radius: 999px;
      }
      .wishlist-chip .icon-btn { color: var(--acc-travel); padding: 2px; }

      .nutrition-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
      .nutrition-day { margin-bottom: 0; }
      .nutrition-day-title { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 14.5px; margin-bottom: 10px; color: var(--acc-nutrition); }
      .nutrition-slot { margin-bottom: 8px; }
      .nutrition-slot:last-child { margin-bottom: 0; }
      .nutrition-slot-label { display: block; font-size: 11px; color: var(--ink-soft); font-weight: 600; margin-bottom: 4px; }
      .nutrition-slot .input { width: 100%; }
      .nutrition-slot-row { display: flex; gap: 6px; align-items: center; }
      .nutrition-slot-row .select { padding: 9px 10px; font-size: 12.5px; }
      .nutrition-slot-row .icon-btn { flex-shrink: 0; background: var(--bg); }

      .recipe-backdrop { position: fixed; inset: 0; z-index: 80; background: rgba(20,20,30,0.45); }
      .recipe-modal {
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 90;
        width: min(360px, 88vw); max-height: 80vh; overflow-y: auto; background: var(--card);
        border-radius: 20px; padding: 22px 24px; box-shadow: 0 24px 60px rgba(20,20,40,0.25);
      }
      .recipe-modal-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
      .recipe-modal-title { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 17px; }
      .recipe-modal-time { font-size: 12px; color: var(--ink-soft); margin-top: 2px; }
      .recipe-modal-subtitle { font-size: 12px; font-weight: 600; color: var(--acc-nutrition); text-transform: none; margin-bottom: 8px; }
      .recipe-ingredients { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 13.5px; color: var(--ink); }
      .shopping-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
      .shopping-list li { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--line); font-size: 13.5px; }
      .shopping-list li:last-child { border-bottom: none; }
      .ingredient-chip.country-chip-active { background: var(--acc-nutrition-soft); border-color: var(--acc-nutrition-soft); color: var(--acc-nutrition); }

      .curio-list { display: flex; flex-direction: column; }
      .curio-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--line); }
      .curio-row:last-child { border-bottom: none; padding-bottom: 0; }
      .curio-icon { width: 36px; height: 36px; border-radius: 11px; background: var(--acc-travel-soft); color: var(--acc-travel); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .curio-text { flex: 1; min-width: 0; }
      .curio-title { font-size: 12px; color: var(--ink-soft); font-weight: 500; }
      .curio-sub { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 14px; margin-top: 2px; }
      .curio-value { text-align: right; flex-shrink: 0; }
      .curio-km { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; font-size: 15px; color: var(--acc-travel); }
      .curio-time { font-size: 11px; color: var(--ink-soft); margin-top: 2px; }

      @media (max-width: 680px) {
        .wrap { flex-direction: column; min-height: 0; }
        .nav { flex-shrink: 0; scrollbar-width: none; }
        .nav::-webkit-scrollbar { display: none; }
        .nav { width: 100%; flex-direction: row; align-items: center; padding: 10px 12px; overflow-x: auto; gap: 10px; }
        .nav-brand { display: flex; padding: 0; flex-shrink: 0; }
        .nav-brand-label { display: none; }
        .save-all-btn { margin: 0; padding: 8px 10px; flex-shrink: 0; }
        .save-all-label { display: none; }
        .save-all-msg { display: none; }
        .nav-list { flex-direction: row; gap: 4px; }
        .nav-item { flex-direction: column; gap: 3px; white-space: nowrap; }
        .nav-item-main { flex-direction: column; align-items: center; gap: 3px; padding: 8px 12px; }
        .nav-item-dots, .nav-reorder-menu { display: none; }
        .nav-label { font-size: 10.5px; }
        .content { padding: 20px 16px 40px; }
        .grid-2 { grid-template-columns: 1fr; }
        .form-row { flex-direction: column; }
        .input, .select, .btn, .input-date, .input-time, .input-amount, .input-num { flex: 1 1 auto; width: 100%; }
        .btn { width: 100%; height: 40px; }
        .type-grid { grid-template-columns: repeat(2, 1fr); }
        .exercise-row { flex-wrap: wrap; }
        .exercise-row .input, .exercise-row .input-num { min-width: 70px; }
      }
    `}</style>
  );
}
