// generate_puzzles.js
// Generador de puzzles mejorado para Word Connect Spanish
// Cambios principales:
// - Solo permite cruces en letras IDÉNTICAS
// - Pool de letras respeta repeticiones (no usa Set)
// - Lee span10011002.json y filtra lexías simples
// - Genera dictionary.json automáticamente

const fs = require('fs');
const https = require('https');

/**
 * Descarga contenido de URL usando https
 */
function fetchRaw(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * Normaliza una palabra del glosario:
 * - Elimina artículos iniciales (el, la, los, las)
 * - Toma solo la primera forma (niño/niña -> niño)
 * - Descarta colocaciones (palabras con espacios)
 * - Convierte a mayúsculas
 * - Elimina puntuación
 */
function normalizeWord(word) {
  if (!word || typeof word !== 'string') return null;
  
  let normalized = word.trim();
  
  // Quitar artículos iniciales
  normalized = normalized.replace(/^(el|la|los|las)\s+/i, '');
  
  // Tomar solo primera forma (niño/niña -> niño)
  normalized = normalized.split('/')[0];
  
  // Descartar colocaciones (palabras con espacios)
  if (/\s/.test(normalized)) return null;
  
  // Eliminar puntuación
  normalized = normalized.replace(/[\"'().,;:!?¡¿\-]/g, '');
  
  return normalized.toUpperCase();
}

/**
 * Carga el glosario desde archivo local o URL
 * Retorna objeto con palabras organizadas por unidad
 */
async function loadGlossary(source, unitKey = 'unidad', lemmaKey = 'lema') {
  // Determinar si es URL o archivo local
  const rawContent = /^https?:/.test(source)
    ? await fetchRaw(source)
    : fs.readFileSync(source, 'utf8');
  
  const json = JSON.parse(rawContent);
  const items = Array.isArray(json) ? json : (json.items || json.data || []);
  
  const byUnit = {};
  
  for (const item of items) {
    const unit = String(item[unitKey] ?? '1').trim();
    const lemma = item[lemmaKey] ?? item.palabra ?? item.entrada ?? item.term;
    const word = normalizeWord(lemma);
    
    if (!word) continue;
    
    if (!byUnit[unit]) byUnit[unit] = new Set();
    byUnit[unit].add(word);
  }
  
  // Convertir Sets a arrays
  Object.keys(byUnit).forEach(key => {
    byUnit[key] = Array.from(byUnit[key]);
  });
  
  return byUnit;
}

/**
 * Construye pool de letras respetando repeticiones
 * NO usa Set - cuenta el máximo de repeticiones por letra entre todas las palabras
 */
function buildLetterPool(words, distractorCount = 1) {
  const maxCounts = {};
  
  // Contar máximo de repeticiones por letra
  for (const word of words) {
    const letterCounts = {};
    for (const char of word) {
      letterCounts[char] = (letterCounts[char] || 0) + 1;
    }
    
    // Actualizar máximo global
    for (const [char, count] of Object.entries(letterCounts)) {
      maxCounts[char] = Math.max(maxCounts[char] || 0, count);
    }
  }
  
  // Construir pool con todas las repeticiones
  const pool = [];
  for (const [char, count] of Object.entries(maxCounts)) {
    pool.push(...Array(count).fill(char));
  }
  
  // Añadir letras distractoras (que no estén ya en el pool)
  const alphabet = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
  let added = 0;
  while (added < distractorCount) {
    const randomChar = alphabet[Math.floor(Math.random() * alphabet.length)];
    if (!pool.includes(randomChar)) {
      pool.push(randomChar);
      added++;
    }
  }
  
  // Mezclar aleatoriamente
  return pool.sort(() => Math.random() - 0.5);
}

/**
 * Coloca 2 o 3 palabras en layout de crucigrama
 * Reglas:
 * - Primera palabra (base) horizontal en (0,0)
 * - Siguientes palabras verticales, cruzando en letras IDÉNTICAS
 * - Prioriza cruce en letra inicial compartida
 * - Para 3 palabras, usa columnas diferentes
 */
function layoutTwoOrThree(words) {
  // Ordenar por longitud (más larga primero)
  const base = words.slice().sort((a, b) => b.length - a.length)[0];
  const others = words.filter(w => w !== base);
  
  const layout = [{
    word: base,
    start_x: 0,
    start_y: 0,
    direction: 'horizontal'
  }];
  
  /**
   * Coloca una palabra vertical buscando cruce en letra idéntica
   */
  const placeVertical = (word, avoidColumns = new Set()) => {
    // Preferir columna 0 si la inicial coincide
    if (word[0] === base[0] && !avoidColumns.has(0)) {
      layout.push({
        word: word,
        start_x: 0,
        start_y: 0,
        direction: 'vertical'
      });
      return true;
    }
    
    // Buscar otra posición donde la inicial del vertical coincida con base
    for (let i = 0; i < base.length; i++) {
      if (word[0] === base[i] && !avoidColumns.has(i)) {
        layout.push({
          word: word,
          start_x: i,
          start_y: 0,
          direction: 'vertical'
        });
        return true;
      }
    }
    
    return false;
  };
  
  // Colocar primera vertical
  if (!placeVertical(others[0])) return null;
  
  // Colocar segunda vertical si existe
  if (others[1]) {
    const usedColumns = new Set(
      layout.filter(l => l.direction === 'vertical').map(l => l.start_x)
    );
    if (!placeVertical(others[1], usedColumns)) return null;
  }
  
  return { layout };
}

/**
 * Genera un nivel completo a partir de palabras
 */
function generateLevelFrom(words) {
  const plan = layoutTwoOrThree(words);
  if (!plan) return null;
  
  return {
    solution_words: words,
    letter_pool: buildLetterPool(words, 1),
    grid_layout: plan.layout
  };
}

/**
 * Selecciona elemento aleatorio de array
 */
function pick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Función principal
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Helper para obtener argumentos
  const getArg = (key, defaultValue) => {
    const index = args.indexOf(key);
    return index >= 0 ? args[index + 1] : defaultValue;
  };
  
  const glossaryPath = getArg('--glossary', 'span10011002.json');
  const levelsPerUnit = parseInt(getArg('--levels', '40'), 10);
  const unitKey = getArg('--unitKey', 'unidad');
  const lemmaKey = getArg('--lemmaKey', 'lema');
  
  console.log('🔄 Cargando glosario desde:', glossaryPath);
  const wordsByUnit = await loadGlossary(glossaryPath, unitKey, lemmaKey);
  
  console.log('📚 Unidades encontradas:', Object.keys(wordsByUnit).length);
  
  const allLevels = {};
  
  // Generar niveles para cada unidad
  for (const [unit, rawWords] of Object.entries(wordsByUnit)) {
    console.log(`\n📝 Generando niveles para unidad ${unit}...`);
    
    // Filtrar palabras de al menos 3 letras
    const pool = rawWords.filter(w => w.length >= 3);
    console.log(`   Palabras disponibles: ${pool.length}`);
    
    const levels = [];
    let attempts = 0;
    const maxAttempts = levelsPerUnit * 30;
    
    while (levels.length < levelsPerUnit && attempts < maxAttempts) {
      attempts++;
      
      // Elegir palabra base
      const base = pick(pool);
      
      // Buscar palabras con misma inicial (mejor para cruces)
      const sameInitial = pool.filter(w => w !== base && w[0] === base[0]);
      
      // Si no hay con misma inicial, buscar cualquiera con letra compartida
      const candidates = sameInitial.length
        ? sameInitial
        : pool.filter(w => w !== base && [...w].some(ch => base.includes(ch)));
      
      if (!candidates.length) continue;
      
      const second = pick(candidates);
      
      // 50% probabilidad de añadir tercera palabra
      const third = Math.random() < 0.5
        ? pick(candidates.filter(w => w !== second))
        : null;
      
      const wordSet = [base, second].concat(third ? [third] : []);
      const uniqueWords = [...new Set(wordSet)];
      
      if (uniqueWords.length < 2) continue;
      
      const level = generateLevelFrom(uniqueWords);
      if (level) {
        level.level_id = `u${unit}_l${levels.length + 1}`;
        levels.push(level);
      }
    }
    
    console.log(`   ✅ Generados ${levels.length} niveles`);
    allLevels[`unit_${unit}`] = levels;
  }
  
  // Guardar niveles generados
  fs.writeFileSync(
    'levels_generated.json',
    JSON.stringify(allLevels, null, 2)
  );
  console.log('\n✅ Archivo generado: levels_generated.json');
  
  // Generar diccionario de bonus words
  const allWords = Object.values(wordsByUnit)
    .flat()
    .map(w => w.toLowerCase());
  const dictionary = [...new Set(allWords)].sort();
  
  fs.writeFileSync(
    'dictionary.json',
    JSON.stringify(dictionary, null, 2)
  );
  console.log('✅ Archivo generado: dictionary.json');
  console.log(`📊 Total de palabras en diccionario: ${dictionary.length}`);
  
  console.log('\n🎉 ¡Listo! Puedes copiar levels_generated.json a levels.json');
}

// Ejecutar si es el archivo principal
if (require.main === module) {
  main().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
}

module.exports = {
  normalizeWord,
  loadGlossary,
  buildLetterPool,
  generateLevelFrom
};