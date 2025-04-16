class TSRTrainer {
    constructor({ lines, progressStore, maxLines = 8 }) {
      this.lines = lines; // Array of move sequences: [['e4','e5','Nf3'], ...]
      this.progressStore = progressStore; // { [fen|move]: { correct, incorrect, avgTime } }
      this.maxLines = maxLines;
      this.lineQueue = []; // { lineId, sequenceOfMoves }
      this.currentLine = null;
  
      this.recalculateQueue();
    }
  
    setMaxLines(count) {
      this.maxLines = count;
      this.recalculateQueue();
    }
  
    recalculateQueue() {
      const candidates = this.lines.filter(line => !this.isLineMastered(line));
      this.lineQueue = candidates.slice(0, this.maxLines);
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
      for (let i = 0; i < line.length; i++) {
        const fen = getFenKey(game.fen());
        checkpoints.push(`${fen}|${line[i]}`);
        game.move(line[i]);
      }
      return checkpoints;
    }
  
    getNextLine() {
      if (!this.lineQueue.length) this.recalculateQueue();
      this.currentLine = this.lineQueue.shift();
      return this.currentLine;
    }
  
    resetLineProgress() {
      if (this.currentLine) {
        this.lineQueue.push(this.currentLine); // Put it back for retry
        this.currentLine = null;
      }
    }
  }
  
  window.TSRTrainer = TSRTrainer;
  