import json
import os
import io
import chess.pgn
import chess
import requests, time
from datetime import datetime, timedelta

import chess
import chess.svg
import matplotlib.pyplot as plt
import io
import textwrap


def generate_pgn_from_node(node, new_move=None):
    nodes = []
    current = node
    while current.parent:
        nodes.append(current)
        current = current.parent
    nodes.reverse()

    board = chess.Board()
    moves = []
    for n in nodes:
        if board.turn == chess.WHITE:
            moves.append(f"{board.fullmove_number}. {board.san(n.move)}")
        else:
            moves.append(f"{board.san(n.move)}")
        board.push(n.move)

    # Append the suggested move, in red
    if new_move:
        if board.turn == chess.WHITE:
            moves.append(
                f"{board.fullmove_number}. <span style='color:red'>{board.san(new_move)}</span>"
            )
        else:
            moves.append(f"<span style='color:red'>{board.san(new_move)}</span>")

    return " ".join(moves)


CACHE_FILE = "explorer_cache.json"
TTL_MONTHS = 6

# viewer = MatplotlibChessBoard()

ENGINE_PATH = "./stockfish"  # Replace this
ENGINE_CACHE_FILE = "stockfish_cache.json"
ENGINE_TTL_MONTHS = 6
MIN_GAMES = 100000
BEGINING_MOVES = """1. e4 c5 2. Nf3"""
COVERAGE_RATE = 0.75

engine = chess.engine.SimpleEngine.popen_uci(ENGINE_PATH)
# Load cache
if os.path.exists(ENGINE_CACHE_FILE):
    with open(ENGINE_CACHE_FILE, "r") as f:
        engine_cache = json.load(f)
else:
    engine_cache = {}


def is_engine_cache_valid(entry):
    timestamp = datetime.fromisoformat(entry["timestamp"])
    return True  # datetime.now() - timestamp < timedelta(days=ENGINE_TTL_MONTHS * 30)


def best_engine_move(game_node, depth=30):
    board = game_node.board()
    fen = board.fen()

    # Check cache
    if fen in engine_cache and is_engine_cache_valid(engine_cache[fen]):
        print(f"✅ Engine cache hit for FEN: {fen}")
        cached = engine_cache[fen]
        move = cached["move"]
        san = cached["san"]
        return move, san, cached["score"]

    # Run Stockfish
    print(f"🧠 Evaluating FEN with Stockfish: {fen}")

    result = engine.analyse(board, chess.engine.Limit(depth=depth))
    best_move = result["pv"][0]
    score = result["score"].white().score(mate_score=100000)

    san = board.san(best_move)
    uci = best_move.uci()

    # Cache it
    engine_cache[fen] = {
        "timestamp": datetime.now().isoformat(),
        "move": uci,
        "score": score,
        "san": san,
    }
    with open(ENGINE_CACHE_FILE, "w") as f:
        json.dump(engine_cache, f, indent=2)

    # viewer.update(game_node, move=best_move)  # Show the board with the best move highlighted

    return uci, san, score


def load_cache():
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, "r") as f:
            return json.load(f)
    return {}


def save_cache(cache):
    with open(CACHE_FILE, "w") as f:
        json.dump(cache, f, indent=2)


def is_cache_valid(entry):
    timestamp = datetime.fromisoformat(entry["timestamp"])
    return datetime.now() - timestamp < timedelta(days=TTL_MONTHS * 30)


explorer_cache = load_cache()


def query_lichess_position(
    game,
    speeds=["blitz", "rapid"],
    ratings=[1000, 1200, 1400, 1600, 1800],
    source="analysis",
    variant="standard",
):
    board = game.board()
    moves_uci = []

    node = game
    while not node.is_end():
        node = node.variation(0)
        moves_uci.append(node.move.uci())
        board.push(node.move)

    fen = board.fen()

    # Check cache
    cached = explorer_cache.get(fen)
    if cached and is_cache_valid(cached):
        # print(f"✅ Cache hit (fresh) for FEN: {fen}")
        return cached["data"]
    elif cached:
        print(f"⚠️ Cache expired for FEN: {fen}")

    # print(f"🌐 Querying Lichess Explorer for FEN: {fen}")
    params = {
        "variant": variant,
        "fen": fen,
        "play": "",
        "speeds": ",".join(speeds),
        "ratings": ",".join(map(str, ratings)),
        "source": source,
    }

    base_url = "https://explorer.lichess.ovh/lichess"
    response = requests.get(base_url, params=params)
    time.sleep(0.05)

    if response.status_code != 200:
        raise Exception(
            f"Lichess Explorer request failed: {response.status_code}, {response.text}"
        )

    result = response.json()

    # Save new result in cache
    explorer_cache[fen] = {"timestamp": datetime.now().isoformat(), "data": result}
    save_cache(explorer_cache)

    return result


# 🧪 Create a test game: 1. d4 Nc6
# Parse it into a game object
pgn_io = io.StringIO(BEGINING_MOVES)
game = chess.pgn.read_game(pgn_io)
node = game
while node.variations:
    node = node.variation(0)  # follow mainline only

turn = f'{"black" if node.turn() else "white"}'
# 🔍 Query Lichess Explorer
result = query_lichess_position(game)
total_games = result["white"] + result["draws"] + result["black"]

print(f"\nTotal games at this position: {total_games}")
print("Move   | Games |   %   |  W / D / B  | AvgRating")
print("-" * 75)

for move in result["moves"]:
    move_total = move["white"] + move["draws"] + move["black"]
    if move_total == 0:
        continue  # avoid division by zero

    percent = (move_total / total_games) * 100
    white_winrate = move["white"] / move_total * 100
    black_winrate = move["black"] / move_total * 100

    print(
        f"{move['san']:>6} | {move_total:>5} | {percent:5.1f}% | "
        f"{move['white']:>2} ({white_winrate:5.1f}%) / {move['draws']:>2} ({(100-(white_winrate+black_winrate)):5.1f}%) / {move['black']:>2} ({black_winrate:5.1f}%) | "
        f"{move.get('averageRating', 'N/A')}"
    )


print("Testing recurse")


def get_top_75_percent_moves(moves, total_games):
    if total_games < MIN_GAMES:
        return []
    sorted_moves = sorted(
        moves, key=lambda m: m["white"] + m["draws"] + m["black"], reverse=True
    )

    selected = []
    coverage = 0
    for move in sorted_moves:
        count = move["white"] + move["draws"] + move["black"]
        selected.append(move)
        coverage += count
        if coverage / total_games >= COVERAGE_RATE:
            break
    return selected


def build_repertoire(game_node, depth=0):
    useStockfish = bool(depth % 2)  # Every other level
    result = (
        best_engine_move(game_node)
        if useStockfish
        else query_lichess_position(game_node)
    )
    if not useStockfish:
        total_games = result["white"] + result["draws"] + result["black"]

        top_moves = get_top_75_percent_moves(result["moves"], total_games)
    else:
        top_moves = [{"uci": result[0], "san": result[1], "score": result[2]}]
    if not top_moves:
        return

    board = game_node.board()
    move_nodes = []

    for move_info in top_moves:
        try:
            uci = move_info["uci"]
            move = board.parse_uci(uci)

            new_node = game_node.add_variation(move)
            move_nodes.append((new_node, move_info))

        except Exception as e:
            print(f"⚠️ Skipped illegal move {move_info['uci']}: {e}")

    # ⬇️ Now recurse into each new move node *after* all children were added
    for new_node, move_info in move_nodes:
        indent = "  " * depth
        print(
            f"{indent}Level {(depth/2.0)+1}: 🔍 {move_info['san']} - Score: {move_info['score']/100.0 if 'score' in move_info.keys() else total_games}"
        )
        build_repertoire(new_node, depth + 1)


build_repertoire(node)


def save_repertoire_to_file(game, filename="repertoire.pgn"):
    filename = f"{turn}_{COVERAGE_RATE}_{MIN_GAMES}-{'_'.join(BEGINING_MOVES.split(' '))}-rep.pgn"
    with open(filename, "w") as f:
        exporter = chess.pgn.FileExporter(f)
        game.accept(exporter)


save_repertoire_to_file(game)


engine.close()
