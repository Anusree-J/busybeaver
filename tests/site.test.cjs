const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { JSDOM, VirtualConsole } = require("jsdom");
const root = path.resolve(__dirname, "..");

async function openPage(t, page = "/", scenario = {}) {
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname === "/posts/posts.json" && scenario.index) {
      res.writeHead(scenario.status || 200, {
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify(scenario.index));
      return;
    }
    if (pathname.endsWith(".md") && scenario.missingPost) {
      res.writeHead(404);
      res.end("Missing article");
      return;
    }
    if (scenario.delay && pathname === "/posts/posts.json")
      await new Promise((r) => setTimeout(r, scenario.delay));
    try {
      const data = await fs.readFile(
        path.join(root, pathname === "/" ? "index.html" : pathname),
      );
      res.writeHead(200, {
        "Content-Type": pathname.endsWith(".js")
          ? "text/javascript"
          : pathname.endsWith(".css")
            ? "text/css"
            : pathname.endsWith(".json")
              ? "application/json"
              : pathname.endsWith(".md")
                ? "text/plain"
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
  const dom = await JSDOM.fromURL(origin + page, {
    resources: "usable",
    runScripts: "dangerously",
    virtualConsole: vc,
    beforeParse(window) {
      window.fetch = (url, options) => fetch(new URL(url, origin), options);
      window.AbortSignal = AbortSignal;
      window.AbortController = AbortController;
    },
  });
  t.after(async () => {
    dom.window.close();
    await new Promise((r) => server.close(r));
  });
  return { dom, document: dom.window.document, errors };
}
async function ready(doc, selector) {
  const start = Date.now();
  while (doc.querySelector(selector)?.getAttribute("aria-busy") !== "false") {
    if (Date.now() - start > 3000)
      throw new Error("Page did not finish loading");
    await new Promise((r) => setTimeout(r, 20));
  }
}

test("homepage renders both posts newest first and preserves required content", async (t) => {
  const { document: d, errors } = await openPage(t);
  await ready(d, "#posts-container");
  const links = [...d.querySelectorAll("#posts-container a.entry")];
  assert.equal(links.length, 2);
  assert.match(links[0].href, /why-im-building-sunny$/);
  assert.match(links[1].textContent, /Software at the Speed of Thought/);
  assert.equal(d.querySelectorAll(".question").length, 3);
  assert.match(d.body.textContent, /How do we age\?/);
  assert.doesNotMatch(
    d.body.textContent,
    /How do minds bloom|How do our bodies heal|Mental health, tended/,
  );
  assert.equal(d.querySelectorAll(".packet").length, 6);
  assert.equal(d.querySelectorAll(".stop").length, 6);
  assert.equal(d.querySelectorAll(".page-scrap").length, 5);
  assert.deepEqual(errors, []);
});
test("article renders full Sunny text and older-post navigation", async (t) => {
  const { document: d, errors } = await openPage(
    t,
    "/article.html?post=why-im-building-sunny",
  );
  await ready(d, "#article-content");
  assert.equal(d.querySelector("h1").textContent, "Why I’m building Sunny");
  assert.match(
    d.querySelector("#article-content").textContent,
    /My grandmother is my home/,
  );
  assert.match(
    d.querySelector("#article-content").textContent,
    /makes more things possible for her/,
  );
  assert.doesNotMatch(
    d.querySelector("#article-content").textContent,
    /sets spending limits|HR interview|dedicate Sunny/,
  );
  assert.match(
    d.querySelector("#article-nav a").href,
    /software-at-the-speed-of-thought$/,
  );
  assert.deepEqual(errors, []);
});
test("existing article still renders images and newer-post navigation", async (t) => {
  const { document: d } = await openPage(
    t,
    "/article.html?post=software-at-the-speed-of-thought",
  );
  await ready(d, "#article-content");
  assert.equal(d.querySelectorAll("#article-content img").length, 2);
  assert.match(
    d.querySelector("#article-nav a").href,
    /why-im-building-sunny$/,
  );
});
test("empty index has a deliberate empty state", async (t) => {
  const { document: d } = await openPage(t, "/", { index: [] });
  await ready(d, "#posts-container");
  assert.match(
    d.querySelector("#posts-container").textContent,
    /No notes here yet/,
  );
});
test("failed index has a retry action, not a fake article", async (t) => {
  const scenario = { index: { error: "unavailable" }, status: 503 };
  const { document: d } = await openPage(t, "/", scenario);
  await ready(d, "#posts-container");
  assert.match(
    d.querySelector("#posts-container").textContent,
    /couldn’t open the notebook/,
  );
  const retry = d.querySelector("#posts-container button");
  assert.ok(retry);
  delete scenario.index;
  delete scenario.status;
  retry.click();
  await ready(d, "#posts-container");
  assert.equal(d.querySelectorAll("a.entry").length, 2);
});
test("a missing article response shows recovery instead of rendering server error text", async (t) => {
  const { document: d } = await openPage(
    t,
    "/article.html?post=why-im-building-sunny",
    { missingPost: true },
  );
  await ready(d, "#article-content");
  assert.match(
    d.querySelector("#article-content").textContent,
    /couldn’t open this page/,
  );
  assert.doesNotMatch(
    d.querySelector("#article-content").textContent,
    /Missing article/,
  );
  assert.ok(d.querySelector('#article-content a[href="index.html#writing"]'));
});
test("unknown article offers a way back", async (t) => {
  const { document: d } = await openPage(t, "/article.html?post=unknown");
  await ready(d, "#article-content");
  assert.match(
    d.querySelector("#article-content").textContent,
    /couldn’t open this page/,
  );
});
test("loading state is visible while the index is pending", async (t) => {
  const { document: d } = await openPage(t, "/", { delay: 250 });
  assert.equal(
    d.querySelector("#posts-container").getAttribute("aria-busy"),
    "true",
  );
  assert.match(
    d.querySelector("#posts-container").textContent,
    /Opening the notebook/,
  );
  await ready(d, "#posts-container");
});
