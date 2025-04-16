function resetStats() {
    if (!pgnId || !userColor) {
      alert("Start training first to reset stats.");
      return;
    }
  
    const key = `pgn-trainer:${userColor}:${pgnId}`;
    localStorage.removeItem(key);
    // alert(`Stats for ${userColor.toUpperCase()} on current PGN have been reset.`);
  
    // Reset in-memory state
    currentIndex = 0;
    currentTrainingLine = null;
    if (typeof tsrTrainer !== 'undefined' && tsrTrainer) {
      tsrTrainer = null;
    }
  
    awaitingCorrection = false;
    expectedCorrection = null;
  
    game.reset();
    board.position(game.fen());
    overlay.clear();
    overlay.render();
  
    // Clear UI
    document.getElementById('stats-box').innerHTML = "";
    document.getElementById('stats-prev').innerHTML = "";
    document.getElementById('status').textContent = "Paste a PGN and click Start";
  }
  


fetch('/chess/white_0.55_1000-1._e4_e5_2._d4_exd4_3._c3_dxc3_4._Bc4_cxb2_5._Bxb2-rep.pgn')
      .then(response => response.text())
      .then(data => {
        document.getElementById('pgn-input').value = data;
      })
      .catch(error => {
        console.error("Couldn't load PGN file:", error);
      });

    let board = null;
    let game = new Chess();
    let currentIndex = 0;
    let moveStartTime = Date.now();
    let lastQuestionKey = null;
    let pgnId = "";
    let currentPgnSoFar = "";
    let userColor = "white";
    let currentTrainingLine = [];
    let tsrTrainer = null;
    let awaitingCorrection = false;
    let correctionArrow = null;
    let expectedCorrection = null;
    

    function startTrainer() {
        const pgn = document.getElementById('pgn-input').value;
        userColor = document.getElementById('color-select').value;
        const eventMatch = pgn.match(/\[Event "(.*?)"\]/);
        if (!eventMatch){
            alert('Add Event tag to PGN. ([Event "Danish"])');
            return;
        }
        const eventTitle = eventMatch[1];
        const colorKey = `pgn-saved:${userColor}:${eventTitle}`;
        localStorage.setItem(colorKey, pgn);

        pgnId = getPGNId(pgn);
      
        game.reset();
        if (!game.load_pgn(pgn)) {
          updateStatus("⚠️ Invalid PGN. Try again.");
          return;
        }
      
        // 1. Parse PGN into full lines using your new parser
        const pgnStrings = parsePGNLines(pgn); // calls getAllPGNLines under the hood
        const lineSequences = pgnStrings.map(pgnStr => {
          const g = new Chess();
          g.load_pgn(pgnStr);
          return g.history(); // array of SAN strings
        });
      
        // 2. Load user stats
        const progress = loadProgress(pgnId, userColor);
      
        // 3. Set up TSR
        const maxLines = parseInt(document.getElementById("tsr-lines")?.value || 8, 10);
        tsrTrainer = new TSRTrainer({
          lines: lineSequences,
          progressStore: progress,
          maxLines: maxLines
        });
      
        // 4. Get first line
        currentTrainingLine = tsrTrainer.getNextLine();
        if (!currentTrainingLine) {
          updateStatus("🎉 All lines mastered!");
          return;
        }
      
        currentIndex = 0;
        game.reset();
        board.orientation(userColor);
        board.position(game.fen());
      
        if (userColor === "black") {
          autoPlayOpponentMove();
        }
      
        updateStatus();
        populatePGNDropdown();
      }
      

      function updateStatus(msg) {
        const statusText = msg || `Move ${currentIndex + 1} of ${currentTrainingLine.length}`;
        document.getElementById('status').textContent = statusText;
      
        // Update PGN up to and including last user move (for the left box)
        const movesUpToNow = currentTrainingLine.slice(0, currentIndex);
        const pgnGame = new Chess();
        movesUpToNow.forEach(m => pgnGame.move(m));
        currentPgnSoFar = pgnGame.pgn(); // Used for logging purposes
      
        // Only update stats box if there’s a move left for the user
        if (currentIndex < currentTrainingLine.length) {
          const fen = game.fen();
          const expectedMove = currentTrainingLine[currentIndex];
          const key = getQuestionKey(fen, expectedMove);
          const stats = getStatsByKey(key, pgnId, userColor);
      
          const fullHistory = game.history({ verbose: true });
          const lastMove = fullHistory.length > 0 ? fullHistory[fullHistory.length - 1] : null;
      
          document.getElementById('stats-box').innerHTML = formatStats(stats, {
            lastMove: lastMove
          });
        }
      
        moveStartTime = Date.now();
      }
      

function getAllPGNLines(parsedGames) {
    const lines = [];
  
    function walk(moves, prefix = [], moveNum = 1, isWhiteMove = true) {
      let currentMoveNum = moveNum;
      let isWhite = isWhiteMove;
      let currentLine = [...prefix];
  
      for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        const san = move.notation.notation;
  
        if (isWhite) {
          currentLine.push(`${currentMoveNum}. ${san}`);
        } else {
          currentLine[currentLine.length - 1] += ` ${san}`;
          currentMoveNum++;
        }
  
        const isLeaf = !move.next && (!move.variations || move.variations.length === 0);
        const isLastInLine = i === moves.length - 1;
  
        if (isLeaf && isLastInLine) {
          lines.push(currentLine.join(" "));
        }
  
        // Handle variations
        if (Array.isArray(move.variations)) {
          for (const variation of move.variations) {
            walk(variation, [...prefix], moveNum, isWhiteMove);
          }
        }
  
        // Walk into mainline
        prefix = [...currentLine];
        moveNum = currentMoveNum;
        isWhiteMove = isWhite;
      }
    }
  
    for (const game of parsedGames) {
      if (game.moves && game.moves.length > 0) {
        walk(game.moves);
      }
    }
  
    return lines;
  }
  

function parsePGNLines(pgn) {
    const game = new Chess();
    if (!game.load_pgn(pgn)) return [];
    const parsed = PgnParser.parse(pgn, { startRule: 'games' });
    const lines = getAllPGNLines(parsed);
    return lines;
  }

    
  function onDrop(source, target) {
    if (!tsrTrainer || !currentTrainingLine) return 'snapback';
  
    const fenBeforeMove = game.fen();
    const expectedMove = currentTrainingLine[currentIndex];
  
    // Handle correction mode
    if (awaitingCorrection) {
      const move = game.move({ from: source, to: target, promotion: 'q' });
  
      if (!move || move.san !== expectedCorrection) {
        game.undo();
        return 'snapback';
      }
  
      // Corrected successfully
      awaitingCorrection = false;
      expectedCorrection = null;
      overlay.clear();
      overlay.render();
  
      // No stats update here — correction doesn't count
      tsrTrainer.resetLineProgress(); // penalize the current line
      currentTrainingLine = tsrTrainer.getNextLine();
      resetBoardAndLine();
      return;
    }
  
    const questionKey = getQuestionKey(fenBeforeMove, expectedMove);
    const move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';
  
    const timeTaken = (Date.now() - moveStartTime) / 1000;
    const correct = (move.san === expectedMove);
  
    recordAttempt(fenBeforeMove, correct, timeTaken, currentPgnSoFar, pgnId, userColor, expectedMove);
  
    const stats = getStatsByKey(questionKey, pgnId, userColor);
    document.getElementById("stats-box").innerHTML = formatStats(stats, {
      lastMove: game.history({ verbose: true }).slice(-1)[0]
    });
  
    if (correct) {
      const prevStats = getStatsByKey(questionKey, pgnId, userColor);
      const fullMoveGame = new Chess();
      currentTrainingLine.slice(0, currentIndex + 1).forEach(m => fullMoveGame.move(m));
      const fullPgnSoFar = fullMoveGame.pgn();
  
      document.getElementById("stats-prev").innerHTML = formatStats(prevStats, {
        pgn: fullPgnSoFar
      });
  
      overlay.clear();
      overlay.render();
  
      currentIndex++;
      updateStatus();
  
      if (currentIndex >= currentTrainingLine.length) {
        tsrTrainer.recalculateQueue();
        currentTrainingLine = tsrTrainer.getNextLine();
        resetBoardAndLine();
      }
  
      const turn = game.turn();
      const expectedColor = userColor === "white" ? "b" : "w";
      if (turn === expectedColor) {
        setTimeout(autoPlayOpponentMove, 300);
      }
    } else {
      game.undo();
  
      awaitingCorrection = true;
      expectedCorrection = expectedMove;
  
      // Replay game to current point to find correct source square
      const temp = new Chess();
      for (let i = 0; i < currentIndex; i++) {
        temp.move(currentTrainingLine[i]);
      }
      const legalMoves = temp.moves({ verbose: true });
      const correctMove = legalMoves.find(m => m.san === expectedMove);
  
      overlay.clear();
      overlay.addArrow(source, target, "red");
      if (correctMove) {
        overlay.addArrow(correctMove.from, correctMove.to, "green");
      }
      overlay.render();
  
      updateStatus(`❌ Incorrect. Try again: ${expectedMove}`);
  
    //   return 'snapback';
    }
  }
  
  
  
  function resetBoardAndLine() {
    game.reset();
    currentIndex = 0;
    board.position(game.fen());
  
    if (userColor === "black") {
      autoPlayOpponentMove();
    }
  
    updateStatus();
  }
    

  function autoPlayOpponentMove() {
    if (currentIndex >= currentTrainingLine.length) return;
  
    const move = currentTrainingLine[currentIndex];
    game.move(move);
    board.position(game.fen());
    currentIndex++;
  
    if (currentIndex < currentTrainingLine.length) {
      const fen = game.fen();
      const nextMove = currentTrainingLine[currentIndex];
      const key = getQuestionKey(fen, nextMove);
      const stats = getStatsByKey(key, pgnId, userColor);
      document.getElementById('stats-box').innerHTML = formatStats(stats, {
        lastMove: { color: userColor, san: move }
      });
    }
  }
  

    function onSnapEnd() {
      board.position(game.fen());
    }

    board = Chessboard('board', {
      draggable: true,
      position: 'start',
      onDrop: onDrop,
      onSnapEnd: onSnapEnd,
      showArrows: []
    });
    var overlay = new SimpleArrowOverlay('board_wrapper');