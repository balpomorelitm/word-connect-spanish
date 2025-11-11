// ... (todo el código que has puesto arriba como versión completa original)
// INICIO DEL BLOQUE NUEVO: función mejorada de createCrossword + utilidades
function createCrossword(words) {
  if (!words.length) {
    return null;
  }
  const uniqueWords = Array.from(new Set(words));
  if (uniqueWords.length !== words.length) {
    return null;
  }

  // Prueba TODOS los órdenes posibles y posiciones base
  let bestPlacements = null;
  let bestScore = -1;
  const perms = generateAllPermutations(uniqueWords);

  for (const order of perms) {
    for (const orientation of ['horizontal', 'vertical']) {
      const placements = buildCrosswordFromOrder(order, orientation);
      if (placements) {
        // Penaliza cruces solo en primeras letras, premia variedad
        let minCrossDist = Number.MAX_SAFE_INTEGER;
        let crossCount = 0;
        if (placements.length > 1) {
          for (let i = 1; i < placements.length; i++) {
            let cellDelta = Math.abs(placements[i].start_x - placements[0].start_x) + Math.abs(placements[i].start_y - placements[0].start_y);
            if (cellDelta > 0) {
              minCrossDist = Math.min(minCrossDist, cellDelta);
              crossCount++;
            }
          }
        }
        // Criterio de puntuación: más cruces lejanos, más palabras cruzadas
        let score = crossCount * 5 - minCrossDist;
        if (score > bestScore) {
          bestScore = score;
          bestPlacements = placements;
        }
      }
    }
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
// ... (resto del archivo igual)
