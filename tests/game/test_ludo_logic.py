import pytest


class LudoGame:
    def __init__(self, player_count=4):
        self.players = [f"Player_{i}" for i in range(player_count)]
        self.current_turn_index = 0
        self.consecutive_sixes = 0

    def handle_dice_roll(
        self, roll: int, move_possible: bool = True, piece_reached_home: bool = False
    ) -> str:
        """
        Processes a Ludo dice roll and updates state according to standard rules:
        - A roll of 6 grants an extra turn, up to 2 consecutive times.
        - A 3rd consecutive 6 is invalidated, and the turn shifts immediately.
        - Reaching home with a piece grants an extra turn.
        - Rolling anything other than a 6 without a special event passes the turn.
        """
        if roll == 6:
            self.consecutive_sixes += 1
            if self.consecutive_sixes == 3:
                self.consecutive_sixes = 0
                self.advance_turn()
                return "Three consecutive sixes! Turn passed."

            if not move_possible:
                # If no move is valid with a 6 (e.g. trapped), player still retains turn
                return "Extra turn granted on six (No move possible)."
            return "Extra turn granted on six."

        # Handling special extra turn modifiers (e.g., scoring a piece home)
        if piece_reached_home:
            self.consecutive_sixes = 0
            return "Piece reached home! Extra turn granted."

        # Normal non-six roll shifts turn to the next player sequence
        self.advance_turn()
        return "Turn passed normally."

    def advance_turn(self):
        self.consecutive_sixes = 0
        self.current_turn_index = (self.current_turn_index + 1) % len(self.players)

    @property
    def current_player(self) -> str:
        return self.players[self.current_turn_index]


# -------------------------------------------------------------------------
# Test Suites
# -------------------------------------------------------------------------


def test_consecutive_sixes_rules():
    """Verifies turn logic handles consecutive sixes and caps at two max."""
    game = LudoGame(player_count=4)

    # First 6 keeps the turn
    assert game.current_player == "Player_0"
    game.handle_dice_roll(6)
    assert game.current_player == "Player_0"

    # Second 6 keeps the turn
    game.handle_dice_roll(6)
    assert game.current_player == "Player_0"

    # Third consecutive 6 must invalidate and pass turn to Player_1
    result = game.handle_dice_roll(6)
    assert "Three consecutive sixes" in result
    assert game.current_player == "Player_1"


def test_piece_reaches_home_bonus():
    """Verifies that scoring a piece home breaks turn sequence to grant a bonus roll."""
    game = LudoGame(player_count=4)

    # Player 0 rolls a 2 but scores a piece home
    result = game.handle_dice_roll(2, move_possible=True, piece_reached_home=True)
    assert "Extra turn granted" in result
    assert game.current_player == "Player_0"


def test_invalid_move_with_normal_roll_transitions():
    """Verifies that if an invalid or impossible move occurs on a non-6, turn is passed."""
    game = LudoGame(player_count=4)

    # Player rolls 4, cannot move anywhere
    game.handle_dice_roll(4, move_possible=False)
    assert game.current_player == "Player_1"
