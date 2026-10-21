import { defineConfig } from 'astro/config';

// Recognised shell prompts at the start of a console line. The matched part is
// coloured as the prompt (accent), the remainder as the typed command.
const PROMPT_RE = /^((?:\*Evil-WinRM\* )?PS [^>]*>|[A-Za-z]:\\[^>]*>|SQL \([^)]*\)[^>]*>|smb: [^>]*>|\$|#)((?<=>).*|\s.*)?$/;

function textOf(node) {
  if (node.type === 'text') return node.value;
  return (node.children || []).map(textOf).join('');
}

const span = (cls, value) => ({
  type: 'element',
  tagName: 'span',
  properties: { className: [cls] },
  children: [{ type: 'text', value }],
});

// Splits each line of a plaintext code block into prompt / command / output
// spans so the terminal transcript can be coloured like a real shell. Runs as a
// Shiki transformer so it sees the highlighted hast (one child span per line).
const PLAIN_LANGS = new Set(['plaintext', 'text', 'txt', 'ansi', '']);
const shellPromptTransformer = {
  name: 'shell-prompt',
  line(node) {
    if (!PLAIN_LANGS.has(this.options.lang)) return;
    const text = textOf(node);
    const m = text.match(PROMPT_RE);
    if (m) {
      node.children = m[2] ? [span('sh-prompt', m[1]), span('sh-cmd', m[2])] : [span('sh-prompt', m[1])];
    } else {
      node.children = [span('sh-out', text)];
    }
  },
};

export default defineConfig({
  // Served at the user GitHub Pages root (repo named pwndalf.github.io), so no base.
  // If this ever moves to a project subpath (username.github.io/repo/), set base: '/repo'.
  site: 'https://pwndalf.github.io',

  // Old /writeups URLs (renamed to walkthroughs)
  redirects: {
    '/writeups': '/walkthroughs',
    '/writeups/[slug]': '/walkthroughs/[slug]',
  },

  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      transformers: [shellPromptTransformer],
    },
  },
});
