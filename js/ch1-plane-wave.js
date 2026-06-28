// ==========================================
// ch1-plane-wave.js - 第一章：均匀平面波与能流
// 职责: 有损介质中平面波的电场/磁场/坡印廷矢量
//       线极化/圆极化/椭圆极化切换
// ==========================================

// ---------- 章节配置 ----------
const ch1_config = {
    Ex: 3.0,
    Ey: 0.0,
    phaseDiff: 0,        // 正交分量相位差 (rad)
    impedanceTheta: 0,   // 本征阻抗角 (rad)
    zMax: 30,
    k: 0.8,
    w: 1.5,
    numPoints: 32
};

// ---------- 3D 对象引用 ----------
const ch1_lines = { E: null, H: null };
const ch1_arrows = { E: [], H: [], S: [] };

// ---------- 初始化 ----------
function initChapter1() {
    const group = sceneGroups.ch1;

    // 传播轴线
    const axisGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, ch1_config.zMax)
    ]);
    const axisLine = new THREE.Line(
        axisGeo,
        new THREE.LineBasicMaterial({ color: 0x475569, opacity: 0.6, transparent: true })
    );
    group.add(axisLine);

    // 连续场强曲线
    const matE = new THREE.LineBasicMaterial({ color: 0xEF4444, linewidth: 2 });
    const matH = new THREE.LineBasicMaterial({ color: 0x3B82F6, linewidth: 2 });

    ch1_lines.E = new THREE.Line(new THREE.BufferGeometry(), matE);
    ch1_lines.H = new THREE.Line(new THREE.BufferGeometry(), matH);

    ch1_lines.E.geometry.setAttribute(
        'position', new THREE.BufferAttribute(new Float32Array(150 * 3), 3)
    );
    ch1_lines.H.geometry.setAttribute(
        'position', new THREE.BufferAttribute(new Float32Array(150 * 3), 3)
    );
    group.add(ch1_lines.E, ch1_lines.H);

    // 3D 旋转矢量箭头 (沿 z 轴分布)
    for (let i = 0; i < ch1_config.numPoints; i++) {
        const z = (i / ch1_config.numPoints) * ch1_config.zMax;
        const origin = new THREE.Vector3(0, 0, z);

        const aE = new THREE.ArrowHelper(
            new THREE.Vector3(1, 0, 0), origin, 0, 0xEF4444, 0.4, 0.2
        );
        const aH = new THREE.ArrowHelper(
            new THREE.Vector3(0, 1, 0), origin, 0, 0x3B82F6, 0.4, 0.2
        );
        const aS = new THREE.ArrowHelper(
            new THREE.Vector3(0, 0, 1), origin, 0, 0x10B981, 0.5, 0.25
        );

        group.add(aE, aH, aS);
        ch1_arrows.E.push({ arr: aE, z: z });
        ch1_arrows.H.push({ arr: aH, z: z });
        ch1_arrows.S.push({ arr: aS, z: z });
    }

    // ---------- 事件绑定 ----------

    // 相位差滑块
    document.getElementById('ch1-phase-slider').addEventListener('input', (e) => {
        const phaseDeg = parseInt(e.target.value);
        ch1_config.phaseDiff = phaseDeg * Math.PI / 180;
        document.getElementById('ch1-phase-val').innerText = phaseDeg + '°';

        // 当 Ey ≈ 0 且相位差偏离 0°/180° 时，自动激活 Ey 分量，
        // 否则相位差变化在视觉上完全不可见（0 * cos 恒为零）
        if (ch1_config.Ey < 0.1 && phaseDeg % 180 !== 0) {
            ch1_config.Ey = ch1_config.Ex;
        }

        // 智能高亮对应极化按钮
        document.getElementById('ch1-btn-linear').className = 'btn';
        document.getElementById('ch1-btn-circular').className = 'btn';
        document.getElementById('ch1-btn-elliptical').className = 'btn';

        const isExEqualsEy = Math.abs(ch1_config.Ex - ch1_config.Ey) < 0.1;
        if (phaseDeg % 180 === 0) {
            document.getElementById('ch1-btn-linear').className = 'btn btn-primary';
        } else if ((phaseDeg === 90 || phaseDeg === 270) && isExEqualsEy) {
            document.getElementById('ch1-btn-circular').className = 'btn btn-primary';
        } else {
            document.getElementById('ch1-btn-elliptical').className = 'btn btn-primary';
        }
        updateMathCh1();
    });

    // 阻抗角滑块
    document.getElementById('ch1-imp-slider').addEventListener('input', (e) => {
        ch1_config.impedanceTheta = parseInt(e.target.value) * Math.PI / 180;
        document.getElementById('ch1-imp-val').innerText = e.target.value + '°';
        updateMathCh1();
    });

    // 能流矢量显示开关
    document.getElementById('ch1-show-poynting').addEventListener('change', (e) => {
        ch1_arrows.S.forEach((obj) => (obj.arr.visible = e.target.checked));
    });
}

// ---------- 逐帧更新 ----------
function updateChapter1() {
    const { Ex, Ey, phaseDiff, impedanceTheta, w, k, numPoints, zMax } = ch1_config;
    const showS = document.getElementById('ch1-show-poynting').checked;

    // 损耗介质衰减常数 α (由 theta_eta 严格导出)
    const alpha = impedanceTheta > 0 ? k * Math.tan(impedanceTheta / 2) : 0.0;

    // 1. 动态绘制电磁波正弦轮廓包络 (含 e^{-alpha * z} 衰减)
    const posE = ch1_lines.E.geometry.attributes.position.array;
    const posH = ch1_lines.H.geometry.attributes.position.array;
    for (let i = 0; i < 150; i++) {
        const z = (i / 149) * zMax;
        const phase = w * globalTime - k * z;
        const decay = Math.exp(-alpha * z);

        posE[i * 3]     = Ex * decay * Math.cos(phase);
        posE[i * 3 + 1] = Ey * decay * Math.cos(phase + phaseDiff);
        posE[i * 3 + 2] = z;

        posH[i * 3]     = -Ey * decay * Math.cos(phase + phaseDiff - impedanceTheta);
        posH[i * 3 + 1] =  Ex * decay * Math.cos(phase - impedanceTheta);
        posH[i * 3 + 2] = z;
    }
    ch1_lines.E.geometry.attributes.position.needsUpdate = true;
    ch1_lines.H.geometry.attributes.position.needsUpdate = true;

    // 2. 动态更新空间 3D 旋转矢量箭头
    for (let i = 0; i < numPoints; i++) {
        const z = ch1_arrows.E[i].z;
        const phase = w * globalTime - k * z;
        const decay = Math.exp(-alpha * z);

        const vxE = Ex * decay * Math.cos(phase);
        const vyE = Ey * decay * Math.cos(phase + phaseDiff);

        const vxH = -Ey * decay * Math.cos(phase + phaseDiff - impedanceTheta);
        const vyH =  Ex * decay * Math.cos(phase - impedanceTheta);

        const vzS = vxE * vyH - vyE * vxH;

        _setArr(ch1_arrows.E[i].arr, vxE, vyE, 0);
        _setArr(ch1_arrows.H[i].arr, vxH, vyH, 0);

        if (showS) {
            const lenS = Math.abs(vzS) * 0.2;
            if (lenS > 0.05) {
                ch1_arrows.S[i].arr.setDirection(
                    new THREE.Vector3(0, 0, vzS > 0 ? 1 : -1)
                );
                ch1_arrows.S[i].arr.setLength(lenS, Math.min(0.3, lenS * 0.4), 0.1);
                ch1_arrows.S[i].arr.visible = true;
            } else {
                ch1_arrows.S[i].arr.visible = false;
            }
        } else {
            ch1_arrows.S[i].arr.visible = false;
        }
    }
}

// ---------- 极化预设 ----------
window.setPresetCh1 = function (type) {
    document.getElementById('ch1-btn-linear').className = 'btn';
    document.getElementById('ch1-btn-circular').className = 'btn';
    document.getElementById('ch1-btn-elliptical').className = 'btn';
    document.getElementById('ch1-btn-' + type).className = 'btn btn-primary';

    if (type === 'linear') {
        ch1_config.Ex = 3.0;
        ch1_config.Ey = 0.0;
        ch1_config.phaseDiff = 0;
        document.getElementById('ch1-phase-slider').value = 0;
        document.getElementById('ch1-phase-val').innerText = '0°';
        gsapCameraMove(22, 16, 28);
    } else if (type === 'circular') {
        ch1_config.Ex = 2.12;
        ch1_config.Ey = 2.12;
        ch1_config.phaseDiff = Math.PI / 2;
        document.getElementById('ch1-phase-slider').value = 90;
        document.getElementById('ch1-phase-val').innerText = '90°';
        gsapCameraMove(22, 16, 28);
    } else if (type === 'elliptical') {
        ch1_config.Ex = 3.0;
        ch1_config.Ey = 1.5;
        ch1_config.phaseDiff = Math.PI / 4;
        document.getElementById('ch1-phase-slider').value = 45;
        document.getElementById('ch1-phase-val').innerText = '45°';
        gsapCameraMove(22, 16, 28);
    }
    updateMathCh1();
};

// ---------- 数学公式渲染 ----------
function updateMathCh1() {
    const { Ex, Ey, phaseDiff, impedanceTheta } = ch1_config;
    const dStr = phaseDiff > 0 ? `+ ${Math.round(phaseDiff * 180 / Math.PI)}^\\circ` : '';
    const tStr = impedanceTheta > 0 ? `- ${Math.round(impedanceTheta * 180 / Math.PI)}^\\circ` : '';
    const decayStr = impedanceTheta > 0 ? 'e^{-\\alpha z}' : '';

    const E = `\\vec{E} = ${decayStr}[${Ex.toFixed(1)}\\cos(\\omega t - kz)\\hat{x}` +
        (Ey > 0 ? ` + ${Ey.toFixed(1)}\\cos(\\omega t - kz ${dStr})\\hat{y}]` : '\\hat{x}]');
    const H = `\\vec{H} = ${decayStr}[-${Ey.toFixed(1)}\\cos(\\omega t - kz ${dStr} ${tStr})\\hat{x} + ${Ex.toFixed(1)}\\cos(\\omega t - kz ${tStr})\\hat{y}]`;
    const S = `\\vec{S}_{avg} = \\frac{1}{2} e^{-2\\alpha z} \\text{Re}\\{ \\vec{E} \\times \\vec{H}^* \\}`;

    katex.render(E, document.getElementById('eq-ch1-E'), { displayMode: true });
    katex.render(H, document.getElementById('eq-ch1-H'), { displayMode: true });
    katex.render(S, document.getElementById('eq-ch1-S'), { displayMode: true });
}
