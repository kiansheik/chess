import json
import os
import io
from pprint import pprint
import chess.pgn
import chess
import requests, time
from datetime import datetime, timedelta

import chess
import chess.svg
import matplotlib.pyplot as plt
import cairosvg
from PIL import Image
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
ENGINE_CACHE_FILE = "stockfish_lists_cache.json"
ENGINE_TTL_MONTHS = 6
MIN_GAMES = 2000
BEGINING_MOVES = """1. d4"""
COVERAGE_RATE = 0.55

# engine = chess.engine.SimpleEngine.popen_uci(ENGINE_PATH)


def is_engine_cache_valid(entry):
    # timestamp = datetime.fromisoformat(entry["timestamp"])
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


def tuple_key_encoder(obj):
    return {json.dumps(k): v for k, v in obj.items()}


def load_engine_cache():
    if os.path.exists(ENGINE_CACHE_FILE):
        with open(ENGINE_CACHE_FILE, "r") as f:
            raw = json.load(f)
            return {tuple(json.loads(k)): v for k, v in raw.items()}
    return {}


def save_engine_cache(cache):
    with open(ENGINE_CACHE_FILE, "w") as f:
        json.dump(tuple_key_encoder(cache), f, indent=2)


def is_cache_valid(entry):
    timestamp = datetime.fromisoformat(entry["timestamp"])
    return datetime.now() - timestamp < timedelta(days=TTL_MONTHS * 30)


explorer_cache = load_cache()
engine_cache = load_engine_cache()


def query_lichess_position(
    game,
    speeds=["blitz", "rapid"],
    ratings=[1000, 1200, 1400, 1600, 1800],
    source="analysis",
    variant="standard",
):
    if type(game) != str:
        board = game.board()
        moves_uci = []

        node = game
        while not node.is_end():
            node = node.variation(0)
            moves_uci.append(node.move.uci())
            board.push(node.move)

        fen = board.fen()
    else:
        fen = game

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

#########


def get_top_lines(board: chess.Board, depth: int = 10, num_lines: int = 5):
    fen = board.fen()
    # Check cache
    if (fen, depth, num_lines) in engine_cache and is_engine_cache_valid(
        engine_cache[(fen, depth, num_lines)]
    ):
        print(f"✅ Engine cache hit for FEN: {fen}")
        cached = engine_cache[(fen, depth, num_lines)]["data"]
        moves = cached["moves"]
        score = cached["score"]
        return moves, score
    # Start the engine
    with chess.engine.SimpleEngine.popen_uci(ENGINE_PATH) as engine:
        # Analyze the position with multiple principal variations
        info = engine.analyse(board, chess.engine.Limit(depth=depth), multipv=num_lines)
        # if board.turn == chess.BLACK:
        #     # reverse the info list
        #     info = info[::-1]
        lines = []
        for i, line_info in enumerate(info):
            pv = line_info.get("pv", [])
            score = line_info["score"].pov(chess.WHITE).score(mate_score=100000)
            pvd = pv[:depth]
            temp_board = board.copy()
            pvs = []
            for move in pvd:
                pvs.append(temp_board.san(move))
                temp_board.push(move)
            lines.append(
                {
                    "index": i + 1,
                    "score": score,
                    "pv": pvs,  # Only keep first `depth` moves
                }
            )
        # Save new result in cache
        engine_cache[(fen, depth, num_lines)] = {
            "timestamp": datetime.now().isoformat(),
            "data": {"moves": lines, "score": lines[0]["score"]},
        }
        save_engine_cache(engine_cache)
        return lines, lines[0]["score"]


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
        move["percent"] = count / total_games
        selected.append(move)
        coverage += count
        if coverage / total_games >= COVERAGE_RATE:
            break
    return selected


def find_sharpest_move(game, depth: int = 10, num_lines: int = 5, thresh=0.5 * 100):
    board = game.board()
    engine_moves, score = get_top_lines(board, depth, num_lines)
    move_children = []

    for move_info in engine_moves:
        if abs(score - move_info["score"]) <= thresh:
            bc = board.copy()
            try:
                move_obj = bc.parse_san(
                    move_info["pv"][0]
                )  # 👈 don't overwrite `move_info`
                bc.push(move_obj)
            except Exception as e:
                print(f"Error parsing/pushing move {move_info['pv'][0]}: {e}")
                continue
            lichess = query_lichess_position(bc.fen())
            total_games = lichess["white"] + lichess["black"] + lichess["draws"]
            probs = get_top_75_percent_moves(lichess["moves"], total_games)
            pmoves = {x["san"] for x in probs}
            best_moves, bscore = get_top_lines(bc, depth, num_lines)
            move_info["best_opp_moves"] = [
                m
                for m in best_moves
                if abs(bscore - m["score"]) <= thresh and m["pv"][0] in pmoves
            ]
            # breakpoint()
            move_children.append(move_info)
    most_forceful_move = sorted(
        move_children,
        key=lambda x: (
            len(x["best_opp_moves"]),
            x["score"] * (-1 if board.turn == chess.WHITE else 1),
        ),
    )[0]
    # breakpoint()
    score = most_forceful_move["score"]
    san = most_forceful_move["pv"][0]
    uci = board.parse_san(san).uci()
    return uci, san, score


# sharpest_move = find_sharpest_move(node, depth=10, num_lines=5)
# if sharpest_move:
#     print("Sharpest move based on engine analysis:")
#     print(f"Sharpest move: {sharpest_move}")

# ############################

# turn = f'{"black" if node.turn() else "white"}'
# # 🔍 Query Lichess Explorer
# result = query_lichess_position(game)
# total_games = result["white"] + result["draws"] + result["black"]

# print(f"\nTotal games at this position: {total_games}")
# print("Move   | Games |   %   |  W / D / B  | AvgRating")
# print("-" * 75)

# for move in result["moves"]:
#     move_total = move["white"] + move["draws"] + move["black"]
#     if move_total == 0:
#         continue  # avoid division by zero

#     percent = (move_total / total_games) * 100
#     white_winrate = move["white"] / move_total * 100
#     black_winrate = move["black"] / move_total * 100

#     print(
#         f"{move['san']:>6} | {move_total:>5} | {percent:5.1f}% | "
#         f"{move['white']:>2} ({white_winrate:5.1f}%) / {move['draws']:>2} ({(100-(white_winrate+black_winrate)):5.1f}%) / {move['black']:>2} ({black_winrate:5.1f}%) | "
#         f"{move.get('averageRating', 'N/A')}"
#     )


# print("Testing recurse")


def build_repertoire(game_node, depth=0):
    useStockfish = bool(depth % 2)  # Every other level
    result = (
        find_sharpest_move(game_node, thresh=0.2 * 100)
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
            f"{indent}Level {(depth/2.0)+1}: 🔍 {move_info['san']} - Score: {move_info['score']/100.0 if 'score' in move_info.keys() else 'na'}"
        )
        build_repertoire(new_node, depth + 1)


print("Building repertoire...")
build_repertoire(node)
turn = f'{"black" if node.turn() else "white"}'


def save_repertoire_to_file(game, filename="repertoire.pgn"):
    filename = f"{turn}_{COVERAGE_RATE}_{MIN_GAMES}-{'_'.join(BEGINING_MOVES.split(' '))}-rep-forte.pgn"
    with open(filename, "w") as f:
        exporter = chess.pgn.FileExporter(f)
        game.accept(exporter)


save_repertoire_to_file(game)
# ##### MAIN
