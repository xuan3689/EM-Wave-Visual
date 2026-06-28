// ==========================================
// ch3-waveguide.js - 第三章：导行电磁波 (矩形波导)
// 职责: TE10/TE20/TE11/TM11 高阶模式、
//       连续波曲线(仿ch1)、截面场分布、色散截止
// ==========================================

// ---------- 章节配置 ----------
const ch3_config = {
    mode: 'TE10',
    f_over_fc: 1.5,
    a: 14,
    b: 7,
    zMax: 30,
    numCurvePoints: 150,   // 每条波曲线的采样点数
    numXProfiles: 5         // x 方向截面采样曲线数
};

// ---------- 3D 对象引用 ----------
let ch3_waveguideBox;
let ch3_crossSection;           // 横截面场分布面 (z=0)
let ch3_crossCanvas, ch3_crossCtx, ch3_crossTex;
const ch3_eCurves = [];         // E 场波曲线数组 {line, xWall}
const ch3_hxCurves = [];        // Hx 场波曲线数组
const ch3_hzCurves = [];        // Hz 纵向场曲线数组
const ch3_vectorArrows = [];    // 精简箭头网格

// ---------- 初始化 ----------
function initChapter3() {
    const group = sceneGroups.ch3;

    // === 1. 金属波导腔线框 ===
    const boxGeo = new THREE.BoxGeometry(ch3_config.a, ch3_config.b, ch3_config.zMax);
    const boxEdges = new THREE.EdgesGeometry(boxGeo);
    const boxLine = new THREE.LineSegments(
        boxEdges,
        new THREE.LineBasicMaterial({ color: 0x0284c7, transparent: true, opacity: 0.8 })
    );
    boxLine.position.set(0, 0, ch3_config.zMax / 2);
    group.add(boxLine);

    // 半透明腔体
    ch3_waveguideBox = new THREE.Mesh(
        boxGeo,
        new THREE.MeshBasicMaterial({ color: 0x075985, transparent: true, opacity: 0.08 })
    );
    ch3_waveguideBox.position.set(0, 0, ch3_config.zMax / 2);
    group.add(ch3_waveguideBox);

    // === 2. 连续 E 场波曲线 (仿 ch1 模式) ===
    for (let i = 0; i < ch3_config.numXProfiles; i++) {
        // x 从壁到壁均匀采样，用于展示横截面场分布
        const xWall = ((i + 0.5) / ch3_config.numXProfiles) * ch3_config.a;
        const x3D = xWall - ch3_config.a / 2;

        const geomE = new THREE.BufferGeometry();
        geomE.setAttribute('position',
            new THREE.BufferAttribute(new Float32Array(ch3_config.numCurvePoints * 3), 3));
        const lineE = new THREE.Line(geomE,
            new THREE.LineBasicMaterial({ color: 0xEF4444, linewidth: 1, transparent: true, opacity: 0.9 }));
        group.add(lineE);
        ch3_eCurves.push({ line: lineE, xWall: xWall, x3D: x3D,
            geom: geomE });
    }

    // === 3. 连续 H 场波曲线 (Hx 分量，与 Ey 配对) ===
    for (let i = 0; i < ch3_config.numXProfiles; i++) {
        const xWall = ((i + 0.5) / ch3_config.numXProfiles) * ch3_config.a;
        const x3D = xWall - ch3_config.a / 2;

        const geomHx = new THREE.BufferGeometry();
        geomHx.setAttribute('position',
            new THREE.BufferAttribute(new Float32Array(ch3_config.numCurvePoints * 3), 3));
        const lineHx = new THREE.Line(geomHx,
            new THREE.LineBasicMaterial({ color: 0x3B82F6, linewidth: 1, transparent: true, opacity: 0.9 }));
        group.add(lineHx);
        ch3_hxCurves.push({ line: lineHx, xWall: xWall, x3D: x3D,
            geom: geomHx });
    }

    // === 4. Hz 纵向磁场曲线 (TE 模特有) ===
    for (let i = 0; i < 3; i++) {
        const xWall = ((i + 0.5) / 3) * ch3_config.a;
        const x3D = xWall - ch3_config.a / 2;

        const geomHz = new THREE.BufferGeometry();
        geomHz.setAttribute('position',
            new THREE.BufferAttribute(new Float32Array(ch3_config.numCurvePoints * 3), 3));
        const lineHz = new THREE.Line(geomHz,
            new THREE.LineBasicMaterial({ color: 0x60A5FA, linewidth: 1, transparent: true, opacity: 0.6 }));
        group.add(lineHz);
        ch3_hzCurves.push({ line: lineHz, xWall: xWall, x3D: x3D,
            geom: geomHz });
    }

    // === 5. 精简矢量箭头网格 (沿 3 条特征线排列) ===
    const arrowCols = 12;  // z 向采样
    const profileXWalls = [
        ch3_config.a * 0.25,  // 1/4 处
        ch3_config.a * 0.50,  // 中心
        ch3_config.a * 0.75   // 3/4 处
    ];

    for (let kz = 0; kz < arrowCols; kz++) {
        const z = (kz / (arrowCols - 1)) * ch3_config.zMax;
        for (const xWall of profileXWalls) {
            const x3D = xWall - ch3_config.a / 2;

            const origin = new THREE.Vector3(x3D, 0, z);
            const aE = new THREE.ArrowHelper(
                new THREE.Vector3(0, 1, 0), origin, 0, 0xEF4444, 0.5, 0.2
            );
            const aH = new THREE.ArrowHelper(
                new THREE.Vector3(1, 0, 0), origin, 0, 0x3B82F6, 0.5, 0.2
            );
            group.add(aE, aH);
            ch3_vectorArrows.push({ arrE: aE, arrH: aH, x3D: x3D, xWall: xWall, z: z });
        }
    }

    // === 6. 横截面场分布面 (CanvasTexture, 放置于 z=0) ===
    ch3_crossCanvas = document.createElement('canvas');
    ch3_crossCanvas.width = 140;
    ch3_crossCanvas.height = 70;
    ch3_crossCtx = ch3_crossCanvas.getContext('2d');
    ch3_crossTex = new THREE.CanvasTexture(ch3_crossCanvas);

    const crossGeo = new THREE.PlaneGeometry(ch3_config.a, ch3_config.b);
    const crossMat = new THREE.MeshBasicMaterial({
        map: ch3_crossTex,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    ch3_crossSection = new THREE.Mesh(crossGeo, crossMat);
    ch3_crossSection.position.set(0, 0, 0.05); // 微偏移避免 z-fighting
    group.add(ch3_crossSection);

    // === 7. 事件绑定 ===
    document.getElementById('ch3-freq-slider').addEventListener('input', (e) => {
        ch3_config.f_over_fc = parseFloat(e.target.value);
        document.getElementById('ch3-freq-val').innerText =
            ch3_config.f_over_fc.toFixed(2) + 'x';
        updateMathCh3();
    });
}

// ---------- 计算单个采样点的场分量 ----------
function calcFieldAt(mode, xWall, yWall, z, beta, alpha, cutoff, w) {
    let Ex = 0, Ey = 0, Ez = 0;
    let Hx = 0, Hy = 0, Hz = 0;

    const phaseFactor = cutoff
        ? Math.exp(-alpha * z) * Math.cos(w * globalTime)
        : Math.cos(w * globalTime - beta * z);
    const phaseFactorQ = cutoff
        ? Math.exp(-alpha * z) * Math.cos(w * globalTime)
        : Math.sin(w * globalTime - beta * z);

    const a = ch3_config.a;
    const b = ch3_config.b;

    if (mode === 'TE10') {
        Ey = Math.sin(Math.PI * xWall / a) * phaseFactor;
        Hx = -Math.sin(Math.PI * xWall / a) * phaseFactor;
        Hz = -Math.cos(Math.PI * xWall / a) * phaseFactorQ;
    } else if (mode === 'TE20') {
        Ey = Math.sin(2 * Math.PI * xWall / a) * phaseFactor;
        Hx = -Math.sin(2 * Math.PI * xWall / a) * phaseFactor;
        Hz = -Math.cos(2 * Math.PI * xWall / a) * phaseFactorQ;
    } else if (mode === 'TE11') {
        Ex = (Math.PI / b) * Math.cos(Math.PI * xWall / a) *
            Math.sin(Math.PI * yWall / b) * phaseFactor;
        Ey = -(Math.PI / a) * Math.sin(Math.PI * xWall / a) *
            Math.cos(Math.PI * yWall / b) * phaseFactor;
        Hx = (Math.PI / a) * Math.sin(Math.PI * xWall / a) *
            Math.cos(Math.PI * yWall / b) * phaseFactor;
        Hy = (Math.PI / b) * Math.cos(Math.PI * xWall / a) *
            Math.sin(Math.PI * yWall / b) * phaseFactor;
        Hz = Math.cos(Math.PI * xWall / a) *
            Math.cos(Math.PI * yWall / b) * phaseFactorQ;
    } else if (mode === 'TM11') {
        Ex = -(Math.PI / a) * Math.cos(Math.PI * xWall / a) *
            Math.sin(Math.PI * yWall / b) * phaseFactor;
        Ey = -(Math.PI / b) * Math.sin(Math.PI * xWall / a) *
            Math.cos(Math.PI * yWall / b) * phaseFactor;
        Ez = Math.sin(Math.PI * xWall / a) * Math.sin(Math.PI * yWall / b) * phaseFactorQ;
        Hx = (Math.PI / b) * Math.sin(Math.PI * xWall / a) *
            Math.cos(Math.PI * yWall / b) * phaseFactor;
        Hy = -(Math.PI / a) * Math.cos(Math.PI * xWall / a) *
            Math.sin(Math.PI * yWall / b) * phaseFactor;
    }

    return { Ex, Ey, Ez, Hx, Hy, Hz };
}

// ---------- 逐帧更新 ----------
function updateChapter3() {
    const { mode, f_over_fc, a, b, zMax, numCurvePoints } = ch3_config;
    const w = 3.0;

    // 截止判定
    const cutoff = f_over_fc < 1.0;

    // 更新状态指示灯
    const badge = document.getElementById('ch3-status-badge');
    const text = document.getElementById('ch3-status-text');
    if (cutoff) {
        badge.style.borderColor = '#991b1b';
        text.innerText = 'CUTOFF (截止消逝)';
        text.style.color = '#ef4444';
    } else {
        badge.style.borderColor = '#166534';
        text.innerText = 'PROPAGATING (正弦传播)';
        text.style.color = '#22c55e';
    }

    let beta = 0, alpha = 0;
    if (cutoff) {
        alpha = Math.sqrt(1.0 - f_over_fc * f_over_fc) * 0.6;
    } else {
        beta = Math.sqrt(f_over_fc * f_over_fc - 1.0) * 0.8;
    }

    // --- 更新 E 场波曲线 ---
    const isTEMode = mode.startsWith('TE');
    const scaleE = 2.0;
    const scaleH = 1.8;

    ch3_eCurves.forEach((curve) => {
        const pos = curve.geom.attributes.position.array;
        for (let i = 0; i < numCurvePoints; i++) {
            const z = (i / (numCurvePoints - 1)) * zMax;
            const f = calcFieldAt(mode, curve.xWall, b / 2, z, beta, alpha, cutoff, w);

            pos[i * 3]     = curve.x3D;
            pos[i * 3 + 1] = f.Ey * scaleE + f.Ex * scaleE * 0.3;
            pos[i * 3 + 2] = z;
        }
        curve.geom.attributes.position.needsUpdate = true;
    });

    // --- 更新 Hx 波曲线 ---
    ch3_hxCurves.forEach((curve) => {
        const pos = curve.geom.attributes.position.array;
        for (let i = 0; i < numCurvePoints; i++) {
            const z = (i / (numCurvePoints - 1)) * zMax;
            const f = calcFieldAt(mode, curve.xWall, b / 2, z, beta, alpha, cutoff, w);

            pos[i * 3]     = curve.x3D + f.Hx * scaleH * 0.5;
            pos[i * 3 + 1] = f.Hy * scaleH;
            pos[i * 3 + 2] = z;
        }
        curve.geom.attributes.position.needsUpdate = true;
    });

    // --- 更新 Hz 纵向磁场曲线 (仅 TE 模可见) ---
    ch3_hzCurves.forEach((curve) => {
        const pos = curve.geom.attributes.position.array;
        const visible = isTEMode && ['TE10', 'TE20', 'TE11'].includes(mode);
        curve.line.visible = visible;

        if (visible) {
            for (let i = 0; i < numCurvePoints; i++) {
                const z = (i / (numCurvePoints - 1)) * zMax;
                const f = calcFieldAt(mode, curve.xWall, b / 2, z, beta, alpha, cutoff, w);

                pos[i * 3]     = curve.x3D;
                pos[i * 3 + 1] = f.Hz * scaleH;
                pos[i * 3 + 2] = z;
            }
            curve.geom.attributes.position.needsUpdate = true;
        }
    });

    // --- 更新精简矢量箭头 ---
    ch3_vectorArrows.forEach((vec) => {
        const yWall = b / 2;
        const f = calcFieldAt(mode, vec.xWall, yWall, vec.z, beta, alpha, cutoff, w);

        _setArr(vec.arrE, f.Ex * scaleE, f.Ey * scaleE, f.Ez * scaleE, 1.2);
        _setArr(vec.arrH, f.Hx * scaleH, f.Hy * scaleH, f.Hz * scaleH, 1.2);
    });

    // --- 更新横截面纹理 (每3帧更新一次节省性能) ---
    if (Math.floor(globalTime * 60) % 3 === 0) {
        updateCrossSection(mode, beta, alpha, cutoff, w);
    }
}

// ---------- 横截面 Canvas 绘制 (优化版) ----------
function updateCrossSection(mode, beta, alpha, cutoff, w) {
    const ctx = ch3_crossCtx;
    const cw = ch3_crossCanvas.width;
    const ch = ch3_crossCanvas.height;
    const { a, b } = ch3_config;

    const zEval = 0;
    const phaseFactor = cutoff
        ? Math.cos(w * globalTime)
        : Math.cos(w * globalTime - beta * zEval);
    const phaseFactorQ = cutoff
        ? Math.cos(w * globalTime)
        : Math.sin(w * globalTime - beta * zEval);

    const imageData = ctx.getImageData(0, 0, cw, ch);
    const data = imageData.data;

    // TE10 / TE20: 场仅沿 x 变化，计算一行后复制到所有行
    if (mode === 'TE10' || mode === 'TE20') {
        const rowData = new Float32Array(cw);
        for (let px = 0; px < cw; px++) {
            const xWall = (px / cw) * a;
            const val = mode === 'TE10'
                ? Math.sin(Math.PI * xWall / a) * phaseFactor
                : Math.sin(2 * Math.PI * xWall / a) * phaseFactor;
            rowData[px] = val;
        }
        for (let py = 0; py < ch; py++) {
            for (let px = 0; px < cw; px++) {
                const val = rowData[px];
                const idx = (py * cw + px) * 4;
                fillPixel(data, idx, val);
            }
        }
    } else {
        // TE11 / TM11: 二维场分布
        for (let py = 0; py < ch; py++) {
            for (let px = 0; px < cw; px++) {
                const xWall = (px / cw) * a;
                const yWall = ((ch - 1 - py) / ch) * b;
                const f = calcFieldAt(mode, xWall, yWall, zEval, 0, 0, cutoff, w);
                const val = Math.sqrt(f.Ex * f.Ex + f.Ey * f.Ey) *
                    (Math.abs(f.Ey) > 0.01 ? Math.sign(f.Ey) : Math.sign(f.Ex || 1));
                const idx = (py * cw + px) * 4;
                fillPixel(data, idx, val);
            }
        }
    }

    ctx.putImageData(imageData, 0, 0);
    ch3_crossTex.needsUpdate = true;
}

// 辅助：填充单个像素的 RGBA
function fillPixel(data, idx, val) {
    const intensity = Math.min(1.0, Math.abs(val));
    const r = val > 0 ? Math.floor(intensity * 220) : 0;
    const b2 = val < 0 ? Math.floor(intensity * 220) : 0;
    data[idx]     = Math.min(255, r + 15);
    data[idx + 1] = 8;
    data[idx + 2] = Math.min(255, b2 + 15);
    data[idx + 3] = Math.floor(90 + intensity * 140);
}

// ---------- 模式切换 ----------
window.setWaveguideMode = function (mode) {
    ch3_config.mode = mode;
    ['TE10', 'TE20', 'TE11', 'TM11'].forEach((m) => {
        document.getElementById('ch3-mode-' + m.toLowerCase()).className =
            m === mode ? 'btn btn-primary' : 'btn';
    });

    // 自动切换到最佳视角
    if (mode === 'TE10' || mode === 'TE20') {
        // 侧视：看到波形沿 z 传播
        gsapCameraMove(22, 8, 28);
        controls.target.set(0, 0, ch3_config.zMax / 2);
    } else {
        // TE11/TM11: 45° 透视，看到二维场分布
        gsapCameraMove(18, 12, 28);
        controls.target.set(0, 0, ch3_config.zMax / 2);
    }
    updateMathCh3();
};

// ---------- 数学公式渲染 ----------
function updateMathCh3() {
    const { mode, f_over_fc } = ch3_config;
    const cutoff = f_over_fc < 1.0;

    const mathFc = `\\text{波导截止频率: } f_c = \\frac{c}{2} \\sqrt{\\left(\\frac{m}{a}\\right)^2 + \\left(\\frac{n}{b}\\right)^2}`;
    const mathBeta = cutoff
        ? `\\beta = -j\\alpha \\Rightarrow \\alpha = k_c\\sqrt{1-(f/f_c)^2} \\quad \\text{(波导截止无功消逝驻波)}`
        : `\\beta = k\\sqrt{1-(f_c/f)^2} \\approx ${(Math.sqrt(f_over_fc * f_over_fc - 1.0) * 0.8).toFixed(2)} \\text{ rad/m}`;

    katex.render(mathFc, document.getElementById('eq-ch3-cutoff'), { displayMode: true });
    katex.render(mathBeta, document.getElementById('eq-ch3-beta'), { displayMode: true });
}
