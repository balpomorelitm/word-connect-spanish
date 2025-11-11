# Word Connect - Spanish Learning Game 🇪🇸

An interactive crossword-style word game designed for Spanish vocabulary learning. Players form words from a letter pool to fill crossword grids, with a bonus word system that rewards discovering additional valid Spanish words.

## 🎮 Features

- **Crossword Gameplay**: Connect letters to form words and fill the grid
- **Unit-Based Learning**: Organized vocabulary by learning units
- **Bonus Word System**: Earn points by discovering valid Spanish words beyond the puzzle solutions
- **Hint System**: Use bonus points to reveal letters when stuck
- **Progress Tracking**: Automatic save of your progress and bonus points
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Beautiful UI**: Modern gradient design with smooth animations

## 🚀 Quick Start

### Play the Game

1. Clone this repository:
   ```bash
   git clone https://github.com/balpomorelitm/word-connect-spanish.git
   cd word-connect-spanish
   ```

2. Open `index.html` in your web browser
   - Or use a local server (recommended):
   ```bash
   python -m http.server 8000
   # Then visit http://localhost:8000
   ```

3. Start playing!
   - Click letters in order to form words
   - Click "Enviar" to submit
   - Click "Borrar" to clear your selection

## 📚 How to Play

### Objective
Form all the words shown in the crossword grid by selecting letters from the pool.

### Controls
- **Click Letters**: Select letters in sequence to form a word
- **Submit Button**: Check if your word is valid
- **Clear Button**: Reset your current selection
- **Hint Button** (💡): Reveal a random letter (costs 50 bonus points)

### Scoring
- **Puzzle Words**: Fill the crossword grid to complete the level
- **Bonus Words**: Find valid Spanish words not in the puzzle (+10 points each)
- **Hints**: Spend 50 points to reveal a letter

## 🛠️ Project Structure

```
word-connect-spanish/
├── index.html          # Main game interface
├── style.css           # Styling and animations
├── game.js             # Game logic and mechanics
├── levels.json         # Auto-generated puzzle definitions por unidad
├── dictionary.json     # Lexías simples (minúsculas) para palabras bonus
├── generate_puzzles.js # Generador de niveles basado en el glosario oficial
├── README.md           # This file
```

## 🧩 Puzzle & Dictionary Generation

The automated generator builds both the playable levels and the bonus-word dictionary directly from the official course glossary `span10011002.json`.

### Glossary structure

`span10011002.json` contains an array of entries similar to:

```json
{
  "_": "5",
  "Unidad Léxica (Español)": "EL LIBRO",
  "Traducción (Inglés)": "THE BOOK",
  "Parte del discurso": "Sustantivo"
  // …otros metadatos
}
```

- `"_"` identifica la unidad didáctica.
- `"Unidad Léxica (Español)"` almacena la lexía en español.
- El script también acepta los campos `palabra`, `entrada`, `term` o `lema` si están presentes.

### Normalización de lexías

`generate_puzzles.js` filtra el glosario para obtener **lexías simples** listas para usar en el juego:

1. Elimina artículos iniciales (`el`, `la`, `los`, `las`).
2. Usa solo la primera forma en variantes como `niño/niña`.
3. Descarta cualquier entrada con espacios (colocaciones o frases hechas).
4. Limpia signos de puntuación y convierte todo a mayúsculas.
5. Conserva únicamente caracteres alfabéticos españoles (`A-Z` y `Ñ`).

El resultado se agrupa por unidad para construir niveles coherentes y se guarda en `dictionary.json` (en minúsculas) para validar palabras bonus.

### Generar nuevos niveles

Ejecuta el generador con Node.js para crear entre 30 y 40 niveles por unidad (40 por defecto) y un diccionario actualizado:

```bash
node generate_puzzles.js --glossary span10011002.json --levels 40
```

Atajos disponibles en `package.json`:

```bash
npm run generate               # Usa la configuración por defecto
npm run generate:glossary      # Usa span10011002.json con 40 niveles por unidad
```

Cada nivel generado incluye:

- `--glossary` admite rutas locales o URLs HTTPS (por ejemplo, el enlace "Raw" de GitHub).
- `solution_words`: 2 o 3 palabras que comparten la letra inicial y se cruzan en letras idénticas.
- `letter_pool`: todas las letras necesarias, contando repeticiones (por ejemplo, `ANA` aporta dos `A`).
- `grid_layout`: una palabra base horizontal y hasta dos verticales colocadas en columnas distintas de la base.

Los archivos finales se escriben directamente en `levels.json` y `dictionary.json`, listos para que el juego los consuma.

## 🎨 Customization

### Change Colors

Edit CSS variables in `style.css`:

```css
:root {
    --primary-color: #4a90e2;      /* Main UI color */
    --success-color: #4caf50;      /* Correct answers */
    --error-color: #f44336;        /* Wrong answers */
    --bonus-color: #ff9800;        /* Bonus points */
}
```

### Adjust Difficulty

In `game.js`, modify:

```javascript
const HINT_COST = 50;  // Points needed for hints
```

In `game.js`, change bonus points:

```javascript
// Line ~200 in foundBonusWord function
gameState.bonusPoints += 10;  // Change reward amount
```

## 📊 Game Progression

- **Units**: Thematic vocabulary groups
- **Levels**: Individual puzzles within each unit
- **Progress**: Automatically saved to browser localStorage
- **Reset**: Clear browser data to restart

## 🐛 Troubleshooting

### Game won't load
- Check browser console for errors (F12)
- Ensure all files are in the same directory
- Use a local server instead of opening HTML directly

### Words not validating
- Verify words are in `levels.json` (puzzle words) or `dictionary.json` (bonus words)
- Check spelling and capitalization
- Ensure dictionary uses lowercase

### Progress not saving
- Check if browser allows localStorage
- Try a different browser
- Clear browser cache and reload

## 📚 Educational Use

This game is designed for:
- Spanish language learners (A1-B1 levels)
- Classroom activities
- Self-paced vocabulary practice
- Homework assignments

### Tips for Teachers
1. Create units matching your curriculum
2. Use the generator to quickly create many levels
3. Adjust vocabulary difficulty per unit
4. Encourage students to find bonus words for extra credit

## 🔧 Technical Details

- **No dependencies**: Pure HTML/CSS/JavaScript
- **Local storage**: Progress saved in browser
- **Responsive**: Mobile-first design
- **Modern browsers**: Chrome, Firefox, Safari, Edge

## 🤝 Contributing

Contributions welcome! Areas for improvement:
- Additional vocabulary units
- More sophisticated puzzle generation algorithms  
- Touch/swipe controls for mobile
- Sound effects and music
- Multiplayer features
- Statistics and analytics dashboard

## 📝 License

MIT License - Feel free to use and modify for educational purposes.

## ❤️ Acknowledgments

Inspired by word puzzle games like Word Connect, Word Cross, and traditional crossword puzzles.

---

¡Buena suerte y diviértete aprendiendo español! 🎉