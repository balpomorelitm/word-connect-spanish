// Game State
let gameState = {
    currentUnit: 0,
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
    fullDictionary: [],
    dictionarySet: new Set(),
    selectedUnits: [],
    availableUnits: [],
    wordUnitMap: new Map(),
    unitTitles: {},
    unitDisplayInfo: []
};

const HINT_WORDS_REQUIRED = 10; // Palabras bonus necesarias para una pista
const BONUS_POINTS_PER_WORD = 10;

const AULA_UNIT_TO_UNIT_NUMBER = {
    '1-0': 0,
    '1-1': 1,
    '1-2': 2,
    '1-3': 3,
    '1-4': 4,
    '1-5': 5,
    '1-6': 6,
    '1-7': 7,
    '1-8': 8,
    '1-9': 9,
    '2-1': 10,
    '2-2': 11,
    '2-4': 12
};

const UNIT_TITLE_OVERRIDES = {
    0: 'En el aula',
    1: 'Nosotros y nosotras',
    2: 'Quiero aprender español',
    3: 'Dónde está Santiago',
    4: 'Cuál prefieres',
    5: 'Tus amigos son mis amigos',
    6: 'Día a día',
    7: 'A comer',
    8: 'El barrio ideal',
    9: '¿Sabes conducir?',
    10: 'El español y tú',
    11: 'Una vida de película',
    12: 'Hogar dulce hogar'
};

const UNIT_AULA_MAPPING = {
    0: { aula: 1, unidad: 0 },
    1: { aula: 1, unidad: 1 },
    2: { aula: 1, unidad: 2 },
    3: { aula: 1, unidad: 3 },
    4: { aula: 1, unidad: 4 },
    5: { aula: 1, unidad: 5 },
    6: { aula: 1, unidad: 6 },
    7: { aula: 1, unidad: 7 },
    8: { aula: 1, unidad: 8 },
    9: { aula: 1, unidad: 9 },
    10: { aula: 2, unidad: 1 },
    11: { aula: 2, unidad: 2 },
    12: { aula: 2, unidad: 4 }
};

function extractUnitNumber(rawUnit) {
    if (rawUnit === undefined || rawUnit === null) {
        return null;
    }

    const text = String(rawUnit).trim();
    if (!text) {
        return null;
    }

    const aulaMatch = text.match(/Aula\s*(\d+)/i);
    const unidadMatch = text.match(/U\s*(\d+)/i) || text.match(/U(\d+)/i);

    if (unidadMatch) {
        const unidadValue = parseInt(unidadMatch[1], 10);
        if (!Number.isNaN(unidadValue)) {
            const aulaValue = aulaMatch ? parseInt(aulaMatch[1], 10) : 1;
            const combinedKey = `${aulaValue}-${unidadValue}`;

            if (Object.prototype.hasOwnProperty.call(AULA_UNIT_TO_UNIT_NUMBER, combinedKey)) {
                return AULA_UNIT_TO_UNIT_NUMBER[combinedKey];
            }

            if (aulaValue === 1) {
                return unidadValue;
            }
        }
    }

    const digits = text.match(/\d+/);
    if (digits) {
        return parseInt(digits[0], 10);
    }

    return null;
}

function extractUnitTitle(rawUnit) {
    if (typeof rawUnit !== 'string') {
        return '';
    }

    const dotIndex = rawUnit.indexOf('. ');
    if (dotIndex !== -1) {
        return rawUnit.slice(dotIndex + 2).trim();
    }

    const hashIndex = rawUnit.indexOf('#');
    if (hashIndex !== -1) {
        return rawUnit.slice(hashIndex + 1).trim();
    }

    return rawUnit.trim();
}

function normalizeGlossaryWord(rawWord) {
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

    word = word.replace(/["'().,;:!?¡¿-]/g, '');
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

    return word.toLocaleLowerCase('es-ES');
}

function processGlossaryData(entries) {
    const unitTitles = {};
    const wordUnitMap = new Map();

    if (!Array.isArray(entries)) {
        return { unitTitles, wordUnitMap };
    }

    entries.forEach((item) => {
        const unitValue = item?.['Lugar en el libro'];
        const unitNumber = extractUnitNumber(unitValue);
        if (unitNumber === null || Number.isNaN(unitNumber)) {
            return;
        }

        if (unitTitles[unitNumber] === undefined && unitValue) {
            unitTitles[unitNumber] = extractUnitTitle(unitValue);
        }

        const lemma = item?.['Unidad Léxica (Español)'];
        const normalized = normalizeGlossaryWord(lemma);
        if (!normalized) {
            return;
        }

        if (!wordUnitMap.has(normalized)) {
            wordUnitMap.set(normalized, new Set());
        }
        wordUnitMap.get(normalized).add(unitNumber);
    });

    Object.entries(UNIT_TITLE_OVERRIDES).forEach(([unitKey, title]) => {
        unitTitles[unitKey] = title;
    });

    return { unitTitles, wordUnitMap };
}

function getUnitMeta(unitNumber) {
    const mapping = UNIT_AULA_MAPPING[unitNumber];
    if (mapping) {
        return { ...mapping, title: gameState.unitTitles[unitNumber] || '' };
    }

    const aula = unitNumber <= 9 ? 1 : 2;
    const unidad = aula === 1 ? unitNumber : unitNumber - 9;
    return { aula, unidad, title: gameState.unitTitles[unitNumber] || '' };
}

function buildUnitDisplayInfo() {
    return gameState.availableUnits.map((unitNumber) => {
        const meta = getUnitMeta(unitNumber);
        return {
            unit: unitNumber,
            aula: meta.aula,
            unidad: meta.unidad,
            title: meta.title,
            aulaLabel: `Aula ${meta.aula}`,
            unidadLabel: `Unidad ${meta.unidad}`
        };
    });
}

function orderUnits(units) {
    const normalizedUnits = Array.isArray(units)
        ? units.map((unit) => Number(unit)).filter((unit) => !Number.isNaN(unit))
        : [];
    const unitSet = new Set(normalizedUnits);
    return gameState.availableUnits.filter((unit) => unitSet.has(unit));
}

function applyUnitFilters() {
    if (!Array.isArray(gameState.selectedUnits) || gameState.selectedUnits.length === 0) {
        gameState.selectedUnits = [...gameState.availableUnits];
    }

    if (!Array.isArray(gameState.fullDictionary) || gameState.fullDictionary.length === 0) {
        gameState.dictionary = [];
        gameState.dictionarySet = new Set();
        return;
    }

    if (!(gameState.wordUnitMap instanceof Map) || gameState.wordUnitMap.size === 0) {
        gameState.dictionary = [...gameState.fullDictionary];
        gameState.dictionarySet = new Set(gameState.dictionary);
        return;
    }

    const allowedUnits = new Set(gameState.selectedUnits);
    const filteredDictionary = gameState.fullDictionary.filter((word) => {
        const unitSet = gameState.wordUnitMap.get(word);
        if (!unitSet) {
            return false;
        }

        for (const unit of unitSet) {
            if (allowedUnits.has(unit)) {
                return true;
            }
        }
        return false;
    });

    gameState.dictionary = filteredDictionary;
    gameState.dictionarySet = new Set(filteredDictionary);
}

function initializeUnitSelectionUI() {
    const container = document.getElementById('unit-selection');
    if (!container) {
        return;
    }

    container.innerHTML = '';

    gameState.unitDisplayInfo.forEach((info) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'unit-card';
        button.dataset.unit = String(info.unit);
        button.setAttribute('aria-pressed', 'false');

        const aulaSpan = document.createElement('span');
        aulaSpan.className = 'unit-card-aula';
        aulaSpan.textContent = info.aulaLabel;

        const unidadSpan = document.createElement('span');
        unidadSpan.className = 'unit-card-unidad';
        unidadSpan.textContent = info.unidadLabel;

        const titleSpan = document.createElement('span');
        titleSpan.className = 'unit-card-title';
        titleSpan.textContent = info.title || '\u00A0';

        button.append(aulaSpan, unidadSpan, titleSpan);

        button.addEventListener('click', () => {
            const isSelected = button.classList.toggle('selected');
            button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        });

        container.appendChild(button);
    });

    syncUnitSelectionUI();
}

function syncUnitSelectionUI() {
    const container = document.getElementById('unit-selection');
    if (!container) {
        return;
    }

    const selectedSet = new Set(gameState.selectedUnits);
    const buttons = container.querySelectorAll('.unit-card');
    buttons.forEach((button) => {
        const unit = parseInt(button.dataset.unit, 10);
        const isSelected = selectedSet.has(unit);
        button.classList.toggle('selected', isSelected);
        button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });
}

// Initialize game on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadGameData();
    loadProgress();
    initializeUnitSelectionUI();
    initGame();
    setupEventListeners();
});

// Load levels and dictionary
async function loadGameData() {
    try {
        const [levelsResponse, dictResponse, glossaryResponse] = await Promise.all([
            fetch('levels.json'),
            fetch('dictionary.json'),
            fetch('span10011002.json')
        ]);

        gameState.allLevels = await levelsResponse.json();
        gameState.fullDictionary = await dictResponse.json();
        gameState.dictionary = [...gameState.fullDictionary];
        gameState.dictionarySet = new Set(gameState.dictionary);

        gameState.availableUnits = Object.keys(gameState.allLevels)
            .map((key) => parseInt(key.replace('unit_', ''), 10))
            .filter((value) => !Number.isNaN(value))
            .sort((a, b) => a - b);

        const glossaryData = await glossaryResponse.json();
        const { unitTitles, wordUnitMap } = processGlossaryData(glossaryData);
        gameState.unitTitles = unitTitles;
        gameState.wordUnitMap = wordUnitMap;
        gameState.unitDisplayInfo = buildUnitDisplayInfo();

        console.log('Game data loaded successfully');
    } catch (error) {
        console.error('Error loading game data:', error);
        alert('Error al cargar los datos del juego. Por favor, recarga la página.');
    }
}

// Validar palabra española usando MyMemory Translation API
async function isValidSpanishWord(word) {
    const wordLower = word.toLowerCase();
    
    // Primero verificar el diccionario local
    if (gameState.dictionarySet.has(wordLower)) {
        return true;
    }
    
    try {
        // Usar MyMemory API para validación
        const mymemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(wordLower)}&langpair=es|en`;
        const mymemoryResponse = await fetch(mymemoryUrl);
        
        if (mymemoryResponse.ok) {
            const mymemoryData = await mymemoryResponse.json();
            
            if (mymemoryData.responseStatus === 200) {
                const translation = mymemoryData.responseData.translatedText.toLowerCase();
                
                // Validar que sea una traducción válida
                const isValidTranslation = translation !== wordLower &&
                                         translation.length > 0 &&
                                         !translation.includes('no found') &&
                                         !translation.includes('not found') &&
                                         !translation.includes('error') &&
                                         !translation.includes('invalid');
                
                return isValidTranslation;
            }
        }
        
        return false;
        
    } catch (error) {
        console.error('Error validating word:', error);
        // Si hay error de red, usar solo el diccionario local
        return false;
    }
}

// Load progress from localStorage
function loadProgress() {
    const availableUnits = gameState.availableUnits;
    if (!availableUnits.length) {
        console.error('No hay unidades disponibles para cargar.');
        return;
    }

    const savedProgress = localStorage.getItem('wordConnectProgress');

    let selectedUnits = [...availableUnits];
    let currentUnit = availableUnits[0];
    let currentLevel = 0;
    let bonusPoints = 0;
    let bonusWordCount = 0;

    if (savedProgress) {
        try {
            const progress = JSON.parse(savedProgress);
            bonusPoints = Number(progress.bonusPoints) || 0;
            bonusWordCount = Number(progress.bonusWordCount) || 0;

            if (Array.isArray(progress.selectedUnits) && progress.selectedUnits.length > 0) {
                selectedUnits = progress.selectedUnits;
            }

            const parsedCurrentUnit = Number(progress.currentUnit);
            if (!Number.isNaN(parsedCurrentUnit) && availableUnits.includes(parsedCurrentUnit)) {
                currentUnit = parsedCurrentUnit;
            }

            const parsedCurrentLevel = Number(progress.currentLevel);
            if (!Number.isNaN(parsedCurrentLevel)) {
                currentLevel = parsedCurrentLevel;
            }
        } catch (error) {
            console.warn('No se pudo analizar el progreso guardado:', error);
        }
    }

    gameState.selectedUnits = orderUnits(selectedUnits);
    if (!gameState.selectedUnits.length) {
        gameState.selectedUnits = [...availableUnits];
    }

    applyUnitFilters();

    if (!gameState.selectedUnits.includes(currentUnit)) {
        currentUnit = gameState.selectedUnits[0];
        currentLevel = 0;
    }

    const levels = gameState.allLevels[`unit_${currentUnit}`] || [];
    if (currentLevel < 0 || currentLevel >= levels.length) {
        currentLevel = 0;
    }

    gameState.currentUnit = currentUnit;
    gameState.currentLevel = currentLevel;
    gameState.bonusPoints = bonusPoints;
    gameState.bonusWordCount = bonusWordCount;

    updateScore();
    updateBonusProgress();
}

// Save progress to localStorage
function saveProgress() {
    localStorage.setItem('wordConnectProgress', JSON.stringify({
        currentUnit: gameState.currentUnit,
        currentLevel: gameState.currentLevel,
        bonusPoints: gameState.bonusPoints,
        bonusWordCount: gameState.bonusWordCount,
        selectedUnits: gameState.selectedUnits
    }));
}

// Reset game to beginning
function resetGame(newSelectedUnits = null) {
    if (Array.isArray(newSelectedUnits) && newSelectedUnits.length > 0) {
        const orderedUnits = orderUnits(newSelectedUnits);
        if (orderedUnits.length > 0) {
            gameState.selectedUnits = orderedUnits;
        }
    }

    if (!gameState.selectedUnits.length) {
        gameState.selectedUnits = [...gameState.availableUnits];
    }

    applyUnitFilters();

    gameState.currentUnit = gameState.selectedUnits[0];
    gameState.currentLevel = 0;
    gameState.bonusPoints = 0;
    gameState.bonusWordCount = 0;
    gameState.foundWords = [];
    gameState.foundBonusWords = [];
    gameState.currentWord = '';
    gameState.selectedLetters = [];

    updateScore();
    updateBonusProgress();
    initGame();
    saveProgress();
    syncUnitSelectionUI();
}

// Initialize game for current level
function initGame() {
    if (!gameState.selectedUnits.length) {
        gameState.selectedUnits = [...gameState.availableUnits];
        applyUnitFilters();
    }

    if (!gameState.selectedUnits.includes(gameState.currentUnit)) {
        gameState.currentUnit = gameState.selectedUnits[0];
        gameState.currentLevel = 0;
    }

    const unitKey = `unit_${gameState.currentUnit}`;
    const levels = gameState.allLevels[unitKey];

    if (!levels || !levels.length) {
        console.error('No se encontraron niveles para la unidad seleccionada.');
        return;
    }

    if (gameState.currentLevel < 0 || gameState.currentLevel >= levels.length) {
        gameState.currentLevel = 0;
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
    const meta = getUnitMeta(gameState.currentUnit);
    const aulaLabel = `Aula ${meta.aula}`;
    const unidadLabel = `Unidad ${meta.unidad}`;
    document.getElementById('unit-level').textContent =
        `${aulaLabel} · ${unidadLabel} - Nivel ${gameState.currentLevel + 1}`;
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
    syncUnitSelectionUI();
    document.getElementById('new-game-modal').classList.remove('hidden');
}

// Hide new game modal
function hideNewGameModal() {
    document.getElementById('new-game-modal').classList.add('hidden');
}

// Confirm new game
function confirmNewGame() {
    const container = document.getElementById('unit-selection');
    const selectedButtons = container
        ? Array.from(container.querySelectorAll('.unit-card.selected'))
        : [];

    const selectedUnits = selectedButtons
        .map((button) => parseInt(button.dataset.unit, 10))
        .filter((unit) => !Number.isNaN(unit));

    if (selectedUnits.length === 0) {
        alert('Selecciona al menos una unidad para iniciar una nueva partida.');
        return;
    }

    hideNewGameModal();
    resetGame(selectedUnits);
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
        const isValid = await isValidSpanishWord(submittedWord);
        
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

    const currentUnitKey = `unit_${gameState.currentUnit}`;
    const levels = gameState.allLevels[currentUnitKey] || [];

    if (gameState.currentLevel >= levels.length) {
        const currentIndex = gameState.selectedUnits.indexOf(gameState.currentUnit);
        const isLastUnit = currentIndex === gameState.selectedUnits.length - 1;

        if (isLastUnit) {
            alert('¡Felicidades! ¡Has completado todas las unidades seleccionadas!');
            gameState.currentUnit = gameState.selectedUnits[0];
        } else {
            gameState.currentUnit = gameState.selectedUnits[currentIndex + 1];
        }

        gameState.currentLevel = 0;
    }

    initGame();
    saveProgress();
}
