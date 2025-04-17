function getFenKey(fen) {
    const parts = fen.split(' ');
    return parts[0] + ' ' + parts[1]; // board layout + who's to move
  }
  
  function getQuestionKey(fen, expectedMove) {
    return getFenKey(fen) + "|" + expectedMove;
  }
  
  function getPGNId(pgn) {
    const match = pgn.match(/\[Event "(.*?)"\]/);
    const title = match ? match[1] : pgn.slice(0, 40);
    return btoa(title).slice(0, 12); // simple base64 hash
  }
  
  function loadProgress(pgnId, color) {
    const key = `pgn-trainer:${color}:${pgnId}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  }
  
  function saveProgress(pgnId, color, progress) {
    const key = `pgn-trainer:${color}:${pgnId}`;
    localStorage.setItem(key, JSON.stringify(progress));
  }
  
  function recordAttempt(fen, correct, timeTaken, pgnSoFar, pgnId, color, expectedMove) {
    const progress = loadProgress(pgnId, color);
    const key = getQuestionKey(fen, expectedMove);
    const now = Date.now(); // numeric timestamp instead of ISO string
  
    if (!progress[key]) {
      progress[key] = {
        pgnUpToHere: pgnSoFar,
        correct: 0,
        incorrect: 0,
        averageTime: 0,
        lastSeen: now
      };
    }
  
    const entry = progress[key];
    if (correct) entry.correct++;
    else entry.incorrect++;
  
    const total = entry.correct + entry.incorrect;
    entry.averageTime = ((entry.averageTime * (total - 1)) + timeTaken) / total;
    entry.lastSeen = now; // update with numeric timestamp
  
    saveProgress(pgnId, color, progress);
  }
  
  function getStatsByKey(key, pgnId, color) {
    const progress = loadProgress(pgnId, color);
    return progress[key] || null;
  }
  
  function formatStats(stats, options = {}) {
    if (!stats) {
        stats = {
            correct: 0,
            incorrect: 0,
            averageTime: 0,
            lastSeen: new Date().toISOString(),
        }
    };
  
    const total = stats.correct + stats.incorrect;
    const pct = Math.round((stats.correct / total) * 100);
    const lines = [];
  
    // Add PGN path (left box)
    if (options.pgn) {
      lines.push(`<div class="pgn-label small"><strong>PGN:</strong> ${options.pgn}</div>`);
    }
  
    // Add After: move with move number and color (right box)
    if (options.lastMove) {
      let afterStr = "";
  
      if (typeof options.lastMove === "string") {
        afterStr = options.lastMove; // fallback if passed as plain text
      } else if (options.lastMove && typeof options.lastMove === "object") {
        const { color, san } = options.lastMove;
        const moveIndex = currentIndex;
        const moveNum = Math.floor((moveIndex + 1) / 2);
        afterStr = `${moveNum}${color === "white" ? '...' : '.'} ${san}`;
      }
  
      lines.push(`<div class="pgn-label small"><strong>After:</strong> ${afterStr}</div>`);
    }
  
    lines.push(`
      Seen: ${total}x<br>
      Correct: ${stats.correct}<br>
      Accuracy: ${pct}%<br>
      Avg Time: ${stats.averageTime.toFixed(2)}s
    `);
  
    return lines.join('<br><br>');
  }
  
  function downloadStats() {
    if (!pgnId || !userColor) {
      alert("Start training first to export stats.");
      return;
    }
  
    const key = `pgn-trainer:${userColor}:${pgnId}`;
    const data = localStorage.getItem(key);
  
    if (!data) {
      alert("No stats found to export.");
      return;
    }
  
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
  
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pgnId}-${userColor}-stats.json`;
    a.click();
  
    URL.revokeObjectURL(url);
  }
  
  function uploadStats(event) {
    const file = event.target.files[0];
    if (!file) return;
  
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = JSON.parse(e.target.result);
  
        if (!pgnId || !userColor) {
          alert("Start training before importing stats.");
          return;
        }
  
        const key = `pgn-trainer:${userColor}:${pgnId}`;
        localStorage.setItem(key, JSON.stringify(data));
        alert("Stats imported successfully!");
        updateStatus(); // refresh current stats view
      } catch (err) {
        alert("Invalid stats file.");
        console.error("Upload error:", err);
      }
    };
    reader.readAsText(file);
  }
  
  function populatePGNDropdown() {
    const selector = document.getElementById('pgn-selector');
    selector.innerHTML = `<option disabled selected>Select a PGN</option>`;
  
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(`pgn-saved:`)) {
        const event = key.split(':')[2];
        const option = document.createElement('option');
        option.value = key;
        let col = key.split(':')[1];
        option.textContent = `${event} (${col})`;
        selector.appendChild(option);
      }
    }
  }
  
function loadSelectedPGN() {
    const selector = document.getElementById('pgn-selector');
    const key = selector.value;
    const savedPGN = localStorage.getItem(key);
    if (savedPGN) {
        document.getElementById('pgn-input').value = savedPGN;

        // Set the color based on the key
        const color = key.split(':')[1];
        const colorSelect = document.getElementById('color-select');
        if (colorSelect) {
            colorSelect.value = color;
        }

        startTrainer(); // reuse the flow
    }
}
  