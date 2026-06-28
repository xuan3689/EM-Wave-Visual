// ==========================================
// core.js - 系统核心总线
// 职责: Three.js 引擎初始化、场景管理、动画循环、
//       章节切换、相机控制、全局工具函数
// ==========================================

// ---------- 全局状态 ----------
let scene, camera, renderer, controls;
let currentChapter = 0;
let globalTime = 0;
let isPlaying = true;

// 各章节独立的 3D 场景组
const sceneGroups = {
    ch0: new THREE.Group(),
    ch1: new THREE.Group(),
    ch2: new THREE.Group(),
    ch3: new THREE.Group(),
    ch4: new THREE.Group()
};

// ---------- Three.js 引擎初始化 ----------
function initThree() {
    const wrapper = document.getElementById('canvas-wrapper');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0b0d); // 深空黑底

    camera = new THREE.PerspectiveCamera(
        40,
        wrapper.clientWidth / wrapper.clientHeight,
        0.1,
        1000
    );

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(wrapper.clientWidth, wrapper.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    // 高雅学术照明
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(10, 20, 15);
    scene.add(dirLight);

    // 经典大地参考网格
    const gridHelper = new THREE.GridHelper(60, 30, 0x2e343b, 0x1a1d21);
    gridHelper.position.y = -5;
    scene.add(gridHelper);

    // 将五个章节的场景组挂载到主场景
    for (let key in sceneGroups) {
        scene.add(sceneGroups[key]);
    }

    // 窗口自适应
    window.addEventListener('resize', () => {
        camera.aspect = wrapper.clientWidth / wrapper.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(wrapper.clientWidth, wrapper.clientHeight);
    });
}

// ---------- 章节切换 ----------
window.switchChapter = function (chapterNum) {
    currentChapter = chapterNum;

    // 标签高亮 (第0章是第一个tab，idx === chapterNum)
    document.querySelectorAll('.tab-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', idx === chapterNum);
    });
    // 控制面板切换
    document.querySelectorAll('.control-panel').forEach((panel, idx) => {
        panel.classList.toggle('active', idx === chapterNum);
    });

    // 数学公式面板切换 (第0章用全屏overlay)
    const formulaOverlay = document.getElementById('formula-overlay');
    if (chapterNum === 0) {
        formulaOverlay.classList.add('active');
    } else {
        formulaOverlay.classList.remove('active');
    }
    document.getElementById('math-ch1').classList.toggle('active', chapterNum === 1);
    document.getElementById('math-ch2').classList.toggle('active', chapterNum === 2);
    document.getElementById('math-ch3').classList.toggle('active', chapterNum === 3);
    document.getElementById('math-ch4').classList.toggle('active', chapterNum === 4);

    // 图例在 ch0 隐藏，其余章节显示
    document.getElementById('legend-ch').classList.toggle('active', chapterNum > 0);
    document.getElementById('legend-poynting').style.display =
        chapterNum === 1 ? 'flex' : 'none';

    // 第0章隐藏图例和示波器
    document.getElementById('pip-container').style.display =
        chapterNum === 0 ? 'none' : 'flex';

    // 切换可见的场景组
    for (let key in sceneGroups) {
        sceneGroups[key].visible = key === 'ch' + chapterNum;
    }

    // 各章节默认相机位置与公式刷新
    if (chapterNum === 0) {
        gsapCameraMove(0, 0, 25);
        controls.target.set(0, 0, 0);
        updateMathCh0();
    } else if (chapterNum === 1) {
        gsapCameraMove(22, 16, 28);
        controls.target.set(0, 0, 15);
        updateMathCh1();
    } else if (chapterNum === 2) {
        gsapCameraMove(32, 10, 15);
        controls.target.set(0, 0, 15);
        updateMathCh2();
    } else if (chapterNum === 3) {
        gsapCameraMove(18, 12, 28);
        controls.target.set(0, 0, 15);
        updateMathCh3();
    } else if (chapterNum === 4) {
        gsapCameraMove(18, 12, 18);
        controls.target.set(0, 0, 0);
        updateMathCh4();
    }
};

// ---------- 动画主循环 ----------
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    if (isPlaying) globalTime += 0.015;

    // 按当前激活章节调度更新
    if (currentChapter === 0) { /* 第0章无动态内容 */ }
    else if (currentChapter === 1) updateChapter1();
    else if (currentChapter === 2) updateChapter2();
    else if (currentChapter === 3) updateChapter3();
    else if (currentChapter === 4) updateChapter4();

    updatePip();
    renderer.render(scene, camera);
}

// ---------- 平滑相机移动 (缓动插值) ----------
window.gsapCameraMove = function (tx, ty, tz) {
    const start = camera.position.clone();
    const end = new THREE.Vector3(tx, ty, tz);
    let frame = 0;
    const maxFrames = 30;

    function move() {
        frame++;
        const p = frame / maxFrames;
        // easeInOutQuad
        const ease = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
        camera.position.lerpVectors(start, end, ease);
        if (frame < maxFrames) requestAnimationFrame(move);
    }
    move();
};

// ---------- 播放 / 暂停 ----------
window.togglePlay = function () {
    isPlaying = !isPlaying;
    const btn = document.getElementById('ch1-btn-play');
    btn.innerText = isPlaying ? '⏸ 暂停解析时钟' : '▶ 启动解析时钟';
};

// ---------- 通用 3D 矢量箭头辅助器 ----------
// 根据 x,y,z 分量设置 ArrowHelper 的方向和长度
function _setArr(arrow, x, y, z, scale = 0.5) {
    const len = Math.sqrt(x * x + y * y + z * z);
    if (len > 0.05) {
        arrow.setDirection(new THREE.Vector3(x / len, y / len, z / len));
        arrow.setLength(len * scale, Math.min(0.25, len * scale * 0.4), 0.1);
        arrow.visible = true;
    } else {
        arrow.visible = false;
    }
}

// ---------- 第0章：麦克斯韦方程组 ----------
function initChapter0() {
    // 第0章 3D 场景为空，只展示公式面板
}

function updateChapter0() {
    // 无动态内容
}

function updateMathCh0() {
    const container = document.getElementById('formula-content');

    // 按章节组织的公式数据
    const chapters = [
        {
            title: '第0章 · 麦克斯韦方程组（总纲）',
            tag: '根基',
            tagColor: '#8b5cf6',
            items: [
                { label: '∇·E = ρ/ε₀  — 电场高斯定律（电场由电荷激发）', tex: '\\nabla \\cdot \\vec{E} = \\frac{\\rho}{\\varepsilon_0}' },
                { label: '∇·H = 0  — 磁场高斯定律（磁单极子不存在）', tex: '\\nabla \\cdot \\vec{H} = 0' },
                { label: '∇×E = −μ₀∂H/∂t  — 法拉第定律（变化的磁场产生电场）', tex: '\\nabla \\times \\vec{E} = -\\mu_0 \\frac{\\partial \\vec{H}}{\\partial t}' },
                { label: '∇×H = J + ε₀∂E/∂t  — 安培-麦克斯韦定律（电流+变化的电场产生磁场）', tex: '\\nabla \\times \\vec{H} = \\vec{J} + \\varepsilon_0 \\frac{\\partial \\vec{E}}{\\partial t}' }
            ]
        },
        {
            title: '第一章 · 均匀平面波与能流',
            tag: '波动解',
            tagColor: '#ef4444',
            items: [
                { label: '波动方程（无源区域）', tex: '\\nabla^2 \\vec{E} = \\mu\\varepsilon \\frac{\\partial^2 \\vec{E}}{\\partial t^2}' },
                { label: '均匀平面波电场解（z向传播）', tex: '\\vec{E}(z,t) = \\text{Re}\\left[ (E_x \\hat{x} + E_y e^{j\\delta} \\hat{y}) e^{j(\\omega t - kz)} \\right]' },
                { label: '磁场与电场的关系（本征阻抗）', tex: '\\vec{H} = \\frac{1}{\\eta} \\hat{z} \\times \\vec{E}, \\quad \\eta = \\sqrt{\\frac{\\mu}{\\varepsilon}}' },
                { label: '坡印廷矢量（能流密度）', tex: '\\vec{S} = \\vec{E} \\times \\vec{H}' },
                { label: '有损介质中的衰减', tex: '\\vec{E}(z,t) = \\vec{E}_0 e^{-\\alpha z} \\cos(\\omega t - kz), \\quad \\alpha = k \\tan(\\theta_\\eta / 2)' }
            ]
        },
        {
            title: '第二章 · 边界反射、折射与趋肤',
            tag: '菲涅尔',
            tagColor: '#f59e0b',
            items: [
                { label: '斯涅尔折射定律', tex: 'n_1 \\sin\\theta_i = n_2 \\sin\\theta_t' },
                { label: 'TE极化反射系数', tex: 'R_{TE} = \\frac{n_1 \\cos\\theta_i - n_2 \\cos\\theta_t}{n_1 \\cos\\theta_i + n_2 \\cos\\theta_t}' },
                { label: 'TM极化反射系数', tex: 'R_{TM} = \\frac{n_2 \\cos\\theta_i - n_1 \\cos\\theta_t}{n_2 \\cos\\theta_i + n_1 \\cos\\theta_t}' },
                { label: '临界角（全反射条件）', tex: '\\theta_c = \\arcsin\\left(\\frac{n_2}{n_1}\\right), \\quad \\theta_i \\geq \\theta_c \\Rightarrow \\text{全反射}' },
                { label: '趋肤深度（良导体衰减）', tex: '\\delta_s = \\frac{1}{\\alpha} = \\frac{1}{\\sigma \\cdot 0.45}' }
            ]
        },
        {
            title: '第三章 · 导行电磁波（矩形波导）',
            tag: '色散',
            tagColor: '#06b6d4',
            items: [
                { label: '矩形波导 TE/TM 模式截止频率', tex: 'f_c = \\frac{c}{2} \\sqrt{\\left(\\frac{m}{a}\\right)^2 + \\left(\\frac{n}{b}\\right)^2}' },
                { label: 'TE₁₀ 主模场分布（E场）', tex: 'E_y = \\sin\\left(\\frac{\\pi x}{a}\\right) e^{j(\\omega t - \\beta z)}' },
                { label: '传播常数 β（f > f_c）', tex: '\\beta = k \\sqrt{1 - (f_c / f)^2}' },
                { label: '截止状态的衰减常数 α（f < f_c）', tex: '\\alpha = k_c \\sqrt{1 - (f / f_c)^2}' }
            ]
        },
        {
            title: '第四章 · 电磁辐射与天线',
            tag: '辐射',
            tagColor: '#d97706',
            items: [
                { label: '电基本振子辐射场方向函数', tex: 'F(\\theta) = \\sin\\theta' },
                { label: '远区辐射电场', tex: 'E_\\theta = j\\eta \\frac{I_0 l e^{-jkr}}{2\\lambda r} \\sin\\theta' }
            ]
        }
    ];

    // 构建 HTML
    let html = '';
    chapters.forEach((ch, idx) => {
        html += `<div class="formula-chapter">`;
        html += `<h3><span class="ch-tag" style="background:${ch.tagColor}22;color:${ch.tagColor};border:1px solid ${ch.tagColor}44">${ch.tag}</span> ${ch.title}</h3>`;
        ch.items.forEach((item) => {
            html += `<div class="formula-item">`;
            html += `<div class="formula-label">${item.label}</div>`;
            html += `<div class="formula-body" id="eq-ch0-${idx}-${ch.items.indexOf(item)}"></div>`;
            html += `</div>`;
        });
        html += `</div>`;
    });
    container.innerHTML = html;

    // 渲染 KaTeX
    chapters.forEach((ch, idx) => {
        ch.items.forEach((item, j) => {
            const el = document.getElementById(`eq-ch0-${idx}-${j}`);
            if (el) katex.render(item.tex, el, { displayMode: true });
        });
    });
}

// ---------- 启动入口 ----------
window.onload = function () {
    initThree();
    initPip();
    initChapter0();
    initChapter1();
    initChapter2();
    initChapter3();
    initChapter4();
    switchChapter(0);
    animate();
};
