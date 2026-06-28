// ==========================================
// ch2-boundary-reflection.js - 第二章：边界反射、折射与趋肤
// 职责: 斯涅尔定律、菲涅尔系数、TE/TM 极化、
//       全反射倏逝波、电导率衰减
// ==========================================

// ---------- 章节配置 ----------
const ch2_config = {
    theta_i: 45 * Math.PI / 180,
    n1: 1.0,
    n2: 1.5,
    sigma: 0,              // 等效电导率
    polarization: 'TE',
    zInterface: 15.0,
    zMax: 30.0
};

// ---------- 3D 对象引用 ----------
let ch2_boundaryPlane;
const ch2_rayLines = { inc: null, ref: null, trans: null };
const ch2_rayStems = { inc: null, ref: null, trans: null };
let ch2_evanescentLine;
let ch2_tirOverlay = null;   // 全反射时高亮边界

// ---------- 初始化 ----------
function initChapter2() {
    const group = sceneGroups.ch2;

    // 1. 介质分界面 (半透明磨砂网格)
    const planeGeo = new THREE.PlaneGeometry(30, 20);
    const planeMat = new THREE.MeshBasicMaterial({
        color: 0x475569, transparent: true, opacity: 0.15, side: THREE.DoubleSide
    });
    ch2_boundaryPlane = new THREE.Mesh(planeGeo, planeMat);
    ch2_boundaryPlane.position.set(0, 0, ch2_config.zInterface);
    group.add(ch2_boundaryPlane);

    const borderGeo = new THREE.EdgesGeometry(planeGeo);
    const borderLine = new THREE.LineSegments(
        borderGeo, new THREE.LineBasicMaterial({ color: 0x475569 })
    );
    borderLine.position.set(0, 0, ch2_config.zInterface);
    group.add(borderLine);

    // 2. 法线虚线
    const normalPoints = [
        new THREE.Vector3(0, 0, ch2_config.zInterface - 8),
        new THREE.Vector3(0, 0, ch2_config.zInterface + 8)
    ];
    const normalGeo = new THREE.BufferGeometry().setFromPoints(normalPoints);
    const normalLine = new THREE.LineSegments(
        normalGeo,
        new THREE.LineDashedMaterial({ color: 0x94a3b8, dashSize: 0.5, gapSize: 0.25 })
    );
    normalLine.computeLineDistances();
    group.add(normalLine);

    // 3. 三条波动示踪曲线 (入射/反射/折射)
    ch2_rayLines.inc = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color: 0xEF4444, linewidth: 2 })
    );
    ch2_rayLines.ref = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color: 0xF59E0B, linewidth: 2 })
    );
    ch2_rayLines.trans = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color: 0x10B981, linewidth: 2 })
    );

    ch2_rayLines.inc.geometry.setAttribute(
        'position', new THREE.BufferAttribute(new Float32Array(100 * 3), 3)
    );
    ch2_rayLines.ref.geometry.setAttribute(
        'position', new THREE.BufferAttribute(new Float32Array(100 * 3), 3)
    );
    ch2_rayLines.trans.geometry.setAttribute(
        'position', new THREE.BufferAttribute(new Float32Array(100 * 3), 3)
    );
    group.add(ch2_rayLines.inc, ch2_rayLines.ref, ch2_rayLines.trans);

    // 4. 梳齿线 (Stem lines)
    ch2_rayStems.inc = new THREE.LineSegments(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color: 0xFCA5A5, transparent: true, opacity: 0.4 })
    );
    ch2_rayStems.ref = new THREE.LineSegments(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color: 0xFDE68A, transparent: true, opacity: 0.4 })
    );
    ch2_rayStems.trans = new THREE.LineSegments(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color: 0xA7F3D0, transparent: true, opacity: 0.4 })
    );

    ch2_rayStems.inc.geometry.setAttribute(
        'position', new THREE.BufferAttribute(new Float32Array(30 * 2 * 3), 3)
    );
    ch2_rayStems.ref.geometry.setAttribute(
        'position', new THREE.BufferAttribute(new Float32Array(30 * 2 * 3), 3)
    );
    ch2_rayStems.trans.geometry.setAttribute(
        'position', new THREE.BufferAttribute(new Float32Array(30 * 2 * 3), 3)
    );
    group.add(ch2_rayStems.inc, ch2_rayStems.ref, ch2_rayStems.trans);

    // 5. 表面倏逝波 (全反射专用)
    ch2_evanescentLine = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color: 0x06B6D4, transparent: true, opacity: 0.8 })
    );
    ch2_evanescentLine.geometry.setAttribute(
        'position', new THREE.BufferAttribute(new Float32Array(100 * 3), 3)
    );
    group.add(ch2_evanescentLine);

    // 6. 全反射边界高亮覆盖层 (默认透明隐藏)
    const tirOverlayGeo = new THREE.PlaneGeometry(30, 20);
    const tirOverlayMat = new THREE.MeshBasicMaterial({
        color: 0xEF4444, transparent: true, opacity: 0, side: THREE.DoubleSide
    });
    ch2_tirOverlay = new THREE.Mesh(tirOverlayGeo, tirOverlayMat);
    ch2_tirOverlay.position.set(0, 0, ch2_config.zInterface + 0.02);
    group.add(ch2_tirOverlay);

    // ---------- 事件绑定 ----------
    document.getElementById('ch2-angle-slider').addEventListener('input', (e) => {
        ch2_config.theta_i = parseInt(e.target.value) * Math.PI / 180;
        document.getElementById('ch2-angle-val').innerText = e.target.value + '°';
        updateMathCh2();
    });
    document.getElementById('ch2-n2-slider').addEventListener('input', (e) => {
        ch2_config.n2 = parseFloat(e.target.value);
        document.getElementById('ch2-n2-val').innerText = ch2_config.n2.toFixed(2);
        updateMathCh2();
    });
    document.getElementById('ch2-sigma-slider').addEventListener('input', (e) => {
        ch2_config.sigma = parseFloat(e.target.value);
        document.getElementById('ch2-sigma-val').innerText = ch2_config.sigma.toFixed(1);
        updateMathCh2();
    });
}

// ---------- 逐帧更新 ----------
function updateChapter2() {
    const { theta_i, n1, n2, sigma, zInterface, zMax, polarization } = ch2_config;
    const w = 2.0;
    const k1 = 0.8;

    // 斯涅尔定律
    const sin_t = (n1 / n2) * Math.sin(theta_i);
    const tir = sin_t > 1.0;
    const theta_t = tir ? Math.PI / 2 : Math.asin(sin_t);

    // 菲涅尔系数
    const cos_i = Math.cos(theta_i);
    const cos_t = tir ? 0.0 : Math.cos(theta_t);
    let R_coef = 0, T_coef = 0;

    if (polarization === 'TE') {
        R_coef = (n1 * cos_i - n2 * cos_t) / (n1 * cos_i + n2 * cos_t);
        T_coef = (2 * n1 * cos_i) / (n1 * cos_i + n2 * cos_t);
    } else {
        R_coef = (n2 * cos_i - n1 * cos_t) / (n2 * cos_i + n1 * cos_t);
        T_coef = (2 * n1 * cos_i) / (n2 * cos_i + n1 * cos_t);
    }
    if (tir) { R_coef = 1.0; T_coef = 0.0; }

    const s_max1 = zInterface / Math.cos(theta_i);
    const s_max2 = (zMax - zInterface) / (tir ? 1.0 : Math.cos(theta_t));

    // 电场偏振方向向量
    const e_inc = polarization === 'TE'
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(Math.cos(theta_i), 0, -Math.sin(theta_i));
    const e_ref = polarization === 'TE'
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(Math.cos(theta_i), 0, Math.sin(theta_i));
    const e_trans = polarization === 'TE'
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(Math.cos(theta_t), 0, -Math.sin(theta_t));

    const alpha = sigma * 0.45;
    const k2 = k1 * (n2 / n1);

    // --- 更新入射波 ---
    const posInc = ch2_rayLines.inc.geometry.attributes.position.array;
    const stemInc = ch2_rayStems.inc.geometry.attributes.position.array;
    for (let i = 0; i < 100; i++) {
        const s = (i / 99) * s_max1;
        const phase = w * globalTime - k1 * s;
        const amp = 2.0 * Math.cos(phase);

        const p = new THREE.Vector3(
            (s - s_max1) * Math.sin(theta_i), 0, s * Math.cos(theta_i)
        );
        p.addScaledVector(e_inc, amp);
        posInc[i * 3] = p.x; posInc[i * 3 + 1] = p.y; posInc[i * 3 + 2] = p.z;

        if (i % 3 === 0 && i < 90) {
            const s_stem = (i / 90) * s_max1;
            const p_axis = new THREE.Vector3(
                (s_stem - s_max1) * Math.sin(theta_i), 0, s_stem * Math.cos(theta_i)
            );
            const amp_stem = 2.0 * Math.cos(w * globalTime - k1 * s_stem);
            const p_wave = p_axis.clone().addScaledVector(e_inc, amp_stem);

            const idx = (i / 3) * 6;
            stemInc[idx] = p_axis.x; stemInc[idx + 1] = p_axis.y; stemInc[idx + 2] = p_axis.z;
            stemInc[idx + 3] = p_wave.x; stemInc[idx + 4] = p_wave.y; stemInc[idx + 5] = p_wave.z;
        }
    }
    ch2_rayLines.inc.geometry.attributes.position.needsUpdate = true;
    ch2_rayStems.inc.geometry.attributes.position.needsUpdate = true;

    // --- 更新反射波 ---
    const posRef = ch2_rayLines.ref.geometry.attributes.position.array;
    const stemRef = ch2_rayStems.ref.geometry.attributes.position.array;
    for (let i = 0; i < 100; i++) {
        const s = (i / 99) * s_max1;
        const phase = w * globalTime - k1 * s_max1 - k1 * s;
        const amp = 2.0 * R_coef * Math.cos(phase);

        const p = new THREE.Vector3(
            s * Math.sin(theta_i), 0, zInterface - s * Math.cos(theta_i)
        );
        p.addScaledVector(e_ref, amp);
        posRef[i * 3] = p.x; posRef[i * 3 + 1] = p.y; posRef[i * 3 + 2] = p.z;

        if (i % 3 === 0 && i < 90) {
            const s_stem = (i / 90) * s_max1;
            const p_axis = new THREE.Vector3(
                s_stem * Math.sin(theta_i), 0, zInterface - s_stem * Math.cos(theta_i)
            );
            const amp_stem = 2.0 * R_coef * Math.cos(w * globalTime - k1 * s_max1 - k1 * s_stem);
            const p_wave = p_axis.clone().addScaledVector(e_ref, amp_stem);

            const idx = (i / 3) * 6;
            stemRef[idx] = p_axis.x; stemRef[idx + 1] = p_axis.y; stemRef[idx + 2] = p_axis.z;
            stemRef[idx + 3] = p_wave.x; stemRef[idx + 4] = p_wave.y; stemRef[idx + 5] = p_wave.z;
        }
    }
    ch2_rayLines.ref.geometry.attributes.position.needsUpdate = true;
    ch2_rayStems.ref.geometry.attributes.position.needsUpdate = true;

    // --- 更新折射波 / 倏逝波 ---
    const posTrans = ch2_rayLines.trans.geometry.attributes.position.array;
    const stemTrans = ch2_rayStems.trans.geometry.attributes.position.array;

    if (tir) {
        // 全反射：显示倏逝波
        ch2_rayLines.trans.visible = false;
        ch2_rayStems.trans.visible = false;
        ch2_evanescentLine.visible = true;

        const posEva = ch2_evanescentLine.geometry.attributes.position.array;
        for (let i = 0; i < 100; i++) {
            const x = (i / 99) * 20.0 - 10.0;
            const depth = 2.0;
            const amp = 2.0 * Math.exp(-1.5 * depth) *
                Math.cos(w * globalTime - k1 * Math.sin(theta_i) * x);
            posEva[i * 3] = x;
            posEva[i * 3 + 1] = amp;
            posEva[i * 3 + 2] = zInterface + 0.3;
        }
        ch2_evanescentLine.geometry.attributes.position.needsUpdate = true;

        // 全反射脉冲动画
        if (ch2_tirOverlay) {
            const pulse = 0.15 + 0.1 * Math.sin(globalTime * 4.0);
            ch2_tirOverlay.material.opacity = pulse;
        }
    } else {
        // 正常折射
        ch2_rayLines.trans.visible = true;
        ch2_rayStems.trans.visible = true;
        ch2_evanescentLine.visible = false;

        if (ch2_tirOverlay) ch2_tirOverlay.material.opacity = 0;

        for (let i = 0; i < 100; i++) {
            const s = (i / 99) * s_max2;
            const decay = Math.exp(-alpha * s);
            const phase = w * globalTime - k1 * s_max1 - k2 * s;
            const amp = 2.0 * T_coef * decay * Math.cos(phase);

            const p = new THREE.Vector3(
                s * Math.sin(theta_t), 0, zInterface + s * Math.cos(theta_t)
            );
            p.addScaledVector(e_trans, amp);
            posTrans[i * 3] = p.x; posTrans[i * 3 + 1] = p.y; posTrans[i * 3 + 2] = p.z;

            if (i % 3 === 0 && i < 90) {
                const s_stem = (i / 90) * s_max2;
                const decay_stem = Math.exp(-alpha * s_stem);
                const p_axis = new THREE.Vector3(
                    s_stem * Math.sin(theta_t), 0, zInterface + s_stem * Math.cos(theta_t)
                );
                const amp_stem = 2.0 * T_coef * decay_stem *
                    Math.cos(w * globalTime - k1 * s_max1 - k2 * s_stem);
                const p_wave = p_axis.clone().addScaledVector(e_trans, amp_stem);

                const idx = (i / 3) * 6;
                stemTrans[idx] = p_axis.x; stemTrans[idx + 1] = p_axis.y; stemTrans[idx + 2] = p_axis.z;
                stemTrans[idx + 3] = p_wave.x; stemTrans[idx + 4] = p_wave.y; stemTrans[idx + 5] = p_wave.z;
            }
        }
        ch2_rayLines.trans.geometry.attributes.position.needsUpdate = true;
        ch2_rayStems.trans.geometry.attributes.position.needsUpdate = true;
    }
}

// ---------- 极化切换 ----------
window.setPolarizationCh2 = function (pol) {
    ch2_config.polarization = pol;
    document.getElementById('ch2-btn-te').className =
        pol === 'TE' ? 'btn btn-primary' : 'btn';
    document.getElementById('ch2-btn-tm').className =
        pol === 'TM' ? 'btn btn-primary' : 'btn';
    updateMathCh2();
};

// ---------- 数学公式渲染 & 全反射界面更新 ----------
function updateMathCh2() {
    const { theta_i, n1, n2, sigma, polarization } = ch2_config;
    const sin_t = (n1 / n2) * Math.sin(theta_i);
    const tir = sin_t > 1.0;

    // 临界角计算
    const critAngle = n2 < n1
        ? (Math.asin(n2 / n1) * 180 / Math.PI).toFixed(1)
        : null;
    document.getElementById('ch2-crit-angle').innerText =
        critAngle ? critAngle + '°' : '— (n₂ ≥ n₁)';

    // 全反射指示器
    const badge = document.getElementById('ch2-tir-badge');
    const hint = document.getElementById('ch2-tir-hint');
    if (tir) {
        badge.classList.remove('hidden');
        hint.innerText = '全反射发生！折射波消失，能量全部返回媒质1，沿界面激发表面倏逝波';
        hint.classList.remove('text-slate-600');
        hint.classList.add('text-red-400');
    } else {
        badge.classList.add('hidden');
        hint.innerText = critAngle
            ? `入射角 ${(theta_i * 180 / Math.PI).toFixed(0)}° < 临界角 ${critAngle}°，正常折射`
            : 'n₂ ≥ n₁ 时不会发生全反射，始终有折射波';
        hint.classList.remove('text-red-400');
        hint.classList.add('text-slate-600');
    }

    // 高亮全反射时相关滑块
    document.getElementById('ch2-angle-slider').style.accentColor = tir ? '#ef4444' : '';

    const mathSnell = tir
        ? `\\theta_i (${(theta_i * 180 / Math.PI).toFixed(0)}^\\circ) > \\theta_c (${critAngle}^\\circ) \\Rightarrow \\text{激发表面波(倏逝波)，在媒质2中沿z向截止}`
        : `n_1 \\sin\\theta_i = n_2 \\sin\\theta_t \\Rightarrow \\theta_t \\approx ${Math.round(Math.asin(sin_t) * 180 / Math.PI)}^\\circ`;

    const mathFresnel = polarization === 'TE'
        ? `R_{TE} = \\frac{n_1 \\cos\\theta_i - n_2 \\cos\\theta_t}{n_1 \\cos\\theta_i + n_2 \\cos\\theta_t}`
        : `R_{TM} = \\frac{n_2 \\cos\\theta_i - n_1 \\cos\\theta_t}{n_2 \\cos\\theta_i + n_1 \\cos\\theta_t}`;

    const skinDepth = sigma > 0
        ? `\\text{趋肤深度 } \\delta_s = \\frac{1}{\\alpha} \\approx ${(1 / (sigma * 0.45)).toFixed(2)} \\text{ m (场强衰减至 } 1/e\\text{)}`
        : `\\text{理想无耗介质: } \\sigma = 0 \\Rightarrow \\delta_s \\rightarrow \\infty`;

    katex.render(mathFresnel, document.getElementById('eq-ch2-fresnel'), { displayMode: true });
    katex.render(mathSnell, document.getElementById('eq-ch2-snell'), { displayMode: true });
    katex.render(skinDepth, document.getElementById('eq-ch2-skin'), { displayMode: true });
}
