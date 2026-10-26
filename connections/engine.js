(() => {
  const MAX_MISTAKES = 4;
  function createGame() {
    return {
      solved: [],
      guesses: [],
      mistakes: 0,
      status: "playing",
      gaveUp: false,
    };
  }
  function wordCategory(puzzle, word) {
    return puzzle.groups.findIndex((group) => group.words.includes(word));
  }
  function submitGuess(puzzle, state, words) {
    if (state.status !== "playing") return { state, kind: "finished" };
    if (
      !Array.isArray(words) ||
      words.length !== 4 ||
      new Set(words).size !== 4 ||
      words.some(
        (word) =>
          typeof word !== "string" ||
          wordCategory(puzzle, word) < 0 ||
          state.solved.includes(wordCategory(puzzle, word)),
      )
    ) {
      return { state, kind: "invalid" };
    }
    const key = [...words].sort().join("|");
    if (state.guesses.some((guess) => [...guess].sort().join("|") === key))
      return { state, kind: "duplicate" };
    const categories = words.map((word) => wordCategory(puzzle, word));
    const correct = categories.every((category) => category === categories[0]);
    const next = {
      ...state,
      solved: [...state.solved],
      guesses: [...state.guesses, [...words]],
      mistakes: state.mistakes + (correct ? 0 : 1),
    };
    if (correct) next.solved.push(categories[0]);
    if (next.solved.length === 4) next.status = "won";
    else if (next.mistakes === MAX_MISTAKES) next.status = "lost";
    const near = categories.some(
      (category) =>
        categories.filter((value) => value === category).length === 3,
    );
    return { state: next, kind: correct ? "correct" : near ? "near" : "wrong" };
  }
  function giveUp(state) {
    return state.status === "playing"
      ? { ...state, status: "lost", gaveUp: true }
      : state;
  }
  function restoreGame(puzzle, saved) {
    if (
      !saved ||
      !Array.isArray(saved.guesses) ||
      saved.guesses.length > 7 ||
      typeof saved.gaveUp !== "boolean"
    )
      return null;
    let state = createGame();
    for (const guess of saved.guesses) {
      const result = submitGuess(puzzle, state, guess);
      if (["invalid", "duplicate", "finished"].includes(result.kind))
        return null;
      state = result.state;
    }
    return saved.gaveUp ? giveUp(state) : state;
  }
  function shuffled(words, random = Math.random) {
    const result = [...words];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  const api = {
    MAX_MISTAKES,
    createGame,
    wordCategory,
    submitGuess,
    giveUp,
    restoreGame,
    shuffled,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else window.ConnectionsGame = api;
})();
