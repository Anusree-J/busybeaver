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

// Icon SVG templates
const icons = {
    lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="11" width="18" height="11" rx="2"/>
        <circle cx="12" cy="16" r="1"/>
        <path d="M7 11V7a5 5 0 0110 0v4"/>
    </svg>`,
    globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 2a14.5 14.5 0 000 20 14.5 14.5 0 000-20"/>
        <path d="M2 12h20"/>
    </svg>`,
    bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 01-3.46 0"/>
        <path d="M12 2v2"/>
    </svg>`,
    code: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <polyline points="16,18 22,12 16,6"/>
        <polyline points="8,6 2,12 8,18"/>
    </svg>`,
    book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
    </svg>`,
    default: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M12 19l7-7 3 3-7 7-3-3z"/>
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
        <path d="M2 2l7.586 7.586"/>
        <circle cx="11" cy="11" r="2"/>
    </svg>`
};

// Load posts list for homepage
async function loadPostsList() {
    const container = document.getElementById('posts-container');
    if (!container) return;

    try {
        const response = await fetch('posts/posts.json');
        const postFiles = await response.json();

        const posts = [];

        for (const file of postFiles) {
            const postResponse = await fetch(`posts/${file}`);
            const markdown = await postResponse.text();
            const { metadata, content } = parseFrontmatter(markdown);

            // Get first paragraph as excerpt
            const plainText = content.replace(/[#*`>\[\]()-]/g, '').trim();
            const firstParagraph = plainText.split('\n\n')[0];
            const excerpt = firstParagraph.slice(0, 200) + (firstParagraph.length > 200 ? '...' : '');

            posts.push({
                slug: file.replace('.md', ''),
                title: metadata.title || 'Untitled',
                description: metadata.description || excerpt,
                date: metadata.date || 'Coming Soon',
                category: metadata.category || 'General',
                icon: metadata.icon || 'default',
                content
            });
        }

        // Sort by date (newest first)
        posts.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Render posts
        container.innerHTML = posts.map(post => `
            <a href="article.html?post=${post.slug}" class="post-item">
                <div class="post-icon">
                    ${icons[post.icon] || icons.default}
                </div>
                <div class="post-content">
                    <span class="post-tag">${post.category}</span>
                    <h3 class="post-title">${post.title}</h3>
                    <p class="post-excerpt">${post.description}</p>
                    <span class="post-date">${formatDate(post.date)}</span>
                </div>
            </a>
        `).join('');

    } catch (error) {
        console.error('Error loading posts:', error);
        container.innerHTML = '<p>No posts available yet.</p>';
    }
}

// Load single article
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
        const response = await fetch(`posts/${slug}.md`);
        if (!response.ok) throw new Error('Post not found');

        const markdown = await response.text();
        const { metadata, content } = parseFrontmatter(markdown);

        // Update page title
        document.title = `${metadata.title || 'Article'} | Busy Beaver`;

        // Update meta description
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.content = metadata.description || '';

        // Render header
        if (headerContainer) {
            const tags = Array.isArray(metadata.tags) ? metadata.tags : [];
            headerContainer.innerHTML = `
                <a href="index.html#writing" class="back-link">
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M12 4l-8 8 8 8" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>Back to Writing</span>
                </a>

                <div class="article-meta">
                    <span class="article-category">${metadata.category || 'General'}</span>
                    <span class="article-date">${formatDate(metadata.date)}</span>
                    <span class="article-reading-time">${calculateReadingTime(content)}</span>
                </div>

                <h1 class="article-title">${metadata.title || 'Untitled'}</h1>

                <p class="article-subtitle">${metadata.description || ''}</p>

                <div class="article-author">
                    <img src="busy beaver logo.jpeg" alt="Busy Beaver" class="author-avatar">
                    <div class="author-info">
                        <span class="author-name">Busy Beaver</span>
                        <span class="author-handle">@busybeaver</span>
                    </div>
                </div>
            `;
        }

        // Render content
        container.innerHTML = parseMarkdown(content);

        // Update tags in footer
        const tagsContainer = document.querySelector('.article-tags');
        if (tagsContainer && Array.isArray(metadata.tags)) {
            tagsContainer.innerHTML = metadata.tags.map(tag =>
                `<span class="tag">${tag}</span>`
            ).join('');
        }

        // Update share links
        const shareTwitter = document.querySelector('.share-link[title="Share on Twitter"]');
        if (shareTwitter) {
            const shareUrl = encodeURIComponent(window.location.href);
            const shareText = encodeURIComponent(metadata.title || 'Article');
            shareTwitter.href = `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`;
        }

    } catch (error) {
        console.error('Error loading article:', error);
        container.innerHTML = '<p>Article not found.</p>';
    }
}

// Format date helper
function formatDate(dateStr) {
    if (!dateStr || dateStr === 'Coming Soon') return 'Coming Soon';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadPostsList();
    loadArticle();
});
