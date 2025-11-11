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
├── levels.json         # Puzzle definitions (10 sample levels)
├── dictionary.json     # Spanish word list for bonus validation
├── generate_puzzles.js # Automated puzzle generator tool
├── README.md           # This file
```

## 🎯 Creating Your Own Puzzles

### Option 1: Manual Creation

Edit `levels.json` directly. Each level follows this structure:

```json
{
  "level_id": "u1_l1",
  "solution_words": ["SOL", "SAL"],
  "letter_pool": ["S", "O", "L", "A"],
  "grid_layout": [
    {
      "word": "SOL",
      "start_x": 1,
      "start_y": 0,
      "direction": "vertical"
    },
    {
      "word": "SAL",
      "start_x": 0,
      "start_y": 1,
      "direction": "horizontal"
    }
  ]
}
```

### Option 2: Automated Generation

Use the puzzle generator tool to create levels automatically:

1. **Install Node.js** (if not already installed)

2. **Customize word lists** in `generate_puzzles.js`:
   ```javascript
   const WORD_LISTS = {
     unit_1: ['SOL', 'SAL', 'PAN', 'PAZ', ...],
     unit_2: ['CASA', 'MESA', 'COSA', ...],
     // Add more units...
   };
   ```

3. **Run the generator**:
   ```bash
   node generate_puzzles.js
   ```

4. **Use generated puzzles**:
   - Output saved to `levels_generated.json`
   - Copy content to `levels.json` or rename the file

### Generator Configuration

Adjust settings in `generate_puzzles.js`:

```javascript
const CONFIG = {
    MIN_WORDS_PER_PUZZLE: 3,    // Minimum words per level
    MAX_WORDS_PER_PUZZLE: 5,    // Maximum words per level
    MAX_ATTEMPTS: 100,          // Attempts before giving up
    DISTRACTOR_LETTERS: 1,      // Extra letters in pool
};
```

## 📝 Expanding the Dictionary

Add more Spanish words to `dictionary.json` for bonus word validation:

```json
[
  "sol",
  "casa",
  "mesa",
  "gato",
  "perro",
  // Add your words here...
]
```

**Tips:**
- Use lowercase for all dictionary entries
- Include common vocabulary appropriate for your learning level
- The larger the dictionary, the more bonus words players can find

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