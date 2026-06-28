// ==========================================
// ch3-waveguide.js - 第三章：导行电磁波 (矩形波导)
// 职责: TE/TM 模式展示 + 行波传播动画 +
//       截止衰减 + 横截面热力图
// 核心: 用 3D 场曲面直观展示波导内场分布
// ==========================================

const ch3_config = {
    mode: 'TE10',
    f_over_fc: 1.5,
    a: 14,
    b: 7,
    zMax: 30
};

// 3D 对象
let ch3_canvas, ch3_ctx, ch3_texture;
let ch3_surfaceGeom, ch3_surfaceMesh;
let ch3_sliceMeshes = [];
const ch3_coordColors = new Float32Array(0);
// 电场线和磁场线的引用
let ch3_eFieldLineGroup = null;
let ch3_hFieldLineGroup = null;

// ---------- 场分量计算 ----------
function calcFieldAt(mode, xWall, yWall, z, beta, alpha, cutoff, w) {
    let Ex = 0, Ey = 0, Ez = 0;
    let Hx = 0, Hy = 0, Hz = 0;

    const pf = cutoff
        ? Math.exp(-alpha * z) * Math.cos(w * globalTime)
        : Math.cos(w * globalTime - beta * z);
    const pfQ = cutoff
        ? Math.exp(-alpha * z) * Math.cos(w * globalTime)
        : Math.sin(w * globalTime - beta * z);

    const a = ch3_config.a;
    const b = ch3_config.b;

    if (mode === 'TE10') {
        Ey =  Math.sin(Math.PI * xWall / a) * pf;
        Hx = -Math.sin(Math.PI * xWall / a) * pf;
        Hz = -Math.cos(Math.PI * xWall / a) * pfQ;
    } else if (mode === 'TE20') {
        Ey =  Math.sin(2 * Math.PI * xWall / a) * pf;
        Hx = -Math.sin(2 * Math.PI * xWall / a) * pf;
        Hz = -Math.cos(2 * Math.PI * xWall / a) * pfQ;
    } else if (mode === 'TE11') {
        Ex =  (Math.PI / b) * Math.cos(Math.PI * xWall / a) * Math.sin(Math.PI * yWall / b) * pf;
        Ey = -(Math.PI / a) * Math.sin(Math.PI * xWall / a) * Math.cos(Math.PI * yWall / b) * pf;
        Hx =  (Math.PI / a) * Math.sin(Math.PI * xWall / a) * Math.cos(Math.PI * yWall / b) * pf;
        Hy =  (Math.PI / b) * Math.cos(Math.PI * xWall / a) * Math.sin(Math.PI * yWall / b) * pf;
        Hz =  Math.cos(Math.PI * xWall / a) * Math.cos(Math.PI * yWall / b) * pfQ;
    } else if (mode === 'TM11') {
        Ex = -(Math.PI / a) * Math.cos(Math.PI * xWall / a) * Math.sin(Math.PI * yWall / b) * pf;
        Ey = -(Math.PI / b) * Math.sin(Math.PI * xWall / a) * Math.cos(Math.PI * yWall / b) * pf;
        Ez =  Math.sin(Math.PI * xWall / a) * Math.sin(Math.PI * yWall / b) * pfQ;
        Hx =  (Math.PI / b) * Math.sin(Math.PI * xWall / a) * Math.cos(Math.PI * yWall / b) * pf;
        Hy = -(Math.PI / a) * Math.cos(Math.PI * xWall / a) * Math.sin(Math.PI * yWall / b) * pf;
    }

    return { Ex, Ey, Ez, Hx, Hy, Hz };
}

// ---------- 渲染截面热力图 ----------
function renderHeatmap(ctx, cw, ch, mode, t, cutoff) {
    const { a, b } = ch3_config;
    const pf = Math.cos(t);
    const data = ctx.getImageData(0, 0, cw, ch).data;
    const out = new Uint8ClampedArray(data.length);
    const isTE10like = (mode === 'TE10' || mode === 'TE20');

    for (let py = 0; py < ch; py++) {
        for (let px = 0; px < cw; px++) {
            const xWall = (px / cw) * a;
            const yWall = ((ch - 1 - py) / ch) * b;
            let val = 0;

            if (isTE10like) {
                const m = mode === 'TE10' ? 1 : 2;
                val = Math.sin(m * Math.PI * xWall / a) * pf;
            } else {
                const f = calcFieldAt(mode, xWall, yWall, 0, 0, 0, cutoff, 0);
                // 纵向场：TE展示Hz，TM展示Ez
                val = mode === 'TE11' ? f.Hz : f.Ez;
            }

            const idx = (py * cw + px) * 4;
            const I = Math.min(1, Math.abs(val));
            out[idx]     = val > 0 ? Math.min(255, I * 240 + 15) : 6;
            out[idx + 1] = 4;
            out[idx + 2] = val < 0 ? Math.min(255, I * 240 + 15) : 6;
            out[idx + 3] = 220;
        }
    }
    ctx.putImageData(new ImageData(out, cw, ch), 0, 0);
}

// ---------- 初始化 ----------
function initChapter3() {
    const group = sceneGroups.ch3;
    const { a, b, zMax } = ch3_config;

    // ========== 1. 波导外壳 ==========
    const boxGeo = new THREE.BoxGeometry(a, b, zMax);
    group.add(new THREE.LineSegments(
        new THREE.EdgesGeometry(boxGeo),
        new THREE.LineBasicMaterial({ color: 0x0284c7, transparent: true, opacity: 0.12 })
    ).translateZ(zMax / 2));

    // 底面网格辅助 (z-x 平面)
    for (let k = 0; k <= 10; k++) {
        const z0 = (k / 10) * zMax;
        group.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-a/2, -b/2, z0), new THREE.Vector3(a/2, -b/2, z0)
            ]),
            new THREE.LineBasicMaterial({ color: 0x1a2740, transparent: true, opacity: 0.3 })
        ));
    }

    // ========== 2. 入口截面热力图 ==========
    ch3_canvas = document.createElement('canvas');
    ch3_canvas.width = 280; ch3_canvas.height = 140;
    ch3_ctx = ch3_canvas.getContext('2d');
    ch3_texture = new THREE.CanvasTexture(ch3_canvas);

    const crossMat = new THREE.MeshBasicMaterial({
        map: ch3_texture, transparent: true, opacity: 0.85,
        side: THREE.DoubleSide, depthWrite: false
    });
    group.add(new THREE.Mesh(new THREE.PlaneGeometry(a, b), crossMat).translateZ(0.1));

    // 截面框
    const bPts = [[-a/2,-b/2],[a/2,-b/2],[a/2,b/2],[-a/2,b/2],[-a/2,-b/2]]
        .map(p => new THREE.Vector3(p[0], p[1], 0.1));
    group.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(bPts),
        new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5 })
    ));

    // ========== 3. 3D 场曲面 (核心展示) ==========
    // 在 x-z 平面 (y=0) 上创建一个网格曲面
    // x 方向 20 格, z 方向 50 格
    const nx = 20, nz = 50;
    const vertices = [];
    const indices = [];
    const colors = [];

    for (let iz = 0; iz <= nz; iz++) {
        for (let ix = 0; ix <= nx; ix++) {
            const xPos = (ix / nx) * a - a/2;
            const zPos = (iz / nz) * zMax;
            vertices.push(xPos, 0, zPos);
            colors.push(0.5, 0.5, 0.5);
        }
    }

    for (let iz = 0; iz < nz; iz++) {
        for (let ix = 0; ix < nx; ix++) {
            const i0 = iz * (nx+1) + ix;
            const i1 = i0 + 1;
            const i2 = (iz+1) * (nx+1) + ix;
            const i3 = i2 + 1;
            indices.push(i0, i1, i2, i1, i3, i2);
        }
    }

    ch3_surfaceGeom = new THREE.BufferGeometry();
    ch3_surfaceGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    ch3_surfaceGeom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
    ch3_surfaceGeom.setIndex(indices);
    ch3_surfaceGeom.computeVertexNormals();

    const surfMat = new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: true, opacity: 0.85,
        side: THREE.DoubleSide
    });
    ch3_surfaceMesh = new THREE.Mesh(ch3_surfaceGeom, surfMat);
    group.add(ch3_surfaceMesh);

    // 场曲面的边框线 (网格线)
    const wireMat = new THREE.LineBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.08
    });
    const wireGeo = new THREE.WireframeGeometry(ch3_surfaceGeom.clone());
    const wireframe = new THREE.LineSegments(wireGeo, wireMat);
    group.add(wireframe);

    // ========== 4. 标注 ==========
    function makeLabel(text, pos, color, size = 4) {
        const c = document.createElement('canvas');
        c.width = 200; c.height = 50;
        const cx = c.getContext('2d');
        cx.font = 'Bold 24px Consolas';
        cx.textAlign = 'center'; cx.textBaseline = 'middle';
        cx.shadowColor = 'rgba(0,0,0,0.9)'; cx.shadowBlur = 6;
        cx.fillStyle = color;
        cx.fillText(text, 100, 25);
        const tex = new THREE.CanvasTexture(c); tex.needsUpdate = true;
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
        s.scale.set(size, size*0.25, 1);
        s.position.copy(pos);
        group.add(s);
    }
    makeLabel('E=0', new THREE.Vector3(-a/2-1, 0, 0), '#ef444466');
    makeLabel('E=0', new THREE.Vector3(a/2+1, 0, 0), '#ef444466');
    makeLabel('传播方向 z', new THREE.Vector3(0, -b/2-1.5, zMax/2), '#60a5fa');

    // 图例
    const legC = document.createElement('canvas');
    legC.width = 170; legC.height = 90;
    const lcx = legC.getContext('2d');
    lcx.font = '12px Consolas';
    lcx.fillStyle = '#94a3b8'; lcx.fillText('纵向场 (红正蓝负)', 4, 16);
    lcx.fillStyle = '#EF4444'; lcx.fillText('E 箭头 = 横向场方向', 4, 38);
    lcx.fillStyle = '#94a3b8'; lcx.fillText('TE:Hz  TM:Ez', 4, 58);
    lcx.fillStyle = '#3B82F6'; lcx.fillText('H 箭头(仅TE)', 4, 78);
    const legTex = new THREE.CanvasTexture(legC); legTex.needsUpdate = true;
    const leg = new THREE.Sprite(new THREE.SpriteMaterial({ map: legTex, transparent: true, depthTest: false }));
    leg.scale.set(3, 1.8, 1);
    leg.position.set(-a/2-1, b/2+1, 0.5);
    group.add(leg);

    // ========== 5. 电场/磁场方向箭头 (在 3D 曲面附近辅助理解) ==========
    // 在 x 方向取 5 列, z 方向取 8 排, 每个位置放 E 和 H 箭头
    // 全部使用 ArrowHelper
    const arrowData = [];
    const eArrowGroup = new THREE.Group();
    const hArrowGroup = new THREE.Group();
    group.add(eArrowGroup);
    group.add(hArrowGroup);

    const arrowXPos = [];
    for (let i = 0; i < 5; i++) arrowXPos.push(((i + 0.5) / 5) * a);

    for (const xWall of arrowXPos) {
        for (let k = 0; k < 8; k++) {
            const zPos = ((k + 0.5) / 8) * zMax;
            const x3D = xWall - a/2;

            const aE = new THREE.ArrowHelper(
                new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(x3D, 0, zPos),
                0.01, 0xEF4444, 0.5, 0.2
            );
            aE.visible = true;
            eArrowGroup.add(aE);

            const aH = new THREE.ArrowHelper(
                new THREE.Vector3(1, 0, 0),
                new THREE.Vector3(x3D, 0, zPos),
                0.01, 0x3B82F6, 0.5, 0.2
            );
            aH.visible = true;
            hArrowGroup.add(aH);

            arrowData.push({ aE, aH, x3D, xWall, zPos });
        }
    }

    // 把箭头数据存到配置里供更新使用
    ch3_config._arrowData = arrowData;

    // ---------- 事件绑定 ----------
    document.getElementById('ch3-freq-slider').addEventListener('input', (e) => {
        ch3_config.f_over_fc = parseFloat(e.target.value);
        document.getElementById('ch3-freq-val').innerText =
            ch3_config.f_over_fc.toFixed(2) + 'x';
        updateMathCh3();
    });
}

// ---------- 逐帧更新 ----------
function updateChapter3() {
    const { mode, f_over_fc, a, b, zMax } = ch3_config;
    const w = 3.0;
    const cutoff = f_over_fc < 1.0;

    // 状态灯
    document.getElementById('ch3-status-badge').style.borderColor = cutoff ? '#991b1b' : '#166534';
    const st = document.getElementById('ch3-status-text');
    st.innerText = cutoff ? '截止 (CUTOFF)' : '传播 (PROPAGATING)';
    st.style.color = cutoff ? '#ef4444' : '#22c55e';

    let beta = 0, alpha = 0;
    if (cutoff) alpha = Math.sqrt(1.0 - f_over_fc * f_over_fc) * 0.6;
    else beta = Math.sqrt(f_over_fc * f_over_fc - 1.0) * 0.8;

    const isTE10like = (mode === 'TE10' || mode === 'TE20');

    // === 1. 更新截面热力图 ===
    renderHeatmap(ch3_ctx, 280, 140, mode, w * globalTime, cutoff);
    ch3_ctx.font = 'Bold 15px Consolas';
    ch3_ctx.fillStyle = cutoff ? 'rgba(239,68,68,0.8)' : 'rgba(200,200,230,0.8)';
    ch3_ctx.textAlign = 'right'; ch3_ctx.textBaseline = 'top';
    ch3_ctx.fillText(mode + (cutoff ? ' CUT' : ''), 278, 4);
    ch3_texture.needsUpdate = true;

    // === 2. 更新 3D 场曲面 (核心) ===
    const pos = ch3_surfaceGeom.attributes.position;
    const col = ch3_surfaceGeom.attributes.color;
    const nx = 20, nz = 50;

    for (let iz = 0; iz <= nz; iz++) {
        for (let ix = 0; ix <= nx; ix++) {
            const i = iz * (nx+1) + ix;
            const xPos = (ix / nx) * a - a/2;
            const xWall = (ix / nx) * a;
            const zPos = (iz / nz) * zMax;

            let eVal = 0;
            if (isTE10like) {
                const m = mode === 'TE10' ? 1 : 2;
                const pf = cutoff
                    ? Math.exp(-alpha * zPos) * Math.cos(w * globalTime)
                    : Math.cos(w * globalTime - beta * zPos);
                eVal = Math.sin(m * Math.PI * xWall / a) * pf;
            } else {
                // 高阶模：展示纵向场分量，TE=Hz、TM=Ez，两者分布完全不同
                const yCut = 0.25 * b;
                const f = calcFieldAt(mode, xWall, yCut, zPos, beta, alpha, cutoff, w);
                // TE11 展示 Hz，TM11 展示 Ez
                const zField = mode === 'TE11' ? f.Hz : f.Ez;
                eVal = zField;
            }

            // y 坐标 = 场幅值
            const disp = eVal * 2.5;
            pos.array[i * 3 + 1] = disp;

            // 颜色：红色(正) / 蓝色(负)
            const I = Math.min(1, Math.abs(eVal));
            col.array[i * 3]     = eVal > 0 ? 0.05 + I * 0.9 : 0.02;
            col.array[i * 3 + 1] = 0.01;
            col.array[i * 3 + 2] = eVal < 0 ? 0.05 + I * 0.9 : 0.02;
        }
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    ch3_surfaceGeom.computeVertexNormals();

    // === 3. 更新电场/磁场方向箭头 (辅助理解场方向) ===
    const yCut = isTE10like ? b/2 : 0.25 * b;
    const arrowData = ch3_config._arrowData || [];
    for (const ad of arrowData) {
        const f = calcFieldAt(mode, ad.xWall, yCut, ad.zPos, beta, alpha, cutoff, w);

        // E 箭头
        const eMag = Math.sqrt(f.Ex * f.Ex + f.Ey * f.Ey);
        if (eMag > 0.01) {
            let eLen = Math.min(eMag * 2.0, 3.5);
            if (isTE10like) {
                // TE10/TE20: E 只有竖直方向
                ad.aE.setDirection(new THREE.Vector3(0, f.Ey > 0 ? 1 : -1, 0));
            } else {
                // TE11/TM11: E 有 x 和 y 两个方向
                const eDir = new THREE.Vector3(f.Ex, f.Ey, 0).normalize();
                ad.aE.setDirection(eDir);
            }
            ad.aE.setLength(eLen, Math.min(eLen * 0.32, 0.3), Math.min(eLen * 0.14, 0.12));
            ad.aE.visible = true;
        } else {
            ad.aE.visible = false;
        }

        // H 箭头 (水平) — 仅在 TE 模式下
        if (isTE10like && Math.abs(f.Hx) > 0.01) {
            const hLen = Math.min(Math.abs(f.Hx) * 0.8, 2.0);
            ad.aH.setDirection(new THREE.Vector3(f.Hx > 0 ? 1 : -1, 0, 0));
            ad.aH.setLength(hLen, Math.min(hLen * 0.32, 0.25), Math.min(hLen * 0.14, 0.1));
            ad.aH.visible = true;
        } else {
            ad.aH.visible = false;
        }
    }
}

// ---------- 模式切换 ----------
window.setWaveguideMode = function (mode) {
    ch3_config.mode = mode;
    ['TE10', 'TE20', 'TE11', 'TM11'].forEach((m) => {
        document.getElementById('ch3-mode-' + m.toLowerCase()).className =
            m === mode ? 'btn btn-primary' : 'btn';
    });
    gsapCameraMove(22, 8, 28);
    controls.target.set(0, 0, ch3_config.zMax / 2);
    updateMathCh3();
};

// ---------- 数学公式渲染 ----------
function updateMathCh3() {
    const { mode, f_over_fc } = ch3_config;
    const cutoff = f_over_fc < 1.0;

    katex.render(
        `\\text{截止频率: } f_c = \\frac{c}{2} \\sqrt{\\left(\\frac{m}{a}\\right)^2 + \\left(\\frac{n}{b}\\right)^2}`,
        document.getElementById('eq-ch3-cutoff'), { displayMode: true });

    const betaStr = cutoff
        ? `\\beta = -j\\alpha, \\; \\alpha = k_c\\sqrt{1-(f/f_c)^2} \\;\\text{(截止衰减)}`
        : `\\beta = k\\sqrt{1-(f_c/f)^2} \\approx ${(Math.sqrt(f_over_fc * f_over_fc - 1.0) * 0.8).toFixed(2)} \\text{ rad/m}`;
    katex.render(betaStr, document.getElementById('eq-ch3-beta'), { displayMode: true });
}
