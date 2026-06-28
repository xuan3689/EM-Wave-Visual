// ==========================================
// ch4-dipole-radiation.js - 电基本振子
// 沿 Z 轴的均匀电流元 I·dl
// 近区: 偶极子场线 r = C·sin²θ 嵌套族
// 远区: 扩散波前 + sinθ 方向图
// ==========================================

const ch4_config = {
    mode: 'near',
    dipoleHalf: 1.2,
    numELines: 12,
    numHRings: 6,
    farRings: 10
};

let ch4_dipole = null, ch4_glow = null, ch4_arrow = null;
let ch4_eGroup = null, ch4_hGroup = null;
let ch4_waveGroup = null, ch4_pattern = null;
const ch4_hRings = [];

// ---------- 偶极子场线生成 ----------
// 静电偶极子场线方程: r = C·sin²θ
// 所有方位角同步脉动，严格对称
function genLines(numLines, t, halfLen) {
    const lines = [];
    const omega = 2.0;
    const amp = 0.6 + 0.4 * Math.abs(Math.cos(omega * t));
    const steps = 100;
    // 所有线共用一个 C 值，只在方位角上旋转
    const C = 4.5 * amp;

    for (let i = 0; i < numLines; i++) {
        const phi = (i / numLines) * Math.PI * 2;
        const pts = [];

        for (let j = 0; j <= steps; j++) {
            const u = (j / steps) * Math.PI;
            const su = Math.sin(u);
            const cu = Math.cos(u);

            // 偶极子场线方程: r = C·sin²θ
            const r = C * su * su;
            // 径向距离 ρ = r·sinθ = C·sin³θ
            const rho = r * su;
            // z = cosθ·(r + halfLen)
            const z = cu * (r + halfLen);

            pts.push(new THREE.Vector3(
                rho * Math.cos(phi),
                rho * Math.sin(phi),
                z
            ));
        }
        lines.push(pts);
    }
    return lines;
}

// ---------- 水平圆环 ----------
function makeRing(radius, zPos, segs) {
    const pts = [];
    for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        pts.push(new THREE.Vector3(radius * Math.cos(a), radius * Math.sin(a), zPos));
    }
    return pts;
}

// ---------- 初始化 ----------
function initChapter4() {
    const g = sceneGroups.ch4;
    const h = ch4_config.dipoleHalf;

    // === 1. 电基本振子 ===
    const mat = new THREE.MeshLambertMaterial({ color: 0xcbd5e1 });
    const cyl = new THREE.CylinderGeometry(0.06, 0.06, h * 2, 12);
    ch4_dipole = new THREE.Mesh(cyl, mat);
    ch4_dipole.rotation.x = Math.PI / 2;
    g.add(ch4_dipole);

    const cap = new THREE.SphereGeometry(0.09, 8, 8);
    let m = new THREE.Mesh(cap, mat); m.position.set(0, 0, h); g.add(m);
    m = new THREE.Mesh(cap, mat); m.position.set(0, 0, -h); g.add(m);

    ch4_arrow = new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -0.6),
        1.2, 0xFBBF24, 0.3, 0.15
    );
    g.add(ch4_arrow);

    ch4_glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xF59E0B })
    );
    g.add(ch4_glow);

    function tag(txt, pos, clr, sz) {
        const c = document.createElement('canvas');
        c.width = 160; c.height = 36;
        const cx = c.getContext('2d');
        cx.font = 'Bold 15px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
        cx.shadowColor = '#000e'; cx.shadowBlur = 6; cx.fillStyle = clr;
        cx.fillText(txt, 80, 18);
        const t = new THREE.CanvasTexture(c); t.needsUpdate = true;
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
        s.scale.set(sz || 3, (sz || 3) * 0.22, 1);
        s.position.copy(pos); g.add(s);
    }
    tag('I·dl', new THREE.Vector3(1.0, 0, h + 0.6), '#FBBF24', 2.5);
    tag('Z', new THREE.Vector3(0, 0, 6), '#94a3b8');

    // === 2. 近场电场线组 ===
    ch4_eGroup = new THREE.Group();
    g.add(ch4_eGroup);
    const eMat = new THREE.LineBasicMaterial({ color: 0xEF4444, transparent: true, opacity: 0.65 });
    for (let i = 0; i < ch4_config.numELines; i++) {
        const line = new THREE.Line(new THREE.BufferGeometry(), eMat.clone());
        ch4_eGroup.add(line);
    }

    // === 3. 近场磁场环 ===
    ch4_hGroup = new THREE.Group();
    g.add(ch4_hGroup);
    const hMat = new THREE.LineBasicMaterial({ color: 0x3B82F6, transparent: true, opacity: 0.3 });
    for (let i = 0; i < ch4_config.numHRings; i++) {
        const radius = 1.0 + i * 1.6;
        const ring = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(makeRing(radius, 0, 48)),
            hMat.clone()
        );
        ch4_hGroup.add(ring);
        ch4_hRings.push({ mesh: ring, baseR: radius });
    }

    // === 4. 远场波前环（水平同心圆，像水波纹一样向四周扩散） ===
    ch4_waveGroup = new THREE.Group();
    g.add(ch4_waveGroup);
    for (let i = 0; i < ch4_config.farRings; i++) {
        // E 环（红色，水平面内）
        const ePts = makeRing(1 + i * 0.8, 0, 40);
        const eRing = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(ePts),
            new THREE.LineBasicMaterial({ color: 0xEF4444, transparent: true, opacity: 0 })
        );
        ch4_waveGroup.add(eRing);

        // H 环（蓝色，水平面内，稍微缩小一点点以示区分）
        const hPts = makeRing(1 + i * 0.8, 0, 40);
        const hRing = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(hPts),
            new THREE.LineBasicMaterial({ color: 0x3B82F6, transparent: true, opacity: 0 })
        );
        ch4_waveGroup.add(hRing);
    }

    // === 5. sinθ 方向图（旋转体法，Z轴空洞，保证完美对称） ===
    // F(θ) = sinθ, 绕 Z 轴旋转生成 3D 网格
    const nRho = 28, nPhi = 40;  // 经线和纬线数
    const scale = 3.5;
    const verts3 = [], idx3 = [];

    for (let j = 0; j <= nRho; j++) {
        const t = (j / nRho) * Math.PI;          // 0 → π (Z轴极角)
        const r = scale * Math.sin(t);           // sinθ
        const zz = r * Math.cos(t);              // 回投影到Z: scale·sinθ·cosθ
        const rr = r * Math.sin(t);              // 径向距离: scale·sin²θ
        for (let i = 0; i <= nPhi; i++) {
            const p = (i / nPhi) * Math.PI * 2;
            verts3.push(rr * Math.cos(p), rr * Math.sin(p), zz);
        }
    }
    for (let j = 0; j < nRho; j++) {
        for (let i = 0; i < nPhi; i++) {
            const a = j * (nPhi + 1) + i;
            const b = a + 1, c = (j + 1) * (nPhi + 1) + i, d = c + 1;
            idx3.push(a, b, c, b, d, c);
        }
    }
    const patGeo = new THREE.BufferGeometry();
    patGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts3), 3));
    patGeo.setIndex(idx3);
    patGeo.computeVertexNormals();
    ch4_pattern = new THREE.Mesh(
        patGeo,
        new THREE.MeshBasicMaterial({ color: 0xD97706, wireframe: true, transparent: true, opacity: 0 })
    );
    g.add(ch4_pattern);

    // === 图例 ===
    const lc = document.createElement('canvas');
    lc.width = 130; lc.height = 80;
    const lcx = lc.getContext('2d');
    lcx.font = '12px Consolas'; lcx.shadowColor = '#000e'; lcx.shadowBlur = 4;
    lcx.fillStyle = '#EF4444'; lcx.fillText('E 电场线', 4, 18);
    lcx.fillStyle = '#3B82F6'; lcx.fillText('H 磁场环', 4, 38);
    lcx.fillStyle = '#D97706'; lcx.fillText('sinθ 方向图', 4, 58);
    lcx.fillStyle = '#FBBF24'; lcx.fillText('电流方向', 4, 78);
    const lt = new THREE.CanvasTexture(lc); lt.needsUpdate = true;
    const leg = new THREE.Sprite(new THREE.SpriteMaterial({ map: lt, transparent: true, depthTest: false }));
    leg.scale.set(3, 2, 1);
    leg.position.set(-4.5, 3.5, 0);
    g.add(leg);

    setMode('near');
}

function setMode(mode) {
    ch4_config.mode = mode;
    document.getElementById('ch4-btn-near').className = mode === 'near' ? 'btn btn-primary' : 'btn';
    document.getElementById('ch4-btn-far').className = mode === 'far' ? 'btn btn-primary' : 'btn';
    document.getElementById('ch4-near-control').classList.toggle('hidden', mode !== 'near');
    document.getElementById('ch4-far-control').classList.toggle('hidden', mode !== 'far');
    updateMathCh4();
}

// ---------- 逐帧 ----------
function updateChapter4() {
    const { mode, dipoleHalf, numELines, numHRings, farRings } = ch4_config;

    const p = 0.5 + 0.5 * Math.sin(globalTime * 2.0);
    ch4_glow.material.color.setHSL(0.1, 1, 0.4 + 0.5 * p);
    ch4_glow.scale.setScalar(1 + 0.3 * p);
    ch4_arrow.setLength(0.8 + 0.4 * Math.sin(globalTime * 2.0), 0.3, 0.15);

    if (mode === 'near') {
        ch4_waveGroup.visible = false;
        ch4_pattern.visible = false;
        ch4_eGroup.visible = true;
        ch4_hGroup.visible = true;

        const lines = genLines(numELines, globalTime, dipoleHalf);
        const children = ch4_eGroup.children;
        for (let i = 0; i < numELines; i++) {
            if (i < lines.length && lines[i].length > 2) {
                children[i].geometry.setFromPoints(lines[i]);
                children[i].visible = true;
                children[i].material.opacity = 0.35 + 0.35 * (0.6 + 0.4 * Math.abs(Math.cos(globalTime * 2.0)));
            } else { children[i].visible = false; }
        }

        for (let i = 0; i < numHRings; i++) {
            const ring = ch4_hRings[i];
            const r = ring.baseR * (1 + 0.06 * Math.sin(globalTime * 1.5));
            ring.mesh.geometry.setFromPoints(makeRing(r, 0, 48));
            ring.mesh.material.opacity = 0.15 + 0.15 * (0.6 + 0.4 * Math.abs(Math.cos(globalTime * 1.5)));
        }
    } else {
        ch4_eGroup.visible = false;
        ch4_hGroup.visible = false;
        ch4_waveGroup.visible = true;
        ch4_pattern.visible = true;

        const children = ch4_waveGroup.children;
        const maxR = farRings * 0.8 + 2;
        const phase = globalTime * 0.8;
        for (let i = 0; i < farRings; i++) {
            const r = ((0.8 + i * 0.8) + phase) % maxR;
            const norm = r / maxR;
            const op = norm < 0.7 ? Math.sin(norm * Math.PI / 0.7) * 0.45 : Math.max(0, 1 - norm) * 0.15;

            children[2*i].geometry.setFromPoints(makeRing(r, 0, 40));
            children[2*i].material.opacity = op;
            children[2*i].visible = true;

            const rH = ((0.8 + i * 0.8) + phase + 1.2) % maxR;
            const normH = rH / maxR;
            const opH = normH < 0.7 ? Math.sin(normH * Math.PI / 0.7) * 0.35 : Math.max(0, 1 - normH) * 0.12;

            children[2*i + 1].geometry.setFromPoints(makeRing(rH, 0, 40));
            children[2*i + 1].material.opacity = opH;
            children[2*i + 1].visible = true;
        }

        ch4_pattern.material.opacity = 0.4;
        const s = 1.0 + 0.02 * Math.sin(globalTime * 2.0);
        ch4_pattern.scale.setScalar(s);
    }
}

window.setAntennaMode = function (mode) { setMode(mode); };

function updateMathCh4() {
    const s = ch4_config.mode === 'near'
        ? '\\text{电基本振子近区: } r = C \\cdot \\sin^2\\theta \\text{（场线方程）} \\\\' +
          'E_r \\propto \\frac{2\\cos\\theta}{r^3}, \\quad E_\\theta \\propto \\frac{\\sin\\theta}{r^3} \\quad \\text{(静电场主导)}'
        : '\\text{电基本振子远区: } E_\\theta = j\\eta \\frac{I_0 l e^{-jkr}}{2\\lambda r} \\sin\\theta \\\\' +
          'F(\\theta) = \\sin\\theta \\quad \\text{赤道面最强，轴向为零}';
    katex.render(s, document.getElementById('eq-ch4-model'), { displayMode: true });
}
