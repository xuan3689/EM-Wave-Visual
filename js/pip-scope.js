// ==========================================
// pip-scope.js - 极化矢量轨迹仪 (PiP Scope)
// 职责: 2D 画中画示波器、MATLAB 学术绘图风、
//       E/H 矢量实时轨迹、极化椭圆描迹
// ==========================================

let pipCanvas, pipCtx;

// ---------- 初始化画布 ----------
function initPip() {
    pipCanvas = document.getElementById('pip-canvas');
    pipCanvas.width = 220;
    pipCanvas.height = 200;
    pipCtx = pipCanvas.getContext('2d');
}

// ---------- 每帧更新示波器 ----------
function updatePip() {
    if (!pipCtx) return;
    pipCtx.clearRect(0, 0, pipCanvas.width, pipCanvas.height);

    const centerX = 110;
    const centerY = 105;
    const radius = 65;

    // 1. 绘制极坐标网格 (虚线)
    pipCtx.beginPath();
    pipCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    pipCtx.strokeStyle = '#26292d';
    pipCtx.lineWidth = 1;
    pipCtx.stroke();

    pipCtx.beginPath();
    pipCtx.arc(centerX, centerY, radius * 0.6, 0, Math.PI * 2);
    pipCtx.strokeStyle = '#1a1d21';
    pipCtx.setLineDash([3, 3]);
    pipCtx.stroke();
    pipCtx.setLineDash([]);

    // 十字准线
    pipCtx.beginPath();
    pipCtx.moveTo(centerX - radius, centerY);
    pipCtx.lineTo(centerX + radius, centerY);
    pipCtx.moveTo(centerX, centerY - radius);
    pipCtx.lineTo(centerX, centerY + radius);
    pipCtx.strokeStyle = '#26292d';
    pipCtx.stroke();

    // 2. 物理极化振幅与相位差提取
    let exAmp = radius - 10;
    let eyAmp = radius - 10;
    let phaseD = 0;

    if (currentChapter === 1) {
        exAmp = (ch1_config.Ex / 3.0) * (radius - 12);
        eyAmp = (ch1_config.Ey / 3.0) * (radius - 12);
        phaseD = ch1_config.phaseDiff;
    }

    // 3. 背景极化偏振轨迹 (描线)
    if (currentChapter === 1 && (exAmp > 1 || eyAmp > 1)) {
        pipCtx.beginPath();
        for (let deg = 0; deg <= 360; deg += 2) {
            const rad = deg * Math.PI / 180;
            const tx = exAmp * Math.cos(rad);
            const ty = eyAmp * Math.cos(rad + phaseD);
            if (deg === 0) pipCtx.moveTo(centerX + tx, centerY - ty);
            else pipCtx.lineTo(centerX + tx, centerY - ty);
        }
        pipCtx.strokeStyle = 'rgba(239, 68, 68, 0.18)';
        pipCtx.lineWidth = 1.5;
        pipCtx.stroke();
    }

    // 4. 计算极坐标旋转矢量位置
    let phaseE = globalTime * 2.0;
    let phaseH = phaseE;

    if (currentChapter === 1) {
        phaseH = phaseE - ch1_config.impedanceTheta - ch1_config.phaseDiff;
    } else if (currentChapter === 2) {
        phaseH = phaseE - ch2_config.sigma * 0.15;
    } else if (currentChapter === 3) {
        phaseH = phaseE - Math.PI / 2;
    }

    const Ex = Math.cos(phaseE) * exAmp;
    const Ey = Math.sin(phaseE + phaseD) * eyAmp;

    const Hx = Math.cos(phaseH) * (radius - 22);
    const Hy = Math.sin(phaseH) * (radius - 22);

    // 5. 绘制电场 E 矢量 (红色)
    _drawVector2D(pipCtx, centerX, centerY, centerX + Ex, centerY - Ey, '#EF4444');

    // 6. 绘制磁场 H 矢量 (蓝色)
    _drawVector2D(pipCtx, centerX, centerY, centerX + Hx, centerY - Hy, '#3B82F6');

    // 7. 相位差标注
    pipCtx.fillStyle = '#8A99AD';
    pipCtx.font = '9px monospace';
    const diffDeg = Math.round((phaseE - phaseH) * 180 / Math.PI) % 360;
    pipCtx.fillText(`矢量瞬时相位差 (Δ): ${Math.abs(diffDeg)}°`, 10, 15);
}

// ---------- 2D 矢量箭头绘制 ----------
function _drawVector2D(ctx, fx, fy, tx, ty, color) {
    // 矢量线
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(tx, ty);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.0;
    ctx.stroke();

    // 箭头三角形
    const angle = Math.atan2(ty - fy, tx - fx);
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(
        tx - 6 * Math.cos(angle - Math.PI / 6),
        ty - 6 * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
        tx - 6 * Math.cos(angle + Math.PI / 6),
        ty - 6 * Math.sin(angle + Math.PI / 6)
    );
    ctx.fillStyle = color;
    ctx.fill();
}
