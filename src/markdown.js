const { Marked } = require('marked');
const markedKatex = require('marked-katex-extension');
const hljs = require('highlight.js/lib/common');

// Languages supported by the editor that are not part of the common highlight.js bundle
hljs.registerLanguage('dart', require('highlight.js/lib/languages/dart'));
hljs.registerLanguage('dockerfile', require('highlight.js/lib/languages/dockerfile'));
hljs.registerLanguage('dos', require('highlight.js/lib/languages/dos'));
hljs.registerLanguage('latex', require('highlight.js/lib/languages/latex'));
hljs.registerLanguage('powershell', require('highlight.js/lib/languages/powershell'));

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-');
}

const slugCounts = new Map();
const marked = new Marked();

marked.use(markedKatex({ throwOnError: false, nonStandard: true }));
marked.use({
  hooks: {
    preprocess(markdown) {
      slugCounts.clear();
      return markdown;
    },
  },
  renderer: {
    heading({ tokens, depth }) {
      const html = this.parser.parseInline(tokens);
      const base = slugify(this.parser.parseInline(tokens, this.parser.textRenderer)) || 'section';
      const count = slugCounts.get(base) || 0;
      slugCounts.set(base, count + 1);
      const id = count ? `${base}-${count}` : base;
      return `<h${depth} id="${id}">${html}</h${depth}>\n`;
    },
    code({ text, lang }) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      const highlighted = hljs.highlight(text, { language }).value;
      return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>\n`;
    },
  },
});

module.exports.parse = (markdown) => marked.parse(markdown);
