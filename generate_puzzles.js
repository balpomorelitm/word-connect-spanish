/**
 * Puzzle Generator for Word Connect Game
 * 
 * This Node.js script generates crossword-style puzzles from a list of words.
 * Run with: node generate_puzzles.js
 * 
 * You can customize the word list and parameters below.
 */

const fs = require('fs');

// Configuration
const CONFIG = {
    MIN_WORDS_PER_PUZZLE: 3,
    MAX_WORDS_PER_PUZZLE: 5,
    MAX_ATTEMPTS: 100,
    DISTRACTOR_LETTERS: 1, // Extra letters not in solution
    GRID_MAX_SIZE: 10
};

// Sample word lists by unit (customize these for your curriculum)
const WORD_LISTS = {
    unit_1: [
        'SOL', 'SAL', 'PAN', 'PAZ', 'MAR', 'MAL', 'RIO', 'ORO',
        'VOZ', 'VIA', 'ZOO', 'ANA', 'RAM', 'OIR', 'OSO', 'OCA'
    ],
    unit_2: [
        'CASA', 'COSA', 'MASA', 'MESA', 'MANO', 'MONO', 'PISO', 'PASO',
        'GATO', 'TACO', 'PATO', 'RATA', 'CAMA', 'RAMA', 'TAZA', 'RAZA'
    ],
    unit_3: [
        'PLAYA', 'PLAZA', 'PLATA', 'CARTA', 'CAMPO', 'CALLE', 'TARDE',
        'MADRE', 'PADRE', 'VERDE', 'NEGRO', 'BLANCO', 'LIBRO', 'BRAZO'
    ]
};

class PuzzleGenerator {
    constructor(words, config) {
        this.words = words.map(w => w.toUpperCase());
        this.config = config;
    }

    // Main generation method
    generatePuzzle() {
        for (let attempt = 0; attempt < this.config.MAX_ATTEMPTS; attempt++) {
            const puzzle = this.attemptPuzzle();
            if (puzzle) {
                return puzzle;
            }
        }
        return null;
    }

    // Attempt to create a single puzzle
    attemptPuzzle() {
        const numWords = this.randomInt(
            this.config.MIN_WORDS_PER_PUZZLE,
            this.config.MAX_WORDS_PER_PUZZLE
        );

        // Select random words
        const selectedWords = this.selectRandomWords(numWords);
        if (!selectedWords) return null;

        // Try to place words on grid
        const grid = new Grid();
        const placements = [];

        // Place first word horizontally at origin
        const firstWord = selectedWords[0];
        const firstPlacement = {
            word: firstWord,
            start_x: 0,
            start_y: 0,
            direction: 'horizontal'
        };
        grid.placeWord(firstPlacement);
        placements.push(firstPlacement);

        // Try to place remaining words
        for (let i = 1; i < selectedWords.length; i++) {
            const word = selectedWords[i];
            const placement = this.findPlacement(word, grid, placements);
            
            if (placement) {
                grid.placeWord(placement);
                placements.push(placement);
            } else {
                return null; // Failed to place word
            }
        }

        // Normalize grid (shift to start at 0,0)
        const normalizedPlacements = this.normalizeGrid(placements);

        // Generate letter pool
        const letterPool = this.generateLetterPool(selectedWords);

        return {
            solution_words: selectedWords,
            letter_pool: letterPool,
            grid_layout: normalizedPlacements
        };
    }

    // Select random words ensuring they can potentially intersect
    selectRandomWords(count) {
        const shuffled = [...this.words].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, Math.min(count, shuffled.length));
    }

    // Find a valid placement for a word
    findPlacement(word, grid, existingPlacements) {
        const possiblePlacements = [];

        // Try to find intersections with existing words
        for (const existing of existingPlacements) {
            const intersections = this.findIntersections(word, existing.word);
            
            for (const {letterIndex, existingIndex} of intersections) {
                // Calculate positions for both orientations
                const placements = this.calculateIntersectionPlacements(
                    word, letterIndex, existing, existingIndex
                );
                
                for (const placement of placements) {
                    if (grid.canPlaceWord(placement) && 
                        !this.overlapsExisting(placement, existingPlacements)) {
                        possiblePlacements.push(placement);
                    }
                }
            }
        }

        if (possiblePlacements.length === 0) return null;
        return possiblePlacements[Math.floor(Math.random() * possiblePlacements.length)];
    }

    // Find all possible letter intersections between two words
    findIntersections(word1, word2) {
        const intersections = [];
        for (let i = 0; i < word1.length; i++) {
            for (let j = 0; j < word2.length; j++) {
                if (word1[i] === word2[j]) {
                    intersections.push({
                        letterIndex: i,
                        existingIndex: j
                    });
                }
            }
        }
        return intersections;
    }

    // Calculate placement based on intersection
    calculateIntersectionPlacements(word, letterIndex, existing, existingIndex) {
        const placements = [];
        
        if (existing.direction === 'horizontal') {
            // Place new word vertically
            placements.push({
                word: word,
                start_x: existing.start_x + existingIndex,
                start_y: existing.start_y - letterIndex,
                direction: 'vertical'
            });
        } else {
            // Place new word horizontally
            placements.push({
                word: word,
                start_x: existing.start_x - letterIndex,
                start_y: existing.start_y + existingIndex,
                direction: 'horizontal'
            });
        }
        
        return placements;
    }

    // Check if placement overlaps with existing words incorrectly
    overlapsExisting(placement, existingPlacements) {
        const newCells = this.getCells(placement);
        
        for (const existing of existingPlacements) {
            const existingCells = this.getCells(existing);
            
            for (const newCell of newCells) {
                for (const existingCell of existingCells) {
                    if (newCell.x === existingCell.x && newCell.y === existingCell.y) {
                        // Same position - must have same letter
                        if (newCell.letter !== existingCell.letter) {
                            return true; // Invalid overlap
                        }
                    }
                }
            }
        }
        
        return false;
    }

    // Get all cells occupied by a word
    getCells(placement) {
        const cells = [];
        for (let i = 0; i < placement.word.length; i++) {
            const x = placement.direction === 'horizontal' 
                ? placement.start_x + i 
                : placement.start_x;
            const y = placement.direction === 'vertical' 
                ? placement.start_y + i 
                : placement.start_y;
            
            cells.push({
                x, y,
                letter: placement.word[i]
            });
        }
        return cells;
    }

    // Normalize grid to start at (0,0)
    normalizeGrid(placements) {
        let minX = Infinity, minY = Infinity;
        
        for (const placement of placements) {
            minX = Math.min(minX, placement.start_x);
            minY = Math.min(minY, placement.start_y);
        }
        
        return placements.map(p => ({
            word: p.word,
            start_x: p.start_x - minX,
            start_y: p.start_y - minY,
            direction: p.direction
        }));
    }

    // Generate letter pool from words
    generateLetterPool(words) {
        const letters = new Set();
        words.forEach(word => {
            word.split('').forEach(letter => letters.add(letter));
        });
        
        const pool = Array.from(letters);
        
        // Add distractor letters
        const allLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (let i = 0; i < this.config.DISTRACTOR_LETTERS; i++) {
            const randomLetter = allLetters[Math.floor(Math.random() * allLetters.length)];
            if (!pool.includes(randomLetter)) {
                pool.push(randomLetter);
            }
        }
        
        // Shuffle pool
        return pool.sort(() => Math.random() - 0.5);
    }

    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}

class Grid {
    constructor() {
        this.cells = new Map();
    }

    placeWord(placement) {
        for (let i = 0; i < placement.word.length; i++) {
            const x = placement.direction === 'horizontal' 
                ? placement.start_x + i 
                : placement.start_x;
            const y = placement.direction === 'vertical' 
                ? placement.start_y + i 
                : placement.start_y;
            
            this.cells.set(`${x},${y}`, placement.word[i]);
        }
    }

    canPlaceWord(placement) {
        for (let i = 0; i < placement.word.length; i++) {
            const x = placement.direction === 'horizontal' 
                ? placement.start_x + i 
                : placement.start_x;
            const y = placement.direction === 'vertical' 
                ? placement.start_y + i 
                : placement.start_y;
            
            const key = `${x},${y}`;
            const existing = this.cells.get(key);
            
            if (existing && existing !== placement.word[i]) {
                return false;
            }
        }
        return true;
    }
}

// Generate puzzles for all units
function generateAllPuzzles() {
    const allLevels = {};
    
    Object.keys(WORD_LISTS).forEach((unitKey, unitIndex) => {
        console.log(`\nGenerating puzzles for ${unitKey}...`);
        const words = WORD_LISTS[unitKey];
        const generator = new PuzzleGenerator(words, CONFIG);
        const levels = [];
        
        const targetLevels = 10; // Generate 10 levels per unit
        let attempts = 0;
        const maxAttempts = targetLevels * 5;
        
        while (levels.length < targetLevels && attempts < maxAttempts) {
            const puzzle = generator.generatePuzzle();
            if (puzzle) {
                puzzle.level_id = `${unitKey}_l${levels.length + 1}`;
                levels.push(puzzle);
                console.log(`  Generated level ${levels.length}/${targetLevels}`);
            }
            attempts++;
        }
        
        if (levels.length < targetLevels) {
            console.log(`  Warning: Only generated ${levels.length} levels for ${unitKey}`);
        }
        
        allLevels[unitKey] = levels;
    });
    
    return allLevels;
}

// Main execution
function main() {
    console.log('=== Word Connect Puzzle Generator ===\n');
    console.log('Configuration:');
    console.log(`  Words per puzzle: ${CONFIG.MIN_WORDS_PER_PUZZLE}-${CONFIG.MAX_WORDS_PER_PUZZLE}`);
    console.log(`  Max attempts per puzzle: ${CONFIG.MAX_ATTEMPTS}`);
    console.log(`  Distractor letters: ${CONFIG.DISTRACTOR_LETTERS}`);
    
    const allLevels = generateAllPuzzles();
    
    // Save to file
    const outputFile = 'levels_generated.json';
    fs.writeFileSync(outputFile, JSON.stringify(allLevels, null, 2));
    
    console.log(`\n=== Generation Complete ===`);
    console.log(`Output saved to: ${outputFile}`);
    
    // Statistics
    let totalLevels = 0;
    Object.keys(allLevels).forEach(unit => {
        totalLevels += allLevels[unit].length;
    });
    console.log(`Total units: ${Object.keys(allLevels).length}`);
    console.log(`Total levels: ${totalLevels}`);
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { PuzzleGenerator, Grid };