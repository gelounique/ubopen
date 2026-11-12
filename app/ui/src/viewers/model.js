// 3D-Viewer: STL, OBJ, glTF/GLB, FBX, PLY, 3MF, DAE, 3DS, VRML, AMF, VTK, PCD, XYZ, USDZ, LWO, KMZ, MD2, LDraw, G-Code
// Studio-Licht, Chrom/Clay/Original/Wireframe, Maße in mm (3D-Druck), Export in STL/OBJ/GLB/glTF/PLY/USDZ, Render als PNG
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { TDSLoader } from 'three/examples/jsm/loaders/TDSLoader.js';
import { VRMLLoader } from 'three/examples/jsm/loaders/VRMLLoader.js';
import { AMFLoader } from 'three/examples/jsm/loaders/AMFLoader.js';
import { VTKLoader } from 'three/examples/jsm/loaders/VTKLoader.js';
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js';
import { XYZLoader } from 'three/examples/jsm/loaders/XYZLoader.js';
import { USDZLoader } from 'three/examples/jsm/loaders/USDZLoader.js';
import { LWOLoader } from 'three/examples/jsm/loaders/LWOLoader.js';
import { KMZLoader } from 'three/examples/jsm/loaders/KMZLoader.js';
import { MD2Loader } from 'three/examples/jsm/loaders/MD2Loader.js';
import { LDrawLoader } from 'three/examples/jsm/loaders/LDrawLoader.js';
import { GCodeLoader } from 'three/examples/jsm/loaders/GCodeLoader.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { PLYExporter } from 'three/examples/jsm/exporters/PLYExporter.js';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';
import { h, btn, seg, toast, err, busy, fileUrl, join, dir, stem, menu } from '../util.js';
const ub = window.ub;

export async function loadModel(path, ext) {
  const url = fileUrl(path);
  const buf = () => ub.read(path).then(b => new Uint8Array(b).buffer);
  const txt = () => ub.readText(path).then(r => r.text);
  const meshOf = g => new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xdddde2, metalness: 0.1, roughness: 0.55 }));
  switch (ext) {
    case 'stl': { const g = new STLLoader().parse(await buf()); g.computeVertexNormals(); return meshOf(g); }
    case 'obj': {
      const loader = new OBJLoader(); const mtlPath = path.replace(/\.obj$/i, '.mtl');
      if (await ub.exists(mtlPath)) { try { const m = await new MTLLoader().setResourcePath(fileUrl(dir(path)) + '/').parse(await ub.readText(mtlPath).then(r => r.text), ''); m.preload(); loader.setMaterials(m); } catch { } }
      return loader.parse(await txt());
    }
    case 'gltf': case 'glb': return (await new GLTFLoader().loadAsync(url)).scene;
    case 'fbx': return new FBXLoader().parse(await buf(), fileUrl(dir(path)) + '/');
    case 'ply': { const g = new PLYLoader().parse(await buf()); g.computeVertexNormals(); return g.index || g.attributes.normal ? new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: !!g.attributes.color, color: g.attributes.color ? 0xffffff : 0xdddde2, roughness: .55 })) : new THREE.Points(g, new THREE.PointsMaterial({ size: 0.01, vertexColors: !!g.attributes.color })); }
    case '3mf': return new ThreeMFLoader().parse(await buf());
    case 'dae': return new ColladaLoader().parse(await txt(), fileUrl(dir(path)) + '/').scene;
    case '3ds': return new TDSLoader().parse(await buf(), fileUrl(dir(path)) + '/');
    case 'wrl': case 'vrml': return new VRMLLoader().parse(await txt(), fileUrl(dir(path)) + '/');
    case 'amf': return new AMFLoader().parse(await buf());
    case 'vtk': case 'vtp': { const g = new VTKLoader().parse(await buf(), ''); g.computeVertexNormals(); return meshOf(g); }
    case 'pcd': return new PCDLoader().parse(await buf());
    case 'xyz': { const g = new XYZLoader().parse(await txt()); return new THREE.Points(g, new THREE.PointsMaterial({ size: 0.02, vertexColors: !!g.attributes.color, color: 0xffb6d5 })); }
    case 'usdz': return new USDZLoader().parse(await buf());
    case 'lwo': return (await new LWOLoader().loadAsync(url)).meshes.reduce((g, m) => (g.add(m), g), new THREE.Group());
    case 'kmz': return (await new KMZLoader().loadAsync(url)).scene;
    case 'md2': { const g = new MD2Loader().parse(await buf()); g.computeVertexNormals(); return meshOf(g); }
    case 'ldr': case 'mpd': { const l = new LDrawLoader(); l.setPartsLibraryPath(fileUrl(dir(path)) + '/'); return await l.loadAsync(url); }
    case 'gcode': case 'gco': case 'nc': return new GCodeLoader().parse(await txt());
    default: throw new Error('3D-Format .' + ext + ' wird nicht unterstützt');
  }
}
export function exportModel(obj, fmt) {
  return new Promise((res, rej) => {
    try {
      if (fmt === 'stl') return res(new STLExporter().parse(obj, { binary: true }));
      if (fmt === 'obj') return res(new OBJExporter().parse(obj));
      if (fmt === 'ply') return new PLYExporter().parse(obj, r => res(r), { binary: true });
      if (fmt === 'glb' || fmt === 'gltf') return new GLTFExporter().parse(obj, r => res(fmt === 'glb' ? r : JSON.stringify(r, null, 1)), rej, { binary: fmt === 'glb', onlyVisible: true });
      if (fmt === 'usdz') return new USDZExporter().parseAsync ? new USDZExporter().parseAsync(obj).then(res, rej) : new USDZExporter().parse(obj).then(res, rej);
      rej(new Error('Unbekanntes Exportformat'));
    } catch (e) { rej(e); }
  });
}

export default {
  async mount(ctx) {
    const { el, bar, file } = ctx;
    const wrap = h('div', { class: 'm3d' }); el.append(wrap);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
    wrap.append(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x050506);
    const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const cam = new THREE.PerspectiveCamera(40, 1, 0.01, 1e6);
    const ctl = new OrbitControls(cam, renderer.domElement); ctl.enableDamping = true;
    const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 5, 4); scene.add(key, new THREE.AmbientLight(0xffffff, 0.25));
    const rim = new THREE.DirectionalLight(0xffb6d5, 1.2); rim.position.set(-4, 2, -4); scene.add(rim);
    busy(el, true, 'Lade 3D-Modell …');
    let obj; try { obj = await loadModel(file.path, file.real); } finally { busy(el, false); }
    // Z-up (STL/3MF/AMF aus Slicern) aufrichten
    if (['stl', '3mf', 'amf'].includes(file.real)) obj.rotation.x = -Math.PI / 2;
    const pivot = new THREE.Group(); pivot.add(obj); scene.add(pivot);
    pivot.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(pivot); const size = box.getSize(new THREE.Vector3()); const center = box.getCenter(new THREE.Vector3());
    obj.position.sub(center); obj.position.y += size.y / 2;
    const R = Math.max(size.x, size.y, size.z) || 1;
    const grid = new THREE.GridHelper(R * 4, 20, 0x333338, 0x1a1a1e); scene.add(grid);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R * 3, 64), new THREE.MeshStandardMaterial({ color: 0x0a0a0c, metalness: .9, roughness: .35 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.001; scene.add(floor);
    cam.position.set(R * 1.4, R * 1.0, R * 1.8); ctl.target.set(0, size.y / 2, 0); cam.near = R / 1000; cam.far = R * 100; cam.updateProjectionMatrix();
    // Statistik
    let tris = 0, verts = 0, meshes = 0; const orig = new Map();
    obj.traverse(o => { if (o.isMesh || o.isPoints || o.isLine) { meshes++; const g = o.geometry; if (g) { const n = g.attributes.position ? g.attributes.position.count : 0; verts += n; tris += g.index ? g.index.count / 3 : n / 3; } orig.set(o, o.material); } });
    const mm = v => v.toFixed(v < 10 ? 2 : 1);
    ctx.info('3D-Modell', [['Maße', `${mm(size.x)} × ${mm(size.z)} × ${mm(size.y)}`], ['Einheit', ['stl', '3mf', 'amf', 'gcode'].includes(file.real) ? 'mm (Slicer)' : 'Szeneneinheiten'], ['Dreiecke', Math.round(tris).toLocaleString('de-DE')], ['Punkte', verts.toLocaleString('de-DE')], ['Objekte', meshes]], '3d');
    ctx.status([`${mm(size.x)} × ${mm(size.z)} × ${mm(size.y)}`, Math.round(tris).toLocaleString('de-DE') + ' Dreiecke']);
    const MATS = { chrome: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.08 }), clay: new THREE.MeshStandardMaterial({ color: 0xd8d4cf, metalness: 0, roughness: 0.9 }), pink: new THREE.MeshPhysicalMaterial({ color: 0xffb6d5, metalness: 0, roughness: 0.25, clearcoat: 1 }), normal: new THREE.MeshNormalMaterial() };
    function setMat(m) { obj.traverse(o => { if (o.isMesh) { o.material = m === 'orig' ? orig.get(o) : m === 'wire' ? new THREE.MeshBasicMaterial({ color: 0xffb6d5, wireframe: true }) : MATS[m]; } }); }
    let raf, auto = false;
    const resize = () => { const r = wrap.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); cam.aspect = r.width / Math.max(1, r.height); cam.updateProjectionMatrix(); };
    const ro = new ResizeObserver(resize); ro.observe(wrap); resize();
    const loop = () => { if (auto) pivot.rotation.y += 0.006; ctl.update(); renderer.render(scene, cam); raf = requestAnimationFrame(loop); }; loop();
    async function snap() { renderer.render(scene, cam); const d = renderer.domElement.toDataURL('image/png'); const out = await ub.outPath(file.path, 'png'); const b = await (await fetch(d)).arrayBuffer(); await ub.write(out, new Uint8Array(b)); ub.copyImageData(d); toast('Render gespeichert & kopiert', 'ok', { action: { label: 'Öffnen', fn: () => ctx.open(out) } }); }
    async function exp(fmt) { const out = await ub.saveDialog({ defaultPath: join(dir(file.path), stem(file.path) + '.' + fmt) }); if (!out) return; const t = toast('Exportiere …', 'busy', { sticky: true }); try { pivot.updateMatrixWorld(true); const r = await exportModel(obj, fmt); await ub.write(out, typeof r === 'string' ? new TextEncoder().encode(r) : new Uint8Array(r.buffer ? r.buffer : r)); t.kill(); toast('Exportiert: ' + out.split(/[\\/]/).pop(), 'ok', { action: { label: 'Öffnen', fn: () => ctx.open(out) } }); } catch (e) { t.kill(); err(e); } }
    bar.append(seg([{ v: 'orig', l: 'Original' }, { v: 'chrome', l: 'Chrom' }, { v: 'clay', l: 'Clay' }, { v: 'pink', l: 'Pink' }, { v: 'normal', l: 'Normalen' }, { v: 'wire', l: 'Gitter' }], 'orig', setMat, 'sm'), h('div', { class: 'tsep' }),
      btn('refresh', '', e => { auto = !auto; e.currentTarget.classList.toggle('on', auto); }, '', 'Automatisch drehen'), btn('grid', '', e => { grid.visible = !grid.visible; floor.visible = grid.visible; e.currentTarget.classList.toggle('on', !grid.visible); }, '', 'Boden ein/aus'),
      btn('fit', '', () => { cam.position.set(R * 1.4, R * 1.0, R * 1.8); ctl.target.set(0, size.y / 2, 0); }, '', 'Ansicht zurücksetzen'), btn('camera', 'Render', snap),
      btn('down', 'Export', e => menu(e.currentTarget, [['stl', 'STL (3D-Druck)'], ['obj', 'OBJ'], ['glb', 'GLB'], ['gltf', 'glTF'], ['ply', 'PLY'], ['usdz', 'USDZ (iPhone AR)']].map(([f, l]) => ({ icon: 'cube', label: l, fn: () => exp(f) })))));
    return { destroy: () => { cancelAnimationFrame(raf); ro.disconnect(); ctl.dispose(); renderer.dispose(); pmrem.dispose(); }, object: () => obj };
  }
};
