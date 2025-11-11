/**
 * Puzzle Generator for Word Connect Game
 * 
 * Reads vocabulary from span10011002.json glossary file
 * Filters simple lexical units (no spaces, articles, or compound forms)
 * Generates crossword puzzles with valid letter intersections only
 * Creates proper letter pools with all necessary repetitions
 * 
 * Run with: node generate_puzzles.js
 * Or with custom glossary: node generate_puzzles.js --glossary span10011002.json --levels 40
 */

const fs = require('fs');
const https = require('https');
const http = require('http');

// Configuration
const CONFIG = {
    MIN_WORDS_PER_PUZZLE: 2,
    MAX_WORDS_PER_PUZZLE: 3,
    MAX_ATTEMPTS: 100,
    DISTRACTOR_LETTERS: 1,
    DEFAULT_LEVELS_PER_UNIT: 40
};

/**
 * Fetch content from URL (supports http and https)
 */
function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

/**
 * Normalize a word from glossary:
 * - Remove leading articles (el, la, los, las)
 * - Take only first form in cases like "niño/niña"
 * - Discard phrases with spaces (collocations)
 * - Remove punctuation
 * - Convert to uppercase
 * Returns null if word should be excluded
 */
function normalizeWord(rawWord) {
    if (!rawWord || typeof rawWord !== 'string') return null;
    
    let word = rawWord.trim();
    
    // Remove leading articles
    word = word.replace(/^(el|la|los|las)\s+/i, '');
    
    // Take only first form (before slash)
    word = word.split('/')[0].trim();
    
    // Discard if contains spaces (collocations/phrases)
    if (/\s/.test(word)) return null;
    
    // Remove punctuation
    word = word.replace(/["'().,;:!?¡¿\-]/g, '');
    
    // Must have at least 3 letters for crossword
    if (word.length < 3) return null;
    
    return word.toUpperCase();
}

/**
 * Load glossary from local file or URL
 * Returns object mapping unit numbers to arrays of normalized words
 */
async function loadGlossary(source, unitKey = '_', lemmaKey = 'Unidad Léxica (Español)') {
    console.log(`Loading glossary from: ${source}`);
    
    let rawData;
    if (/^https?:\/\//i.test(source)) {
        rawData = await fetchUrl(source);
    } else {
        rawData = fs.readFileSync(source, 'utf8');
    }
    
    const json = JSON.parse(rawData);
    const items = Array.isArray(json) ? json : (json.items || json.data || []);
    
    console.log(`Loaded ${items.length} entries from glossary`);
    
    const byUnit = {};
    let totalFiltered = 0;
    
    for (const item of items) {
        // Extract unit number from the _ field (e.g., "3" from item._)
        const unitNum = String(item[unitKey] || '1').trim();
        
        // Extract the Spanish lexical unit
        const lemma = item[lemmaKey] || item.palabra || item.entrada || item.term;
        
        const normalized = normalizeWord(lemma);
        if (normalized) {
            if (!byUnit[unitNum]) byUnit[unitNum] = new Set();
            byUnit[unitNum].add(normalized);
            totalFiltered++;
        }
    }
    
    // Convert Sets to Arrays
    Object.keys(byUnit).forEach(unit => {
        byUnit[unit] = Array.from(byUnit[unit]);
    });
    
    console.log(`Filtered to ${totalFiltered} simple lexical units across ${Object.keys(byUnit).length} units`);
    
    return byUnit;
}

/**
 * Build letter pool with ALL repetitions needed
 * Takes the maximum count of each letter across all words
 */
function buildLetterPool(words, distractors = 1) {
    const maxCounts = {};
    
    // Count letter frequencies in each word and take maximum
    for (const word of words) {
        const localCounts = {};
        for (const letter of word) {
            localCounts[letter] = (localCounts[letter] || 0) + 1;
        }
        
        for (const [letter, count] of Object.entries(localCounts)) {
            maxCounts[letter] = Math.max(maxCounts[letter] || 0, count);
        }
    }
    
    // Build pool with all repetitions
    const pool = [];
    for (const [letter, count] of Object.entries(maxCounts)) {
        for (let i = 0; i < count; i++) {
            pool.push(letter);
        }
    }
    
    // Add distractor letters (only if not already in pool)
    const alphabet = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
    let added = 0;
    while (added < distractors) {
        const randomLetter = alphabet[Math.floor(Math.random() * alphabet.length)];
        if (!pool.includes(randomLetter)) {
            pool.push(randomLetter);
            added++;
        }
    }
    
    // Shuffle pool
    return pool.sort(() => Math.random() - 0.5);
}

/**
 * Layout 2-3 words in crossword pattern
 * - Place longest word horizontally at (0,0) as base
 * - Place others vertically, intersecting ONLY at identical letters
 * - Prefer intersection at first shared letter
 */
function layoutTwoOrThree(words) {
    // Sort by length to get base word (longest)
    const sorted = words.slice().sort((a, b) => b.length - a.length);
    const base = sorted[0];
    const others = words.filter(w => w !== base);
    
    const layout = [{
        word: base,
        start_x: 0,
        start_y: 0,
        direction: 'horizontal'
    }];
    
    const usedColumns = new Set();
    
    /**
     * Place a word vertically, intersecting with base
     * Only allows intersection at IDENTICAL letters
     */
    const placeVertical = (word, avoidCols = new Set()) => {
        // Prefer intersection at word's first letter if it appears in base
        const firstLetter = word[0];
        
        // Try to intersect at first letter first
        for (let baseIdx = 0; baseIdx < base.length; baseIdx++) {
            if (base[baseIdx] === firstLetter && !avoidCols.has(baseIdx)) {
                layout.push({
                    word: word,
                    start_x: baseIdx,
                    start_y: 0,
                    direction: 'vertical'
                });
                usedColumns.add(baseIdx);
                return true;
            }
        }
        
        // If first letter doesn't match, try any matching letter
        for (let wordIdx = 0; wordIdx < word.length; wordIdx++) {
            for (let baseIdx = 0; baseIdx < base.length; baseIdx++) {
                if (word[wordIdx] === base[baseIdx] && !avoidCols.has(baseIdx)) {
                    layout.push({
                        word: word,
                        start_x: baseIdx,
                        start_y: -wordIdx,
                        direction: 'vertical'
                    });
                    usedColumns.add(baseIdx);
                    return true;
                }
            }
        }
        
        return false;
    };
    
    // Place first vertical word
    if (!placeVertical(others[0])) return null;
    
    // Place second vertical word if exists
    if (others[1]) {
        if (!placeVertical(others[1], usedColumns)) return null;
    }
    
    return { layout };
}

/**
 * Generate a single level from a set of words
 */
function generateLevelFrom(words) {
    const plan = layoutTwoOrThree(words);
    if (!plan) return null;
    
    return {
        solution_words: words,
        letter_pool: buildLetterPool(words, CONFIG.DISTRACTOR_LETTERS),
        grid_layout: plan.layout
    };
}

/**
 * Random selection helper
 */
function pick(array) {
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate all puzzles from glossary
 */
async function generatePuzzlesFromGlossary(glossarySource, levelsPerUnit, unitKey, lemmaKey) {
    const byUnit = await loadGlossary(glossarySource, unitKey, lemmaKey);
    
    const allLevels = {};
    const allWords = [];
    
    for (const [unitNum, words] of Object.entries(byUnit)) {
        console.log(`\nGenerating ${levelsPerUnit} puzzles for unit ${unitNum} (${words.length} words)...`);
        
        const pool = words.filter(w => w.length >= 3);
        if (pool.length < 2) {
            console.log(`  Skipped: not enough words`);
            continue;
        }
        
        const levels = [];
        let attempts = 0;
        const maxAttempts = levelsPerUnit * 30;
        
        while (levels.length < levelsPerUnit && attempts < maxAttempts) {
            attempts++;
            
            // Pick base word
            const base = pick(pool);
            
            // Try to find words sharing the initial letter
            const sameInitial = pool.filter(w => w !== base && w[0] === base[0]);
            const candidates = sameInitial.length > 0 
                ? sameInitial 
                : pool.filter(w => w !== base && [...w].some(ch => base.includes(ch)));
            
            if (candidates.length === 0) continue;
            
            const second = pick(candidates);
            
            // 50% chance to add a third word
            const remainingCands = candidates.filter(w => w !== second);
            const third = (Math.random() < 0.5 && remainingCands.length > 0) 
                ? pick(remainingCands) 
                : null;
            
            const wordSet = [base, second];
            if (third) wordSet.push(third);
            
            // Ensure uniqueness
            const uniqueWords = [...new Set(wordSet)];
            if (uniqueWords.length < 2) continue;
            
            // Generate level
            const level = generateLevelFrom(uniqueWords);
            if (level) {
                level.level_id = `u${unitNum}_l${levels.length + 1}`;
                levels.push(level);
                console.log(`  Level ${levels.length}/${levelsPerUnit} - Words: ${uniqueWords.join(', ')}`);
            }
        }
        
        if (levels.length < levelsPerUnit) {
            console.log(`  Warning: Only generated ${levels.length} levels (attempted ${attempts} times)`);
        }
        
        allLevels[`unit_${unitNum}`] = levels;
        allWords.push(...pool);
    }
    
    return { levels: allLevels, dictionary: allWords };
}

/**
 * Main function
 */
async function main() {
    console.log('=== Word Connect Puzzle Generator ===\n');
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const getArg = (key, defaultVal) => {
        const idx = args.indexOf(key);
        return idx >= 0 ? args[idx + 1] : defaultVal;
    };
    
    const glossarySource = getArg('--glossary', 'span10011002.json');
    const levelsPerUnit = parseInt(getArg('--levels', String(CONFIG.DEFAULT_LEVELS_PER_UNIT)), 10);
    const unitKey = getArg('--unitKey', '_');
    const lemmaKey = getArg('--lemmaKey', 'Unidad Léxica (Español)');
    
    console.log('Configuration:');
    console.log(`  Glossary source: ${glossarySource}`);
    console.log(`  Levels per unit: ${levelsPerUnit}`);
    console.log(`  Words per puzzle: ${CONFIG.MIN_WORDS_PER_PUZZLE}-${CONFIG.MAX_WORDS_PER_PUZZLE}`);
    console.log(`  Distractor letters: ${CONFIG.DISTRACTOR_LETTERS}`);
    console.log('');
    
    try {
        // Generate puzzles from glossary
        const { levels, dictionary } = await generatePuzzlesFromGlossary(
            glossarySource,
            levelsPerUnit,
            unitKey,
            lemmaKey
        );
        
        // Save levels
        const levelsFile = 'levels_generated.json';
        fs.writeFileSync(levelsFile, JSON.stringify(levels, null, 2));
        console.log(`\n✓ Levels saved to: ${levelsFile}`);
        
        // Save dictionary (all simple lexical units in lowercase for bonus validation)
        const uniqueDict = [...new Set(dictionary)].map(w => w.toLowerCase()).sort();
        fs.writeFileSync('dictionary.json', JSON.stringify(uniqueDict, null, 2));
        console.log(`✓ Dictionary saved with ${uniqueDict.length} words`);
        
        // Statistics
        let totalLevels = 0;
        Object.values(levels).forEach(unitLevels => {
            totalLevels += unitLevels.length;
        });
        
        console.log(`\n=== Generation Complete ===`);
        console.log(`Total units: ${Object.keys(levels).length}`);
        console.log(`Total levels: ${totalLevels}`);
        console.log(`\nNext steps:`);
        console.log(`  1. Review levels_generated.json`);
        console.log(`  2. Copy to levels.json: cp levels_generated.json levels.json`);
        console.log(`  3. Reload the game to test new puzzles`);
        
    } catch (error) {
        console.error('\n❌ Error generating puzzles:');
        console.error(error.message);
        console.error('\nMake sure the glossary file exists and is valid JSON.');
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { loadGlossary, normalizeWord, buildLetterPool, layoutTwoOrThree, generateLevelFrom };