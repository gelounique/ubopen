// Icon-Set (Lucide, ISC) → SVG-Strings im UB-Look (weiß, 1.75 px Linie)
import * as L from 'lucide';

const MAP = {
  home: 'House', open: 'FolderOpen', file: 'File', files: 'Files', convert: 'RefreshCcw', formats: 'LibraryBig', settings: 'SlidersHorizontal', info: 'Info',
  min: 'Minus', max: 'Square', restore: 'Copy', close: 'X', plus: 'Plus', search: 'Search', save: 'Save', saveas: 'SaveAll', copy: 'Copy', copies: 'CopyPlus',
  backup: 'ArchiveRestore', rename: 'TextCursorInput', folder: 'Folder', reveal: 'FolderSearch', external: 'ExternalLink', trash: 'Trash2', link: 'Link', clip: 'Clipboard',
  zoomin: 'ZoomIn', zoomout: 'ZoomOut', fit: 'Maximize', one: 'Scan', rotl: 'RotateCcw', rotr: 'RotateCw', fliph: 'FlipHorizontal2', flipv: 'FlipVertical2', crop: 'Crop',
  sun: 'SunMedium', contrast: 'Contrast', drop: 'Droplet', pipette: 'Pipette', resize: 'Scaling', undo: 'Undo2', redo: 'Redo2', play: 'Play', pause: 'Pause',
  stepb: 'StepBack', stepf: 'StepForward', vol: 'Volume2', mute: 'VolumeX', camera: 'Camera', scissors: 'Scissors', repeat: 'Repeat', pip: 'PictureInPicture2',
  full: 'Expand', image: 'Image', film: 'Film', wave: 'AudioLines', cc: 'Captions', pdf: 'FileText', doc: 'FileText', slides: 'Presentation', table: 'Sheet', braces: 'Braces',
  code: 'Code', globe: 'Globe', book: 'BookOpen', box: 'Package', disk: 'Disc3', cube: 'Box', type: 'Type', db: 'Database', mail: 'Mail', card: 'Contact', cpu: 'Cpu',
  hex: 'Binary', pen: 'PenTool', check: 'Check', x: 'X', alert: 'TriangleAlert', chevd: 'ChevronDown', chevr: 'ChevronRight', chevl: 'ChevronLeft', chevu: 'ChevronUp',
  dots: 'Ellipsis', grid: 'LayoutGrid', list: 'List', sort: 'ArrowUpDown', filter: 'ListFilter', wrap: 'WrapText', eye: 'Eye', edit: 'PencilLine', layers: 'Layers',
  hash: 'Hash', shield: 'ShieldCheck', down: 'Download', up: 'Upload', merge: 'Merge', split: 'Split', extract: 'PackageOpen', pack: 'PackagePlus', key: 'KeyRound',
  bolt: 'Zap', gpu: 'MonitorCog', clock: 'Clock3', sparkles: 'Sparkles', heart: 'Heart', insta: 'Instagram', star: 'Star', refresh: 'RefreshCw', wand: 'Wand2',
  move: 'Move', ruler: 'Ruler', palette: 'Palette', lock: 'Lock', unlock: 'LockOpen', send: 'Send', paperclip: 'Paperclip', terminal: 'SquareTerminal', table2: 'Table2',
  sigma: 'Sigma', arrowr: 'ArrowRight', arrowl: 'ArrowLeft', dot: 'Circle', loader: 'LoaderCircle', moon: 'Moon', hand: 'Hand', light: 'Lightbulb', target: 'Crosshair',
  rows: 'Rows3', cols: 'Columns3', bookopen: 'BookOpenText', panel: 'PanelRight', gauge: 'Gauge', music: 'Music', video: 'Clapperboard', text: 'Text', fileplus: 'FilePlus2', stop: 'Square',
};
const cache = new Map();
function node2svg(n) { return n.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join(''); }
export function icon(name, size = 18, extra = '') {
  const k = name + size + extra; if (cache.has(k)) return cache.get(k);
  const key = MAP[name] || name; const n = L[key] || (L.icons && L.icons[key]) || L.File;
  const s = `<svg class="ic ${extra}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${node2svg(n)}</svg>`;
  cache.set(k, s); return s;
}
export const catIcon = c => ({ image: 'image', raw: 'camera', vector: 'pen', video: 'film', audio: 'wave', subtitle: 'cc', pdf: 'pdf', doc: 'doc', office: 'doc', slides: 'slides', sheet: 'table', data: 'braces', code: 'code', web: 'globe', ebook: 'book', comic: 'bookopen', archive: 'box', disk: 'disk', model: 'cube', font: 'type', database: 'db', email: 'mail', contact: 'card', exe: 'cpu', torrent: 'link', binary: 'hex', folder: 'folder' }[c] || 'file');
