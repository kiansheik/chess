const tc = {
    "w": "white",
    "b": "black"
}

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
    ground.set({
        fen: game.fen(),    
        turnColor: tc[game.turn()],
        movable: {
          ...ground.state.movable,
          color: tc[game.turn()]
        }
      });
      
    clearArrows();
  
    // Clear UI
    document.getElementById('stats-box').innerHTML = "";
    document.getElementById('stats-prev').innerHTML = "";
    document.getElementById('status').textContent = "Paste a PGN and click Start";
  }
  

fetch('/chess/pgn/white_0.55_1000-1._e4_e5_2._d4_exd4_3._c3_dxc3_4._Bc4_cxb2_5._Bxb2-rep.pgn')
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
    let ground = null;
    

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
          pgnId: pgnId,
          color: userColor,
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
        ground.set({
            orientation: userColor,
            fen: game.fen(),    
            turnColor: tc[game.turn()],
            movable: {
              ...ground.state.movable,
              color: tc[game.turn()]
            }
          });          
      
        if (userColor === "black") {
          autoPlayOpponentMove();
        }
      
        updateStatus();
        populatePGNDropdown();
        updateMasteredLineCount();
      }
      
      function updateStatus(msg) {
        if (!Array.isArray(currentTrainingLine)) {
          document.getElementById('status').textContent = msg || "🎉 All lines mastered!";
          document.getElementById('stats-box').innerHTML = "";
          return;
        }
      
        const totalMoves = currentTrainingLine.length;
        const statusText = msg || `Move ${currentIndex + 1} of ${totalMoves}`;
        document.getElementById('status').textContent = statusText;
      
        // Update PGN up to and including last user move (for the left box)
        const movesUpToNow = currentTrainingLine.slice(0, currentIndex);
        const pgnGame = new Chess();
        movesUpToNow.forEach(m => pgnGame.move(m));
        currentPgnSoFar = pgnGame.pgn(); // Used for logging
      
        // If there’s a move left for the user to make, update stats box
        if (currentIndex < totalMoves) {
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
      
      

function snapback(lastGoodFen) {
        if (!lastGoodFen) {
          console.warn("No last good position saved.");
          return;
        }
      
        // Reset the internal game state
        game.load(lastGoodFen);
      
        // Update the Chessground board
        ground.set({
          fen: lastGoodFen,
          turnColor: tc[game.turn()],
          movable: {
            ...ground.state.movable,
            color: tc[game.turn()]
          }
        });
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
  function clearArrows() {
    ground.set({
      drawable: {
        ...ground.state.drawable,
        autoShapes: []
      }
    });
  }
  
  function drawArrows({ source, target, correctMove }) {
    const shapes = [];
  
    // Red arrow for the move the user tried
    shapes.push({
      orig: source,
      dest: target,
      brush: 'red'
    });
  
    // Green arrow for the correct move
    if (correctMove) {
      shapes.push({
        orig: correctMove.from,
        dest: correctMove.to,
        brush: 'green'
      });
    }
  
    ground.set({
      orientation: userColor,
      drawable: {
        ...ground.state.drawable,
        autoShapes: shapes
      }
    });
  }
  
    
  function onDrop(source, target) {
    const fenBeforeMove = game.fen();
    console.log("Dropped from", source, "to", target);
    if (!tsrTrainer || !currentTrainingLine) { 
        snapback(fenBeforeMove); return 'snapback';
    }
  
    const expectedMove = currentTrainingLine[currentIndex];
  
    // Handle correction mode
    if (awaitingCorrection) {
      const move = game.move({ from: source, to: target, promotion: 'q' });
  
      if (!move || move.san !== expectedCorrection) {
        game.undo();
        snapback(fenBeforeMove); return 'snapback';
      }
  
      // Corrected successfully
      awaitingCorrection = false;
      expectedCorrection = null;
      clearArrows()
  
      // No stats update here — correction doesn't count
      tsrTrainer.resetLineProgress(); // penalize the current line
      currentTrainingLine = tsrTrainer.getNextLine();
      resetBoardAndLine();
      return;
    }
  
    const questionKey = getQuestionKey(fenBeforeMove, expectedMove);
    const move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) {
        snapback(fenBeforeMove); return 'snapback';
    }
  
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
  
      clearArrows()
  
      currentIndex++;
      updateStatus();
  
      if (currentIndex >= currentTrainingLine.length) {
        tsrTrainer.recalculateQueue();
        currentTrainingLine = tsrTrainer.getNextLine();
        resetBoardAndLine();
      }
  
      const turn = tc[game.turn()];
      const expectedColor = userColor === "white" ? "black" : "white";
      if (turn === expectedColor) {
        setTimeout(autoPlayOpponentMove, 300);
      }
      updateEngineSuggestion()
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
  
      clearArrows()
      drawArrows({
        source: source,
        target: target,
        correctMove: correctMove
      });
      
  
      updateStatus(`❌ Incorrect. Try again: ${expectedMove}`);
  
      snapback(fenBeforeMove); return 'snapback';
    }
    updateMasteredLineCount();
  }
  
  
  
  function resetBoardAndLine() {
    game.reset();
    currentIndex = 0;
    ground.set({
        fen: game.fen(),    
        turnColor: tc[game.turn()],
        movable: {
          ...ground.state.movable,
          color: tc[game.turn()]
        }
      });
  
    if (userColor === "black") {
      autoPlayOpponentMove();
    }
  
    updateStatus();
    updateEngineSuggestion();
  }
    

  function autoPlayOpponentMove() {
    if (!currentTrainingLine || currentIndex >= currentTrainingLine.length) {
      tsrTrainer.markCurrentLineMastered?.();
      currentTrainingLine = tsrTrainer.getNextLine();
      resetBoardAndLine();
      return;
    }
    console.log("Opponent's turn");
    const moveSan = currentTrainingLine[currentIndex];
    const move = game.move(moveSan, { sloppy: true });
    if (!move) {
      console.warn("Engine could not apply move:", moveSan);
      return;
    }
  
    const newFen = game.fen();
    ground.set({
      fen: newFen,    turnColor: tc[game.turn()],
      movable: {
        ...ground.state.movable,
        color: tc[game.turn()]
      }
    });
  
    currentIndex++;
  
    if (currentIndex >= currentTrainingLine.length) {
      // 🎉 Line ends on opponent’s move
      tsrTrainer.markCurrentLineMastered?.();
      currentTrainingLine = tsrTrainer.getNextLine();
      resetBoardAndLine();
      return;
    }
  
    const nextMove = currentTrainingLine[currentIndex];
    const key = getQuestionKey(game.fen(), nextMove);
    const stats = getStatsByKey(key, pgnId, userColor);
  
    document.getElementById('stats-box').innerHTML = formatStats(stats, {
      lastMove: { color: userColor, san: moveSan }
    });
  
    updateEngineSuggestion();
  }
  
  
  let selectedSquare = null;

//   function setupHybridTapAndDrag() {
//     const boardEl = document.getElementById('board');
    
//     // Handle mouse/touch clicks on squares
//     boardEl.addEventListener('mousedown', handleSquareInteraction);
//     boardEl.addEventListener('touchstart', handleSquareInteraction);
//   }
  
//   function handleSquareInteraction(e) {
//     const squareEl = e.target.closest('.square-55d63');
//     if (!squareEl) return;
  
//     const square = squareEl.dataset.square;
//     if (!square) return;
  
//     // First tap: select
//     if (!selectedSquare) {
//       selectedSquare = square;
//       highlightSquare(square);
//       return;
//     }
  
//     // Second tap: try to make move
//     const move = game.move({ from: selectedSquare, to: square, promotion: 'q' });
//     if (move) {
//         ground.set({
//             fen: game.fen(),
//             turnColor: tc[game.turn()]
//           });
//       currentIndex++;
//       updateStatus();
//       updateEngineSuggestion();
  
//       const turn = tc[game.turn()];
//       const expectedColor = userColor === "white" ? "b" : "w";
//       if (turn === expectedColor) {
//         setTimeout(autoPlayOpponentMove, 300);
//       }
//     }
  
//     selectedSquare = null;
//     removeHighlights();
//   }
  
//   function highlightSquare(square) {
//     removeHighlights();
//     const el = document.querySelector(`.square-${square}`);
//     if (el) el.style.backgroundColor = '#f8e473';
//   }
  
//   function removeHighlights() {
//     document.querySelectorAll('.square-55d63').forEach(el => {
//       el.style.backgroundColor = '';
//     });
//   }
  
  

    function onSnapEnd() {
      ground.set({
        fen: game.fen(),    turnColor: tc[game.turn()],
        movable: {
          ...ground.state.movable,
          color: tc[game.turn()]
        }
      });
    }    

    // setupHybridTapAndDrag();
    // var overlay = new SimpleArrowOverlay('board_wrapper');

    document.addEventListener('touchmove', function (e) {
        if (!e.target.closest('#board')) return;
        if (window.innerWidth < 768) return; // skip on mobile
        e.preventDefault(); // prevent scroll only when dragging on board
      }, { passive: false });
      
      
// When the page is ready for it, run populatePGNDropdown()
    document.addEventListener('DOMContentLoaded', function() {
        ground = Chessground.Chessground(document.getElementById('board'), {
            orientation: userColor,
            draggable: {
              enabled: true,
              showGhost: true
            },
            movable: {
              free: true, // set to false if you want to restrict to legal moves
              color: userColor,
              showDests: true,
              events: {
                after: (orig, dest, metadata) => {
                //   console.log('Dropped from', orig, 'to', dest);
                //   game.move({ from: orig, to: dest, promotion: 'q' });
                //   ground.set({ fen: game.fen() });
                  onDrop(orig, dest);
                }
              }
            },
            // dropmode: {
            //     active: true,
            //   },
            // highlight: {
            //   lastMove: true,
            //   check: true
            // },
            animation: {
              enabled: true,
              duration: 300
            },
            // events: {
            //     move: (orig, dest, metadata) => {
            //         // console.log('Dropped from', orig, 'to', dest);
            //       //   game.move({ from: orig, to: dest, promotion: 'q' });
            //       //   ground.set({ fen: game.fen() });
            //         onDrop(orig, dest);
            //       }
            // }
          });  
        populatePGNDropdown();
      });

      const stockfish = new Worker('/chess/js/stockfish.js');
stockfish.onmessage = (e) => {
  if (typeof e.data === "string") handleEngineOutput(e.data);
};

function updateEngineSuggestion() {
    if (!document.getElementById('engine-toggle').checked) return;
  
    const depth = parseInt(document.getElementById('engine-depth').value) || 15;
    const fen = game.fen();
  
    stockfish.postMessage("uci");
    stockfish.postMessage("setoption name MultiPV value 3"); // 👈 top 3 lines
    stockfish.postMessage(`position fen ${fen}`);
    stockfish.postMessage(`go depth ${depth}`);
  }
  
  
  
  let engineLines = [];

  function handleEngineOutput(line) {
    if (line.startsWith("info") && line.includes(" pv ")) {
      const multipvMatch = line.match(/multipv (\d+)/);
      const scoreMatch = line.match(/score (cp|mate) (-?\d+)/);
      const pvMatch = line.match(/ pv (.+)/);
  
      if (pvMatch) {
        const uciMoves = pvMatch[1].trim().split(" ");
        const multipv = multipvMatch ? parseInt(multipvMatch[1], 10) : 1;
        let score = null;
  
        if (scoreMatch) {
          const type = scoreMatch[1];
          const value = parseInt(scoreMatch[2], 10);
          score = type === 'cp' ? (value / 100).toFixed(2) : `#${value}`;
        }
  
        engineLines[multipv - 1] = { uciMoves, score };
      }
    }
  
    if (line.startsWith("bestmove")) {
        clearArrows();
  
      const suggestionsHTML = engineLines.slice(0, 3).map((entry, index) => {
        if (!entry) return "";
  
        const { uciMoves, score } = entry;
        const tempGame = new Chess(game.fen());
        const sanMoves = [];
  
        for (const uci of uciMoves.slice(0, 5)) {
          const move = tempGame.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: 'q' });
          if (!move) break;
          sanMoves.push(move.san);
        }
  
        // Draw arrow for top line
        if (index === 0 && uciMoves[0]) {
          const from = uciMoves[0].slice(0, 2);
          const to = uciMoves[0].slice(2, 4);
        //   overlay.addArrow(from, to, 'rgba(0, 0, 255, 0.6)', userColor);
        }
  
        const scoreDisplay = score !== null ? ` (${score})` : "";
        return `<div><strong>#${index + 1}</strong>: ${sanMoves.join(" ")}${scoreDisplay}</div>`;
      });
  
    //   overlay.render();
      document.getElementById("engine-lines").innerHTML = suggestionsHTML.join("");
      engineLines = [];
    }
  }
  
  

  function handleEngineToggle() {
    const enabled = document.getElementById('engine-toggle').checked;
  
    if (enabled) {
      updateEngineSuggestion(); // Evaluate and draw the arrow
    } else {
    clearArrows();
    }
  }
  

  