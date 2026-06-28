// ==========================================
// ch4-antenna-radiation.js - 第四章：电磁辐射与天线
// 职责: 赫兹偶极子近场流线、远场辐射方向图、
//       半波振子甜甜圈、近区/远区连续过渡
// ==========================================

// ---------- 章节配置 ----------
const ch4_config = {
    obsDistance: 0.5,       // 归一化观测距离 (r / λ)
    showDonut: true,
    antennaHeight: 8
};

// ---------- 3D 对象引用 ----------
let ch4_antennaBar;
const ch4_fieldLines = [];
let ch4_patternMesh;

// ---------- 初始化 ----------
function initChapter4() {
    const group = sceneGroups.ch4;

    // 1. 天线偶极子实体
    const barGeo = new THREE.CylinderGeometry(0.12, 0.12, ch4_config.antennaHeight, 16);
    const barMat = new THREE.MeshLambertMaterial({ color: 0xcbd5e1 });
    ch4_antennaBar = new THREE.Mesh(barGeo, barMat);
    group.add(ch4_antennaBar);

    // 2. 连续等值流线：预置 8 条高保真闭合流道
    for (let i = 0; i < 8; i++) {
        const lineRight = new THREE.Line(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({ color: 0xEF4444, opacity: 0.85, transparent: true })
        );
        const lineLeft = new THREE.Line(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({ color: 0xEF4444, opacity: 0.85, transparent: true })
        );
        group.add(lineRight, lineLeft);

        // 存储对应的恒定 contour C 值 (从小到大嵌套)
        const cVal = 0.04 + i * 0.12;
        ch4_fieldLines.push({ lineR: lineRight, lineL: lineLeft, cValue: cVal });
    }

    // 3. 半波振子经典方向图网格线框
    //    F(θ) = cos(π/2 · cosθ) / sinθ
    const donutGeo = new THREE.SphereGeometry(3.5, 36, 36);
    const pos = donutGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const vec = new THREE.Vector3(x, y, z);
        const r = vec.length();
        const theta = Math.acos(y / r);  // 天线轴沿 Y 轴

        const cosTheta = Math.cos(theta);
        const sinTheta = Math.sin(theta);
        const factor = Math.abs(sinTheta) < 0.001
            ? 0
            : Math.cos((Math.PI / 2) * cosTheta) / sinTheta;

        vec.setLength(r * Math.abs(factor));
        pos.setX(i, vec.x);
        pos.setY(i, vec.y);
        pos.setZ(i, vec.z);
    }
    donutGeo.computeVertexNormals();

    ch4_patternMesh = new THREE.Mesh(
        donutGeo,
        new THREE.MeshBasicMaterial({
            color: 0xD97706, wireframe: true, transparent: true, opacity: 0.35
        })
    );
    ch4_patternMesh.rotation.x = Math.PI / 2;
    group.add(ch4_patternMesh);

    // ---------- 事件绑定 ----------
    document.getElementById('ch4-dist-slider').addEventListener('input', (e) => {
        ch4_config.obsDistance = parseFloat(e.target.value);
        document.getElementById('ch4-dist-val').innerText =
            ch4_config.obsDistance.toFixed(2) + 'λ';

        // 联动近场/远场按钮高亮
        document.getElementById('ch4-btn-near-shortcut').className =
            ch4_config.obsDistance < 1.5 ? 'btn btn-primary' : 'btn';
        document.getElementById('ch4-btn-far-shortcut').className =
            ch4_config.obsDistance >= 1.5 ? 'btn btn-primary' : 'btn';

        // 近场/远场说明面板切换
        document.getElementById('ch4-near-control').classList.toggle(
            'hidden', ch4_config.obsDistance >= 1.5
        );
        document.getElementById('ch4-pattern-control').classList.toggle(
            'hidden', ch4_config.obsDistance < 1.5
        );

        updateMathCh4();
    });

    document.getElementById('ch4-show-donut').addEventListener('change', (e) => {
        ch4_config.showDonut = e.target.checked;
    });
}

// ---------- 偶极子近场流函数 Contour 数值发生器 ----------
// 求解 1/r² + cos/sin 闭合等势线
function generateContourPoints(C, t, isLeft) {
    const pts = [];
    const rStart = 0.3;
    const rEnd = 16.0;
    const steps = 140;
    const omega = 2.0;

    for (let i = 0; i <= steps; i++) {
        const r = rStart + (rEnd - rStart) * (i / steps);
        const phase = omega * t - r;

        // Hertz 偶极子严格极坐标流函数 D
        const D = r * Math.cos(phase) + Math.sin(phase);
        const val = (C * r * r) / D;

        if (val >= 0.0 && val <= 1.002) {
            const clamped = Math.min(1.0, Math.max(0.0, val));
            const sinTheta = Math.sqrt(clamped);
            const cosTheta = Math.sqrt(1.0 - clamped);

            const z = r * sinTheta * (isLeft ? -1 : 1);
            const y = r * cosTheta;

            // 利用极角对称连续缝合曲线成椭圆族
            pts.push(new THREE.Vector3(0, y, z));
            pts.unshift(new THREE.Vector3(0, -y, z));
        }
    }
    return pts;
}

// ---------- 逐帧更新 ----------
function updateChapter4() {
    const { obsDistance, showDonut } = ch4_config;

    // 联动距离自动调节摄像机焦距
    const targetCamZ = 12 + obsDistance * 10;
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCamZ, 0.05);

    if (obsDistance < 1.5) {
        // --- 近场模式：激活等值流场线 ---
        ch4_patternMesh.visible = false;

        ch4_fieldLines.forEach((wave) => {
            wave.lineR.visible = true;
            wave.lineL.visible = true;

            const ptsR = generateContourPoints(wave.cValue, globalTime, false);
            const ptsL = generateContourPoints(wave.cValue, globalTime, true);

            if (ptsR.length > 2) wave.lineR.geometry.setFromPoints(ptsR);
            if (ptsL.length > 2) wave.lineL.geometry.setFromPoints(ptsL);
        });
    } else {
        // --- 远场模式：展现半波振子辐射方向图 ---
        ch4_fieldLines.forEach((w) => {
            w.lineR.visible = false;
            w.lineL.visible = false;
        });

        ch4_patternMesh.visible = showDonut;
        // 呼吸震荡效果
        const scale = 1.0 + 0.04 * Math.sin(globalTime * 3.0);
        ch4_patternMesh.scale.set(scale, scale, scale);
    }
}

// ---------- 近场/远场预设切换 ----------
window.setAntennaPreset = function (zone) {
    const slider = document.getElementById('ch4-dist-slider');
    slider.value = zone === 'near' ? 0.5 : 2.5;
    slider.dispatchEvent(new Event('input'));
};

// ---------- 数学公式渲染 ----------
function updateMathCh4() {
    const { obsDistance } = ch4_config;
    let mathStr = '';

    if (obsDistance < 1.5) {
        mathStr = `\\text{感应场等值流函数: } \\psi(r,\\theta,t) = \\sin^2\\theta \\left[ \\frac{\\cos(\\omega t - r)}{r} + \\frac{\\sin(\\omega t - r)}{r^2} \\right] = C \\\\
        \\Rightarrow \\text{在偶极子根部相互吸引分裂，断裂剥离并射出，完美契合瞬时Maxwell方程}`;
    } else {
        mathStr = `\\text{半波振子辐射远场(E_\\theta): } E_\\theta = j\\eta \\frac{I_0 e^{-jkr}}{2\\pi r} F(\\theta) \\\\
        \\Rightarrow \\text{校准场强方向图: } F(\\theta) = \\left| \\frac{\\cos\\left(\\frac{\\pi}{2}\\cos\\theta\\right)}{\\sin\\theta} \\right| \\quad (\\text{经典黄金瓣甜甜圈})`;
    }

    katex.render(mathStr, document.getElementById('eq-ch4-model'), { displayMode: true });
}
