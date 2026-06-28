// ==========================================
// core.js - 系统核心总线
// 职责: Three.js 引擎初始化、场景管理、动画循环、
//       章节切换、相机控制、全局工具函数
// ==========================================

// ---------- 全局状态 ----------
let scene, camera, renderer, controls;
let currentChapter = 1;
let globalTime = 0;
let isPlaying = true;

// 各章节独立的 3D 场景组
const sceneGroups = {
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

    // 坐标轴指示器 (右下角，颜色与物理语义匹配：E=红, H=蓝, 传播=灰)
    const axPos = new THREE.Vector3(18, -3, 25);
    const axisLen = 5;

    function makeAxisLine(from, to, color) {
        const g = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(from[0], from[1], from[2]),
            new THREE.Vector3(to[0], to[1], to[2])
        ]);
        const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color }));
        scene.add(l);
    }
    makeAxisLine([axPos.x, axPos.y, axPos.z], [axPos.x + axisLen, axPos.y, axPos.z], 0xEF4444);
    makeAxisLine([axPos.x, axPos.y, axPos.z], [axPos.x, axPos.y + axisLen, axPos.z], 0x3B82F6);
    makeAxisLine([axPos.x, axPos.y, axPos.z], [axPos.x, axPos.y, axPos.z + axisLen], 0x94a3b8);

    // 坐标轴文字标签
    function createAxisLabel(text, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 80;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = 'Bold 36px Consolas, "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = color;
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        const material = new THREE.SpriteMaterial({
            map: texture, transparent: true,
            depthTest: false, depthWrite: false
        });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(7, 1.8, 1);
        return sprite;
    }

    const labelX = createAxisLabel('E 电场方向 (x)', '#EF4444');
    labelX.position.set(axPos.x + 6.5, axPos.y - 0.3, axPos.z);
    scene.add(labelX);

    const labelY = createAxisLabel('H 磁场方向 (y)', '#3B82F6');
    labelY.position.set(axPos.x, axPos.y + 6.5, axPos.z);
    scene.add(labelY);

    const labelZ = createAxisLabel('传播方向 (z)', '#94a3b8');
    labelZ.position.set(axPos.x, axPos.y - 0.3, axPos.z + 6.5);
    scene.add(labelZ);

    // 将四个章节的场景组挂载到主场景
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

    // 标签高亮
    document.querySelectorAll('.tab-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', idx + 1 === chapterNum);
    });
    // 控制面板切换
    document.querySelectorAll('.control-panel').forEach((panel, idx) => {
        panel.classList.toggle('active', idx + 1 === chapterNum);
    });

    // 数学公式面板切换
    document.getElementById('math-ch1').classList.toggle('active', chapterNum === 1);
    document.getElementById('math-ch2').classList.toggle('active', chapterNum === 2);
    document.getElementById('math-ch3').classList.toggle('active', chapterNum === 3);
    document.getElementById('math-ch4').classList.toggle('active', chapterNum === 4);

    // 图例始终显示，但能流矢量只在第一章显示
    document.getElementById('legend-ch').classList.toggle('active', true);
    document.getElementById('legend-poynting').style.display =
        chapterNum === 1 ? 'flex' : 'none';

    // 切换可见的场景组
    for (let key in sceneGroups) {
        sceneGroups[key].visible = key === 'ch' + chapterNum;
    }

    // 各章节默认相机位置与公式刷新
    if (chapterNum === 1) {
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
    if (currentChapter === 1) updateChapter1();
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

// ---------- 启动入口 ----------
window.onload = function () {
    initThree();
    initPip();
    initChapter1();
    initChapter2();
    initChapter3();
    initChapter4();
    switchChapter(1);
    animate();
};
