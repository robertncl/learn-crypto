import { el, svgEl } from './dom.js';

/* ============================== Charts ==============================

   A small SVG chart for the demos: line, area and bar series on one shared y-axis
   (never two — compare different units in separate charts), optional log scale,
   labeled reference lines and labeled points. Includes a crosshair tooltip that
   works with pointer and keyboard (← → Home End), a screen-reader readout, and a
   collapsible data table so no value is reachable only by hovering.

   const chart = createChart(host, { title, xs, series, x, y, refs, points, height });
   chart.update({ ...changedOptions });                                            */

const MARGIN = { top: 14, right: 16, bottom: 30, left: 50 };

function niceTicks(min, max, count = 4) {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0);
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(Number(v.toPrecision(12)));
  return ticks;
}

function logTicks(min, max) {
  const ticks = [];
  for (let e = Math.ceil(Math.log10(min)); e <= Math.floor(Math.log10(max)); e++) ticks.push(10 ** e);
  return ticks;
}

export function createChart(host, initial) {
  let opts = { height: 200, ...initial };
  let active = null; // index under the crosshair

  const svgHost = el('div', { className: 'chart-plot' });
  const tip = el('div', { className: 'chart-tip', hidden: true, 'aria-hidden': 'true' });
  const readout = el('span', { className: 'visually-hidden', 'aria-live': 'polite' });
  const frame = el('div', {
    className: 'chart-frame',
    tabIndex: 0,
    role: 'group',
    'aria-label': `${opts.title}. Use the left and right arrow keys to read values.`,
  }, svgHost, tip, readout);
  const caption = el('p', { className: 'chart-title', 'aria-hidden': 'true' });
  const legend = el('ul', { className: 'chart-legend' });
  const table = el('details', { className: 'chart-table' });
  host.replaceChildren(caption, legend, frame, table);

  let geom = null; // scales from the last render, for hit-testing

  function render(announce = false) {
    const width = Math.max(260, frame.clientWidth || host.clientWidth || 520);
    const { height, xs, series } = opts;
    const isBar = series.some((s) => s.type === 'bar');

    /* ---- scales ---- */
    const yLog = Boolean(opts.y?.log);
    const allY = series.flatMap((s) => s.values).filter((v) => Number.isFinite(v) && (!yLog || v > 0));
    let yMin = opts.y?.min ?? Math.min(0, ...allY);
    let yMax = opts.y?.max ?? Math.max(...allY, ...(opts.refs ?? []).map((r) => r.y));
    if (yMax === yMin) yMax = yMin + 1;
    if (yLog) { yMin = Math.max(yMin, 1e-12); }
    const fmtY = opts.y?.format ?? ((v) => String(v));
    const yTicks = (opts.y?.ticks ?? (yLog ? logTicks(yMin, yMax) : niceTicks(yMin, yMax)))
      .filter((t) => t >= yMin - 1e-12 && t <= yMax * (1 + 1e-9));
    // Make room for the longest y tick label (~6.5px per character at 11px).
    const M = { ...MARGIN, left: Math.max(MARGIN.left, 12 + 6.5 * Math.max(0, ...yTicks.map((t) => String(fmtY(t)).length))) };
    const plotW = width - M.left - M.right;
    const plotH = height - M.top - M.bottom;
    const sy = yLog
      ? (v) => M.top + plotH * (1 - (Math.log10(Math.max(v, yMin)) - Math.log10(yMin)) / (Math.log10(yMax) - Math.log10(yMin)))
      : (v) => M.top + plotH * (1 - (v - yMin) / (yMax - yMin));

    const n = xs.length;
    const band = plotW / Math.max(n, 1);
    const xMin = opts.x?.min ?? Math.min(...xs);
    const xMax = opts.x?.max ?? Math.max(...xs);
    const sx = isBar
      ? (i) => M.left + band * (i + 0.5)
      : (i) => M.left + plotW * ((xs[i] - xMin) / (xMax - xMin || 1));
    const sxValue = (v) => M.left + plotW * ((v - xMin) / (xMax - xMin || 1));
    geom = { sx, n, isBar, band, plotW };

    const fmtX = opts.x?.format ?? ((v) => String(v));

    const svg = svgEl('svg', {
      width, height, viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': opts.title, class: 'chart-svg',
    });

    /* ---- grid + y ticks ---- */
    for (const t of yTicks) {
      const y = sy(t);
      svg.append(svgEl('line', { x1: M.left, x2: width - M.right, y1: y, y2: y, class: 'chart-grid' }));
      svg.append(svgEl('text', { x: M.left - 6, y: y + 4, 'text-anchor': 'end', class: 'chart-tick' }, fmtY(t)));
    }
    /* ---- x ticks ---- */
    const xTickIdx = opts.x?.tickIndexes ?? (() => {
      const want = Math.max(2, Math.floor(plotW / 70));
      const step = Math.max(1, Math.ceil(n / want));
      return xs.map((_, i) => i).filter((i) => i % step === 0);
    })();
    // Drop any tick label that would crowd the previous one (narrow screens).
    let lastTickX = -Infinity;
    for (const i of xTickIdx) {
      const label = String(fmtX(xs[i], i));
      const x = sx(i);
      if (x - lastTickX < label.length * 6.5 + 10) continue;
      lastTickX = x;
      svg.append(svgEl('text', { x, y: height - M.bottom + 16, 'text-anchor': 'middle', class: 'chart-tick' }, label));
    }
    if (opts.x?.label) {
      svg.append(svgEl('text', { x: width - M.right, y: height - 2, 'text-anchor': 'end', class: 'chart-axis-label' }, opts.x.label));
    }
    if (opts.y?.label) {
      svg.append(svgEl('text', { x: M.left, y: M.top - 4, 'text-anchor': 'start', class: 'chart-axis-label' }, opts.y.label));
    }
    const baseY = yLog ? M.top + plotH : sy(Math.max(yMin, 0));
    svg.append(svgEl('line', { x1: M.left, x2: width - M.right, y1: baseY, y2: baseY, class: 'chart-axis' }));

    /* ---- series ---- */
    const barSeries = series.filter((s) => s.type === 'bar');
    const barW = Math.min(24, (band - 2) / Math.max(barSeries.length, 1));
    for (const s of series) {
      if (s.type === 'bar') {
        const k = barSeries.indexOf(s);
        s.values.forEach((v, i) => {
          if (!Number.isFinite(v)) return;
          const x = sx(i) - (barSeries.length * barW) / 2 + k * barW + 1;
          const w = Math.max(1, barW - 2); // 2px surface gap between neighbours
          const top = sy(v);
          const h = Math.max(0, baseY - top);
          const r = Math.min(4, w / 2, h);
          const d = `M${x},${baseY}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${baseY}Z`;
          svg.append(svgEl('path', { d, class: `chart-bar${i === opts.highlight ? ' is-highlight' : ''}`, style: `fill:${s.color}` }));
        });
      } else {
        const pts = s.values.map((v, i) => (Number.isFinite(v) && (!yLog || v > 0) ? [sx(i), sy(v)] : null));
        const segs = [];
        let cur = [];
        for (const p of pts) {
          if (p) cur.push(p);
          else if (cur.length) { segs.push(cur); cur = []; }
        }
        if (cur.length) segs.push(cur);
        for (const seg of segs) {
          const d = seg.map(([x, y], j) => `${j ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
          if (s.type === 'area') {
            svg.append(svgEl('path', { d: `${d}L${seg.at(-1)[0]},${baseY}L${seg[0][0]},${baseY}Z`, class: 'chart-area', style: `fill:${s.color}` }));
          }
          svg.append(svgEl('path', { d, class: `chart-line${s.dashed ? ' is-dashed' : ''}`, style: `stroke:${s.color}` }));
        }
        if (s.markers) {
          pts.forEach((p) => p && svg.append(svgEl('circle', { cx: p[0], cy: p[1], r: 4, class: 'chart-dot', style: `fill:${s.color}` })));
        }
        if (s.endLabel && pts.at(-1)) {
          const [x, y] = pts.at(-1);
          svg.append(svgEl('text', { x: x - 4, y: y - 8, 'text-anchor': 'end', class: 'chart-direct-label' }, s.endLabel));
        }
      }
    }

    /* ---- reference lines (targets, thresholds) ---- */
    for (const ref of opts.refs ?? []) {
      const y = sy(ref.y);
      svg.append(svgEl('line', { x1: M.left, x2: width - M.right, y1: y, y2: y, class: 'chart-ref' }));
      svg.append(svgEl('text', { x: width - M.right, y: y - 5, 'text-anchor': 'end', class: 'chart-ref-label' }, ref.label));
    }

    /* ---- labeled points (e.g. "you are here") ---- */
    for (const p of opts.points ?? []) {
      const cx = p.index !== undefined ? sx(p.index) : sxValue(p.x);
      const cy = sy(p.y);
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
      svg.append(svgEl('circle', { cx, cy, r: 5, class: 'chart-dot is-point', style: `fill:${p.color ?? 'var(--series-1)'}` }));
      if (p.label) {
        // Default corner: above, on whichever side has room. Callers can pick one to avoid collisions.
        const place = p.place ?? (cx < M.left + plotW * 0.7 ? 'above-right' : 'above-left');
        const right = place.endsWith('right');
        const below = place.startsWith('below');
        svg.append(svgEl('text', {
          x: cx + (right ? 9 : -9), y: cy + (below ? 16 : -8), 'text-anchor': right ? 'start' : 'end', class: 'chart-direct-label',
        }, p.label));
      }
    }

    /* ---- crosshair ---- */
    if (active !== null && active < n) {
      const x = sx(active);
      svg.append(svgEl('line', { x1: x, x2: x, y1: M.top, y2: M.top + plotH, class: 'chart-crosshair' }));
      for (const s of series) {
        const v = s.values[active];
        if (s.type !== 'bar' && Number.isFinite(v) && (!yLog || v > 0)) {
          svg.append(svgEl('circle', { cx: x, cy: sy(v), r: 4, class: 'chart-dot', style: `fill:${s.color}` }));
        }
      }
    }

    svgHost.replaceChildren(svg);
    renderTip(announce);
  }

  function renderTip(announce = false) {
    if (active === null || active >= opts.xs.length) { tip.hidden = true; return; }
    const fmtY = opts.tooltipFormat ?? opts.y?.format ?? ((v) => String(v));
    const fmtX = opts.x?.tooltipFormat ?? opts.x?.format ?? ((v) => String(v));
    const rows = opts.series.map((s) => el('p', { className: 'chart-tip-row' },
      el('span', { className: 'chart-key', style: `--key:${s.color}` }),
      el('strong', { textContent: Number.isFinite(s.values[active]) ? fmtY(s.values[active], s) : '–' }),
      el('span', { textContent: ` ${s.label}` })));
    tip.replaceChildren(el('p', { className: 'chart-tip-x', textContent: fmtX(opts.xs[active], active) }), ...rows);
    tip.hidden = false;
    const x = geom.sx(active);
    const left = x > frame.clientWidth * 0.6;
    tip.style.insetInlineStart = left ? 'auto' : `${x + 12}px`;
    tip.style.insetInlineEnd = left ? `${frame.clientWidth - x + 12}px` : 'auto';
    // Announce only keyboard-driven moves; pointer hovering would be a stream of chatter.
    if (announce) {
      const values = opts.series.map((s) => `${Number.isFinite(s.values[active]) ? fmtY(s.values[active], s) : 'no value'} ${s.label}`);
      readout.textContent = `${fmtX(opts.xs[active], active)}: ${values.join(', ')}`;
    }
  }

  function renderLegend() {
    // A single series is named by the chart's title; two or more get a legend.
    legend.hidden = opts.series.length < 2 && !opts.legend;
    legend.replaceChildren(...opts.series.map((s) => el('li', {},
      el('span', { className: `chart-key${s.type === 'bar' || s.type === 'area' ? ' is-box' : ''}${s.dashed ? ' is-dashed' : ''}`, style: `--key:${s.color}` }),
      s.label)));
  }

  function renderTable() {
    if (opts.table === false) { table.hidden = true; return; }
    const fmtX = opts.x?.tooltipFormat ?? opts.x?.format ?? ((v) => String(v));
    const fmtY = opts.tooltipFormat ?? opts.y?.format ?? ((v) => String(v));
    const wasOpen = table.open;
    table.replaceChildren(
      el('summary', { textContent: 'Show data table' }),
      el('div', { className: 'table-wrap' }, el('table', {},
        el('thead', {}, el('tr', {},
          el('th', { scope: 'col', textContent: opts.x?.label ?? '' }),
          ...opts.series.map((s) => el('th', { scope: 'col', textContent: s.label })))),
        el('tbody', {}, ...opts.xs.map((xv, i) => el('tr', {},
          el('th', { scope: 'row', textContent: fmtX(xv, i) }),
          ...opts.series.map((s) => el('td', { textContent: Number.isFinite(s.values[i]) ? fmtY(s.values[i], s) : '–' }))))))),
    );
    table.open = wasOpen;
  }

  /* ---- interaction ---- */
  const indexAt = (clientX) => {
    const rect = frame.getBoundingClientRect();
    const x = clientX - rect.left;
    let best = 0;
    for (let i = 1; i < geom.n; i++) if (Math.abs(geom.sx(i) - x) < Math.abs(geom.sx(best) - x)) best = i;
    return best;
  };
  frame.addEventListener('pointermove', (e) => {
    if (!geom?.n) return;
    const i = indexAt(e.clientX);
    if (i !== active) { active = i; render(); }
  });
  frame.addEventListener('pointerleave', () => { if (active !== null) { active = null; render(); } });
  frame.addEventListener('blur', () => { if (active !== null) { active = null; render(); } });
  frame.addEventListener('keydown', (e) => {
    const n = opts.xs.length;
    const moves = { ArrowRight: 1, ArrowLeft: -1, Home: -Infinity, End: Infinity };
    if (!(e.key in moves) || !n) return;
    e.preventDefault();
    const start = active ?? (moves[e.key] > 0 ? -1 : n);
    active = Math.min(n - 1, Math.max(0, start + moves[e.key]));
    render(true);
  });

  new ResizeObserver(() => render()).observe(frame);

  const api = {
    update(changes) {
      opts = { ...opts, ...changes };
      if (active !== null && active >= opts.xs.length) active = null;
      frame.setAttribute('aria-label', `${opts.title}. Use the left and right arrow keys to read values.`);
      caption.textContent = opts.title;
      renderLegend();
      renderTable();
      render();
    },
  };
  api.update({});
  return api;
}
