import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mdToHtml, inline, parseFront, slug, buildDocs } from '../scripts/build-docs.mjs';

test('markdown: títulos con ancla, listas, tablas, código y enlaces', () => {
  const { html, heads } = mdToHtml('## Ñandú útil\n\nTexto con **negrita**, *cursiva* y `code <b>`.\n\n- a\n  - b\n- c\n\n1. uno\n2. dos\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```js\nlet x = 1 < 2;\n```\n\n> nota\n');
  assert.match(html, /<h2 id="nandu-util">/); assert.equal(heads[0].id, 'nandu-util');
  assert.match(html, /<strong>negrita<\/strong>/); assert.match(html, /<em>cursiva<\/em>/); assert.match(html, /<code>code &lt;b&gt;<\/code>/);
  assert.match(html, /<ul><li>a<ul><li>b<\/li><\/ul><\/li><li>c<\/li><\/ul>/); assert.match(html, /<ol><li>uno<\/li><li>dos<\/li><\/ol>/);
  assert.match(html, /<th>A<\/th>/); assert.match(html, /<td>2<\/td>/); assert.match(html, /1 &lt; 2/); assert.match(html, /<blockquote><p>nota<\/p>/);
});
test('enlaces: los .md locales pasan a .html y los externos abren aparte', () => {
  assert.match(inline('[x](lunas.md#a)'), /href="lunas.html#a"/);
  assert.match(inline('[x](https://e.org/a.md)'), /href="https:\/\/e.org\/a.md" target="_blank" rel="noopener"/);
});
test('no inyecta HTML desde el texto', () => assert.ok(!/<script/.test(inline('<script>alert(1)</script>'))));
test('portada y slug', () => { assert.equal(parseFront('---\ntitle: "T"\norder: 2\n---\ncuerpo').meta.order, '2'); assert.equal(slug('Año 2026!'), 'ano-2026'); });

test('sitio completo: páginas, índice de búsqueda, enlaces internos válidos', () => {
  const out = mkdtempSync(join(tmpdir(), 'docs-'));
  const built = buildDocs({ srcDir: 'docs', outDir: out });
  assert.ok(built.length >= 8);
  assert.ok(existsSync(join(out, 'index.html')) && existsSync(join(out, 'es', 'search.json')));
  const idx = JSON.parse(readFileSync(join(out, 'es', 'search.json'), 'utf8')); assert.ok(idx.length > 10);
  for (const f of readdirSync(join(out, 'es')).filter((x) => x.endsWith('.html'))) {
    const h = readFileSync(join(out, 'es', f), 'utf8');
    assert.ok(!/gmail/i.test(h));
    for (const m of h.matchAll(/href="([^"#:]+\.html)(#[^"]*)?"/g)) assert.ok(existsSync(join(out, 'es', m[1])), `${f} enlaza a ${m[1]}`);
    for (const m of h.matchAll(/href="#([^"]+)"/g)) assert.ok(h.includes(`id="${m[1]}"`), `${f}: ancla ${m[1]}`);
  }
});
