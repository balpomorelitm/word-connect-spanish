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

function findPlacement(baseWord, verticalWords) {
  if (!baseWord || !verticalWords.length) {
    return null;
  }

  const placements = [
    { word: baseWord, start_x: 0, start_y: 0, direction: 'horizontal' },
  ];

  const grid = new Map();
  const letterColumns = {};

  for (let x = 0; x < baseWord.length; x += 1) {
    const letter = baseWord[x];
    const key = `${x},0`;
    grid.set(key, letter);
    if (!letterColumns[letter]) {
      letterColumns[letter] = [];
    }
    letterColumns[letter].push(x);
  }

  const usedColumns = new Set();

  for (const word of verticalWords) {
    if (!word || word.length === 0) {
      return null;
    }

    const initial = word[0];
    const candidates = (letterColumns[initial] || []).filter((col) => !usedColumns.has(col));
    if (!candidates.length) {
      return null;
    }

    const column = candidates[0];

    for (let i = 0; i < word.length; i += 1) {
      const y = i;
      const key = `${column},${y}`;
      const existing = grid.get(key);
      const letter = word[i];
      if (existing && existing !== letter) {
        return null;
      }
    }

    usedColumns.add(column);

    for (let i = 0; i < word.length; i += 1) {
      const y = i;
      const key = `${column},${y}`;
      grid.set(key, word[i]);
    }

    placements.push({ word, start_x: column, start_y: 0, direction: 'vertical' });
  }

  return placements;
}

function permute(items) {
  if (items.length <= 1) {
    return [items.slice()];
  }

  const permutations = [];

  function backtrack(current, remaining) {
    if (!remaining.length) {
      permutations.push(current.slice());
      return;
    }

    for (let i = 0; i < remaining.length; i += 1) {
      current.push(remaining[i]);
      const nextRemaining = remaining.slice(0, i).concat(remaining.slice(i + 1));
      backtrack(current, nextRemaining);
      current.pop();
    }
  }

  backtrack([], items);
  return permutations;
}

function createLevelFromCombination(words) {
  for (let i = 0; i < words.length; i += 1) {
    const base = words[i];
    const verticalCandidates = words.filter((_, index) => index !== i);
    const permutations = permute(verticalCandidates);

    for (const option of permutations) {
      const layout = findPlacement(base, option);
      if (!layout) {
        continue;
      }

      const solutionWords = [base, ...option];
      return {
        solution_words: solutionWords,
        grid_layout: layout,
        letter_pool: buildLetterPool(solutionWords),
      };
    }
  }

  return null;
}

function combinations(array, size) {
  const result = [];

  function helper(start, combo) {
    if (combo.length === size) {
      result.push(combo.slice());
      return;
    }

    for (let i = start; i < array.length; i += 1) {
      combo.push(array[i]);
      helper(i + 1, combo);
      combo.pop();
    }
  }

  helper(0, []);
  return result;
}

function generateLevelsForUnit(words, levelsPerUnit) {
  const byInitial = new Map();

  for (const word of words) {
    if (word.length < 3) {
      continue;
    }
    const initial = word[0];
    if (!byInitial.has(initial)) {
      byInitial.set(initial, []);
    }
    byInitial.get(initial).push(word);
  }

  const generated = [];
  const seenCombos = new Set();

  for (const group of byInitial.values()) {
    if (group.length < 2) {
      continue;
    }

    group.sort((a, b) => {
      if (b.length !== a.length) {
        return b.length - a.length;
      }
      return a.localeCompare(b);
    });

    for (const comboSize of [2, 3]) {
      if (group.length < comboSize) {
        continue;
      }

      for (const combo of combinations(group, comboSize)) {
        const key = combo.slice().sort().join('|');
        if (seenCombos.has(key)) {
          continue;
        }

        const level = createLevelFromCombination(combo);
        if (!level) {
          continue;
        }

        seenCombos.add(key);
        generated.push(level);
      }
    }
  }

  generated.sort((a, b) => {
    const lengthDiff = b.solution_words[0].length - a.solution_words[0].length;
    if (lengthDiff !== 0) {
      return lengthDiff;
    }
    return a.solution_words.join('|').localeCompare(b.solution_words.join('|'));
  });

  if (generated.length <= levelsPerUnit) {
    return generated.slice();
  }

  return generated.slice(0, levelsPerUnit);
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
  findPlacement,
  generateLevelsForUnit,
};
