// Generador de la documentación pública: convierte docs/<idioma>/*.md en páginas HTML estáticas (sin dependencias).
// Soporta lo que la documentación usa: portada (frontmatter), títulos, párrafos, listas, tablas, citas, código, enlaces, imágenes, negrita y cursiva.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

export const DOC_LANGS = { es: 'Español', en: 'English' };
const UI = {
  es: { search: 'Buscar en la documentación', none: 'Sin resultados', menu: 'Menú', app: 'Abrir Caeliscope', prev: 'Anterior', next: 'Siguiente', on: 'En esta página', docs: 'Documentación', contact: 'Contáctanos' },
  en: { search: 'Search the documentation', none: 'No results', menu: 'Menu', app: 'Open Caeliscope', prev: 'Previous', next: 'Next', on: 'On this page', docs: 'Documentation', contact: 'Contact Us' },
};
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'seccion';

export function parseFront(src) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src); const meta = {};
  if (!m) return { meta, body: src };
  for (const l of m[1].split(/\r?\n/)) { const k = /^(\w+):\s*(.*)$/.exec(l); if (k) meta[k[1]] = k[2].trim().replace(/^["']|["']$/g, ''); }
  return { meta, body: src.slice(m[0].length) };
}

// Inline: código, imágenes, enlaces (los .md pasan a .html), negrita, cursiva.
export function inline(s) {
  const codes = []; s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(`<code>${esc(c)}</code>`); return `\u0000${codes.length - 1}\u0000`; });
  s = esc(s);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, a, u) => `<img src="${u}" alt="${a}" loading="lazy">`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
    const ext = /^https?:/.test(u); const href = ext ? u : u.replace(/\.md(#|$)/, '.html$1');
    return `<a href="${href}"${ext ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[+i]);
}

export function mdToHtml(md) {
  const lines = md.replace(/\r/g, '').split('\n'); const out = [], heads = []; let i = 0;
  const isSpecial = (l) => /^(#{1,4}\s|```|>|\s*[-*]\s|\s*\d+\.\s|\|)/.test(l) || /^(-{3,}|\*{3,})\s*$/.test(l);
  const list = (start, indent) => {                    // lista (anidada por sangría de 2 espacios), devuelve html y avanza i
    const ordered = /^\s*\d+\./.test(lines[start]); const tag = ordered ? 'ol' : 'ul'; let html = `<${tag}>`; i = start;
    while (i < lines.length) {
      const m = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(lines[i]); if (!m) break;
      const ind = m[1].length; if (ind < indent) break;
      if (ind > indent) { html = html.replace(/<\/li>$/, '') + list(i, ind) + '</li>'; continue; }
      let text = m[3]; i++;
      while (i < lines.length && lines[i].trim() && !/^\s*([-*]|\d+\.)\s/.test(lines[i]) && /^\s+/.test(lines[i])) text += ' ' + lines[i++].trim();
      html += `<li>${inline(text)}</li>`;
    }
    return html + `</${tag}>`;
  };
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = /^```(\w*)\s*$/.exec(l))) { const buf = []; i++; while (i < lines.length && !/^```\s*$/.test(lines[i])) buf.push(lines[i++]); i++; out.push(`<pre><code${m[1] ? ` class="lang-${m[1]}"` : ''}>${esc(buf.join('\n'))}</code></pre>`); continue; }
    if ((m = /^(#{1,4})\s+(.*)$/.exec(l))) { const n = m[1].length, id = slug(m[2].replace(/`/g, '')); if (n === 2 || n === 3) heads.push({ n, id, text: m[2].replace(/[`*]/g, '') }); out.push(`<h${n} id="${id}">${inline(m[2])}</h${n}>`); i++; continue; }
    if (/^(-{3,}|\*{3,})\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
    if (l.startsWith('>')) { const buf = []; while (i < lines.length && lines[i].startsWith('>')) buf.push(lines[i++].replace(/^>\s?/, '')); out.push(`<blockquote>${mdToHtml(buf.join('\n')).html}</blockquote>`); continue; }
    if (l.startsWith('|') && /^\|?\s*:?-{2,}/.test(lines[i + 1] || '')) {
      const cells = (r) => r.replace(/^\||\|\s*$/g, '').split('|').map((c) => c.trim());
      const head = cells(l); i += 2; const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(cells(lines[i++]));
      out.push(`<div class="tw"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`); continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) { out.push(list(i, /^(\s*)/.exec(l)[1].length)); continue; }
    const buf = []; while (i < lines.length && lines[i].trim() && (buf.length === 0 || !isSpecial(lines[i]))) buf.push(lines[i++].trim());
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return { html: out.join('\n'), heads };
}

const CSS = `:root{--bg:#02040a;--panel:#070b14;--line:#16202f;--fg:#dbe3f1;--dim:#93a1ba;--cy:#5edfe5;--cy2:#02e1f8;--code:#0b1220}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.7 'Jost Variable','Jost','Helvetica Neue',Arial,sans-serif}
a{color:var(--cy);text-decoration:none}a:hover{text-decoration:underline}
header{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:18px;padding:10px 22px;background:rgba(2,4,10,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
header img{height:46px;display:block;border:0;border-radius:0}header .sp{flex:1}
#q{width:min(320px,34vw);background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:7px 12px;font:inherit;font-size:14px}
#q:focus{outline:1px solid var(--cy)}
.btn{white-space:nowrap;border:1px solid var(--line);border-radius:8px;padding:6px 12px;font-size:14px;color:var(--fg);background:var(--panel)}.btn:hover{border-color:var(--cy);text-decoration:none}
#res{z-index:9;position:absolute;right:22px;top:52px;width:min(420px,92vw);background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:6px;display:none;max-height:70vh;overflow:auto}
#res a{display:block;padding:8px 10px;border-radius:6px;color:var(--fg)}#res a:hover{background:#0d1626;text-decoration:none}#res small{display:block;color:var(--dim)}
.wrap{display:grid;grid-template-columns:250px minmax(0,1fr) 210px;gap:34px;max-width:1280px;margin:0 auto;padding:26px 22px 60px}
nav.side{position:sticky;top:76px;align-self:start;max-height:calc(100vh - 96px);overflow:auto;font-size:15px}
nav.side h4,nav.toc h4{margin:0 0 8px;font-weight:400;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
nav.side a{display:block;padding:5px 10px;border-left:2px solid var(--line);color:var(--dim)}nav.side a:hover{color:var(--fg);text-decoration:none}
nav.side a.on{color:var(--cy);border-left-color:var(--cy)}
nav.toc{position:sticky;top:76px;align-self:start;font-size:14px}nav.toc a{display:block;padding:3px 0;color:var(--dim)}nav.toc a.l3{padding-left:12px}
main{min-width:0}main h1{font-weight:300;font-size:2.3rem;line-height:1.2;margin:.1em 0 .5em;letter-spacing:.01em}
main h2{font-weight:400;font-size:1.5rem;margin:2.2em 0 .5em;padding-top:.4em;border-top:1px solid var(--line)}main h3{font-weight:500;font-size:1.15rem;margin:1.8em 0 .3em;color:#eaf3ff}
main p,main li{color:#cdd6e6}main li{margin:.25em 0}
code{background:var(--code);border:1px solid var(--line);border-radius:5px;padding:1px 6px;font:.88em/1.4 ui-monospace,Consolas,Menlo,monospace;color:#bff3f6}
pre{background:var(--code);border:1px solid var(--line);border-radius:10px;padding:14px 16px;overflow:auto}pre code{background:none;border:0;padding:0}
blockquote{margin:1.2em 0;padding:.2em 1.1em;border-left:3px solid var(--cy);background:#07101c;border-radius:0 8px 8px 0}blockquote p{margin:.6em 0}
.tw{overflow:auto}table{border-collapse:collapse;width:100%;font-size:15px;margin:1em 0}th,td{border:1px solid var(--line);padding:8px 12px;text-align:left;vertical-align:top}th{background:var(--panel);font-weight:500}
img{max-width:100%;border-radius:10px;border:1px solid var(--line)}hr{border:0;border-top:1px solid var(--line);margin:2em 0}
.pn{display:flex;justify-content:space-between;gap:16px;margin-top:3em;padding-top:1.2em;border-top:1px solid var(--line)}.pn>span{flex:1}.pn a{display:block}.pn>span:last-child{text-align:right}.pn small{display:block;white-space:nowrap;color:var(--dim);font-size:12px;letter-spacing:.1em;text-transform:uppercase}
footer{max-width:1280px;margin:0 auto;padding:0 22px 36px;color:var(--dim);font-size:13px}
.fbar{display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:12px 16px;padding-top:16px;border-top:1px solid var(--line)}
.fbar>a.mail{color:var(--cy);font-size:15px}
.flinks{display:flex;align-items:center;gap:14px;margin-left:auto}.flinks a{display:block;line-height:0;border-radius:8px;transition:transform .15s,filter .15s}.flinks a:hover{transform:translateY(-2px);filter:brightness(1.15)}
.fbar .flinks{margin-bottom:-8px}.fcomm{display:flex;flex-direction:column;gap:6px}.fct{color:#dcb450;font-size:9px;font-weight:500;letter-spacing:.16em}.fcrow{display:flex;gap:10px}.fcrow a{display:block;line-height:0;transition:transform .15s,filter .15s}.fcrow a:hover{transform:translateY(-2px);filter:brightness(1.15)}.fcrow img{height:28px;width:auto;display:block;border:0;border-radius:7px}
.flinks img{height:34px;width:auto;display:block;border:0;border-radius:0}.flinks .g img{height:28px}.flinks .e img{height:40px}.flinks .h img{height:44px}
.fline{text-align:center;margin-top:18px}
@media(max-width:1000px){.wrap{grid-template-columns:minmax(0,1fr);gap:18px}nav.toc{display:none}nav.side{position:static;max-height:none;border-bottom:1px solid var(--line);padding-bottom:12px}}
@media(max-width:560px){#q{width:auto;min-width:80px;flex:1}.btn.app{display:none}header{gap:8px;padding:8px 12px}header img{height:34px}.flinks{flex-wrap:wrap;justify-content:flex-end;gap:8px 12px}.flinks img{height:24px!important}.flinks .g img{height:20px!important}.fcrow img{height:24px!important}.flinks .e img{height:28px!important}.flinks .h img{height:34px!important}.btn{padding:6px 9px;font-size:13px}}`;

const SEARCH_JS = `(()=>{const q=document.getElementById('q'),r=document.getElementById('res');let ix=null;
const load=()=>ix||(ix=fetch('search.json').then(x=>x.json()).catch(()=>[]));
const n=s=>s.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();
q.addEventListener('input',async()=>{const t=n(q.value.trim());if(t.length<2){r.style.display='none';return}
const d=await load();const w=t.split(/\\s+/);const hits=d.map(e=>{const h=n(e.t+' '+e.h),b=n(e.x);let s=0;for(const k of w){if(h.includes(k))s+=5;if(b.includes(k))s+=1;else if(!h.includes(k)){return null}}return{e,s}}).filter(Boolean).sort((a,b)=>b.s-a.s).slice(0,8);
r.innerHTML=hits.length?hits.map(({e})=>'<a href="'+e.u+'">'+e.t+(e.h?' › '+e.h:'')+'<small>'+e.x.slice(0,90)+'…</small></a>').join(''):'<a>'+r.dataset.none+'</a>';r.style.display='block'});
document.addEventListener('click',e=>{if(!r.contains(e.target)&&e.target!==q)r.style.display='none'});
document.addEventListener('keydown',e=>{if(e.key==='/'&&document.activeElement!==q){e.preventDefault();q.focus()}if(e.key==='Escape')r.style.display='none'})})();`;

export function pageHtml({ lang, meta, html, heads, pages, file, other, prev, next }) {
  const u = UI[lang];
  const nav = pages.map((p) => `<a href="${p.file}"${p.file === file ? ' class="on"' : ''}>${esc(p.title)}</a>`).join('');
  const toc = heads.length > 1 ? `<nav class="toc"><h4>${u.on}</h4>${heads.map((h) => `<a class="l${h.n}" href="#${h.id}">${esc(h.text)}</a>`).join('')}</nav>` : '<nav class="toc"></nav>';
  const pn = (prev || next) ? `<div class="pn"><span>${prev ? `<a href="${prev.file}"><small>← ${u.prev}</small>${esc(prev.title)}</a>` : ''}</span><span>${next ? `<a href="${next.file}" style="text-align:right"><small>${u.next} →</small>${esc(next.title)}</a>` : ''}</span></div>` : '';
  const sw = Object.keys(DOC_LANGS).filter((l) => l !== lang).map((l) => other[l] ? `<a class="btn" href="../${l}/${other[l]}" hreflang="${l}">${l.toUpperCase()}</a>` : '').join('');
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(meta.title)} · Caeliscope</title><meta name="description" content="${esc(meta.description || '')}">
<meta name="theme-color" content="#02040a"><link rel="icon" href="../../brand/caeliscope-icon.svg" type="image/svg+xml">
<style>${CSS}</style></head><body>
<header><a href="../../" title="${u.app}"><img src="../../brand/caeliscope-logo.svg" alt="Caeliscope"></a><span class="sp"></span>
<input id="q" type="search" placeholder="${u.search} ( / )" autocomplete="off" aria-label="${u.search}">${sw}<a class="btn app" href="../../">${u.app}</a></header>
<div id="res" data-none="${u.none}"></div>
<div class="wrap"><nav class="side"><h4>${u.docs}</h4>${nav}</nav><main>${html}${pn}</main>${toc}</div>
<footer><div class="fbar"><div class="fcomm"><a class="fct" href="https://github.com/HermeticaLabs/Caeliscope/blob/main/COMMUNITY/README${lang === 'es' ? '.es' : ''}.md" target="_blank" rel="noopener">CAELISCOPE PARTNERS, COMMUNITY &amp; RECOGNITION</a><span class="fcrow">
<a href="https://elgranobservatorio.com/" target="_blank" rel="noopener" title="El Gran Observatorio"><img src="../../brand/elgranobservatorio.png" alt="El Gran Observatorio"></a>
<a href="https://hub.xerj.org/" target="_blank" rel="noopener" title="XERJ Corpus Hub"><img src="../../brand/xerj.png" alt="XERJ Corpus Hub"></a></span></div><span class="flinks">
<a class="i" href="inicio.html" title="Caeliscope"><img src="../../brand/caeliscope-icon.svg" alt="Caeliscope"></a>
<a class="g" href="https://github.com/HermeticaLabs/Caeliscope" target="_blank" rel="noopener" title="GitHub · Caeliscope"><img src="../../brand/about-github.png" alt="GitHub / Caeliscope"></a>
<a class="e" href="https://github.com/hermeticalabs/caelis-engine" target="_blank" rel="noopener" title="Caelis Engine"><img src="../../brand/caelis-engine-light.svg" alt="Caelis Engine"></a>
<a class="h" href="https://github.com/HermeticaLabs/caelis-engine#built-with-caelis-engine" target="_blank" rel="noopener" title="Hermetica Labs"><img src="../../brand/hermetica-light.svg" alt="Hermetica Labs"></a></span></div>
<div class="fline">Hermetica Labs · Caeliscope · AGPL-3.0-or-later</div></footer><script>${SEARCH_JS}</script></body></html>`;
}

export function buildDocs({ srcDir = 'docs', outDir = 'dist/docs' } = {}) {
  const built = []; const bundle = {};
  for (const lang of Object.keys(DOC_LANGS)) {
    const dir = join(srcDir, lang); if (!existsSync(dir)) continue;
    const pages = readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => {
      const { meta, body } = parseFront(readFileSync(join(dir, f), 'utf8'));
      return { src: f, file: f.replace(/\.md$/, '.html'), meta, body, title: meta.title || f, order: Number(meta.order ?? 999) };
    }).sort((a, b) => a.order - b.order || a.src.localeCompare(b.src));
    bundle[lang] = pages;
  }
  const otherOf = (lang, p) => Object.fromEntries(Object.keys(bundle).filter((l) => l !== lang).map((l) => [l, bundle[l].find((q) => q.src === p.src)?.file]));
  const index = {};
  for (const [lang, pages] of Object.entries(bundle)) {
    mkdirSync(join(outDir, lang), { recursive: true }); index[lang] = [];
    pages.forEach((p, n) => {
      const { html, heads } = mdToHtml(p.body);
      const full = `<h1>${esc(p.title)}</h1>\n${html}`;
      writeFileSync(join(outDir, lang, p.file), pageHtml({ lang, meta: { title: p.title, description: p.meta.description }, html: full, heads, pages, file: p.file, other: otherOf(lang, p), prev: pages[n - 1], next: pages[n + 1] }));
      // índice de búsqueda: una entrada por sección
      const parts = p.body.split(/^(?=##\s)/m);
      for (const part of parts) {
        const h = /^##\s+(.*)$/m.exec(part); const text = part.replace(/^#{1,4}\s.*$/gm, '').replace(/\]\([^)]*\)/g, ']').replace(/[`*|>#\[\]()]/g, ' ').replace(/\s+/g, ' ').trim();
        if (text) index[lang].push({ u: `${p.file}${h ? '#' + slug(h[1].replace(/`/g, '')) : ''}`, t: p.title, h: h ? h[1].replace(/[`*]/g, '') : '', x: text.slice(0, 600) });
      }
      for (const m of p.body.matchAll(/!\[[^\]]*\]\((\.\.\/img\/[^)\s]+)\)/g)) {   // imágenes referenciadas: se copian junto al sitio
        const from = join(srcDir, lang, m[1]), to = join(outDir, lang, m[1]);
        if (existsSync(from)) { mkdirSync(dirname(to), { recursive: true }); copyFileSync(from, to); }
      }
      built.push(`${lang}/${p.file}`);
    });
    writeFileSync(join(outDir, lang, 'search.json'), JSON.stringify(index[lang]));
  }
  const first = Object.fromEntries(Object.entries(bundle).map(([l, p]) => [l, `${l}/${p[0]?.file}`]));
  writeFileSync(join(outDir, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Caeliscope</title><meta name="viewport" content="width=device-width,initial-scale=1">
<script>var f=${JSON.stringify(first)},l=(navigator.language||'en').slice(0,2);location.replace(f[l]||f.en||Object.values(f)[0]);</script>
<noscript>${Object.entries(first).map(([l, f]) => `<a href="${f}">${DOC_LANGS[l]}</a>`).join(' · ')}</noscript>`);
  return built;
}
