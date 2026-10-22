/* ========================================
   Busy Beaver - Markdown Blog System
   ======================================== */

// Simple markdown parser (supports common markdown syntax)
function parseMarkdown(md) {
  let html = md
    // Code blocks
    .replace(
      /```(\w*)\n([\s\S]*?)```/g,
      '<pre><code class="language-$1">$2</code></pre>',
    )
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Headers
    .replace(/^### (.*$)/gm, "<h3>$1</h3>")
    .replace(/^## (.*$)/gm, "<h2>$1</h2>")
    .replace(/^# (.*$)/gm, "<h1>$1</h1>")
    // Bold and italic
    .replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    // Blockquotes
    .replace(/^> (.*$)/gm, "<blockquote>$1</blockquote>")
    // Unordered lists
    .replace(/^- (.*$)/gm, "<li>$1</li>")
    // Images (must come before links)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Horizontal rules
    .replace(/^---$/gm, "<hr>")
    // Line breaks to paragraphs
    .replace(/\n\n/g, "</p><p>")
    // Clean up consecutive blockquotes
    .replace(/<\/blockquote>\n<blockquote>/g, "\n");

  // Wrap list items in ul
  html = html.replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>");

  // Wrap in paragraph tags
  html = "<p>" + html + "</p>";

  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, "");
  html = html.replace(/<p>(<h[1-6]>)/g, "$1");
  html = html.replace(/(<\/h[1-6]>)<\/p>/g, "$1");
  html = html.replace(/<p>(<ul>)/g, "$1");
  html = html.replace(/(<\/ul>)<\/p>/g, "$1");
  html = html.replace(/<p>(<blockquote>)/g, "$1");
  html = html.replace(/(<\/blockquote>)<\/p>/g, "$1");
  html = html.replace(/<p>(<pre>)/g, "$1");
  html = html.replace(/(<\/pre>)<\/p>/g, "$1");
  html = html.replace(/<p>(<hr>)<\/p>/g, "$1");

  return html;
}

// Parse frontmatter from markdown
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { metadata: {}, content };

  const frontmatter = match[1];
  const body = match[2];
  const metadata = {};

  frontmatter.split("\n").forEach((line) => {
    const colonIndex = line.indexOf(":");
    if (colonIndex > -1) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();

      // Handle arrays like [tag1, tag2]
      if (value.startsWith("[") && value.endsWith("]")) {
        value = value
          .slice(1, -1)
          .split(",")
          .map((v) => v.trim());
      }

      metadata[key] = value;
    }
  });

  return { metadata, content: body };
}

// Calculate reading time
function calculateReadingTime(text) {
  const wordsPerMinute = 200;
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.ceil(words / wordsPerMinute);
  return `${minutes} min read`;
}

// Fetch the static notebook with a bounded wait and explicit HTTP failures.
async function readResource(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error("Resource unavailable");
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function escapeHTML(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}

async function fetchAllPosts() {
  const postFiles = JSON.parse(await readResource("posts/posts.json"));
  if (
    !Array.isArray(postFiles) ||
    postFiles.some(
      (file) => typeof file !== "string" || !/^[a-z0-9-]+\.md$/.test(file),
    )
  ) {
    throw new Error("Invalid notebook index");
  }
  const posts = await Promise.all(
    postFiles.map(async (file) => {
      const { metadata, content } = parseFrontmatter(
        await readResource(`posts/${file}`),
      );
      return {
        slug: file.slice(0, -3),
        title: metadata.title || "Untitled",
        description: metadata.description || "",
        date: metadata.date || "Coming Soon",
        category: metadata.category || "General",
        content,
      };
    }),
  );
  return posts.sort((a, b) => new Date(b.date) - new Date(a.date));
}

function showRecovery(container, message, retry) {
  container.innerHTML = `<div class="status"><p>${message}</p><button type="button">Try again</button><a href="index.html#writing">Back to all writing</a></div>`;
  container.querySelector("button").addEventListener("click", retry);
}

async function loadPostsList() {
  const container = document.getElementById("posts-container");
  if (!container) return;
  container.setAttribute("aria-busy", "true");
  container.innerHTML = '<p class="status">Opening the notebook…</p>';
  try {
    const posts = await fetchAllPosts();
    if (!posts.length) {
      container.innerHTML =
        '<p class="status">No notes here yet. Come back for the next page.</p>';
      return;
    }
    container.innerHTML = posts
      .map(
        (post, index) => `
            <a href="article.html?post=${post.slug}" class="entry${index === 0 ? " featured" : ""}">
                <span class="entry-meta">${escapeHTML(gardenDate(post.date))}</span>
                <span class="entry-copy">
                    ${index === 0 ? '<span class="entry-label">The latest note</span>' : ""}
                    <span class="entry-title">${escapeHTML(post.title)}</span>
                    <span class="entry-description">${escapeHTML(post.description)}</span>
                </span>
                <span class="entry-arrow" aria-hidden="true">↗</span>
            </a>`,
      )
      .join("");
  } catch {
    showRecovery(
      container,
      "I couldn’t open the notebook. Please try again.",
      loadPostsList,
    );
  } finally {
    container.setAttribute("aria-busy", "false");
  }
}

async function loadArticle() {
  const container = document.getElementById("article-content");
  const headerContainer = document.getElementById("article-header");
  const navEl = document.getElementById("article-nav");
  if (!container) return;
  container.setAttribute("aria-busy", "true");
  container.innerHTML = '<p class="status">Opening the notebook…</p>';
  if (headerContainer) headerContainer.innerHTML = "";
  if (navEl) navEl.innerHTML = "";
  const slug = new URLSearchParams(window.location.search).get("post");
  try {
    const posts = await fetchAllPosts();
    const index = posts.findIndex((post) => post.slug === slug);
    if (index === -1) throw new Error("Post not found");
    const post = posts[index];
    document.title = `${post.title} · busybeaver`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && post.description) metaDesc.content = post.description;
    if (headerContainer) {
      headerContainer.innerHTML = `
                <p class="overline">${escapeHTML(post.category)} · ${escapeHTML(gardenDate(post.date))} · ${calculateReadingTime(post.content)}</p>
                <h1 class="leaf-title">${escapeHTML(post.title)}</h1>
                ${post.description ? `<p class="leaf-subtitle">${escapeHTML(post.description)}</p>` : ""}`;
    }
    container.innerHTML = parseMarkdown(post.content);
    if (navEl) {
      const older = posts[index + 1];
      const newer = posts[index - 1];
      navEl.innerHTML =
        (older
          ? `<a href="article.html?post=${older.slug}">← ${escapeHTML(older.title)}</a>`
          : "<span></span>") +
        (newer
          ? `<a class="is-next" href="article.html?post=${newer.slug}">${escapeHTML(newer.title)} →</a>`
          : "");
    }
  } catch {
    showRecovery(
      container,
      "I couldn’t open this page. Try again, or head back to the notebook.",
      loadArticle,
    );
  } finally {
    container.setAttribute("aria-busy", "false");
  }
}

function gardenDate(dateStr) {
  if (!dateStr || dateStr === "Coming Soon") return "coming soon";
  const date = new Date(dateStr);
  if (isNaN(date)) return String(dateStr).toLowerCase();
  return date
    .toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    })
    .toLowerCase();
}

document.addEventListener("DOMContentLoaded", () => {
  loadPostsList();
  loadArticle();
});
