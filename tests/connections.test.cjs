const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { JSDOM, VirtualConsole } = require("jsdom");
const engine = require("../connections/engine.js");
const puzzles = require("../connections/puzzles.json");
const root = path.resolve(__dirname, "..");
async function page(t, scenario = {}, hash = "") {
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname === "/connections/puzzles.json" && scenario.override) {
      res.writeHead(scenario.status || 200, {
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify(scenario.data));
      return;
    }
    try {
      const data = await fs.readFile(path.join(root, pathname));
      res.writeHead(200, {
        "Content-Type": pathname.endsWith(".js")
          ? "text/javascript"
          : pathname.endsWith(".css")
            ? "text/css"
            : pathname.endsWith(".json")
              ? "application/json"
              : "text/html",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => errors.push(e.message));
  vc.on("error", (e) => errors.push(String(e)));
  const dom = await JSDOM.fromURL(origin + "/connections.html" + hash, {
    resources: "usable",
    runScripts: "dangerously",
    virtualConsole: vc,
    beforeParse(w) {
      w.fetch = (url, options) => fetch(new URL(url, origin), options);
      w.AbortSignal = AbortSignal;
    },
  });
  t.after(async () => {
    dom.window.close();
    await new Promise((r) => server.close(r));
  });
  await until(
    () =>
      dom.window.document
        .querySelector("#puzzle-list")
        ?.getAttribute("aria-busy") === "false",
  );
  return { dom, d: dom.window.document, errors };
}
async function until(check) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > 4000) throw new Error("Page did not become ready");
    await new Promise((r) => setTimeout(r, 10));
  }
}
function choose(d, words) {
  for (const word of words) {
    const tile = [...d.querySelectorAll(".tile")].find(
      (b) => b.textContent === word,
    );
    assert.ok(tile, "Word available: " + word);
    tile.click();
  }
  d.querySelector("#submit").click();
}
test("all four published puzzles have unique words and rules solve every group", () => {
  assert.deepEqual(
    puzzles.map((p) => p.title),
    ["AJ #4", "AJ #3", "AJ #2", "AJ #1"],
  );
  for (const p of puzzles) {
    assert.equal(new Set(p.groups.flatMap((g) => g.words)).size, 16);
    let state = engine.createGame();
    for (const group of p.groups) {
      const result = engine.submitGuess(p, state, group.words);
      assert.equal(result.kind, "correct");
      state = result.state;
    }
    assert.equal(state.status, "won");
    assert.equal(state.mistakes, 0);
  }
});
test("published puzzle list is newest first and links open a playable board", async (t) => {
  const { dom, d, errors } = await page(t);
  assert.deepEqual(
    [...d.querySelectorAll(".puzzle-link strong")].map((e) => e.textContent),
    puzzles.map((p) => p.title),
  );
  d.querySelector(".puzzle-link").click();
  await until(() => !d.querySelector("#game").hidden);
  assert.equal(d.querySelector("#puzzle-title").textContent, "AJ #4");
  assert.equal(d.querySelectorAll(".tile").length, 16);
  assert.equal(d.querySelectorAll(".solved-row").length, 0);
  assert.equal(dom.window.location.hash, "#puzzle/" + puzzles[0].id);
  assert.deepEqual(errors, []);
});
test("real UI supports selection, near misses, duplicates, solving and restored progress", async (t) => {
  const p = puzzles[0];
  const { dom, d, errors } = await page(t, {}, "#puzzle/" + p.id);
  const near = [...p.groups[0].words.slice(0, 3), p.groups[1].words[0]];
  choose(d, near);
  assert.equal(d.querySelector("#feedback").textContent, "One away!");
  assert.equal(
    d.querySelector("#mistakes").textContent,
    "Mistakes remaining: 3 of 4",
  );
  d.querySelector("#submit").click();
  assert.match(d.querySelector("#feedback").textContent, /Already tried/);
  assert.equal(
    d.querySelector("#mistakes").textContent,
    "Mistakes remaining: 3 of 4",
  );
  d.querySelector("#deselect").click();
  for (const group of p.groups) choose(d, group.words);
  assert.equal(d.querySelector("#result-title").textContent, "Solved!");
  assert.equal(d.querySelectorAll(".solved-row").length, 4);
  assert.equal(d.querySelectorAll(".tile").length, 0);
  dom.window.dispatchEvent(new dom.window.HashChangeEvent("hashchange"));
  assert.equal(d.querySelector("#result-title").textContent, "Solved!");
  assert.deepEqual(errors, []);
});
test("four mistakes end an attempt and corrupt saved state cannot unlock groups", () => {
  const p = puzzles[0];
  let state = engine.createGame();
  for (let i = 0; i < 4; i++)
    state = engine.submitGuess(
      p,
      state,
      p.groups.map((g) => g.words[i]),
    ).state;
  assert.equal(state.status, "lost");
  assert.equal(state.mistakes, 4);
  assert.equal(
    engine.restoreGame(p, { guesses: [["injected"]], gaveUp: false }),
    null,
  );
  assert.equal(
    engine.restoreGame(p, { guesses: [], solved: [0, 1, 2, 3], gaveUp: false })
      .status,
    "playing",
  );
});
test("failed data load shows retry and recovers using the real JSON file", async (t) => {
  const scenario = {
    override: true,
    status: 503,
    data: { error: "Unavailable" },
  };
  const { d } = await page(t, scenario);
  assert.match(d.querySelector("#puzzle-list").textContent, /Could not load/);
  assert.equal(d.querySelectorAll(".puzzle-link").length, 0);
  scenario.override = false;
  d.querySelector("#puzzle-list button").click();
  await until(
    () => d.querySelector("#puzzle-list").getAttribute("aria-busy") === "false",
  );
  assert.equal(d.querySelectorAll(".puzzle-link").length, 4);
});
test("empty list and malformed data produce deliberate states", async (t) => {
  const empty = await page(t, { override: true, data: [] });
  assert.match(
    empty.d.querySelector("#puzzle-list").textContent,
    /No published puzzles/,
  );
  const invalid = await page(t, { override: true, data: [{ id: "bad" }] });
  assert.match(
    invalid.d.querySelector("#puzzle-list").textContent,
    /Could not load/,
  );
});
