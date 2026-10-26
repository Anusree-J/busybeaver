(() => {
  "use strict";
  const {
    createGame,
    submitGuess,
    giveUp,
    restoreGame,
    shuffled,
    wordCategory,
  } = window.ConnectionsGame;
  const $ = (id) => document.getElementById(id);
  let puzzles = [],
    puzzle,
    state,
    order = [],
    selected = [];
  const squares = ["🟨", "🟩", "🟦", "🟪"];
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function stored(item) {
    try {
      const raw = localStorage.getItem("busybeaver:connections:" + item.id);
      return raw ? restoreGame(item, JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }
  function save() {
    try {
      localStorage.setItem(
        "busybeaver:connections:" + puzzle.id,
        JSON.stringify({ guesses: state.guesses, gaveUp: state.gaveUp }),
      );
    } catch {
      $("storage-notice").textContent =
        "Progress could not be saved on this browser. You can still finish this puzzle.";
    }
  }
  function validate(data) {
    if (!Array.isArray(data)) throw new Error("Invalid puzzle list");
    const ids = new Set();
    for (const item of data) {
      if (
        !item ||
        typeof item.id !== "string" ||
        !/^[-a-zA-Z0-9]+$/.test(item.id) ||
        ids.has(item.id) ||
        !/^AJ #[1-9][0-9]*$/.test(item.title) ||
        !Number.isFinite(item.publishedAt) ||
        !Array.isArray(item.groups) ||
        item.groups.length !== 4
      )
        throw new Error("Invalid puzzle");
      ids.add(item.id);
      const words = [];
      for (const group of item.groups) {
        if (
          !group ||
          typeof group.label !== "string" ||
          !group.label.trim() ||
          !Array.isArray(group.words) ||
          group.words.length !== 4 ||
          group.words.some(
            (word) =>
              typeof word !== "string" || !word.trim() || word.length > 24,
          )
        )
          throw new Error("Invalid group");
        words.push(...group.words);
      }
      if (new Set(words).size !== 16) throw new Error("Duplicate words");
    }
    return data.sort(
      (a, b) =>
        b.publishedAt - a.publishedAt ||
        Number(b.title.slice(4)) - Number(a.title.slice(4)),
    );
  }
  function list() {
    $("library").hidden = false;
    $("game").hidden = true;
    document.title = "Connections · busybeaver";
    $("puzzle-list").replaceChildren();
    if (!puzzles.length) {
      $("puzzle-list").append(element("p", "No published puzzles yet."));
      return;
    }
    for (const item of puzzles) {
      const link = element("a", undefined, "puzzle-link");
      link.href = "#puzzle/" + item.id;
      const swatches = element("div", undefined, "puzzle-swatches");
      swatches.setAttribute("aria-hidden", "true");
      squares.forEach((_, i) =>
        swatches.append(element("i", undefined, "level-" + i)),
      );
      const progress = stored(item);
      link.append(
        swatches,
        element("strong", item.title),
        element(
          "span",
          progress?.status === "won"
            ? "Solved ✓"
            : progress?.status === "lost"
              ? "View result →"
              : progress?.guesses.length
                ? "Continue →"
                : "Play →",
        ),
      );
      $("puzzle-list").append(link);
    }
  }
  function selection() {
    document
      .querySelectorAll(".tile")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(selected.includes(button.textContent)),
        ),
      );
    $("deselect").disabled = selected.length === 0;
    $("submit").disabled = selected.length !== 4;
    $("selection-status").textContent = selected.length
      ? `${selected.length} of 4 selected`
      : "Select four words.";
  }
  function render() {
    $("word-board").replaceChildren();
    const finished = state.status !== "playing";
    const shown = [...state.solved];
    if (finished)
      puzzle.groups.forEach((_, i) => {
        if (!shown.includes(i)) shown.push(i);
      });
    for (const i of shown) {
      const group = puzzle.groups[i],
        row = element("section", undefined, "solved-row level-" + i);
      row.append(
        element(
          "h2",
          group.label + (state.solved.includes(i) ? "" : " · revealed"),
        ),
        element("p", group.words.join(", ")),
      );
      $("word-board").append(row);
    }
    if (!finished)
      for (const word of order.filter(
        (word) => !state.solved.includes(wordCategory(puzzle, word)),
      )) {
        const tile = element("button", word, "tile");
        tile.type = "button";
        tile.setAttribute("aria-pressed", "false");
        tile.addEventListener("click", () => {
          if (selected.includes(word))
            selected = selected.filter((w) => w !== word);
          else if (selected.length < 4) selected.push(word);
          $("feedback").textContent = "";
          selection();
        });
        tile.addEventListener("keydown", (event) => {
          if (event.key === "Enter" && selected.length === 4) {
            event.preventDefault();
            guess();
          }
        });
        $("word-board").append(tile);
      }
    $("mistakes").textContent =
      `Mistakes remaining: ${4 - state.mistakes} of 4`;
    $("game-actions").hidden = finished;
    $("reveal").hidden = finished;
    $("selection-status").hidden = finished;
    $("result").hidden = !finished;
    if (finished) {
      $("result-title").textContent =
        state.status === "won"
          ? "Solved!"
          : `${state.solved.length}/4 groups found`;
      $("result-grid").replaceChildren(
        ...state.guesses.map((guess) =>
          element(
            "div",
            guess.map((word) => squares[wordCategory(puzzle, word)]).join(""),
          ),
        ),
      );
    }
    selection();
  }
  function route() {
    const match = location.hash.match(/^#puzzle\/([-a-zA-Z0-9]+)$/);
    if (!match) {
      list();
      return;
    }
    puzzle = puzzles.find((item) => item.id === match[1]);
    if (!puzzle) {
      list();
      $("puzzle-list").prepend(
        element("p", "That puzzle is not available. Choose one below."),
      );
      return;
    }
    state = stored(puzzle) || createGame();
    selected = [];
    order = shuffled(puzzle.groups.flatMap((group) => group.words));
    $("library").hidden = true;
    $("game").hidden = false;
    $("puzzle-title").textContent = puzzle.title;
    document.title = puzzle.title + " · Connections · busybeaver";
    $("feedback").textContent = "";
    $("storage-notice").textContent = "";
    $("copy-fallback").hidden = true;
    render();
    $("puzzle-title").focus();
  }
  function guess() {
    const result = submitGuess(puzzle, state, selected);
    state = result.state;
    $("feedback").textContent =
      {
        correct: "Correct.",
        near: "One away!",
        wrong: "Incorrect group.",
        duplicate: "Already tried that group. No mistake used.",
        invalid: "Select four different words.",
      }[result.kind] || "";
    if (result.kind === "correct" || state.status !== "playing") selected = [];
    if (
      result.kind === "correct" ||
      result.kind === "near" ||
      result.kind === "wrong"
    )
      save();
    render();
  }
  $("submit").addEventListener("click", guess);
  $("deselect").addEventListener("click", () => {
    selected = [];
    selection();
  });
  $("shuffle").addEventListener("click", () => {
    order = shuffled(order);
    render();
  });
  $("reveal").addEventListener("click", () => {
    $("reveal-dialog").returnValue = "cancel";
    $("reveal-dialog").showModal();
  });
  $("reveal-dialog").addEventListener("close", () => {
    if ($("reveal-dialog").returnValue === "reveal") {
      state = giveUp(state);
      selected = [];
      save();
      render();
      $("feedback").textContent = "Answers revealed.";
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("reveal-dialog").open) {
      selected = [];
      selection();
    }
  });
  $("copy").addEventListener("click", async () => {
    const text = [
      "Connections · " + puzzle.title,
      ...state.guesses.map((guess) =>
        guess.map((word) => squares[wordCategory(puzzle, word)]).join(""),
      ),
      `${state.solved.length}/4 groups · ${state.mistakes} mistakes${state.gaveUp ? " · Revealed" : ""}`,
      location.href,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      $("feedback").textContent = "Result copied.";
    } catch {
      const field = $("copy-fallback");
      field.hidden = false;
      field.querySelector("textarea").value = text;
      field.querySelector("textarea").focus();
      field.querySelector("textarea").select();
    }
  });
  async function load() {
    $("puzzle-list").setAttribute("aria-busy", "true");
    $("puzzle-list").replaceChildren(element("p", "Loading puzzles…"));
    try {
      const response = await fetch("connections/puzzles.json", {
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error("Load failed");
      puzzles = validate(await response.json());
      route();
    } catch {
      $("library").hidden = false;
      $("game").hidden = true;
      const retry = element("button", "Try again");
      retry.type = "button";
      retry.addEventListener("click", load);
      $("puzzle-list").replaceChildren(
        element("p", "Could not load the puzzles. Please try again."),
        retry,
      );
    } finally {
      $("puzzle-list").setAttribute("aria-busy", "false");
    }
  }
  window.addEventListener("hashchange", route);
  load();
})();
