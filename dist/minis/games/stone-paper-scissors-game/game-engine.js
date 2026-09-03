const RULES = {
  rock: {
    beats: ["scissors", "lizard"],
    verb: { scissors: "crushes", lizard: "crushes" },
  },
  paper: {
    beats: ["rock", "spock"],
    verb: { rock: "covers", spock: "disproves" },
  },
  scissors: {
    beats: ["paper", "lizard"],
    verb: { paper: "cuts", lizard: "decapitates" },
  },
  lizard: {
    beats: ["spock", "paper"],
    verb: { spock: "poisons", paper: "eats" },
  },
  spock: {
    beats: ["rock", "scissors"],
    verb: { rock: "vaporizes", scissors: "smashes" },
  },
};

function determineWinner(player, computer) {
  if (player === computer) return { outcome: "tie", message: "It's a tie!" };

  if (RULES[player] && RULES[player].beats.includes(computer)) {
    const verb = RULES[player].verb[computer];
    return {
      outcome: "player",
      message: `${capitalize(player)} ${verb} ${capitalize(computer)}! You win!`,
    };
  }

  if (RULES[computer] && RULES[computer].beats.includes(player)) {
    const verb = RULES[computer].verb[player];
    return {
      outcome: "computer",
      message: `${capitalize(computer)} ${verb} ${capitalize(player)}! Computer wins!`,
    };
  }

  return { outcome: "tie", message: "It's a tie!" };
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { RULES, determineWinner };
}
