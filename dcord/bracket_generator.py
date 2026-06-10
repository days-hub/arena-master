"""Render a single-elimination tournament bracket to a PNG using Pillow.

Consumes the match records the rest of the app already produces (the ``matches``
table / the FastAPI ``/api/tournaments/by_name/{name}`` response): each match is a
dict with ``team_a``, ``team_b``, ``round_number`` and (optionally) ``winner``.
Built for power-of-two brackets, matching the rest of the app's assumptions.
"""
from collections import defaultdict

from PIL import Image, ImageDraw, ImageFont

# Layout constants (pixels)
MARGIN = 40
COL_WIDTH = 200       # horizontal space allotted to each round
BOX_WIDTH = 160       # width of a match's team boxes
ROW_HEIGHT = 26       # height of a single team row
SLOT_HEIGHT = 80      # vertical space per first-round match

LINE_COLOR = (120, 120, 120)
WINNER_BG = (200, 240, 200)
TEXT_COLOR = (20, 20, 20)
LOSER_COLOR = (150, 150, 150)
BG_COLOR = "white"


def _load_font(size):
    """Return a TrueType font, falling back gracefully on headless systems."""
    for name in ("arial.ttf", "DejaVuSans.ttf", "LiberationSans-Regular.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def generate_bracket_image(matches, output_path="tournament_bracket.png"):
    """Draw ``matches`` as a bracket, save it to ``output_path``, and return the path.

    ``matches`` is a list of dicts with keys ``team_a``, ``team_b``,
    ``round_number`` and (optionally) ``winner`` and ``match_number``.
    """
    if not matches:
        raise ValueError("No matches to render")

    # Group matches by round, ordered ascending; keep a stable order within a round.
    by_round = defaultdict(list)
    for m in matches:
        by_round[m["round_number"]].append(m)
    rounds = [by_round[r] for r in sorted(by_round)]
    for round_matches in rounds:
        round_matches.sort(key=lambda m: (m.get("match_number") or m.get("id") or 0))

    first_round_count = len(rounds[0])
    width = MARGIN * 2 + len(rounds) * COL_WIDTH
    height = MARGIN * 2 + first_round_count * SLOT_HEIGHT
    image = Image.new("RGB", (width, height), BG_COLOR)
    draw = ImageDraw.Draw(image)
    font = _load_font(18)
    title_font = _load_font(15)

    # Vertical centre of every match box, computed round by round. Each later-round
    # match sits midway between the two matches that feed it (power-of-two bracket).
    centers = []
    for r, round_matches in enumerate(rounds):
        if r == 0:
            centers.append([
                MARGIN + i * SLOT_HEIGHT + SLOT_HEIGHT / 2
                for i in range(len(round_matches))
            ])
        else:
            prev = centers[r - 1]
            centers.append([
                (prev[2 * i] + prev[2 * i + 1]) / 2 if 2 * i + 1 < len(prev) else prev[2 * i]
                for i in range(len(round_matches))
            ])

    def box_left(r):
        return MARGIN + r * COL_WIDTH

    # Round headings.
    for r in range(len(rounds)):
        is_final = r == len(rounds) - 1 and len(rounds[r]) == 1
        heading = "Final" if is_final else f"Round {r + 1}"
        draw.text((box_left(r), MARGIN // 2), heading, fill=TEXT_COLOR, font=title_font)

    # Connector lines between each pair of matches and the match they feed.
    for r in range(len(rounds) - 1):
        for i in range(len(rounds[r + 1])):
            if 2 * i + 1 >= len(centers[r]):
                continue
            y_top = centers[r][2 * i]
            y_bottom = centers[r][2 * i + 1]
            x_from = box_left(r) + BOX_WIDTH
            x_mid = box_left(r + 1) - (COL_WIDTH - BOX_WIDTH) / 2
            x_to = box_left(r + 1)
            target = centers[r + 1][i]
            draw.line([(x_from, y_top), (x_mid, y_top)], fill=LINE_COLOR)
            draw.line([(x_from, y_bottom), (x_mid, y_bottom)], fill=LINE_COLOR)
            draw.line([(x_mid, y_top), (x_mid, y_bottom)], fill=LINE_COLOR)
            draw.line([(x_mid, target), (x_to, target)], fill=LINE_COLOR)

    # Match boxes, drawn on top of the connectors.
    for r, round_matches in enumerate(rounds):
        for i, match in enumerate(round_matches):
            cy = centers[r][i]
            x = box_left(r)
            top = cy - ROW_HEIGHT  # two rows centred on cy
            winner = match.get("winner")
            for row, team in enumerate((match["team_a"], match["team_b"])):
                y = top + row * ROW_HEIGHT
                is_winner = team is not None and team == winner
                if is_winner:
                    draw.rectangle([x, y, x + BOX_WIDTH, y + ROW_HEIGHT], fill=WINNER_BG)
                draw.rectangle([x, y, x + BOX_WIDTH, y + ROW_HEIGHT], outline=LINE_COLOR)
                color = TEXT_COLOR if (winner is None or is_winner) else LOSER_COLOR
                draw.text((x + 6, y + 5), str(team) if team else "TBD", fill=color, font=font)

    image.save(output_path)
    return output_path
