/**
 * Psychrometric Chart Home Assistant Card
 * Version 0.8.2 - Radial Collision Avoidance
 */

console.info("%c PSYCHROMETRIC-CARD %c v0.8.2 ", "color: white; background: #4f46e5; font-weight: bold;", "color: #4f46e5; background: white; font-weight: bold;");

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

// --- 2. MATH ENGINE (IP Base with SI Utils) ---
const PsychroMath = {
    F_TO_R: 459.67,

    // Unit Conversions
    CtoF: (c) => c * 1.8 + 32,
    FtoC: (f) => (f - 32) / 1.8,
    kPaToPsi: (kpa) => kpa * 0.145038,
    PsiToKpa: (psi) => psi / 0.145038,
    MToFt: (m) => m * 3.28084,
    FtToM: (ft) => ft / 3.28084,

    getPressureFromAltitude: (elevation, units = 'imperial') => {
        const ft = units === 'metric' ? PsychroMath.MToFt(elevation) : elevation;
        const psi = 14.696 * Math.pow(1 - 6.8754e-6 * ft, 5.2559);
        return psi; 
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

    getEnthalpyIP: (tempF, W) => {
        return 0.240 * tempF + W * (1061 + 0.444 * tempF);
    },
    
    getEnthalpySI: (tempC, W) => {
        return 1.006 * tempC + W * (2501 + 1.86 * tempC);
    },

    getSpecificVolumeIP: (tempF, W, p_atm) => {
        const T = tempF + 459.67;
        const P_psf = p_atm * 144;
        const R_da = 53.352;
        return (R_da * T * (1 + 1.6078 * W)) / P_psf;
    },
    
    getSpecificVolumeSI: (tempC, W, p_kpa) => {
        const T = tempC + 273.15;
        const P_pa = p_kpa * 1000;
        const R_da = 287.058;
        return (R_da * T * (1 + 1.6078 * W)) / P_pa;
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
        const h_target = PsychroMath.getEnthalpyIP(tempF, W);
        for (let i = 0; i < 20; i++) {
            const p_ws_wb = PsychroMath.getSatVaporPressure(wb);
            const W_star = PsychroMath.getHumRatio(p_ws_wb, p_atm);
            const h_wb = PsychroMath.getEnthalpyIP(wb, W_star);
            const error = h_wb - h_target;
            if (Math.abs(error) < 0.05 || isNaN(error)) break;
            wb = wb - error / 1.0; 
        }
        return wb;
    },

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
        this.trailPoints = [];
        this.enthalpyHistory = [];
        this.weatherLoaded = false;
        this.historyLoading = false;
        this.lastHistoryFetch = 0;
        this.card = null;
        this.parsedHeatmapColors = [];
        this.isMetric = false;
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

        const styles = config.chart_style || {};

        this._config = {
            ...config,
            clothing_level: config.clothing_level !== undefined ? parseFloat(config.clothing_level) : 0.5,
            metabolic_rate: config.metabolic_rate !== undefined ? parseFloat(config.metabolic_rate) : 1.1,
            air_velocity: config.air_velocity !== undefined ? parseFloat(config.air_velocity) : 20,
            mean_radiant_temp_offset: config.mean_radiant_temp_offset !== undefined ? parseFloat(config.mean_radiant_temp_offset) : 0,
            altitude: config.altitude !== undefined ? parseFloat(config.altitude) : 0,
            show_title: config.show_title !== undefined ? config.show_title : true,
            weather_file: config.weather_file || null,
            weather_window_days: config.weather_window_days !== undefined ? parseInt(config.weather_window_days) : 15,
            heatmap_colors: rawHeatmapColors,
            unit_system: config.unit_system || "imperial",
            enable_trails: config.enable_trails !== undefined ? config.enable_trails : false,
            trail_hours: config.trail_hours !== undefined ? parseInt(config.trail_hours) : 24,
            enthalpy_trend_hours: config.enthalpy_trend_hours !== undefined ? parseInt(config.enthalpy_trend_hours) : 24,
            style: {
                saturation: styles.saturation_line || "var(--info-color, #3b82f6)",
                wet_bulb: styles.wet_bulb_lines || "var(--success-color, #10b981)",
                grid: styles.grid_lines || "var(--divider-color, rgba(100, 100, 100, 0.1))",
                axis: styles.axis_lines || "var(--secondary-text-color)",
                comfort_stroke: styles.comfort_zone_stroke || "var(--success-color, #15803d)",
                comfort_fill: styles.comfort_zone_fill || "rgba(34, 197, 94, 0.2)",
                label_background: styles.label_background || "rgba(var(--rgb-card-background-color, 30, 30, 30), 0.3)",
                region_labels: styles.region_labels || "var(--secondary-text-color)"
            }
        };
        
        this.isMetric = this._config.unit_system === "metric";
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

        const pressure = PsychroMath.getPressureFromAltitude(this._config.altitude, this._config.unit_system);
        const newPoints = [];

        this._config.points.forEach(ptConfig => {
            let temp = this.getEntityValue(ptConfig.temperature_entity);
            let hum = this.getEntityValue(ptConfig.humidity_entity);
            
            if (temp !== null && hum !== null) {
                const db_calc = this.isMetric ? PsychroMath.CtoF(temp) : temp;
                const w = PsychroMath.getWFromRelHum(db_calc, hum, pressure);
                
                newPoints.push({
                    name: ptConfig.name || "Point",
                    icon: ptConfig.icon || "mdi:circle",
                    color: ptConfig.color || "var(--primary-text-color)",
                    db: db_calc,
                    w: w,
                    rh: hum,
                    originalT: temp
                });
            }
        });

        const fetchNeeded = this._config.enable_trails || this._config.enthalpy_trend_hours > 0;
        if (fetchNeeded && !this.historyLoading && (!this.lastHistoryFetch || (Date.now() - this.lastHistoryFetch > 300000))) {
            this.fetchHistory();
        }

        const todayDOY = this.getDayOfYear(new Date());
        const trailSig = this.trailPoints ? this.trailPoints.length : 0;
        const trendSig = this.enthalpyHistory ? this.enthalpyHistory.length : 0;
        const dataSig = JSON.stringify(newPoints) + this._hass.themes.darkMode + this.weatherLoaded + todayDOY + trailSig + trendSig + this.isMetric;
        
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

    getDayOfYear(date) {
        const start = new Date(date.getFullYear(), 0, 0);
        const diff = date - start;
        const oneDay = 1000 * 60 * 60 * 24;
        return Math.floor(diff / oneDay);
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

    async fetchHistory() {
        this.historyLoading = true;
        const hours = Math.max(
            this._config.enable_trails ? this._config.trail_hours : 0, 
            this._config.enthalpy_trend_hours || 0
        );
        
        if (hours <= 0) {
            this.historyLoading = false;
            return;
        }

        const startTime = new Date();
        startTime.setHours(startTime.getHours() - hours);
        const isoStart = startTime.toISOString();
        
        const entityIds = new Set();
        this._config.points.forEach(pt => {
            if (pt.temperature_entity) entityIds.add(pt.temperature_entity);
            if (pt.humidity_entity) entityIds.add(pt.humidity_entity);
        });
        
        try {
            const historyData = await this._hass.callApi('GET', `history/period/${isoStart}?filter_entity_id=${Array.from(entityIds).join(',')}&minimal_response`);
            this.processHistory(historyData);
            this.lastHistoryFetch = Date.now();
            this.drawChart();
        } catch(e) {
            console.error("Psychrometric Card: History fetch failed", e);
        } finally {
            this.historyLoading = false;
        }
    }

    processHistory(historyData) {
        const historyMap = {}; 
        historyData.forEach(arr => {
            if(arr.length > 0) {
                const eid = arr[0].entity_id;
                historyMap[eid] = arr;
            }
        });

        this.trailPoints = []; 
        this.enthalpyHistory = [];

        const now = new Date();
        const pressure = PsychroMath.getPressureFromAltitude(this._config.altitude, this._config.unit_system);
        
        const getValF = (val) => this.isMetric ? PsychroMath.CtoF(val) : val;

        if (this._config.enable_trails) {
            const duration = this._config.trail_hours * 60 * 60 * 1000;
            const step = 1000 * 60 * 30; 

            this._config.points.forEach(ptConfig => {
                const tHist = historyMap[ptConfig.temperature_entity];
                const hHist = historyMap[ptConfig.humidity_entity];
                if (!tHist || !hHist) return;

                const samples = [];
                for (let time = now.getTime() - duration; time < now.getTime(); time += step) {
                    const tState = this.findStateAtTime(tHist, time);
                    const hState = this.findStateAtTime(hHist, time);
                    if (tState && hState) {
                        const rawT = parseFloat(tState.state);
                        const rh = parseFloat(hState.state);
                        if(!isNaN(rawT) && !isNaN(rh)) {
                            const db = getValF(rawT);
                            const w = PsychroMath.getWFromRelHum(db, rh, pressure);
                            const age = (now.getTime() - time) / duration;
                            if (!isNaN(w) && w >= 0) samples.push({ db, w, age });
                        }
                    }
                }
                if (samples.length > 0) {
                    this.trailPoints.push({ color: ptConfig.color || "var(--primary-text-color)", points: samples });
                }
            });
        }

        if (this._config.enthalpy_trend_hours > 0) {
            const duration = this._config.enthalpy_trend_hours * 60 * 60 * 1000;
            const step = 1000 * 60 * 15;

            this._config.points.forEach(ptConfig => {
                const tHist = historyMap[ptConfig.temperature_entity];
                const hHist = historyMap[ptConfig.humidity_entity];
                if (!tHist || !hHist) return;

                const data = [];
                for (let time = now.getTime() - duration; time < now.getTime(); time += step) {
                    const tState = this.findStateAtTime(tHist, time);
                    const hState = this.findStateAtTime(hHist, time);
                    if (tState && hState) {
                        const rawT = parseFloat(tState.state);
                        const rh = parseFloat(hState.state);
                        if(!isNaN(rawT) && !isNaN(rh)) {
                            const db = getValF(rawT);
                            const w = PsychroMath.getWFromRelHum(db, rh, pressure);
                            
                            let hVal;
                            if (this.isMetric) {
                                hVal = PsychroMath.getEnthalpySI(rawT, w);
                            } else {
                                hVal = PsychroMath.getEnthalpyIP(db, w);
                            }
                            
                            if (!isNaN(hVal)) data.push({ time: new Date(time), value: hVal });
                        }
                    }
                }
                if (data.length > 0) {
                    this.enthalpyHistory.push({ 
                        name: ptConfig.name, 
                        color: ptConfig.color || "var(--primary-text-color)", 
                        data: data 
                    });
                }
            });
        }
    }

    findStateAtTime(historyArr, timestamp) {
        for (let i = historyArr.length - 1; i >= 0; i--) {
            if (new Date(historyArr[i].last_changed).getTime() <= timestamp) {
                return historyArr[i];
            }
        }
        return null;
    }

    parseWeatherText(text) {
        const lines = text.split('\n');
        const parsedPoints = [];
        const pressure = PsychroMath.getPressureFromAltitude(this._config.altitude, this._config.unit_system);
        
        const daysInMonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        const monthOffsets = [0];
        for(let i=1; i<=12; i++) monthOffsets[i] = monthOffsets[i-1] + daysInMonth[i];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = line.split(',');
            if (cols.length > 10 && !isNaN(parseInt(cols[0]))) {
                const month = parseInt(cols[1]);
                const day = parseInt(cols[2]);
                const db_c = parseFloat(cols[6]);
                const rh_percent = parseFloat(cols[8]);
                
                if (!isNaN(db_c) && !isNaN(rh_percent) && !isNaN(month) && !isNaN(day)) {
                    const db_f = db_c * 1.8 + 32;
                    const w = PsychroMath.getWFromRelHum(db_f, rh_percent, pressure);
                    const doy = monthOffsets[month-1] + day;
                    if (!isNaN(w) && w >= 0) {
                        parsedPoints.push({ db: db_f, w: w, doy: doy });
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

            .label-box {
                width: 100%; 
                height: 100%;
                box-sizing: border-box;
                border: 1px solid; 
                border-radius: 4px;
                backdrop-filter: blur(4px);
                -webkit-backdrop-filter: blur(4px);
                color: var(--primary-text-color);
                font-size: 10px;
                line-height: 1.3;
                padding: 4px 6px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }
            .label-row { white-space: nowrap; }
            .label-title { font-weight: bold; font-size: 11px; margin-bottom: 2px; }
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
        
        html += `<div class="legend-item"><div class="dot" style="background: ${this._config.style.comfort_fill}; border: 1px solid ${this._config.style.comfort_stroke}"></div> Comfort Zone</div>`;
        
        if (this._config.weather_file) {
             const days = this._config.weather_window_days;
             const rangeText = `Seasonal Weather (+/- ${days} days)`;
             html += `<div class="legend-item"><div class="dot" style="background: linear-gradient(to right, ${this._config.heatmap_colors[1]}, ${this._config.heatmap_colors[2]})"></div> ${rangeText}</div>`;
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

        let tempRange, humRange;
        if (this.isMetric) {
            tempRange = [PsychroMath.CtoF(-25), PsychroMath.CtoF(45)]; 
            humRange = [0, 0.030]; 
        } else {
            tempRange = [-10, 110];
            humRange = [0, 0.030];
        }

        const altitude = this._config.altitude;
        const pressure = PsychroMath.getPressureFromAltitude(altitude, this._config.unit_system);

        const xScale = (val) => ((val - tempRange[0]) / (tempRange[1] - tempRange[0])) * innerWidth;
        const yScale = (val) => innerHeight - ((val - humRange[0]) / (humRange[1] - humRange[0])) * innerHeight;

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

            const today = new Date();
            const currentDOY = this.getDayOfYear(today);
            const windowDays = this._config.weather_window_days;

            this.weatherPoints.forEach(pt => {
                let dist = Math.abs(pt.doy - currentDOY);
                if (dist > 182) dist = 365 - dist;
                if (dist > windowDays) return;

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
        let trailsSvg = '';
        let trendSvg = '';
        
        const cStyle = this._config.style;
        const textColor = "var(--primary-text-color)";
        const axisColor = cStyle.axis;
        const regionLabelColor = cStyle.region_labels;
        
        const satClipPathId = `sat-clip-${Math.random().toString(36).substr(2, 9)}`;
        svgContent += `<defs><clipPath id="${satClipPathId}"><path d="${lineGen(satAreaPoints)} Z" /></clipPath></defs>`;

        // Custom RH Clip
        const rhClipPathId = `rh-clip-${Math.random().toString(36).substr(2, 9)}`;
        const rh80Points = [];
        const rh20Points = [];
        for (let t = tempRange[0]; t <= tempRange[1]; t += 1.0) {
            const w = PsychroMath.getWFromRelHum(t, 80, pressure);
            const wSat = PsychroMath.getWFromRelHum(t, 100, pressure);
            rh80Points.push({ x: xScale(t), y: yScale(Math.min(w, wSat)) });
        }
        for (let t = tempRange[1]; t >= tempRange[0]; t -= 1.0) {
            const w = PsychroMath.getWFromRelHum(t, 20, pressure);
            rh20Points.push({ x: xScale(t), y: yScale(w) });
        }
        const rhClipD = lineGen([...rh80Points, ...rh20Points]) + " Z";
        svgContent += `<defs><clipPath id="${rhClipPathId}"><path d="${rhClipD}" /></clipPath></defs>`;

        // Create PMV Clip Path
        const pmvClipPathId = `pmv-clip-${Math.random().toString(36).substr(2, 9)}`;
        const met = this._config.metabolic_rate;
        const clo = this._config.clothing_level;
        const vel = this._config.air_velocity;
        const mrtOffset = this._config.mean_radiant_temp_offset;
        const upperLine = []; const lowerLine = []; const maxW = 0.018; const wStep = 0.001;
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
            const t_cold = findT(-0.5); const t_hot = findT(0.5);
            lowerLine.push({ x: xScale(t_cold), y: yScale(w) }); upperLine.unshift({ x: xScale(t_hot), y: yScale(w) });
        }
        const polyD = lineGen([...lowerLine, ...upperLine]) + " Z";
        svgContent += `<defs><clipPath id="${pmvClipPathId}"><path d="${polyD}" /></clipPath></defs>`;

        // Render Comfort Zone with Dual Clipping Strategy
        svgContent += `<path d="${polyD}" fill="${cStyle.comfort_fill}" stroke="none" clip-path="url(#${rhClipPathId})" />`;
        svgContent += `<path d="${polyD}" fill="none" stroke="${cStyle.comfort_stroke}" stroke-width="1" clip-path="url(#${rhClipPathId})" />`;
        const rh80LineD = lineGen(rh80Points);
        const rh20LineD = lineGen(rh20Points.slice().reverse()); 
        svgContent += `<path d="${rh80LineD}" fill="none" stroke="${cStyle.comfort_stroke}" stroke-width="1" clip-path="url(#${pmvClipPathId})" />`;
        svgContent += `<path d="${rh20LineD}" fill="none" stroke="${cStyle.comfort_stroke}" stroke-width="1" clip-path="url(#${pmvClipPathId})" />`;

        // Wet Bulb
        const wbColor = cStyle.wet_bulb;
        const wbRange = this.isMetric ? { start: -25, end: 45, step: 5 } : { start: -10, end: 110, step: 5 };
        
        for (let wbVal = wbRange.start; wbVal <= wbRange.end; wbVal += wbRange.step) {
            const wbF = this.isMetric ? PsychroMath.CtoF(wbVal) : wbVal;
            const pts = [];
            for (let t = wbF; t <= tempRange[1]; t += 1) {
                const w = PsychroMath.getWFromWetBulb(t, wbF, pressure);
                if (w >= 0 && w <= humRange[1]) pts.push({ x: xScale(t), y: yScale(w) });
            }
            if (pts.length > 1) {
                svgContent += `<path d="${lineGen(pts)}" fill="none" stroke="${wbColor}" stroke-width="0.5" stroke-dasharray="4,4" opacity="0.4" clip-path="url(#${satClipPathId})" />`;
                const labelPt = pts[0];
                if (labelPt) svgContent += `<text x="${labelPt.x - 3}" y="${labelPt.y - 3}" font-size="9" fill="${wbColor}" text-anchor="end" opacity="0.6">${wbVal}${this.isMetric ? '' : ''}</text>`;
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
            const strokeColor = isSat ? cStyle.saturation : cStyle.grid;
            svgContent += `<path d="${lineGen(pts)}" fill="none" stroke="${strokeColor}" stroke-width="${isSat ? 2 : 1}" stroke-dasharray="${isSat ? '0' : '4,4'}" opacity="${isSat ? 1 : 0.5}" />`;
            if (pts.length > 5 && !isSat) {
                const pt = pts[Math.floor(pts.length * 0.7)];
                svgContent += `<text x="${pt.x}" y="${pt.y - 2}" font-size="10" fill="${cStyle.axis}">${rh}%</text>`;
            }
        });

        // Axes
        const xTicks = [];
        for (let t = tempRange[0]; t <= tempRange[1]; t += 10) xTicks.push(t);
        svgContent += `<line x1="0" y1="${innerHeight}" x2="${innerWidth}" y2="${innerHeight}" stroke="${cStyle.axis}" />`;
        xTicks.forEach(t => {
            const x = xScale(t);
            svgContent += `<line x1="${x}" y1="${innerHeight}" x2="${x}" y2="${innerHeight+6}" stroke="${cStyle.axis}" />`;
            svgContent += `<line x1="${x}" y1="0" x2="${x}" y2="${innerHeight}" stroke="${cStyle.grid}" />`;
            svgContent += `<text x="${x}" y="${innerHeight+20}" text-anchor="middle" font-size="12" fill="${textColor}">${t}°F</text>`;
        });
        const yTicks = [];
        for (let w = 0; w <= humRange[1]; w += 0.005) yTicks.push(w);
        svgContent += `<line x1="${innerWidth}" y1="0" x2="${innerWidth}" y2="${innerHeight}" stroke="${cStyle.axis}" />`;
        yTicks.forEach(w => {
            const y = yScale(w);
            svgContent += `<line x1="${innerWidth}" y1="${y}" x2="${innerWidth+6}" y2="${y}" stroke="${cStyle.axis}" />`;
            svgContent += `<line x1="0" y1="${y}" x2="${innerWidth}" y2="${y}" stroke="${cStyle.grid}" />`;
            svgContent += `<text x="${innerWidth+8}" y="${y+3}" font-size="12" fill="${textColor}">${(w*7000).toFixed(0)}</text>`;
        });
        svgContent += `<text x="${innerWidth/2}" y="${innerHeight+40}" text-anchor="middle" fill="${textColor}" font-size="14">Dry Bulb Temperature (°F)</text>`;
        svgContent += `<text transform="rotate(-90)" x="${-innerHeight/2}" y="${innerWidth+55}" text-anchor="middle" fill="${textColor}" font-size="14">Humidity Ratio (grains/lb)</text>`;

        if (this.weatherLoaded && this.weatherPoints.length > 0 && maxBinCount > 0) {
            const legendW = 100; const legendH = 10; const legendX = innerWidth - legendW - 10; const legendY = innerHeight - 40;
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
                   <rect width="${legendW}" height="${legendH}" fill="url(#${gradientId})" stroke="${cStyle.axis}" stroke-width="0.5" />
                   <text x="0" y="-4" font-size="9" fill="${cStyle.axis}">0</text>
                   <text x="${legendW}" y="-4" font-size="9" fill="${cStyle.axis}" text-anchor="end">${maxBinCount} hrs</text>
                   <text x="${legendW/2}" y="${legendH + 10}" font-size="9" fill="${cStyle.axis}" text-anchor="middle" font-weight="bold">Frequency</text>
               </g>
            `;
        }

        // --- NEW: ENTHALPY TREND GRAPH (Top Left) ---
        if (this.enthalpyHistory.length > 0 && this._config.enthalpy_trend_hours > 0) {
            const tW = 500; 
            const tH = 300; 
            const tX = 10;   
            const tY = 10;   
            
            // 1. Calculate Scales for Trend
            let minH = Infinity, maxH = -Infinity, minTime = Infinity, maxTime = -Infinity;
            this.enthalpyHistory.forEach(series => {
                series.data.forEach(d => {
                    if (d.value < minH) minH = d.value;
                    if (d.value > maxH) maxH = d.value;
                    const t = d.time.getTime();
                    if (t < minTime) minTime = t;
                    if (t > maxTime) maxTime = t;
                });
            });
            // Buffer
            minH -= 1; maxH += 1;
            
            const titleOffset = 25; 
            const graphH = tH - titleOffset;

            const scaleTX = (t) => ((t - minTime) / (maxTime - minTime)) * tW;
            const scaleTY = (h) => (graphH - ((h - minH) / (maxH - minH)) * graphH) + titleOffset; 
            
            const trendGen = (data) => {
                if (data.length === 0) return '';
                const d = data.map((pt, i) => `${i===0?'M':'L'} ${scaleTX(pt.time.getTime()).toFixed(1)},${scaleTY(pt.value).toFixed(1)}`).join(' ');
                return d;
            };

            const maskId = `trend-mask-${Math.random().toString(36).substr(2, 9)}`;
            const gradId = `trend-fade-grad-${maskId}`;
            svgContent += `
                <defs>
                    <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="white" stop-opacity="1"/>
                        <stop offset="40%" stop-color="white" stop-opacity="0.9"/>
                        <stop offset="80%" stop-color="black" stop-opacity="0"/> 
                    </linearGradient>
                    <mask id="${maskId}">
                        <rect x="0" y="0" width="${tW}" height="${tH}" fill="url(#${gradId})" />
                    </mask>
                </defs>
            `;

            let trendLines = '';
            
            const unitsH = this.isMetric ? "kJ/kg" : "Btu/lb";
            trendLines += `<text x="5" y="15" font-size="14" font-weight="bold" fill="${textColor}">Enthalpy Trend (${this._config.enthalpy_trend_hours}h) - ${unitsH}</text>`;
            trendLines += `<text x="-5" y="${titleOffset + 8}" font-size="10" fill="${axisColor}" text-anchor="end">${maxH.toFixed(0)}</text>`;
            trendLines += `<text x="-5" y="${tH}" font-size="10" fill="${axisColor}" text-anchor="end">${minH.toFixed(0)}</text>`;

            let seriesPaths = '';
            this.enthalpyHistory.forEach(series => {
                seriesPaths += `<path d="${trendGen(series.data)}" fill="none" stroke="${series.color}" stroke-width="2" />`;
            });
            
            trendLines += `<g mask="url(#${maskId})">${seriesPaths}</g>`;
            trendSvg += `<g transform="translate(${tX}, ${tY})">${trendLines}</g>`;
        }

        // --- LAYER 3: TRAILS ---
        this.trailPoints.forEach(trail => {
            trail.points.forEach(pt => {
                if (pt.db < tempRange[0] || pt.db > tempRange[1] || pt.w > humRange[1]) return;
                const cx = xScale(pt.db);
                const cy = yScale(pt.w);
                const opacity = (1 - pt.age) * 0.5;
                if (opacity > 0.05) {
                    trailsSvg += `<circle cx="${cx}" cy="${cy}" r="2" fill="${trail.color}" stroke="none" opacity="${opacity}" />`;
                }
            });
        });
        
        svgContent += `<g class="trails">${trailsSvg}</g>`;
        svgContent += `<g class="trend">${trendSvg}</g>`; 

        // --- LAYER 4: POINTS & LABELS ---
        // 1. Calculate Coordinates for all points
        const chartPoints = this.points.map(pt => {
            if (pt.db < tempRange[0] || pt.db > tempRange[1] || pt.w > humRange[1]) return null;
            return {
                ...pt,
                cx: xScale(pt.db),
                cy: yScale(pt.w)
            };
        }).filter(p => p !== null);

        // Sorting by Y helps, but let's sort by density? Or stick to Y.
        chartPoints.sort((a, b) => a.cy - b.cy);
        
        const occupied = []; 
        const boxW = 170; 
        const boxH = 65; 
        const padding = 5; 

        // Add markers to occupied zones
        chartPoints.forEach(p => { 
            occupied.push({ left: p.cx - 10, top: p.cy - 10, right: p.cx + 10, bottom: p.cy + 10 }); 
        });

        const getOverlapArea = (rect) => {
            // Check chart bounds overlap (penalty)
            let boundsPenalty = 0;
            if (rect.left < 0) boundsPenalty += (0 - rect.left) * rect.height;
            if (rect.right > innerWidth) boundsPenalty += (rect.right - innerWidth) * rect.height;
            if (rect.top < 0) boundsPenalty += (0 - rect.top) * rect.width;
            if (rect.bottom > innerHeight) boundsPenalty += (rect.bottom - innerHeight) * rect.width;

            let objOverlap = 0;
            for (let other of occupied) {
                const x_overlap = Math.max(0, Math.min(rect.right, other.right) - Math.max(rect.left, other.left));
                const y_overlap = Math.max(0, Math.min(rect.bottom, other.bottom) - Math.max(rect.top, other.top));
                objOverlap += x_overlap * y_overlap;
            }
            return boundsPenalty + objOverlap;
        };

        chartPoints.forEach(pt => {
            // Generate candidates: Radii * Angles
            const radii = [40, 60, 90, 120, 150];
            const angles = [
                 -45, -135, 45, 135, // Diagonals first (preferred)
                 -90, 90,            // Vertical
                 0, 180,             // Horizontal
                 -20, -70, -110, -160, 20, 70, 110, 160 // Intermediates
            ];
            
            let bestCandidate = null;
            let minOverlap = Infinity;

            for (let r of radii) {
                for (let ang of angles) {
                    const rad = ang * (Math.PI / 180);
                    const dx = Math.cos(rad) * r;
                    const dy = Math.sin(rad) * r;
                    
                    const boxX = (dx > 0) ? dx : (dx - boxW);
                    const boxY = (dy > 0) ? dy : (dy - boxH);
                    
                    const absBoxX = pt.cx + boxX;
                    const absBoxY = pt.cy + boxY;
                    
                    const rect = { 
                        left: absBoxX - padding, 
                        top: absBoxY - padding, 
                        right: absBoxX + boxW + padding, 
                        bottom: absBoxY + boxH + padding,
                        width: boxW + 2*padding,
                        height: boxH + 2*padding
                    };
                    
                    const overlap = getOverlapArea(rect);
                    
                    if (overlap === 0) {
                        // Found a free spot!
                        bestCandidate = { dx, dy, boxX, boxY };
                        minOverlap = 0;
                        break; 
                    }
                    
                    if (overlap < minOverlap) {
                        minOverlap = overlap;
                        bestCandidate = { dx, dy, boxX, boxY };
                    }
                }
                if (minOverlap === 0) break;
            }
            
            // Fallback (should have been set by loop, but safe guard)
            if (!bestCandidate) { 
                 const dx = 40; const dy = -40; 
                 bestCandidate = { dx, dy, boxX: dx, boxY: dy - boxH }; 
            }

            // Register used space
            occupied.push({
                left: pt.cx + bestCandidate.boxX,
                top: pt.cy + bestCandidate.boxY,
                right: pt.cx + bestCandidate.boxX + boxW,
                bottom: pt.cy + bestCandidate.boxY + boxH
            });
            
            // Draw
            const lineX2 = pt.cx + bestCandidate.dx;
            const lineY2 = pt.cy + bestCandidate.dy;
            const boxAbsX = pt.cx + bestCandidate.boxX;
            const boxAbsY = pt.cy + bestCandidate.boxY;
            
            pointsSvg += `<circle cx="${pt.cx}" cy="${pt.cy}" r="5" fill="none" stroke="${pt.color}" stroke-width="2" />`;
            labelsSvg += `<line x1="${pt.cx}" y1="${pt.cy}" x2="${lineX2}" y2="${lineY2}" stroke="${pt.color}" stroke-width="1" />`;
            
            const p_w = PsychroMath.getPwFromW(pt.w, pressure); 
            const wb = PsychroMath.getWetBulb(pt.db, pt.w, pressure); 
            const dp = PsychroMath.getDewPoint(p_w); 
            const h = PsychroMath.getEnthalpyIP(pt.db, pt.w); 
            const w_grains = pt.w * 7000;

            let lines;
            if (this.isMetric) {
                const dbC = PsychroMath.FtoC(pt.db);
                const wbC = PsychroMath.FtoC(wb);
                const dpC = PsychroMath.FtoC(dp);
                const w_gkg = pt.w * 1000;
                const h_kj = PsychroMath.getEnthalpySI(dbC, pt.w);
                
                lines = [ 
                    pt.name, 
                    `DB: ${dbC.toFixed(1)}°C | RH: ${pt.rh.toFixed(1)}%`, 
                    `WB: ${wbC.toFixed(1)}°C | DP: ${dpC.toFixed(1)}°C`, 
                    `h: ${h_kj.toFixed(1)} kJ/kg | W: ${w_gkg.toFixed(1)} g/kg` 
                ];
            } else {
                lines = [ 
                    pt.name, 
                    `DB: ${pt.db.toFixed(1)}°F | RH: ${pt.rh.toFixed(1)}%`, 
                    `WB: ${wb.toFixed(1)}°F | DP: ${dp.toFixed(1)}°F`, 
                    `h: ${h.toFixed(1)} Btu/lb | W: ${w_grains.toFixed(1)} gr/lb` 
                ];
            }

            labelsSvg += `<foreignObject x="${boxAbsX}" y="${boxAbsY}" width="${boxW}" height="${boxH}"><div xmlns="http://www.w3.org/1999/xhtml" class="label-box" style="border-color: ${pt.color}; background: ${this._config.style.label_background};"><div class="label-title">${lines[0]}</div><div class="label-row">${lines[1]}</div><div class="label-row">${lines[2]}</div><div class="label-row">${lines[3]}</div></div></foreignObject>`;
        });

        svgContent += `<g class="labels">${labelsSvg}</g>`;
        svgContent += `<g class="points">${pointsSvg}</g>`;

        this.svgEl.innerHTML = `<g transform="translate(${margin.left},${margin.top})">${svgContent}</g>`;
    }

    getCardSize() {
        return 4;
    }
}

customElements.define('psychrometric-card', PsychrometricCard);
