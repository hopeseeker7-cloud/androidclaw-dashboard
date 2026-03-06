/* ─────────────────────────────────────────────
   charts.js — SVG 차트 & 리소스 미터
───────────────────────────────────────────── */

function svgDonut(pct, color, size, label) {
  const r      = (size / 2) - 8;
  const circ   = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(pct, 100) / 100);
  const gradId = 'g' + Math.random().toString(36).slice(2, 8);
  const labelText = label || '사용';
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="donut-svg">
      <defs>
        <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${color}" />
          <stop offset="100%" stop-color="${color}99" />
        </linearGradient>
      </defs>
      <circle cx="${size/2}" cy="${size/2}" r="${r}"
        stroke="var(--border)" stroke-width="6" fill="none" opacity="0.5" />
      <circle cx="${size/2}" cy="${size/2}" r="${r}"
        stroke="url(#${gradId})" stroke-width="6" fill="none"
        stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"
        stroke-linecap="round" transform="rotate(-90 ${size/2} ${size/2})"
        class="donut-fill" />
      <text x="${size/2}" y="${size/2 - 4}" text-anchor="middle"
        fill="var(--text-primary)" font-family="var(--font-mono)"
        font-size="${size * 0.22}" font-weight="700">${pct}%</text>
      <text x="${size/2}" y="${size/2 + 10}" text-anchor="middle"
        fill="var(--text-dim)" font-family="var(--font-mono)"
        font-size="${size * 0.1}">${labelText}</text>
    </svg>`;
}

function resourceMeter(label, icon, usedLabel, totalLabel, pct, color) {
  const cls = pct > CONFIG.RES_ALERT_PCT ? 'alert' : pct > CONFIG.RES_WARN_PCT ? 'warn' : '';
  return `
    <div class="res-meter">
      <div class="res-meter-icon">${icon}</div>
      <div class="res-meter-body">
        <div class="res-meter-top">
          <span class="res-meter-label">${label}</span>
          <span class="res-meter-nums">${escHtml(usedLabel)} / ${escHtml(totalLabel)}</span>
        </div>
        <div class="res-meter-bar">
          <div class="res-meter-fill ${cls}" style="width:${Math.min(pct,100)}%;background:${color}"></div>
        </div>
      </div>
      <div class="res-meter-pct ${cls}">${pct}%</div>
    </div>`;
}

function svgDonutChart(allocation, size) {
  if (!allocation || !allocation.length) return '';
  const cx = size / 2, cy = size / 2, r = size / 2 - 12, r2 = r - 16;
  let cumAngle = -90;
  const paths   = [];
  const legends = [];

  allocation.forEach((item, i) => {
    const angle    = (item.pct / 100) * 360;
    const startRad = (cumAngle * Math.PI) / 180;
    const endRad   = ((cumAngle + angle) * Math.PI) / 180;
    const x1  = cx + r  * Math.cos(startRad);
    const y1  = cy + r  * Math.sin(startRad);
    const x2  = cx + r  * Math.cos(endRad);
    const y2  = cy + r  * Math.sin(endRad);
    const x1i = cx + r2 * Math.cos(startRad);
    const y1i = cy + r2 * Math.sin(startRad);
    const x2i = cx + r2 * Math.cos(endRad);
    const y2i = cy + r2 * Math.sin(endRad);
    const largeArc = angle > 180 ? 1 : 0;
    const color    = DONUT_COLORS[i % DONUT_COLORS.length];

    if (item.pct >= 100) {
      paths.push(`<circle cx="${cx}" cy="${cy}" r="${(r+r2)/2}" fill="none" stroke="${color}" stroke-width="${r-r2}" />`);
    } else if (item.pct > 0.5) {
      paths.push(`<path d="M${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} L${x2i},${y2i} A${r2},${r2} 0 ${largeArc},0 ${x1i},${y1i} Z" fill="${color}" opacity="0.85"><title>${item.name}: ${item.pct}%</title></path>`);
    }

    legends.push(`<span class="donut-legend-item"><span class="donut-dot" style="background:${color}"></span>${item.name} <b>${item.pct}%</b></span>`);
    cumAngle += angle;
  });

  return `
    <div class="donut-container">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        ${paths.join('')}
        <text x="${cx}" y="${cy - 6}" text-anchor="middle" fill="var(--text-primary)" font-size="12" font-weight="700" font-family="var(--font-mono)">보유비중</text>
        <text x="${cx}" y="${cy + 10}" text-anchor="middle" fill="var(--text-dim)" font-size="10" font-family="var(--font-mono)">(%)</text>
      </svg>
      <div class="donut-legend">${legends.join('')}</div>
    </div>`;
}

function svgLineChart(history, exchangeName, width, height) {
  if (!history || !history.length) return '<div class="chart-empty">데이터 수집 중...</div>';

  const exHistory = history.filter(h => h.exchange === exchangeName);
  if (!exHistory.length) return '<div class="chart-empty">히스토리 없음</div>';

  const values     = exHistory.map(h => h.portfolio_value);
  const dates      = exHistory.map(h => h.date);
  const cashValues = exHistory.map(h => h.cash_krw);

  const minVal = Math.min(...values) * 0.995;
  const maxVal = Math.max(...values) * 1.005;
  const range  = maxVal - minVal || 1;

  const pad = { top: 25, right: 10, bottom: 30, left: 10 };
  const w   = width  - pad.left - pad.right;
  const h   = height - pad.top  - pad.bottom;

  const points = values.map((v, i) => {
    const x = pad.left + (i / Math.max(values.length - 1, 1)) * w;
    const y = pad.top  + h - ((v - minVal) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const cashPoints = cashValues.map((v, i) => {
    const x = pad.left + (i / Math.max(cashValues.length - 1, 1)) * w;
    const y = pad.top  + h - ((v - minVal) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const step    = Math.max(1, Math.floor(dates.length / 8));
  const xLabels = dates.map((d, i) => {
    if (i % step !== 0 && i !== dates.length - 1) return '';
    const x = pad.left + (i / Math.max(dates.length - 1, 1)) * w;
    return `<text x="${x.toFixed(1)}" y="${height - 5}" text-anchor="middle" fill="var(--text-dim)" font-size="9" font-family="var(--font-mono)">${d.slice(5)}</text>`;
  }).filter(Boolean).join('');

  const maxIdx = values.indexOf(Math.max(...values));
  const minIdx = values.indexOf(Math.min(...values));
  const maxX   = pad.left + (maxIdx / Math.max(values.length - 1, 1)) * w;
  const maxY   = pad.top  + h - ((values[maxIdx] - minVal) / range) * h;
  const minX   = pad.left + (minIdx / Math.max(values.length - 1, 1)) * w;
  const minY   = pad.top  + h - ((values[minIdx] - minVal) / range) * h;

  return `
    <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#A78BFA" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#A78BFA" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      ${[0,0.25,0.5,0.75,1].map(f => {
        const y = pad.top + h * (1-f);
        return `<line x1="${pad.left}" y1="${y}" x2="${width-pad.right}" y2="${y}" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="3,3"/>`;
      }).join('')}
      <polygon points="${points.join(' ')} ${(pad.left + w).toFixed(1)},${(pad.top + h).toFixed(1)} ${pad.left},${(pad.top + h).toFixed(1)}" fill="url(#lineGrad)" />
      <polyline points="${points.join(' ')}" fill="none" stroke="#A78BFA" stroke-width="2" stroke-linejoin="round" />
      <polyline points="${cashPoints.join(' ')}" fill="none" stroke="#F59E0B" stroke-width="1.5" stroke-dasharray="4,3" stroke-linejoin="round" opacity="0.7" />
      ${values.length > 0 ? `<circle cx="${points[points.length-1].split(',')[0]}" cy="${points[points.length-1].split(',')[1]}" r="3.5" fill="#A78BFA" />` : ''}
      <text x="${maxX}" y="${maxY - 8}" text-anchor="middle" fill="#34D399" font-size="9" font-weight="600" font-family="var(--font-mono)">max ${Math.round(values[maxIdx]).toLocaleString()}</text>
      ${minIdx !== maxIdx ? `<text x="${minX}" y="${minY + 14}" text-anchor="middle" fill="#F472B6" font-size="9" font-weight="600" font-family="var(--font-mono)">min ${Math.round(values[minIdx]).toLocaleString()}</text>` : ''}
      ${xLabels}
      <circle cx="${pad.left + 5}" cy="10" r="4" fill="#A78BFA"/>
      <text x="${pad.left + 14}" y="13" fill="var(--text-dim)" font-size="9" font-family="var(--font-mono)">총자산</text>
      <circle cx="${pad.left + 65}" cy="10" r="4" fill="#F59E0B"/>
      <text x="${pad.left + 74}" y="13" fill="var(--text-dim)" font-size="9" font-family="var(--font-mono)">현금</text>
    </svg>`;
}
