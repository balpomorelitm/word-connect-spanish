// Game State
let gameState = {
    currentUnit: 1,
    currentLevel: 0,
    bonusPoints: 0,
    bonusWordCount: 0, // Contador de palabras bonus para pistas
    foundWords: [],
    foundBonusWords: [],
    currentWord: '',
    selectedLetters: [],
    levelData: null,
    allLevels: null,
    dictionary: [],
    externalDictionary: null // Para el diccionario externo
};

const HINT_WORDS_REQUIRED = 10; // Palabras bonus necesarias para una pista
const BONUS_POINTS_PER_WORD = 10;

// Initialize game on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadGameData();
    await loadExternalDictionary();
    loadProgress();
    initGame();
    setupEventListeners();
});

// Load levels and dictionary
async function loadGameData() {
    try {
        const [levelsResponse, dictResponse] = await Promise.all([
            fetch('levels.json'),
            fetch('dictionary.json')
        ]);
        
        gameState.allLevels = await levelsResponse.json();
        gameState.dictionary = await dictResponse.json();
        
        console.log('Game data loaded successfully');
    } catch (error) {
        console.error('Error loading game data:', error);
        alert('Error al cargar los datos del juego. Por favor, recarga la página.');
    }
}

// Load external dictionary (usando FreeDictionaryAPI)
async function loadExternalDictionary() {
    try {
        // Creamos un set con palabras comunes del español para validación rápida
        // En producción, esto se conectaría a una API real
        gameState.externalDictionary = new Set([
            // Este es un placeholder - la validación real usará la API
        ]);
        console.log('External dictionary initialized');
    } catch (error) {
        console.error('Error loading external dictionary:', error);
    }
}

// Validar palabra contra diccionario externo
async function checkExternalDictionary(word) {
    try {
        // Intentamos usar la API de diccionario libre
        const normalizedWord = word.toLowerCase();
        
        // Primero verificamos nuestro diccionario local
        if (gameState.dictionary.includes(normalizedWord)) {
            return true;
        }
        
        // Luego intentamos con una API externa (sin CORS)
        // Usamos la Spanish Dictionary API
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/es/${normalizedWord}`);
        
        if (response.ok) {
            return true;
        }
        
        return false;
    } catch (error) {
        // Si hay error de red, usamos solo nuestro diccionario local
        return gameState.dictionary.includes(word.toLowerCase());
    }
}

// Load progress from localStorage
function loadProgress() {
    const savedProgress = localStorage.getItem('wordConnectProgress');
    if (savedProgress) {
        const progress = JSON.parse(savedProgress);
        gameState.currentUnit = progress.currentUnit || 1;
        gameState.currentLevel = progress.currentLevel || 0;
        gameState.bonusPoints = progress.bonusPoints || 0;
        gameState.bonusWordCount = progress.bonusWordCount || 0;
    }
    updateScore();
    updateBonusProgress();
}

// Save progress to localStorage
function saveProgress() {
    localStorage.setItem('wordConnectProgress', JSON.stringify({
        currentUnit: gameState.currentUnit,
        currentLevel: gameState.currentLevel,
        bonusPoints: gameState.bonusPoints,
        bonusWordCount: gameState.bonusWordCount
    }));
}

// Reset game to beginning
function resetGame() {
    gameState.currentUnit = 1;
    gameState.currentLevel = 0;
    gameState.bonusPoints = 0;
    gameState.bonusWordCount = 0;
    saveProgress();
    initGame();
}

// Initialize game for current level
function initGame() {
    const unitKey = `unit_${gameState.currentUnit}`;
    const levels = gameState.allLevels[unitKey];
    
    if (!levels || !levels[gameState.currentLevel]) {
        console.error('Level not found');
        return;
    }
    
    gameState.levelData = levels[gameState.currentLevel];
    gameState.foundWords = [];
    gameState.foundBonusWords = [];
    gameState.currentWord = '';
    gameState.selectedLetters = [];
    
    updateLevelDisplay();
    drawGrid();
    drawLetterPool();
    clearCurrentWord();
    hideBonusDisplay();
    updateBonusProgress();
}

// Update level and progress display
function updateLevelDisplay() {
    document.getElementById('unit-level').textContent = 
        `Unidad ${gameState.currentUnit} - Nivel ${gameState.currentLevel + 1}`;
    updateProgress();
}

// Update progress counter
function updateProgress() {
    const total = gameState.levelData.solution_words.length;
    const found = gameState.foundWords.length;
    document.getElementById('progress').textContent = `${found}/${total} palabras`;
}

// Update bonus progress bar
function updateBonusProgress() {
    const count = gameState.bonusWordCount;
    const percentage = (count / HINT_WORDS_REQUIRED) * 100;
    
    document.getElementById('bonus-count').textContent = count;
    document.getElementById('bonus-progress-fill').style.width = `${percentage}%`;
    
    // Actualizar botón de pista
    const hintBtn = document.getElementById('hint-button');
    hintBtn.disabled = count < HINT_WORDS_REQUIRED;
    
    // Efecto visual cuando está completo
    const progressBar = document.querySelector('.bonus-progress-bar');
    if (count >= HINT_WORDS_REQUIRED) {
        progressBar.classList.add('complete');
    } else {
        progressBar.classList.remove('complete');
    }
}

// Draw the crossword grid
function drawGrid() {
    const gridContainer = document.getElementById('grid-container');
    gridContainer.innerHTML = '';
    
    // Calculate grid dimensions
    let maxX = 0, maxY = 0;
    gameState.levelData.grid_layout.forEach(wordData => {
        const endX = wordData.direction === 'horizontal' 
            ? wordData.start_x + wordData.word.length - 1 
            : wordData.start_x;
        const endY = wordData.direction === 'vertical' 
            ? wordData.start_y + wordData.word.length - 1 
            : wordData.start_y;
        maxX = Math.max(maxX, endX);
        maxY = Math.max(maxY, endY);
    });
    
    const rows = maxY + 1;
    const cols = maxX + 1;
    
    // Set grid template
    gridContainer.style.gridTemplateColumns = `repeat(${cols}, 45px)`;
    gridContainer.style.gridTemplateRows = `repeat(${rows}, 45px)`;
    
    // Create grid cells
    const grid = Array(rows).fill().map(() => Array(cols).fill(null));
    
    // Mark cells that should contain letters
    gameState.levelData.grid_layout.forEach(wordData => {
        for (let i = 0; i < wordData.word.length; i++) {
            const x = wordData.direction === 'horizontal'
                ? wordData.start_x + i
                : wordData.start_x;
            const y = wordData.direction === 'vertical'
                ? wordData.start_y + i
                : wordData.start_y;

            if (!grid[y][x]) {
                grid[y][x] = {
                    letter: wordData.word[i],
                    words: new Set([wordData.word])
                };
            } else {
                grid[y][x].words.add(wordData.word);
            }
        }
    });
    
    // Create HTML cells
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.x = x;
            cell.dataset.y = y;
            
            if (grid[y][x]) {
                cell.dataset.letter = grid[y][x].letter;
                cell.dataset.words = Array.from(grid[y][x].words).join('|');
            } else {
                cell.classList.add('empty');
            }

            gridContainer.appendChild(cell);
        }
    }
}

// Draw letter pool
function drawLetterPool() {
    const letterPool = document.getElementById('letter-pool');
    letterPool.innerHTML = '';
    
    gameState.levelData.letter_pool.forEach((letter, index) => {
        const btn = document.createElement('button');
        btn.className = 'letter-btn';
        btn.textContent = letter;
        btn.dataset.letter = letter;
        btn.dataset.index = index;
        letterPool.appendChild(btn);
    });
}

// Setup event listeners
function setupEventListeners() {
    // Letter pool click events
    document.getElementById('letter-pool').addEventListener('click', (e) => {
        if (e.target.classList.contains('letter-btn')) {
            selectLetter(e.target);
        }
    });
    
    // Action buttons
    document.getElementById('clear-button').addEventListener('click', clearCurrentWord);
    document.getElementById('submit-button').addEventListener('click', submitWord);
    document.getElementById('hint-button').addEventListener('click', useHint);
    document.getElementById('next-level-button').addEventListener('click', nextLevel);
    
    // New game button
    document.getElementById('new-game-button').addEventListener('click', showNewGameModal);
    document.getElementById('confirm-new-game').addEventListener('click', confirmNewGame);
    document.getElementById('cancel-new-game').addEventListener('click', hideNewGameModal);
}

// Show new game confirmation modal
function showNewGameModal() {
    document.getElementById('new-game-modal').classList.remove('hidden');
}

// Hide new game modal
function hideNewGameModal() {
    document.getElementById('new-game-modal').classList.add('hidden');
}

// Confirm new game
function confirmNewGame() {
    hideNewGameModal();
    resetGame();
}

// Select a letter
function selectLetter(btn) {
    if (btn.classList.contains('selected')) return;
    
    gameState.selectedLetters.push(btn);
    gameState.currentWord += btn.dataset.letter;
    btn.classList.add('selected');
    updateCurrentWordDisplay();
}

// Clear current word
function clearCurrentWord() {
    gameState.selectedLetters.forEach(btn => {
        btn.classList.remove('selected');
    });
    gameState.selectedLetters = [];
    gameState.currentWord = '';
    updateCurrentWordDisplay();
    hideBonusDisplay();
}

// Update current word display
function updateCurrentWordDisplay() {
    document.getElementById('word-display').textContent = gameState.currentWord;
}

// Submit word for validation
async function submitWord() {
    if (gameState.currentWord.length === 0) return;
    
    const word = gameState.currentWord.toUpperCase();
    await validateWord(word);
}

// Validate submitted word
async function validateWord(submittedWord) {
    // Check if it's a puzzle word
    if (gameState.levelData.solution_words.includes(submittedWord)) {
        if (gameState.foundWords.includes(submittedWord)) {
            showError('¡Ya encontraste esta palabra!');
        } else {
            foundPuzzleWord(submittedWord);
        }
        return;
    }
    
    // Check if it's a bonus word (minimum 3 letters)
    if (submittedWord.length >= 3) {
        const isValid = await checkExternalDictionary(submittedWord);
        
        if (isValid) {
            if (gameState.foundBonusWords.includes(submittedWord)) {
                showError('¡Ya encontraste esta palabra extra!');
            } else {
                foundBonusWord(submittedWord);
            }
            return;
        }
    }
    
    // Invalid word
    showError('Palabra no válida');
}

// Handle found puzzle word
function foundPuzzleWord(word) {
    gameState.foundWords.push(word);
    fillGridWord(word);
    clearCurrentWord();
    updateProgress();
    
    // Check if level is complete
    if (gameState.foundWords.length === gameState.levelData.solution_words.length) {
        setTimeout(() => showLevelComplete(), 500);
    }
}

// Fill word in grid
function fillGridWord(word) {
    const cells = document.querySelectorAll('.grid-cell');
    cells.forEach(cell => {
        const words = cell.dataset.words ? cell.dataset.words.split('|') : [];
        if (words.includes(word)) {
            cell.textContent = cell.dataset.letter;
            cell.classList.add('filled');
        }
    });
}

// Handle found bonus word
function foundBonusWord(word) {
    gameState.foundBonusWords.push(word);
    gameState.bonusPoints += BONUS_POINTS_PER_WORD;
    gameState.bonusWordCount += 1;
    
    updateScore();
    updateBonusProgress();
    saveProgress();
    
    showBonusMessage(word);
    clearCurrentWord();
    
    // Animación especial cuando se completa la barra
    if (gameState.bonusWordCount % HINT_WORDS_REQUIRED === 0) {
        showHintReadyMessage();
    }
}

// Show bonus message
function showBonusMessage(word) {
    const bonusDisplay = document.getElementById('bonus-display');
    bonusDisplay.textContent = `¡Palabra extra: ${word}! +${BONUS_POINTS_PER_WORD} puntos`;
    bonusDisplay.style.background = '#4caf50';
    bonusDisplay.classList.remove('hidden');
    
    setTimeout(() => {
        bonusDisplay.classList.add('hidden');
    }, 2000);
}

// Show hint ready message
function showHintReadyMessage() {
    const bonusDisplay = document.getElementById('bonus-display');
    bonusDisplay.textContent = '¡Pista desbloqueada! 💡 Puedes revelar una casilla';
    bonusDisplay.style.background = '#ff9800';
    bonusDisplay.classList.remove('hidden');
    
    setTimeout(() => {
        bonusDisplay.classList.add('hidden');
    }, 3000);
}

// Hide bonus display
function hideBonusDisplay() {
    document.getElementById('bonus-display').classList.add('hidden');
}

// Show error message
function showError(message) {
    const wordDisplay = document.getElementById('current-word');
    wordDisplay.classList.add('error-shake');
    
    const bonusDisplay = document.getElementById('bonus-display');
    bonusDisplay.textContent = message;
    bonusDisplay.style.background = '#f44336';
    bonusDisplay.classList.remove('hidden');
    
    setTimeout(() => {
        wordDisplay.classList.remove('error-shake');
        bonusDisplay.classList.add('hidden');
        bonusDisplay.style.background = '#ff9800';
    }, 1000);
}

// Update score display
function updateScore() {
    document.getElementById('score').textContent = gameState.bonusPoints;
}

// Use hint - reveal a random cell
function useHint() {
    if (gameState.bonusWordCount < HINT_WORDS_REQUIRED) return;
    
    // Find an unfilled cell
    const cells = Array.from(document.querySelectorAll('.grid-cell:not(.filled):not(.empty)'));
    if (cells.length === 0) {
        showError('¡Ya están todas las casillas reveladas!');
        return;
    }
    
    // Reveal a random cell
    const randomCell = cells[Math.floor(Math.random() * cells.length)];
    randomCell.textContent = randomCell.dataset.letter;
    randomCell.classList.add('filled');
    randomCell.classList.add('hint-revealed');
    
    // Deduct bonus words
    gameState.bonusWordCount -= HINT_WORDS_REQUIRED;
    updateBonusProgress();
    saveProgress();
    
    // Show feedback
    const bonusDisplay = document.getElementById('bonus-display');
    bonusDisplay.textContent = `¡Letra revelada! ${randomCell.dataset.letter}`;
    bonusDisplay.style.background = '#4a90e2';
    bonusDisplay.classList.remove('hidden');
    
    setTimeout(() => {
        bonusDisplay.classList.add('hidden');
    }, 2000);
}

// Show level complete modal
function showLevelComplete() {
    const modal = document.getElementById('level-complete-modal');
    document.getElementById('words-found').textContent = gameState.foundWords.length;
    document.getElementById('bonus-found').textContent = gameState.foundBonusWords.length;
    document.getElementById('points-earned').textContent = 
        `${gameState.foundBonusWords.length * BONUS_POINTS_PER_WORD} puntos bonus`;
    
    modal.classList.remove('hidden');
}

// Next level
function nextLevel() {
    const modal = document.getElementById('level-complete-modal');
    modal.classList.add('hidden');
    
    gameState.currentLevel++;
    
    // Check if unit is complete
    const unitKey = `unit_${gameState.currentUnit}`;
    if (gameState.currentLevel >= gameState.allLevels[unitKey].length) {
        gameState.currentUnit++;
        gameState.currentLevel = 0;
        
        // Check if game is complete
        const nextUnitKey = `unit_${gameState.currentUnit}`;
        if (!gameState.allLevels[nextUnitKey]) {
            alert('¡Felicidades! ¡Has completado todos los niveles!');
            gameState.currentUnit = 1;
            gameState.currentLevel = 0;
        }
    }
    
    saveProgress();
    initGame();
}