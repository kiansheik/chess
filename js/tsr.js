class TSRTrainer {
    constructor({ lines, pgnId, color, maxLines = 8 }) {
      this.lines = lines;
      this.pgnId = pgnId;
      this.userColor = color;
      this.maxLines = maxLines;
  
      this.progress = loadProgress(this.pgnId, this.userColor);
      this.checkpointCache = new Map(); // line -> checkpoint array
      this.masteredCache = new Map();   // line -> true/false
  
      this.activeLineIndices = [];
      this.lineQueue = [];
      this.currentLine = null;
  
      this.initActiveLines();
      this.recalculateQueue();
    }
  
    refreshProgress() {
      this.progress = loadProgress(this.pgnId, this.userColor);
    }
  
    initActiveLines() {
      let count = 0;
      this.activeLineIndices = [];
      for (let i = 0; i < this.lines.length && count < this.maxLines; i++) {
        if (!this.isLineMastered(this.lines[i])) {
          this.activeLineIndices.push(i);
          count++;
        }
      }
    }
  
    isLineMastered(line) {
      if (this.masteredCache.has(line)) {
        return this.masteredCache.get(line);
      }
  
      const checkpoints = this.getCheckpoints(line);
      const result = checkpoints.every(key => {
        const entry = this.progress[key];
        if (!entry) return false;
        const total = entry.correct + entry.incorrect;
        return total >= 3 && (entry.correct / total) >= 0.8;
      });
      if (result) {
        this.masteredCache.set(line, result);
      }
      return result;
    }
  
    getCheckpoints(line) {
      if (this.checkpointCache.has(line)) {
        return this.checkpointCache.get(line);
      }
  
      const checkpoints = [];
      const game = new Chess();
  
      for (let i = 0; i < line.length; i++) {
        const fen = getFenKey(game.fen());
        const move = game.move(line[i], { sloppy: true });
        if (!move) break;
  
        const moveColor = (i % 2 === 0) ? 'w' : 'b';
        if (this.userColor[0] === moveColor) {
          checkpoints.push(`${fen}|${line[i]}`);
        }
      }
  
      this.checkpointCache.set(line, checkpoints);
      return checkpoints;
    }
  
    recalculateQueue() {
      this.initActiveLines();
      const now = Date.now();
      this.refreshProgress();
    
      const allLines = this.lines;
      const unmastered = allLines.filter(line => !this.isLineMastered(line));
    
      const candidates = (unmastered.length > 0 ? unmastered : allLines).map(line => {
        const checkpoints = this.getCheckpoints(line);
    
        let total = 0, correct = 0, lastSeen = 0;
        for (const key of checkpoints) {
          const stats = this.progress[key];
          if (stats) {
            const attempts = (stats.correct || 0) + (stats.incorrect || 0);
            total += attempts;
            correct += stats.correct || 0;
            lastSeen = Math.max(lastSeen, new Date(stats.lastSeen || 0).getTime());
          }
        }
    
        const accuracy = total ? correct / total : 0;
        const recencyScore = lastSeen ? now - lastSeen : Infinity;
        const score = recencyScore * 0.8 + (1 - accuracy) * 0.2;
    
        return { line, score };
      });
    
      candidates.sort((a, b) => b.score - a.score);
      this.lineQueue = candidates.map(c => c.line);
    }
  
    getNextLine() {
      if (!this.lineQueue.length) this.recalculateQueue();
      const next = this.lineQueue.find(l => l !== this.currentLine) || this.lineQueue[0];
      this.currentLine = next;
      this.lineQueue = this.lineQueue.filter(l => l !== next);
      return next;
    }
  
    resetLineProgress() {
      if (this.currentLine) {
        this.lineQueue.push(this.currentLine);
        this.currentLine = null;
      }
    }
  
    markCurrentLineMastered() {
      const currentIndex = this.lines.indexOf(this.currentLine);
      if (currentIndex >= 0 && this.isLineMastered(this.currentLine)) {
        this.currentLine = null;
        this.recalculateQueue();
      }
    }
  }
  window.TSRTrainer = TSRTrainer;  
  function updateMasteredLineCount() {
    if (!tsrTrainer) return;
  
    const total = tsrTrainer.lines.length;
    const mastered = tsrTrainer.lines.filter(line => tsrTrainer.isLineMastered(line)).length;
    console.log("Mastered lines:", mastered, "of", total);
    document.getElementById('lines-mastered').textContent = `${mastered}/${total} lines mastered`;
  }

  window.updateMasteredLineCount = updateMasteredLineCount;