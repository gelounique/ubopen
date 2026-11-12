// Viewer-Registry: welcher Viewer für welche Datei
import image from './image.js';
import video from './video.js';
import audio from './audio.js';
import pdf from './pdf.js';
import text from './text.js';
import data from './data.js';
import table from './table.js';
import doc from './doc.js';
import office from './office.js';
import html from './html.js';
import archive from './archive.js';
import model from './model.js';
import font from './font.js';
import sqlite from './sqlite.js';
import email from './email.js';
import comic from './comic.js';
import hex from './hex.js';
import exe from './exe.js';

export const VIEWERS = { image, video, audio, pdf, text, data, table, doc, office, html, archive, model, font, sqlite, email, comic, hex, exe };

const TEXTY_DOC = new Set(['md', 'markdown', 'mdown', 'mkd', 'mkdn', 'mdx', 'rst', 'tex', 'latex', 'ltx', 'org', 'textile', 'wiki', 'mediawiki', 'dokuwiki', 'twiki', 'creole', 'jira', 'bib', 'bibtex', 'ris', 'typ', 'muse', 't2t', 'djot', 'dj', 'adoc', 'asciidoc', 'pod', 'man', '1', '2', '3', '4', '5', '6', '7', '8', 'opml', 'dbk', 'docbook', 'jats']);
const MODEL_INFO_ONLY = new Set(['3dm', 'step', 'stp', 'iges', 'igs', 'blend', 'skp', 'f3d']);

export function viewerFor(f, tab) {
  const t = window.UB && window.UB.tabs.find(x => x.path === f.path);
  if (t && t.forceArchive) return 'archive';
  const e = f.real, c = f.cat;
  if (c === 'image' || c === 'raw') return 'image';
  if (c === 'vector') return ['svg', 'svgz'].includes(e) ? 'image' : e === 'ai' ? 'pdf' : 'office';
  if (c === 'video') return 'video';
  if (c === 'audio') return ['mid', 'midi'].includes(e) ? 'hex' : 'audio';
  if (c === 'subtitle' || c === 'code' || c === 'contact') return 'text';
  if (c === 'pdf') return 'pdf';
  if (c === 'doc') return TEXTY_DOC.has(e) ? 'text' : (e === 'ipynb' ? 'data' : 'doc');
  if (c === 'ebook') return ['epub', 'fb2'].includes(e) ? 'doc' : ['chm'].includes(e) ? 'archive' : ['djvu', 'djv'].includes(e) ? 'hex' : 'doc';
  if (c === 'office' || c === 'slides') return 'office';
  if (c === 'sheet') return ['numbers', 'gnumeric', 'sxc', 'stc', 'uos', 'et', 'ett'].includes(e) ? 'office' : 'table';
  if (c === 'data') return ['xsd', 'xsl', 'xslt', 'wsdl', 'csproj', 'vcxproj', 'sln', 'resx', 'env', 'properties'].includes(e) ? 'text' : 'data';
  if (c === 'torrent') return 'data';
  if (c === 'web') return 'html';
  if (c === 'comic') return 'comic';
  if (c === 'archive' || c === 'disk') return 'archive';
  if (c === 'model') return MODEL_INFO_ONLY.has(e) ? 'hex' : 'model';
  if (c === 'font') return ['ttf', 'otf', 'woff', 'woff2'].includes(e) ? 'font' : 'hex';
  if (c === 'database') return 'sqlite';
  if (c === 'email') return e === 'msg' ? 'hex' : (e === 'mbox' || e === 'mbx') ? 'text' : 'email';
  if (c === 'exe') return ['exe', 'dll', 'sys', 'ocx', 'scr', 'cpl', 'efi', 'mui', 'lnk'].includes(e) ? 'exe' : 'hex';
  return f.isText ? 'text' : 'hex';
}
