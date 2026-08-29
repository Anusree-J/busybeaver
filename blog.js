/* ========================================
   Busy Beaver - Markdown Blog System
   ======================================== */

// Simple markdown parser (supports common markdown syntax)
function parseMarkdown(md) {
    let html = md
        // Code blocks
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Headers
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        // Bold and italic
        .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        // Blockquotes
        .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
        // Unordered lists
        .replace(/^- (.*$)/gm, '<li>$1</li>')
        // Images (must come before links)
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        // Horizontal rules
        .replace(/^---$/gm, '<hr>')
        // Line breaks to paragraphs
        .replace(/\n\n/g, '</p><p>')
        // Clean up consecutive blockquotes
        .replace(/<\/blockquote>\n<blockquote>/g, '\n');

    // Wrap list items in ul
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    // Wrap in paragraph tags
    html = '<p>' + html + '</p>';

    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<h[1-6]>)/g, '$1');
    html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ul>)/g, '$1');
    html = html.replace(/(<\/ul>)<\/p>/g, '$1');
    html = html.replace(/<p>(<blockquote>)/g, '$1');
    html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');
    html = html.replace(/<p>(<pre>)/g, '$1');
    html = html.replace(/(<\/pre>)<\/p>/g, '$1');
    html = html.replace(/<p>(<hr>)<\/p>/g, '$1');

    return html;
}

// Parse frontmatter from markdown
function parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { metadata: {}, content };

    const frontmatter = match[1];
    const body = match[2];
    const metadata = {};

    frontmatter.split('\n').forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex > -1) {
            const key = line.slice(0, colonIndex).trim();
            let value = line.slice(colonIndex + 1).trim();

            // Handle arrays like [tag1, tag2]
            if (value.startsWith('[') && value.endsWith(']')) {
                value = value.slice(1, -1).split(',').map(v => v.trim());
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

// Fetch and parse every post referenced in posts.json, sorted newest-first
async function fetchAllPosts() {
    const response = await fetch('posts/posts.json');
    const postFiles = await response.json();

    const posts = [];
    for (const file of postFiles) {
        const postResponse = await fetch(`posts/${file}`);
        const markdown = await postResponse.text();
        const { metadata, content } = parseFrontmatter(markdown);

        posts.push({
            slug: file.replace('.md', ''),
            title: metadata.title || 'Untitled',
            description: metadata.description || '',
            date: metadata.date || 'Coming Soon',
            category: metadata.category || 'General',
            content
        });
    }

    posts.sort((a, b) => new Date(b.date) - new Date(a.date));
    return posts;
}

const LEAF_SVG = `<svg class="entry-leaf" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 18 C 3 13, 1 7, 4.5 2.5 C 10 4, 12.5 9, 10 18 Z"/></svg>`;

// Load writing index for homepage
async function loadPostsList() {
    const container = document.getElementById('posts-container');
    if (!container) return;

    try {
        const posts = await fetchAllPosts();

        container.innerHTML = posts.map(post => `
            <a href="article.html?post=${post.slug}" class="entry">
                ${LEAF_SVG}
                <span class="entry-title">${post.title}</span>
                <span class="entry-meta">${gardenDate(post.date)}</span>
            </a>
        `).join('');

    } catch (error) {
        console.error('Error loading posts:', error);
        container.innerHTML = '<p class="entries-loading">nothing has come up yet.</p>';
    }
}

// Load single log / article
async function loadArticle() {
    const container = document.getElementById('article-content');
    const headerContainer = document.getElementById('article-header');
    if (!container) return;

    const params = new URLSearchParams(window.location.search);
    const slug = params.get('post');

    if (!slug) {
        window.location.href = 'index.html';
        return;
    }

    try {
        // Load the full index for prev/next navigation
        const posts = await fetchAllPosts();
        const index = posts.findIndex(p => p.slug === slug);
        if (index === -1) throw new Error('Post not found');

        const post = posts[index];
        const { metadata, content } = parseFrontmatter(
            await (await fetch(`posts/${slug}.md`)).text()
        );

        // Update page title + meta description
        document.title = `${post.title} · busybeaver`;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.content = post.description;

        // Render header
        if (headerContainer) {
            headerContainer.innerHTML = `
                <p class="overline">${post.category.toLowerCase()} · ${gardenDate(post.date)} · ${calculateReadingTime(content)}</p>
                <h1 class="leaf-title">${post.title}</h1>
                ${post.description ? `<p class="leaf-subtitle">${post.description}</p>` : ''}
            `;
        }

        // Render body
        container.innerHTML = parseMarkdown(content);

        // Prev (older) / Next (newer) navigation
        const navEl = document.getElementById('article-nav');
        if (navEl) {
            const older = posts[index + 1];
            const newer = posts[index - 1];
            const parts = [];
            parts.push(older
                ? `<a href="article.html?post=${older.slug}">← ${older.title}</a>`
                : `<span></span>`);
            if (newer) {
                parts.push(`<a class="is-next" href="article.html?post=${newer.slug}">${newer.title} →</a>`);
            }
            navEl.innerHTML = parts.join('');
        }

    } catch (error) {
        console.error('Error loading article:', error);
        container.innerHTML = '<p class="entries-loading">This page seems to have blown away.</p>';
    }
}

// Format a date as "march 2026" for garden listings
function gardenDate(dateStr) {
    if (!dateStr || dateStr === 'Coming Soon') return 'still growing';
    const date = new Date(dateStr);
    if (isNaN(date)) return String(dateStr).toLowerCase();
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toLowerCase();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadPostsList();
    loadArticle();
});
