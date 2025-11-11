function createCrossword(words) {
  if (!words.length) {
    return null;
  }
  const uniqueWords = Array.from(new Set(words));
  if (uniqueWords.length !== words.length) {
    return null;
  }

  // Nuevo: probar TODOS los órdenes y todas las posiciones base
  // Mezcla todos los órdenes posibles para maximizar cruces variados
  let bestPlacements = null;
  let bestScore = -1;
  let attempts = 0;
  const MAX_ATTEMPTS = uniqueWords.length > 1 ? Math.min(120, factorial(uniqueWords.length)) : 1;
  const perms = generateAllPermutations(uniqueWords);

  for (const order of perms) {
    for (const orientation of ['horizontal', 'vertical']) {
      const placements = buildCrosswordFromOrder(order, orientation);
      if (placements) {
        // Analiza la posición de cruce, evitando primeras letras
        let minCrossPos = Number.MAX_SAFE_INTEGER;
        if (placements.length > 1) {
          for (let i = 1; i < placements.length; i++) {
            let overlap = Math.abs(placements[i].start_x - placements[0].start_x) + Math.abs(placements[i].start_y - placements[0].start_y);
            if (overlap > 0) {
              minCrossPos = Math.min(minCrossPos, overlap);
            }
          }
        }
        // Premia cruces alejados de posición 0
        let score = -minCrossPos;
        // Si hay varios cruces en posiciones distintas, mejor
        score += placements.length * 2;
        if (score > bestScore) {
          bestScore = score;
          bestPlacements = placements;
        }
      }
      attempts++;
      if (attempts >= MAX_ATTEMPTS) break;
    }
    if (attempts >= MAX_ATTEMPTS) break;
  }

  return bestPlacements;
}

function generateAllPermutations(arr) {
  if (arr.length <= 1) return [arr];
  const results = [];
  function permute(subarr, m = []) {
    if (!subarr.length) {
      results.push(m);
    } else {
      for (let i = 0; i < subarr.length; i++) {
        let curr = subarr.slice();
        permute(curr.splice(i, 1), m.concat([subarr[i]]));
      }
    }
  }
  permute(arr);
  return results;
}

function factorial(n) {
  let res = 1;
  for (let i = 2; i <= n; ++i) res *= i;
  return res;
}

// Reemplaza el bloque original dentro de generate_puzzles.js
// El resto del archivo permanece igual hasta usar esta función en el generador de niveles