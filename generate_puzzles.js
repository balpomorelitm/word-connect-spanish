const fs = require('fs');
const http = require('http');
const https = require('https');

function fetchFromUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Request failed with status ${res.statusCode}`));
          return;
        }
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => resolve(data));
      })
      .on('error', reject);
  });
}

function normalizeWord(rawWord) {
  if (!rawWord || typeof rawWord !== 'string') {
    return null;
  }

  let word = rawWord.trim();
  if (!word) {
    return null;
  }

  word = word.replace(/^(el|la|los|las)\s+/i, '');
  word = word.split('/')[0].trim();
  if (!word || /\s/.test(word)) {
    return null;
  }

  word = word.replace(/["'().,;:!?¡¿\-]/g, '');
  if (!word) {
    return null;
  }

  word = word.toLocaleLowerCase('es-ES');
  word = word
    .replace(/[áäâà]/g, 'a')
    .replace(/[éëêè]/g, 'e')
    .replace(/[íïîì]/g, 'i')
    .replace(/[óöôò]/g, 'o')
    .replace(/[úüûù]/g, 'u');

  word = word.toLocaleUpperCase('es-ES');

  if (!/^[A-ZÑ]+$/.test(word)) {
    return null;
  }

  return word;
}

function extractUnitIdentifier(rawUnit) {
  if (rawUnit === undefined || rawUnit === null) {
    return '1';
  }

  if (typeof rawUnit === 'number') {
    return String(rawUnit);
  }

  const text = String(rawUnit).trim();
  if (!text) {
    return '1';
  }

  const match = text.match(/U(\d+)/i);
  if (match) {
    return match[1];
  }

  const digits = text.match(/\d+/);
  if (digits) {
    return digits[0];
  }

  return text;
}

async function loadGlossary(source, unitKey = 'Lugar en el libro', lemmaKey = 'Unidad Léxica (Español)') {
  const rawData = /^https?:\/\//i.test(source)
    ? await fetchFromUrl(source)
    : fs.readFileSync(source, 'utf8');

  const entries = JSON.parse(rawData);
  const items = Array.isArray(entries) ? entries : entries.items || entries.data || [];

  const byUnit = new Map();
  const allWords = new Set();

  for (const item of items) {
    const unitValue = item?.[unitKey];
    const unit = extractUnitIdentifier(unitValue);
    const rawLemma =
      item?.[lemmaKey] ?? item?.palabra ?? item?.entrada ?? item?.term ?? item?.lema ?? null;

    const normalized = normalizeWord(rawLemma);
    if (!normalized) {
      continue;
    }

    allWords.add(normalized);

    if (!byUnit.has(unit)) {
      byUnit.set(unit, new Set());
    }
    byUnit.get(unit).add(normalized);
  }

  const units = {};
  for (const [unit, words] of byUnit.entries()) {
    units[unit] = Array.from(words).sort();
  }

  return { units, allWords: Array.from(allWords).sort() };
}

function buildLetterPool(words) {
  const maxCounts = {};

  for (const word of words) {
    const localCounts = {};
    for (const letter of word) {
      localCounts[letter] = (localCounts[letter] || 0) + 1;
    }
    for (const [letter, count] of Object.entries(localCounts)) {
      if (!maxCounts[letter] || count > maxCounts[letter]) {
        maxCounts[letter] = count;
      }
    }
  }

  return Object.keys(maxCounts)
    .sort()
    .flatMap((letter) => Array(maxCounts[letter]).fill(letter));
}

function sharedLetterCount(a, b) {
  const setA = new Set(a.split(''));
  let count = 0;
  for (const letter of new Set(b.split(''))) {
    if (setA.has(letter)) {
      count += 1;
    }
  }
  return count;
}

function calculateOverlapScore(words) {
  let totalOverlap = 0;
  for (let i = 0; i < words.length; i += 1) {
    for (let j = i + 1; j < words.length; j += 1) {
      totalOverlap += sharedLetterCount(words[i], words[j]);
    }
  }
  return totalOverlap;
}

function haveSharedLetters(a, b) {
  return sharedLetterCount(a, b) > 0;
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function coordinateKey(x, y) {
  return `${x},${y}`;
}

function canPlaceWord(word, startX, startY, direction, grid) {
  let touchesExisting = false;

  for (let i = 0; i < word.length; i += 1) {
    const x = direction === 'horizontal' ? startX + i : startX;
    const y = direction === 'vertical' ? startY + i : startY;
    const key = coordinateKey(x, y);
    const existing = grid.get(key);

    if (existing) {
      if (existing.letter !== word[i]) {
        return false;
      }
      touchesExisting = true;
    }
  }

  return touchesExisting;
}

function placeWordOnGrid(word, startX, startY, direction, grid, placements) {
  const placement = { word, start_x: startX, start_y: startY, direction };
  placements.push(placement);

  for (let i = 0; i < word.length; i += 1) {
    const x = direction === 'horizontal' ? startX + i : startX;
    const y = direction === 'vertical' ? startY + i : startY;
    const key = coordinateKey(x, y);
    const letter = word[i];

    const cell = grid.get(key);
    if (cell) {
      cell.words.add(word);
    } else {
      grid.set(key, { letter, words: new Set([word]) });
    }
  }

  return placement;
}

function removeWordFromGrid(placement, grid, placements) {
  placements.pop();

  const { word, start_x: startX, start_y: startY, direction } = placement;
  for (let i = 0; i < word.length; i += 1) {
    const x = direction === 'horizontal' ? startX + i : startX;
    const y = direction === 'vertical' ? startY + i : startY;
    const key = coordinateKey(x, y);
    const cell = grid.get(key);

    if (!cell) {
      continue;
    }

    cell.words.delete(word);
    if (cell.words.size === 0) {
      grid.delete(key);
    }
  }
}

function findPlacementsForWord(word, placements, grid) {
  const options = [];
  const seen = new Set();

  for (const placed of placements) {
    const otherWord = placed.word;

    for (let otherIndex = 0; otherIndex < otherWord.length; otherIndex += 1) {
      const letter = otherWord[otherIndex];
      for (let wordIndex = 0; wordIndex < word.length; wordIndex += 1) {
        if (word[wordIndex] !== letter) {
          continue;
        }

        let startX;
        let startY;
        let direction;

        if (placed.direction === 'horizontal') {
          direction = 'vertical';
          const x = placed.start_x + otherIndex;
          const y = placed.start_y;
          startX = x;
          startY = y - wordIndex;
        } else {
          direction = 'horizontal';
          const x = placed.start_x;
          const y = placed.start_y + otherIndex;
          startX = x - wordIndex;
          startY = y;
        }

        if (!canPlaceWord(word, startX, startY, direction, grid)) {
          continue;
        }

        const key = `${startX},${startY},${direction}`;
        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        options.push({ word, start_x: startX, start_y: startY, direction });
      }
    }
  }

  return shuffleArray(options);
}

function normalizePlacements(placements) {
  let minX = Infinity;
  let minY = Infinity;

  for (const placement of placements) {
    minX = Math.min(minX, placement.start_x);
    minY = Math.min(minY, placement.start_y);
  }

  const shiftX = Number.isFinite(minX) && minX < 0 ? -minX : 0;
  const shiftY = Number.isFinite(minY) && minY < 0 ? -minY : 0;

  return placements.map((placement) => ({
    word: placement.word,
    start_x: placement.start_x + shiftX,
    start_y: placement.start_y + shiftY,
    direction: placement.direction,
  }));
}

function buildCrosswordFromOrder(order, baseOrientation) {
  if (!order.length) {
    return null;
  }

  const grid = new Map();
  const placements = [];

  placeWordOnGrid(order[0], 0, 0, baseOrientation, grid, placements);

  const remaining = order.slice(1).sort((a, b) => b.length - a.length);

  function backtrack(index) {
    if (index >= remaining.length) {
      return true;
    }

    const word = remaining[index];
    const options = findPlacementsForWord(word, placements, grid);

    for (const option of options) {
      const placed = placeWordOnGrid(
        option.word,
        option.start_x,
        option.start_y,
        option.direction,
        grid,
        placements,
      );

      if (backtrack(index + 1)) {
        return true;
      }

      removeWordFromGrid(placed, grid, placements);
    }

    return false;
  }

  if (!backtrack(0)) {
    return null;
  }

  return normalizePlacements(placements);
}

function generateAllPermutations(words) {
  if (words.length <= 1) {
    return [words.slice()];
  }

  const results = [];

  function permute(remaining, current) {
    if (!remaining.length) {
      results.push(current.slice());
      return;
    }

    for (let i = 0; i < remaining.length; i += 1) {
      const nextRemaining = remaining.slice(0, i).concat(remaining.slice(i + 1));
      current.push(remaining[i]);
      permute(nextRemaining, current);
      current.pop();
    }
  }

  permute(words, []);
  return results;
}

function createCrossword(words) {
  if (!words.length) {
    return null;
  }

  const uniqueWords = Array.from(new Set(words));
  if (uniqueWords.length !== words.length) {
    return null;
  }

  const shuffledWords = shuffleArray(uniqueWords.slice());
  const firstWord = shuffledWords.shift();
  if (!firstWord) {
    return null;
  }

  const grid = new Map();
  const placements = [];
  const initialOrientation = Math.random() < 0.5 ? 'horizontal' : 'vertical';
  placeWordOnGrid(firstWord, 0, 0, initialOrientation, grid, placements);

  const remaining = new Set(shuffledWords);
  const maxFailures = uniqueWords.length * 20;
  let failures = 0;

  while (remaining.size > 0 && failures < maxFailures) {
    const basePlacement = placements[Math.floor(Math.random() * placements.length)];
    const baseWord = basePlacement.word;
    const letterIndices = shuffleArray(Array.from({ length: baseWord.length }, (_, index) => index));

    let placed = false;

    for (const baseIndex of letterIndices) {
      const letter = baseWord[baseIndex];
      const candidates = shuffleArray(
        Array.from(remaining).filter((word) => word.includes(letter)),
      );

      if (!candidates.length) {
        continue;
      }

      const anchorX =
        basePlacement.direction === 'horizontal'
          ? basePlacement.start_x + baseIndex
          : basePlacement.start_x;
      const anchorY =
        basePlacement.direction === 'vertical'
          ? basePlacement.start_y + baseIndex
          : basePlacement.start_y;

      const newDirection = basePlacement.direction === 'horizontal' ? 'vertical' : 'horizontal';

      for (const candidate of candidates) {
        const candidateIndices = shuffleArray(
          Array.from({ length: candidate.length }, (_, index) => index).filter(
            (index) => candidate[index] === letter,
          ),
        );

        for (const candidateIndex of candidateIndices) {
          const startX = newDirection === 'horizontal' ? anchorX - candidateIndex : anchorX;
          const startY = newDirection === 'vertical' ? anchorY - candidateIndex : anchorY;

          if (!canPlaceWord(candidate, startX, startY, newDirection, grid)) {
            continue;
          }

          placeWordOnGrid(candidate, startX, startY, newDirection, grid, placements);
          remaining.delete(candidate);
          placed = true;
          break;
        }

        if (placed) {
          break;
        }
      }

      if (placed) {
        break;
      }
    }

    if (!placed) {
      failures += 1;
    } else {
      failures = 0;
    }
  }

  if (remaining.size > 0) {
    return null;
  }

  return normalizePlacements(placements);
}

function chooseWordCount(currentCount, levelsPerUnit, availableCount) {
  if (availableCount < 2) {
    return 0;
  }

  const progress = levelsPerUnit > 0 ? currentCount / levelsPerUnit : 0;

  if (availableCount === 2) {
    return 2;
  }

  if (progress < 0.25) {
    return Math.min(3, availableCount);
  }

  if (availableCount === 3) {
    if (progress > 0.6) {
      return 3;
    }
    return Math.random() < 0.5 ? 3 : 2;
  }

  if (progress < 0.6) {
    return Math.min(Math.random() < 0.6 ? 3 : 4, availableCount);
  }

  return Math.min(Math.random() < 0.5 ? 4 : 3, availableCount);
}

function selectWordCombo(words, targetSize, preferHighOverlap = false) {
  if (words.length < targetSize || targetSize < 2) {
    return null;
  }

  const attempts = Math.min(words.length * 6, 150);
  let bestCombo = null;
  let bestScore = preferHighOverlap ? -1 : Infinity;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const shuffled = shuffleArray(words.slice());
    const selected = [shuffled[0]];

    while (selected.length < targetSize) {
      const joinedLetters = selected.join('');
      const candidates = shuffled.filter((word) => {
        if (selected.includes(word)) {
          return false;
        }
        return sharedLetterCount(word, joinedLetters) > 0;
      });

      if (!candidates.length) {
        break;
      }

      candidates.sort((a, b) => {
        const overlapA = sharedLetterCount(a, joinedLetters);
        const overlapB = sharedLetterCount(b, joinedLetters);
        if (overlapB !== overlapA) {
          return overlapB - overlapA;
        }
        return a.length - b.length;
      });

      const bestOverlap = sharedLetterCount(candidates[0], joinedLetters);
      const topCandidates = candidates.filter(
        (word) => sharedLetterCount(word, joinedLetters) >= bestOverlap - 1,
      );

      selected.push(topCandidates[Math.floor(Math.random() * topCandidates.length)]);
    }

    if (selected.length === targetSize) {
      const uniqueSelected = Array.from(new Set(selected));
      if (uniqueSelected.length === targetSize) {
        const score = calculateOverlapScore(uniqueSelected);

        if (preferHighOverlap) {
          if (score > bestScore) {
            bestScore = score;
            bestCombo = uniqueSelected.slice().sort();
          }
        } else if (score < bestScore) {
          bestScore = score;
          bestCombo = uniqueSelected.slice().sort();
        }
      }
    }
  }

  return bestCombo;
}

function generateLevelsForUnit(words, levelsPerUnit) {
  const eligibleWords = Array.from(
    new Set(
      words
        .map((word) => word.trim())
        .filter((word) => word && word.length >= 3),
    ),
  );

  const availableCount = eligibleWords.length;
  if (availableCount < 2) {
    return [];
  }

  const desiredCandidates = Math.min(levelsPerUnit * 3, 180);
  const combosSeen = new Set();
  const generated = [];
  const maxAttempts = Math.max(levelsPerUnit * 400, 800);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (generated.length >= desiredCandidates) {
      break;
    }

    const progress = generated.length / levelsPerUnit;
    const preferHighOverlap = progress < 0.4;

    const desiredSize = chooseWordCount(generated.length, levelsPerUnit, availableCount);
    const targetSize = Math.min(desiredSize, availableCount);
    if (targetSize < 2) {
      continue;
    }

    const combo = selectWordCombo(eligibleWords, targetSize, preferHighOverlap);
    if (!combo) {
      continue;
    }

    const key = combo.join('|');
    if (combosSeen.has(key)) {
      continue;
    }

    const placements = createCrossword(combo);
    if (!placements) {
      continue;
    }

    const solutionWords = combo.slice();
    const level = {
      solution_words: solutionWords,
      grid_layout: placements,
      letter_pool: buildLetterPool(solutionWords),
    };

    combosSeen.add(key);

    const uniqueLetterCount = new Set(solutionWords.join('')).size;
    const maxWordLength = Math.max(...solutionWords.map((word) => word.length));

    generated.push({
      level,
      metrics: {
        wordCount: solutionWords.length,
        maxWordLength,
        uniqueLetterCount,
        overlapScore: calculateOverlapScore(solutionWords),
      },
    });
  }

  if (!generated.length) {
    return [];
  }

  generated.sort((a, b) => {
    if (a.metrics.wordCount !== b.metrics.wordCount) {
      return a.metrics.wordCount - b.metrics.wordCount;
    }
    if (a.metrics.overlapScore !== b.metrics.overlapScore) {
      return b.metrics.overlapScore - a.metrics.overlapScore;
    }
    if (a.metrics.maxWordLength !== b.metrics.maxWordLength) {
      return a.metrics.maxWordLength - b.metrics.maxWordLength;
    }
    if (a.metrics.uniqueLetterCount !== b.metrics.uniqueLetterCount) {
      return a.metrics.uniqueLetterCount - b.metrics.uniqueLetterCount;
    }
    return a.level.solution_words.join('|').localeCompare(b.level.solution_words.join('|'));
  });

  const limit = Math.min(levelsPerUnit, generated.length);
  return generated.slice(0, limit).map((entry) => entry.level);
}

async function main() {
  const args = process.argv.slice(2);
  const getOption = (flag, defaultValue) => {
    const index = args.indexOf(flag);
    if (index === -1 || index + 1 >= args.length) {
      return defaultValue;
    }
    return args[index + 1];
  };

  const glossarySource = getOption('--glossary', 'span10011002.json');
  const levelsPerUnit = Number.parseInt(getOption('--levels', '40'), 10);
  const unitKey = getOption('--unitKey', 'Lugar en el libro');
  const lemmaKey = getOption('--lemmaKey', 'Unidad Léxica (Español)');

  if (Number.isNaN(levelsPerUnit) || levelsPerUnit <= 0) {
    throw new Error('Levels per unit must be a positive integer');
  }

  const { units, allWords } = await loadGlossary(glossarySource, unitKey, lemmaKey);

  const levelsByUnit = {};

  for (const [unit, wordList] of Object.entries(units)) {
    const levels = generateLevelsForUnit(wordList, levelsPerUnit);
    levelsByUnit[`unit_${unit}`] = levels.map((level, index) => ({
      level_id: `u${unit}_l${index + 1}`,
      solution_words: level.solution_words,
      letter_pool: level.letter_pool,
      grid_layout: level.grid_layout,
    }));
  }

  fs.writeFileSync('levels.json', JSON.stringify(levelsByUnit, null, 2));

  const dictionary = Array.from(new Set(allWords.map((word) => word.toLowerCase()))).sort();
  fs.writeFileSync('dictionary.json', JSON.stringify(dictionary, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Error generating puzzles:');
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  loadGlossary,
  normalizeWord,
  buildLetterPool,
  sharedLetterCount,
  calculateOverlapScore,
  haveSharedLetters,
  createCrossword,
  generateLevelsForUnit,
};
