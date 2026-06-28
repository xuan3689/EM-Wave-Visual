// ==========================================
// ch3-waveguide.js - 第三章：导行电磁波 (矩形波导)
// 职责: TE10/TE20/TE11/TM11 高阶模式、
//       色散截止效应、传播/消逝状态切换
// ==========================================

// ---------- 章节配置 ----------
const ch3_config = {
    mode: 'TE10',
    f_over_fc: 1.5,       // 归一化工作频率
    a: 14,                 // 波导宽边
    b: 7,                  // 波导窄边
    zMax: 30
};

// ---------- 3D 对象引用 ----------
let ch3_waveguideBox;
const ch3_vectorArrows = [];

// ---------- 初始化 ----------
function initChapter3() {
    const group = sceneGroups.ch3;

    // 1. 金属波导腔线框
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
        new THREE.MeshBasicMaterial({ color: 0x075985, transparent: true, opacity: 0.12 })
    );
    ch3_waveguideBox.position.set(0, 0, ch3_config.zMax / 2);
    group.add(ch3_waveguideBox);

    // 2. 高密度 3D 矢量场网格 (E 和 H 双场)
    const cols = 15;   // Z 向
    const rowsX = 5;   // X 向
    const rowsY = 3;   // Y 向

    for (let kz = 0; kz < cols; kz++) {
        const z = (kz / (cols - 1)) * ch3_config.zMax;
        for (let kx = 0; kx < rowsX; kx++) {
            const x = (kx / (rowsX - 1) - 0.5) * ch3_config.a * 0.85;
            for (let ky = 0; ky < rowsY; ky++) {
                const y = (ky / (rowsY - 1) - 0.5) * ch3_config.b * 0.8;

                const origin = new THREE.Vector3(x, y, z);

                const aE = new THREE.ArrowHelper(
                    new THREE.Vector3(0, 1, 0), origin, 0, 0xEF4444, 0.4, 0.2
                );
                const aH = new THREE.ArrowHelper(
                    new THREE.Vector3(1, 0, 0), origin, 0, 0x3B82F6, 0.4, 0.2
                );

                group.add(aE, aH);
                ch3_vectorArrows.push({ arrE: aE, arrH: aH, x: x, y: y, z: z });
            }
        }
    }

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

    // 截止判定
    const cutoff = f_over_fc < 1.0;

    // 联合更新状态指示灯
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

    // 遍历矢量场网格，计算严格解析解
    ch3_vectorArrows.forEach((vec) => {
        const x = vec.x + a / 2;  // 零点移到边界
        const y = vec.y + b / 2;
        const z = vec.z;

        const phaseFactor = cutoff
            ? Math.exp(-alpha * z) * Math.cos(w * globalTime)
            : Math.cos(w * globalTime - beta * z);

        let Ex = 0, Ey = 0, Ez = 0;
        let Hx = 0, Hy = 0, Hz = 0;

        if (mode === 'TE10') {
            Ey = Math.sin(Math.PI * x / a) * phaseFactor;
            Hx = -Math.sin(Math.PI * x / a) * phaseFactor;
            Hz = -Math.cos(Math.PI * x / a) *
                (cutoff ? Math.cos(w * globalTime) : Math.sin(w * globalTime - beta * z));
        } else if (mode === 'TE20') {
            Ey = Math.sin(2 * Math.PI * x / a) * phaseFactor;
            Hx = -Math.sin(2 * Math.PI * x / a) * phaseFactor;
            Hz = -Math.cos(2 * Math.PI * x / a) *
                (cutoff ? Math.cos(w * globalTime) : Math.sin(w * globalTime - beta * z));
        } else if (mode === 'TE11') {
            Ex = (Math.PI / b) * Math.cos(Math.PI * x / a) *
                Math.sin(Math.PI * y / b) * phaseFactor;
            Ey = -(Math.PI / a) * Math.sin(Math.PI * x / a) *
                Math.cos(Math.PI * y / b) * phaseFactor;
            Hx = (Math.PI / a) * Math.sin(Math.PI * x / a) *
                Math.cos(Math.PI * y / b) * phaseFactor;
            Hy = (Math.PI / b) * Math.cos(Math.PI * x / a) *
                Math.sin(Math.PI * y / b) * phaseFactor;
        } else if (mode === 'TM11') {
            Ex = -(Math.PI / a) * Math.cos(Math.PI * x / a) *
                Math.sin(Math.PI * y / b) * phaseFactor;
            Ey = -(Math.PI / b) * Math.sin(Math.PI * x / a) *
                Math.cos(Math.PI * y / b) * phaseFactor;
            Ez = Math.sin(Math.PI * x / a) * Math.sin(Math.PI * y / b) *
                (cutoff ? Math.cos(w * globalTime) : Math.sin(w * globalTime - beta * z));
            Hx = (Math.PI / b) * Math.sin(Math.PI * x / a) *
                Math.cos(Math.PI * y / b) * phaseFactor;
            Hy = -(Math.PI / a) * Math.cos(Math.PI * x / a) *
                Math.sin(Math.PI * y / b) * phaseFactor;
        }

        const scaleE = 2.0;
        const scaleH = 1.8;
        _setArr(vec.arrE, Ex * scaleE, Ey * scaleE, Ez * scaleE, 1.2);
        _setArr(vec.arrH, Hx * scaleH, Hy * scaleH, Hz * scaleH, 1.2);
    });
}

// ---------- 模式切换 ----------
window.setWaveguideMode = function (mode) {
    ch3_config.mode = mode;
    ['TE10', 'TE20', 'TE11', 'TM11'].forEach((m) => {
        document.getElementById('ch3-mode-' + m.toLowerCase()).className =
            m === mode ? 'btn btn-primary' : 'btn';
    });
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
