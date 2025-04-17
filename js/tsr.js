class TSRTrainer {
    constructor({ lines, progressStore, maxLines = 8 }) {
      this.lines = lines; // full list of lines in input order
      this.progressStore = progressStore;
      this.maxLines = maxLines;
      this.activeLineIndices = []; // indices of lines currently being studied
      this.lineQueue = [];
      this.currentLine = null;
  
      this.initActiveLines();
      this.recalculateQueue();
    }
  
    initActiveLines() {
      let count = 0;
      for (let i = 0; i < this.lines.length && count < this.maxLines; i++) {
        const line = this.lines[i];
        if (!this.isLineMastered(line)) {
          this.activeLineIndices.push(i);
          count++;
        }
      }
    }
  
    setMaxLines(count) {
      this.maxLines = count;
      this.recalculateQueue();
    }
  
    isLineMastered(line) {
      const checkpoints = this.getCheckpoints(line);
      return checkpoints.every(key => {
        const entry = this.progressStore[key];
        if (!entry) return false;
        const total = entry.correct + entry.incorrect;
        return total >= 3 && (entry.correct / total) >= 0.8;
      });
    }
  
    getCheckpoints(line) {
      const checkpoints = [];
      const game = new Chess();
      for (let move of line) {
        const fen = getFenKey(game.fen());
        checkpoints.push(`${fen}|${move}`);
        game.move(move);
      }
      return checkpoints;
    }
  
    recalculateQueue() {
      const now = Date.now();
  
      const candidates = this.activeLineIndices
        .filter(i => !this.isLineMastered(this.lines[i]))
        .map(i => {
          const line = this.lines[i];
          const checkpoints = this.getCheckpoints(line);
          let totalAttempts = 0;
          let correctAttempts = 0;
          let lastSeen = 0;
  
          for (const key of checkpoints) {
            const stats = this.progressStore[key];
            if (stats) {
              const attempts = (stats.correct || 0) + (stats.incorrect || 0);
              totalAttempts += attempts;
              correctAttempts += stats.correct || 0;
              lastSeen = Math.max(lastSeen, new Date(stats.lastSeen || 0).getTime());
            }
          }
  
          const accuracy = totalAttempts ? correctAttempts / totalAttempts : 0;
          const recencyScore = lastSeen ? now - lastSeen : Infinity;
          const accuracyScore = 1 - accuracy;
          const score = recencyScore * 0.7 + accuracyScore * 0.3;
  
          return { line, score };
        });
  
      candidates.sort((a, b) => b.score - a.score);
      this.lineQueue = candidates.map(c => c.line);
    }
  
    getNextLine() {
      if (!this.lineQueue.length) this.recalculateQueue();
  
      const next = this.lineQueue.find(line => line !== this.currentLine) || this.lineQueue[0];
      this.currentLine = next;
      this.lineQueue = this.lineQueue.filter(line => line !== next);
      return this.currentLine;
    }
  
    resetLineProgress() {
      if (this.currentLine) {
        this.lineQueue.push(this.currentLine);
        this.currentLine = null;
      }
    }
  
    // Call when a line is mastered to add the next unstudied index
    addNextUnseenLine() {
      const nextIndex = this.activeLineIndices.length;
      if (nextIndex < this.lines.length && !this.isLineMastered(this.lines[nextIndex])) {
        this.activeLineIndices.push(nextIndex);
      }
    }
  
    markCurrentLineMastered() {
      const currentIndex = this.lines.indexOf(this.currentLine);
      if (currentIndex >= 0 && this.isLineMastered(this.currentLine)) {
        this.currentLine = null;
        this.addNextUnseenLine();
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