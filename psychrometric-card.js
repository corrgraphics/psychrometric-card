/**
 * Psychrometric Chart Home Assistant Card
 * Version 6.1 - Smart Label Collision Avoidance
 */

console.info("%c PSYCHROMETRIC-CARD %c v6.1.0 ", "color: white; background: #4f46e5; font-weight: bold;", "color: #4f46e5; background: white; font-weight: bold;");

// --- 1. COLOR UTILS ---
const ColorUtils = {
    _ctx: null,
    getContext: () => {
        if (!ColorUtils._ctx) {
            const canvas = document.createElement('canvas');
            canvas.width = 1; canvas.height = 1;
            ColorUtils._ctx = canvas.getContext('2d', { willReadFrequently: true });
        }
        return ColorUtils._ctx;
    },
    parseColor: (color) => {
        const ctx = ColorUtils.getContext();
        ctx.clearRect(0,0,1,1);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        return { r, g, b, a: a / 255 };
    },
    interpolate: (c1, c2, factor) => {
        const r = Math.round(c1.r + (c2.r - c1.r) * factor);
        const g = Math.round(c1.g + (c2.g - c1.g) * factor);
        const b = Math.round(c1.b + (c2.b - c1.b) * factor);
        const a = c1.a + (c2.a - c1.a) * factor;
        return `rgba(${r},${g},${b},${a})`;
    },
    getGradientColor: (intensity, parsedColors) => {
        if (intensity < 0.5) {
            return ColorUtils.interpolate(parsedColors[0], parsedColors[1], intensity * 2);
        } else {
            return ColorUtils.interpolate(parsedColors[1], parsedColors[2], (intensity - 0.5) * 2);
        }
    }
};

// --- 2. MATH ENGINE (IP UNITS) ---
const PsychroMath = {
    F_TO_R: 459.67,

    getPressureFromAltitude: (ft) => {
        return 14.696 * Math.pow(1 - 6.8754e-6 * ft, 5.2559);
    },

    getSatVaporPressure: (tempF) => {
        const T = tempF + 459.67; 
        if (tempF >= 32) {
            const C1 = -1.0440397e4, C2 = -1.1294650e1, C3 = -2.7022355e-2, C4 = 1.2890360e-5, C5 = -2.4780681e-9, C6 = 6.5459673;
            return Math.exp(C1/T + C2 + C3*T + C4*T*T + C5*T*T*T + C6*Math.log(T));
        } else {
            const C1 = -1.0214165e4, C2 = -4.8932428, C3 = -5.3765794e-3, C4 = 1.9202377e-7, C5 = 3.5575832e-10, C6 = -9.0344688e-14, C7 = 4.1635019;
            return Math.exp(C1/T + C2 + C3*T + C4*T*T + C5*T*T*T + C6*Math.pow(T, 4) + C7*Math.log(T));
        }
    },

    getHumRatio: (p_w, p_atm) => {
        if (p_atm <= p_w) return 0.030; 
        return 0.621945 * p_w / (p_atm - p_w);
    },

    getPwFromW: (W, p_atm) => {
        return p_atm * W / (0.621945 + W);
    },

    getRelHum: (tempF, W, p_atm) => {
        const p_ws = PsychroMath.getSatVaporPressure(tempF);
        const p_w = PsychroMath.getPwFromW(W, p_atm);
        return p_w / p_ws;
    },

    getWFromRelHum: (db, rh, p_atm) => {
        const p_ws = PsychroMath.getSatVaporPressure(db);
        const rh_decimal = rh > 1 ? rh / 100 : rh;
        const p_w = rh_decimal * p_ws;
        return PsychroMath.getHumRatio(p_w, p_atm);
    },

    getWFromWetBulb: (db, wb, p_atm) => {
        const p_ws_wb = PsychroMath.getSatVaporPressure(wb);
        const num = (p_atm - p_ws_wb) * (db - wb);
        const den = 2830 - 1.44 * wb;
        const p_v = p_ws_wb - (num / den);
        return PsychroMath.getHumRatio(p_v, p_atm);
    },

    // --- MATH FUNCTIONS FOR LABELS ---
    getEnthalpy: (tempF, W) => {
        return 0.240 * tempF + W * (1061 + 0.444 * tempF);
    },

    getSpecificVolume: (tempF, W, p_atm) => {
        const T = tempF + 459.67;
        const P_psf = p_atm * 144;
        const R_da = 53.352;
        return (R_da * T * (1 + 1.6078 * W)) / P_psf;
    },

    getDewPoint: (p_w) => {
        let dp = 50.0; 
        for(let i=0; i<10; i++){
            const p_guess = PsychroMath.getSatVaporPressure(dp);
            const p_d = PsychroMath.getSatVaporPressure(dp + 0.1);
            const deriv = (p_d - p_guess) / 0.1;
            const error = p_guess - p_w;
            if(Math.abs(error) < 0.0001) break;
            dp = dp - error/deriv;
        }
        return dp;
    },
    
    getWetBulb: (tempF, W, p_atm) => {
        let wb = tempF;
        const h_target = PsychroMath.getEnthalpy(tempF, W);
        for (let i = 0; i < 20; i++) {
            const p_ws_wb = PsychroMath.getSatVaporPressure(wb);
            const W_star = PsychroMath.getHumRatio(p_ws_wb, p_atm);
            const h_wb = PsychroMath.getEnthalpy(wb, W_star);
            const error = h_wb - h_target;
            if (Math.abs(error) < 0.05 || isNaN(error)) break;
            wb = wb - error / 1.0; 
        }
        return wb;
    },

    // --- COMFORT ENGINE (ASHRAE 55 / PMV) ---
    calculatePMV: (taF, trF, velFPM, rhPercent, met, clo) => {
        const ta = (taF - 32) * 5 / 9; 
        const tr = (trF - 32) * 5 / 9; 
        const vel = velFPM * 0.00508;  
        const rh = rhPercent;          

        const pa = rh * 10 * Math.exp(16.6536 - 4030.183 / (ta + 235));
        const icl = 0.155 * clo; 
        const m = met * 58.15; 
        const w = 0; 
        const mw = m - w; 
        
        let fcl;
        if (icl <= 0.078) fcl = 1 + 1.29 * icl;
        else fcl = 1.05 + 0.645 * icl;

        const taK = ta + 273;
        const trK = tr + 273;
        
        let tclK = taK + (35.5 - ta) / (3.5 * icl + 0.1);

        const p1 = icl * fcl;
        const p2 = p1 * 3.96;
        const p3 = p1 * 100;
        const p4 = p1 * taK; 
        const p5 = 308.7 - 0.028 * mw + p2 * Math.pow(trK / 100, 4);
        
        let xn = tclK / 100;
        let hc = 12.1 * Math.sqrt(vel);
        let xf = xn;
        
        let it = 0;
        while (it < 150) {
            xf = (xf + xn) / 2;
            let hcn = 2.38 * Math.pow(Math.abs(100 * xf - taK), 0.25);
            if (hc > hcn) hcn = hc;
            xn = (p5 + p4 * hcn - p2 * Math.pow(xf, 4)) / (100 + p3 * hcn);
            if (Math.abs(xn - xf) < 0.00015) break;
            it++;
        }
        
        tclK = 100 * xn;
        const ts = 0.303 * Math.exp(-0.036 * m) + 0.028;
        const tcl = tclK - 273; 

        const hl1 = 3.05 * 0.001 * (5733 - 6.99 * mw - pa);
        const hl2 = 0.42 * (mw - 58.15);
        const hl3 = 1.7 * 0.00001 * m * (5867 - pa);
        const hl4 = 0.0014 * m * (34 - ta);
        const hl5 = 3.96 * fcl * (Math.pow(xn, 4) - Math.pow(trK / 100, 4));
        const hl6 = fcl * hc * (tcl - ta);

        return ts * (mw - hl1 - hl2 - hl3 - hl4 - hl5 - hl6);
    }
};

class PsychrometricCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._hass = null;
        this._config = null;
        this.points = [];
        this.weatherPoints = [];
        this.weatherLoaded = false;
        this.card = null;
        this.parsedHeatmapColors = [];
    }

    setConfig(config) {
        if (!config.points || !Array.isArray(config.points)) {
            throw new Error('Please define a list of "points" (name, icon, temperature_entity, humidity_entity).');
        }
        
        config.points.forEach((pt, index) => {
            if (!pt.temperature_entity || !pt.humidity_entity) {
                throw new Error(`Point at index ${index} is missing temperature_entity or humidity_entity.`);
            }
        });

        const rawHeatmapColors = config.heatmap_colors || ["rgba(96, 165, 250, 0)", "#60a5fa", "#0f766e"];
        this.parsedHeatmapColors = rawHeatmapColors.map(c => ColorUtils.parseColor(c));

        this._config = {
            ...config,
            clothing_level: config.clothing_level !== undefined ? parseFloat(config.clothing_level) : 0.5,
            metabolic_rate: config.metabolic_rate !== undefined ? parseFloat(config.metabolic_rate) : 1.1,
            air_velocity: config.air_velocity !== undefined ? parseFloat(config.air_velocity) : 20,
            mean_radiant_temp_offset: config.mean_radiant_temp_offset !== undefined ? parseFloat(config.mean_radiant_temp_offset) : 0,
            altitude: config.altitude !== undefined ? parseFloat(config.altitude) : 0,
            show_title: config.show_title !== undefined ? config.show_title : true,
            weather_file: config.weather_file || null,
            heatmap_colors: rawHeatmapColors
        };
        this.renderContainer();
        
        if (this.card) {
             this.card.header = (this._config.show_title && this._config.title) ? this._config.title : "";
        }

        if (this._config.weather_file && !this.weatherLoaded) {
            this.fetchWeatherData();
        }
    }

    set hass(hass) {
        this._hass = hass;
        
        if (!this._config || !this.chartContainer) return;

        const pressure = PsychroMath.getPressureFromAltitude(this._config.altitude);
        const newPoints = [];

        this._config.points.forEach(ptConfig => {
            const temp = this.getEntityValue(ptConfig.temperature_entity);
            const hum = this.getEntityValue(ptConfig.humidity_entity);
            
            if (temp !== null && hum !== null) {
                const w = PsychroMath.getWFromRelHum(temp, hum, pressure);
                newPoints.push({
                    name: ptConfig.name || "Point",
                    icon: ptConfig.icon || "mdi:circle",
                    color: ptConfig.color || "var(--primary-text-color)",
                    db: temp,
                    w: w,
                    rh: hum
                });
            }
        });

        const dataSig = JSON.stringify(newPoints) + this._hass.themes.darkMode + this.weatherLoaded;
        if (this._lastDataSig !== dataSig) {
            this.points = newPoints;
            this._lastDataSig = dataSig;
            this.drawChart();
        }
    }

    getEntityValue(entityId) {
        if (!this._hass.states[entityId]) return null;
        const val = parseFloat(this._hass.states[entityId].state);
        return isNaN(val) ? null : val;
    }

    async fetchWeatherData() {
        if (!this._config.weather_file) return;
        
        try {
            const response = await fetch(this._config.weather_file);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const text = await response.text();
            this.parseWeatherText(text);
            this.weatherLoaded = true;
            this.drawChart();
        } catch (e) {
            console.error("Psychrometric Card: Failed to load weather file", e);
        }
    }

    parseWeatherText(text) {
        const lines = text.split('\n');
        const parsedPoints = [];
        const pressure = PsychroMath.getPressureFromAltitude(this._config.altitude);
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = line.split(',');
            if (cols.length > 10 && !isNaN(parseInt(cols[0]))) {
                const db_c = parseFloat(cols[6]);
                const rh_percent = parseFloat(cols[8]);
                
                if (!isNaN(db_c) && !isNaN(rh_percent)) {
                    const db_f = db_c * 1.8 + 32;
                    const w = PsychroMath.getWFromRelHum(db_f, rh_percent, pressure);
                    if (!isNaN(w) && w >= 0) {
                        parsedPoints.push({ db: db_f, w: w });
                    }
                }
            }
        }
        this.weatherPoints = parsedPoints;
    }

    renderContainer() {
        if (this.chartContainer) return;

        const style = document.createElement('style');
        style.textContent = `
            :host { display: block; }
            ha-card { overflow: visible !important; display: block; }
            .card-content { padding: 16px; position: relative; }
            .chart-container { width: 100%; height: 0; padding-bottom: 56.25%; position: relative; }
            
            canvas, svg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
            canvas { pointer-events: none; z-index: 0; }
            svg { z-index: 1; overflow: visible; font-family: var(--paper-font-body1_-_font-family, sans-serif); }
            
            .legend { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; font-size: 0.9em; justify-content: center; color: var(--primary-text-color); }
            .legend-item { display: flex; items-center; gap: 4px; }
            .dot { width: 10px; height: 10px; border-radius: 50%; }
        `;

        this.shadowRoot.appendChild(style);

        this.card = document.createElement('ha-card');
        if (this._config.show_title && this._config.title) {
            this.card.header = this._config.title;
        }

        const content = document.createElement('div');
        content.className = 'card-content';

        this.chartContainer = document.createElement('div');
        this.chartContainer.className = 'chart-container';
        
        this.canvasEl = document.createElement('canvas');
        this.canvasEl.width = 1920; 
        this.canvasEl.height = 1080;
        this.chartContainer.appendChild(this.canvasEl);

        this.svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.chartContainer.appendChild(this.svgEl);
        
        content.appendChild(this.chartContainer);

        this.legendContainer = document.createElement('div');
        this.legendContainer.className = 'legend';
        content.appendChild(this.legendContainer);

        this.card.appendChild(content);
        this.shadowRoot.appendChild(this.card);
        
        this.updateLegend();
    }
    
    updateLegend() {
        if (!this.legendContainer || !this._config.points) return;
        
        let html = '';
        this._config.points.forEach(pt => {
             const color = pt.color || "var(--primary-text-color)";
             const name = pt.name || "Point";
             html += `<div class="legend-item"><div class="dot" style="background: ${color}"></div> ${name}</div>`;
        });
        
        html += `<div class="legend-item"><div class="dot" style="background: rgba(34, 197, 94, 0.2); border: 1px solid var(--success-color, #15803d)"></div> Comfort</div>`;
        
        if (this._config.weather_file) {
             html += `<div class="legend-item"><div class="dot" style="background: linear-gradient(to right, ${this._config.heatmap_colors[1]}, ${this._config.heatmap_colors[2]})"></div> Annual Weather</div>`;
        }

        this.legendContainer.innerHTML = html;
    }

    drawChart() {
        if (!this.svgEl || !this.canvasEl) return;
        
        const width = 960;
        const height = 540;
        const margin = { top: 20, right: 60, bottom: 50, left: 60 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        this.svgEl.setAttribute("viewBox", `0 0 ${width} ${height}`);
        this.svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");

        const tempRange = [-10, 110];
        const humRange = [0, 0.030];
        const altitude = this._config.altitude;
        const pressure = PsychroMath.getPressureFromAltitude(altitude);

        const xScale = (val) => ((val - tempRange[0]) / (tempRange[1] - tempRange[0])) * innerWidth;
        const yScale = (val) => innerHeight - ((val - humRange[0]) / (humRange[1] - humRange[0])) * innerHeight;

        // --- PREPARE DATA ---
        const lineGen = (pts) => {
            if (pts.length === 0) return '';
            const d = pts.map((p, i) => `${i===0?'M':'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
            return d;
        };

        const satPoints = [];
        for (let t = tempRange[0]; t <= tempRange[1]; t += 0.5) {
            const w = PsychroMath.getWFromRelHum(t, 100, pressure);
            satPoints.push({ x: xScale(t), y: yScale(w) });
        }
        const satAreaPoints = [...satPoints, { x: xScale(tempRange[1]), y: yScale(0) }, { x: xScale(tempRange[0]), y: yScale(0) }];
        
        let maxBinCount = 0;

        // --- LAYER 1: CANVAS HEATMAP ---
        const ctx = this.canvasEl.getContext('2d');
        const cWidth = this.canvasEl.width;
        const cHeight = this.canvasEl.height;
        ctx.clearRect(0, 0, cWidth, cHeight);
        
        const sfX = cWidth / width;
        const sfY = cHeight / height;
        
        if (this.weatherLoaded && this.weatherPoints.length > 0) {
            ctx.save();
            ctx.scale(sfX, sfY); 
            ctx.translate(margin.left, margin.top);

            ctx.beginPath();
            ctx.moveTo(satAreaPoints[0].x, satAreaPoints[0].y);
            for(let i=1; i<satAreaPoints.length; i++) ctx.lineTo(satAreaPoints[i].x, satAreaPoints[i].y);
            ctx.closePath();
            ctx.clip();

            const binWidthDB = 2.0; 
            const binHeightW = 0.0005;
            const bins = {};

            this.weatherPoints.forEach(pt => {
                if (pt.db < tempRange[0] || pt.db > tempRange[1] || pt.w < humRange[0] || pt.w > humRange[1]) return;
                const xIndex = Math.floor((pt.db - tempRange[0]) / binWidthDB);
                const yIndex = Math.floor(pt.w / binHeightW);
                const key = `${xIndex},${yIndex}`;
                bins[key] = (bins[key] || 0) + 1;
                if (bins[key] > maxBinCount) maxBinCount = bins[key];
            });

            const pColors = this.parsedHeatmapColors;
            Object.keys(bins).forEach(key => {
                const [xIndex, yIndex] = key.split(',').map(Number);
                const count = bins[key];
                
                const db0 = tempRange[0] + xIndex * binWidthDB;
                const w1 = yIndex * binHeightW; 
                
                const x = xScale(db0);
                const w = xScale(db0 + binWidthDB) - x;
                const yBottom = yScale(w1);
                const yTop = yScale(w1 + binHeightW);
                const h = yBottom - yTop;
                
                const intensity = count / maxBinCount;
                ctx.fillStyle = ColorUtils.getGradientColor(Math.pow(intensity, 0.5), pColors);
                ctx.fillRect(x, yTop, w, h);
            });
            
            ctx.restore();
        }

        // --- LAYER 2: SVG VECTORS ---
        let svgContent = '';
        let pointsSvg = '';
        let labelsSvg = '';
        const textColor = "var(--primary-text-color)";
        const gridColor = "var(--divider-color, rgba(100, 100, 100, 0.1))";
        const axisColor = "var(--secondary-text-color)";
        
        const satClipPathId = `sat-clip-${Math.random().toString(36).substr(2, 9)}`;
        svgContent += `<defs><clipPath id="${satClipPathId}"><path d="${lineGen(satAreaPoints)} Z" /></clipPath></defs>`;

        // Comfort Zone
        const met = this._config.metabolic_rate;
        const clo = this._config.clothing_level;
        const vel = this._config.air_velocity;
        const mrtOffset = this._config.mean_radiant_temp_offset;

        const upperLine = [];
        const lowerLine = [];
        const maxW = 0.015;
        const wStep = 0.001;

        for (let w = 0; w <= maxW; w += wStep) {
            const findT = (targetPMV) => {
                let low = 40, high = 100;
                for(let i=0; i<12; i++){
                    let mid = (low + high)/2;
                    let p_atm = pressure;
                    let p_ws = PsychroMath.getSatVaporPressure(mid);
                    let p_w = PsychroMath.getPwFromW(w, p_atm);
                    let rh = (p_w / p_ws) * 100;
                    if (rh > 100) rh = 100;
                    let pmv = PsychroMath.calculatePMV(mid, mid + mrtOffset, vel, rh, met, clo);
                    if (pmv > targetPMV) high = mid; else low = mid;
                }
                return low;
            };
            const t_cold = findT(-0.5);
            const t_hot = findT(0.5);
            lowerLine.push({ x: xScale(t_cold), y: yScale(w) });
            upperLine.unshift({ x: xScale(t_hot), y: yScale(w) });
        }
        const polyD = lineGen([...lowerLine, ...upperLine]) + " Z";
        svgContent += `<path d="${polyD}" fill="rgba(34, 197, 94, 0.2)" stroke="var(--success-color, #15803d)" stroke-width="1" clip-path="url(#${satClipPathId})" />`;

        // Wet Bulb Lines
        const wbColor = "var(--success-color, #10b981)";
        for (let wb = -10; wb <= 110; wb += 5) {
            const pts = [];
            for (let t = wb; t <= tempRange[1]; t += 1) {
                const w = PsychroMath.getWFromWetBulb(t, wb, pressure);
                if (w >= 0 && w <= humRange[1]) pts.push({ x: xScale(t), y: yScale(w) });
            }
            if (pts.length > 1) {
                svgContent += `<path d="${lineGen(pts)}" fill="none" stroke="${wbColor}" stroke-width="0.5" stroke-dasharray="4,4" opacity="0.4" clip-path="url(#${satClipPathId})" />`;
                const labelPt = pts[0];
                if (labelPt) svgContent += `<text x="${labelPt.x - 3}" y="${labelPt.y - 3}" font-size="9" fill="${wbColor}" text-anchor="end" opacity="0.6">${wb}</text>`;
            }
        }

        // Grid
        [20, 40, 60, 80, 100].forEach(rh => {
            const pts = [];
            for (let t = tempRange[0]; t <= tempRange[1]; t += 1) {
                const w = PsychroMath.getWFromRelHum(t, rh, pressure);
                if (w <= humRange[1]) pts.push({ x: xScale(t), y: yScale(w) });
            }
            const isSat = rh === 100;
            const strokeColor = isSat ? "var(--info-color, #3b82f6)" : axisColor;
            svgContent += `<path d="${lineGen(pts)}" fill="none" stroke="${strokeColor}" stroke-width="${isSat ? 2 : 1}" stroke-dasharray="${isSat ? '0' : '4,4'}" opacity="${isSat ? 1 : 0.5}" />`;
            if (pts.length > 5 && !isSat) {
                const pt = pts[Math.floor(pts.length * 0.7)];
                svgContent += `<text x="${pt.x}" y="${pt.y - 2}" font-size="10" fill="${axisColor}">${rh}%</text>`;
            }
        });

        // Axes
        const xTicks = [];
        for (let t = tempRange[0]; t <= tempRange[1]; t += 10) xTicks.push(t);
        svgContent += `<line x1="0" y1="${innerHeight}" x2="${innerWidth}" y2="${innerHeight}" stroke="${axisColor}" />`;
        xTicks.forEach(t => {
            const x = xScale(t);
            svgContent += `<line x1="${x}" y1="${innerHeight}" x2="${x}" y2="${innerHeight+6}" stroke="${axisColor}" />`;
            svgContent += `<line x1="${x}" y1="0" x2="${x}" y2="${innerHeight}" stroke="${gridColor}" />`;
            svgContent += `<text x="${x}" y="${innerHeight+20}" text-anchor="middle" font-size="12" fill="${textColor}">${t}°F</text>`;
        });

        const yTicks = [];
        for (let w = 0; w <= humRange[1]; w += 0.005) yTicks.push(w);
        svgContent += `<line x1="${innerWidth}" y1="0" x2="${innerWidth}" y2="${innerHeight}" stroke="${axisColor}" />`;
        yTicks.forEach(w => {
            const y = yScale(w);
            svgContent += `<line x1="${innerWidth}" y1="${y}" x2="${innerWidth+6}" y2="${y}" stroke="${axisColor}" />`;
            svgContent += `<line x1="0" y1="${y}" x2="${innerWidth}" y2="${y}" stroke="${gridColor}" />`;
            svgContent += `<text x="${innerWidth+8}" y="${y+3}" font-size="12" fill="${textColor}">${(w*7000).toFixed(0)}</text>`;
        });

        svgContent += `<text x="${innerWidth/2}" y="${innerHeight+40}" text-anchor="middle" fill="${textColor}" font-size="14">Dry Bulb Temperature (°F)</text>`;
        svgContent += `<text transform="rotate(-90)" x="${-innerHeight/2}" y="${innerWidth+40}" text-anchor="middle" fill="${textColor}" font-size="14">Humidity Ratio (grains/lb)</text>`;

        if (this.weatherLoaded && this.weatherPoints.length > 0 && maxBinCount > 0) {
            const legendW = 100;
            const legendH = 10;
            const legendX = innerWidth - legendW - 10;
            const legendY = innerHeight - 40;
            const gradientId = `weather-grad-${Math.random().toString(36).substr(2, 9)}`;
            const colors = this._config.heatmap_colors;
            svgContent += `
               <defs>
                   <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="0%">
                       <stop offset="0%" stop-color="${colors[0]}" />
                       <stop offset="50%" stop-color="${colors[1]}" />
                       <stop offset="100%" stop-color="${colors[2]}" />
                   </linearGradient>
               </defs>
               <g transform="translate(${legendX}, ${legendY})">
                   <rect width="${legendW}" height="${legendH}" fill="url(#${gradientId})" stroke="${axisColor}" stroke-width="0.5" />
                   <text x="0" y="-4" font-size="9" fill="${axisColor}">0</text>
                   <text x="${legendW}" y="-4" font-size="9" fill="${axisColor}" text-anchor="end">${maxBinCount} hrs</text>
                   <text x="${legendW/2}" y="${legendH + 10}" font-size="9" fill="${axisColor}" text-anchor="middle" font-weight="bold">Frequency</text>
               </g>
            `;
        }

        // --- LAYER 3: SVG POINTS & LABELS WITH COLLISION DETECTION ---
        
        // 1. Calculate Coordinates for all points
        const chartPoints = this.points.map(pt => {
            if (pt.db < tempRange[0] || pt.db > tempRange[1] || pt.w > humRange[1]) return null;
            return {
                ...pt,
                cx: xScale(pt.db),
                cy: yScale(pt.w)
            };
        }).filter(p => p !== null);

        const occupied = [];
        const boxW = 135;
        const boxH = 65;
        const padding = 10; // spacing between boxes

        // Add points to occupied space (small exclusion zone around markers)
        chartPoints.forEach(p => {
            occupied.push({ left: p.cx - 10, top: p.cy - 10, right: p.cx + 10, bottom: p.cy + 10 });
        });

        // Function to check collision
        const isOverlapping = (rect) => {
            // Check chart boundaries (approximate)
            if (rect.left < 0 || rect.right > innerWidth || rect.top < 0 || rect.bottom > innerHeight) return true;
            
            // Check existing objects
            for (let other of occupied) {
                if (!(rect.right < other.left || 
                      rect.left > other.right || 
                      rect.bottom < other.top || 
                      rect.top > other.bottom)) {
                    return true;
                }
            }
            return false;
        };

        chartPoints.forEach(pt => {
            // Define candidate positions relative to point (cx, cy)
            // 1. Top-Right (Default)
            // 2. Bottom-Right
            // 3. Top-Left
            // 4. Bottom-Left
            
            const offset = 40; 
            
            const candidates = [
                // Top-Right: Line goes up-right, Box starts there
                // SVG coords: y decreases up. so dy=-offset
                { dx: offset, dy: -offset, boxX: offset, boxY: -offset - boxH, anchor: 'bl' }, 
                // Bottom-Right
                { dx: offset, dy: offset, boxX: offset, boxY: offset, anchor: 'tl' },
                // Top-Left: Line goes up-left, Box ends there
                { dx: -offset, dy: -offset, boxX: -offset - boxW, boxY: -offset - boxH, anchor: 'br' },
                // Bottom-Left
                { dx: -offset, dy: offset, boxX: -offset - boxW, boxY: offset, anchor: 'tr' }
            ];

            // Sort candidates by preference based on chart position (keep away from edges)
            const preferLeft = pt.cx > innerWidth / 2;
            const preferTop = pt.cy > innerHeight / 2;

            candidates.sort((a, b) => {
                let scoreA = 0;
                let scoreB = 0;
                if (preferLeft && a.dx < 0) scoreA++;
                if (!preferLeft && a.dx > 0) scoreA++;
                if (preferTop && a.dy < 0) scoreA++;
                if (!preferTop && a.dy > 0) scoreA++;

                if (preferLeft && b.dx < 0) scoreB++;
                if (!preferLeft && b.dx > 0) scoreB++;
                if (preferTop && b.dy < 0) scoreB++;
                if (!preferTop && b.dy > 0) scoreB++;
                
                return scoreB - scoreA;
            });

            let chosen = candidates[0]; // Default to first preference
            
            // Try to find non-overlapping position
            for (let cand of candidates) {
                const rect = {
                    left: pt.cx + cand.boxX - padding,
                    top: pt.cy + cand.boxY - padding,
                    right: pt.cx + cand.boxX + boxW + padding,
                    bottom: pt.cy + cand.boxY + boxH + padding
                };
                
                if (!isOverlapping(rect)) {
                    chosen = cand;
                    break;
                }
            }

            // Mark chosen position as occupied (actual box size)
            occupied.push({
                left: pt.cx + chosen.boxX,
                top: pt.cy + chosen.boxY,
                right: pt.cx + chosen.boxX + boxW,
                bottom: pt.cy + chosen.boxY + boxH
            });

            // Calculate SVG Params
            const lineX2 = pt.cx + chosen.dx;
            const lineY2 = pt.cy + chosen.dy;
            
            const boxAbsX = pt.cx + chosen.boxX;
            const boxAbsY = pt.cy + chosen.boxY;
            
            // Draw Point
            pointsSvg += `<circle cx="${pt.cx}" cy="${pt.cy}" r="5" fill="${pt.color}" stroke="white" stroke-width="2" />`;

            // Draw Line
            labelsSvg += `<line x1="${pt.cx}" y1="${pt.cy}" x2="${lineX2}" y2="${lineY2}" stroke="${pt.color}" stroke-width="1" />`;
            
            // Values
            const p_w = PsychroMath.getPwFromW(pt.w, pressure);
            const wb = PsychroMath.getWetBulb(pt.db, pt.w, pressure);
            const dp = PsychroMath.getDewPoint(p_w);
            const h = PsychroMath.getEnthalpy(pt.db, pt.w);
            const w_grains = pt.w * 7000;

            const lines = [
                pt.name,
                `DB: ${pt.db.toFixed(1)}°F | RH: ${pt.rh.toFixed(1)}%`,
                `WB: ${wb.toFixed(1)}°F | DP: ${dp.toFixed(1)}°F`,
                `h: ${h.toFixed(1)} | W: ${w_grains.toFixed(1)}`
            ];

            const paddingText = 5;

            labelsSvg += `
                <g transform="translate(${boxAbsX}, ${boxAbsY})">
                    <rect x="0" y="0" width="${boxW}" height="${boxH}" rx="4" fill="var(--ha-card-background, #2c2c2c)" stroke="${pt.color}" stroke-width="1" fill-opacity="0.9" />
                    <text x="${paddingText}" y="${paddingText + 12}" font-size="11" font-weight="bold" fill="${textColor}">${lines[0]}</text>
                    <text x="${paddingText}" y="${paddingText + 26}" font-size="10" fill="${textColor}">${lines[1]}</text>
                    <text x="${paddingText}" y="${paddingText + 38}" font-size="10" fill="${textColor}">${lines[2]}</text>
                    <text x="${paddingText}" y="${paddingText + 50}" font-size="10" fill="${textColor}">${lines[3]}</text>
                </g>
            `;
        });

        // Add Points & Labels to SVG
        svgContent += `<g class="labels">${labelsSvg}</g>`;
        svgContent += `<g class="points">${pointsSvg}</g>`;

        this.svgEl.innerHTML = `<g transform="translate(${margin.left},${margin.top})">${svgContent}</g>`;
    }

    getCardSize() {
        return 4;
    }
}

customElements.define('psychrometric-card', PsychrometricCard);
