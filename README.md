# Psychrometric Card for Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/release/corrgraphics/psychrometric-card.svg)](https://github.com/corrgraphics/psychrometric-card/releases)

A native, lightweight Lovelace card that renders a live **Psychrometric Chart** using real-time entity data.

This card visualizes the state of air in your home against the **ASHRAE 55 Comfort Zone**. It features unlimited custom state points, color customization, and an innovative **Seasonal Weather Heatmap** layer driven by EPW climate files.

<img width="1318" height="794" alt="image" src="https://github.com/user-attachments/assets/97e831d4-a4c7-4c2e-995e-0d02c4fa2ada" />


## Features

* **Real-Time Visualization:** Plot indoor, outdoor, and HVAC supply points dynamically.
* **ASHRAE 55 Comfort Zone:** Calculates the comfort polygon based on metabolic rate, clothing level, and air velocity (PMV model).
* **Weather Heatmap:** Import standard `.epw` (EnergyPlus Weather) files to render a historical frequency heatmap directly on the chart.
* **Metric & Imperial:** Full SI unit support — °C, kJ/kg, g/kg, m/s — switchable via `unit_system`.
* **Zero Dependencies:** Built with native SVG and HTML Canvas. No heavy libraries like D3.js or Chart.js.
* **Theme Aware:** Automatically adapts to Home Assistant Light and Dark modes.
* **Mobile Friendly:** Responsive design that scales to fit any dashboard column.

## Installation

### Method 1: HACS (Recommended)

1. Go to HACS > Frontend.
2. Click the 3 dots in the top right corner and select **Custom repositories**.
3. Add `https://github.com/corrgraphics/psychrometric-card` as a **Lovelace** repository.
4. Click **Explore & Download Repositories** and search for "Psychrometric Card".
5. Click **Download**.

### Method 2: Manual Installation

1. Download `psychrometric-card.js` from the [Releases](https://github.com/corrgraphics/psychrometric-card/releases) page.
2. Upload the file to your Home Assistant `config/www/` directory.
3. Add the resource to your Dashboard configuration:
   * **Settings** > **Dashboards** > **Three dots (top right)** > **Resources**.
   * Add Resource: `/local/psychrometric-card.js`
   * Type: **JavaScript Module**.

## Configuration

### Basic Example (Imperial)

```yaml
type: custom:psychrometric-card
title: "Home Climate"
altitude: 1000  # Elevation in feet
points:
  - name: "Living Room"
    temperature_entity: sensor.living_room_temperature
    humidity_entity: sensor.living_room_humidity
    color: "#10b981"
  - name: "Outside"
    temperature_entity: sensor.outdoor_temperature
    humidity_entity: sensor.outdoor_humidity
    color: "#3b82f6"
```

### Basic Example (Metric)

```yaml
type: custom:psychrometric-card
title: "Home Climate"
unit_system: metric
altitude: 300  # Elevation in metres
air_velocity: 0.1  # m/s
points:
  - name: "Living Room"
    temperature_entity: sensor.living_room_temperature   # expects °C
    humidity_entity: sensor.living_room_humidity
    color: "#10b981"
  - name: "Outside"
    temperature_entity: sensor.outdoor_temperature       # expects °C
    humidity_entity: sensor.outdoor_humidity
    color: "#3b82f6"
```

### Advanced Example (Comfort & Weather)

```yaml
type: custom:psychrometric-card
title: Home Climate
points:
  - name: Outside
    temperature_entity: sensor.home_temperature
    humidity_entity: sensor.home_relative_humidity
    color: "#3b82f6"
  - name: Upper Floor
    temperature_entity: sensor.thermostat_temperature
    humidity_entity: sensor.thermostat_humidity
    color: "#10b981"
  - name: Main Floor
    temperature_entity: sensor.esphome_temp
    humidity_entity: sensor.esphome_hum
    color: "#ffcc00"
clothing_level: 0.6
metabolic_rate: 1.25
air_velocity: 10
altitude: 5610
weather_file: /local/epw/local.epw
weather_window_days: 15
heatmap_colors:
  - rgba(158, 210, 196, 0)
  - rgba(158, 210, 196, .5)
  - rgba(218, 131, 30, .5)
chart_style:
  saturation_line: "#9ed2c4"
  wet_bulb_lines: "#10b981"
  grid_lines: rgba(255, 255, 255, 0.1)
  axis_lines: "#9ca3af"
  comfort_zone_fill: rgba(158, 210, 196, 0.2)
  comfort_zone_stroke: rgba(158, 210, 196, 0.6)
  label_background: rgba(0, 0, 0, 0.5)
enable_trails: true
trail_hours: 12
enthalpy_trend_hours: 24
```

### Configuration Options

| Name | Type | Default | Description |
|:-----|:-----|:--------|:------------|
| `points` | list | **Required** | A list of point objects to plot (see below). |
| `unit_system` | string | `imperial` | Set to `metric` for SI units (°C, kJ/kg, g/kg). |
| `altitude` | number | `0` | Elevation above sea level. Feet when imperial, metres when metric. |
| `title` | string | `null` | Optional header text for the card. |
| `show_title` | boolean | `true` | Show or hide the card header. |
| `weather_file` | string | `null` | Path to a `.epw` file (e.g., `/local/weather.epw`) for heatmap background. |
| `weather_window_days` | number | `15` | Number of trailing and leading days to render for seasonal weather data. |
| `heatmap_colors` | list | `[Blue/Teal]` | List of 3 colors for the weather frequency gradient (Low, Mid, High). |
| `clothing_level` | number | `0.5` | Insulation of clothing (clo). |
| `metabolic_rate` | number | `1.1` | Metabolic activity level (met). |
| `air_velocity` | number | `20` (imperial) / `0.1` (metric) | Air speed. Feet per minute (fpm) when imperial, metres per second (m/s) when metric. |
| `mean_radiant_temp_offset` | number | `0` | Offset applied to dry bulb temp to estimate mean radiant temperature. |
| `chart_style` | map | `null` | Chart look and feel configuration (see below). |
| `enable_trails` | boolean | `false` | Enable historical "ghost" trails on the chart. |
| `trail_hours` | number | `12` | Number of historical hours to show for trails. |
| `enthalpy_trend_hours` | number | `24` | Hours to show on the enthalpy trend chart. Set to `0` to disable. |

### Point Object
Each item in the `points` list accepts:

| Name | Type | Description |
|:-----|:-----|:------------|
| `temperature_entity` | string | **Required.** Entity ID for Dry Bulb temperature. °F when imperial, °C when metric. |
| `humidity_entity` | string | **Required.** Entity ID for Relative Humidity (%). |
| `name` | string | Label shown on the chart and in the legend. |
| `color` | string | CSS color for the point and legend dot. |

### Chart Style
Each item in the `chart_style` map accepts:

| Name | Type | Description |
|:-----|:-----|:------------|
| `saturation_line` | string | Saturation curve color. |
| `wet_bulb_lines` | string | Wet bulb line color. |
| `grid_lines` | string | Background grid line color. |
| `axis_lines` | string | Axis line color. |
| `comfort_zone_fill` | string | ASHRAE 55 comfort zone fill color. |
| `comfort_zone_stroke` | string | ASHRAE 55 comfort zone border color. |
| `label_background` | string | Point label background color and opacity. |
| `region_labels` | string | RH region label color. |

## Unit Systems

When `unit_system: metric` is set:

* Temperature axes and labels display in **°C**
* Humidity ratio displays in **g/kg** (instead of grains/lb)
* Enthalpy displays in **kJ/kg** (instead of Btu/lb)
* Wet bulb lines are labelled in **°C**
* Point tooltips show DB, WB, DP in **°C**
* `altitude` is interpreted in **metres**
* `air_velocity` is interpreted in **m/s** (default `0.1`)

Temperature entities must provide values in the matching unit — °F for imperial, °C for metric. Humidity is always a percentage (%).

## Weather Heatmap (.epw)
To visualize historical weather data:
1. Download an EPW file for your location (e.g., from [Climate.OneBuilding.org](https://climate.onebuilding.org/)).
2. Place the `.epw` file in your `config/www/` folder.
3. Reference it in the config via `/local/filename.epw`.

The card parses this file and bins the hourly data into a frequency heatmap rendered behind the chart lines. EPW files store temperature in °C internally; the card handles the conversion automatically regardless of `unit_system`.

## Credits

Developed by **[corrgraphics](https://github.com/corrgraphics)**.

Math engine adapted from:
* ASHRAE Fundamentals (IP Units)
* CBE Thermal Comfort Tool (ISO 7730 PMV implementation)

## License
MIT License

## Additional Resources

Energy Plus Climate Files
https://energyplus.net/weather-region/north_and_central_america_wmo_region_4/USA

Visual Color Gradient Picker
https://cssgradient.io/

Resource for determining ASHRAE 55 parameters for your space.
https://comfort.cbe.berkeley.edu/

## ASHRAE 55 Information

The ASHRAE 55 Standard is: Thermal Environmental Conditions for Human Occupancy.

The green box labeled "comfort zone" in the screenshots shown above is rendered based on inputs to your yaml config.

### Air Velocity

| Value | Description |
|:------|:------------|
| 0.05 – 0.25 m/s (10 – 50 fpm) | Unnoticeably still |
| 0.30 – 0.50 m/s (60 – 100 fpm) | Pleasantly still |
| 0.55 – 1.00 m/s (108 – 197 fpm) | Pleasant but noticeable |
| 1.05 – 1.50 m/s (207 – 295 fpm) | Slightly draughty |
| 1.55 – 2.00 m/s (305 – 394 fpm) | Noticeably draughty |

### Clothing Level

| Value | Description |
|:------|:------------|
| 0 | Naked |
| 0.05 | Underwear only |
| 0.10 – 0.15 | Shorts only, no shoes |
| 0.20 – 0.35 | Shorts and t-shirt, no shoes |
| 0.40 – 0.55 | Shorts and t-shirt, shoes |
| 0.60 – 0.75 | Pants, shirt, shoes |
| 0.80 – 1.15 | Pants, shirt, jacket, shoes |
| 1.20+ | You are probably heading outside… |

### Metabolic Rate

| Value | Description |
|:------|:------------|
| 0 | You are dead |
| 0.05 – 0.20 | Approaching death |
| 0.25 – 0.40 | Sleeping |
| 0.45 – 0.60 | Resting |
| 0.65 – 0.80 | Reclining and relaxed |
| 0.85 – 0.95 | Seated and relaxed |
| 1.00 – 1.10 | Seated with sedentary activity |
| 1.15 – 1.20 | Standing and relaxed |
| 1.25 – 1.40 | Seated with light activity |
| 1.45 – 1.60 | Standing with light activity |
| 1.65 – 1.95 | Walking |
| 2.00+ | Working out |

You can set these as fixed values or wire them to Home Assistant input sensors for dynamic comfort modeling — e.g. different clothing levels by season, motion sensors to detect activity, presence-based metabolic rate, etc. Just add the sensor entity ID to the corresponding yaml config option.

## Localization

The card supports multiple languages via the `language` config option. All abbreviations in point tooltips, axis labels, and UI text will be translated.

```yaml
type: custom:psychrometric-card
unit_system: metric
language: fr
points:
  - ...
```

| Language | Code | DB | WB | DP | RH |
|:---------|:-----|:---|:---|:---|:---|
| English  | `en` | DB | WB | DP | RH |
| Français | `fr` | BS | BH | PR | HR |
| Deutsch  | `de` | TT | FT | TP | rF |
| Español  | `es` | TB | TBH | PR | HR |

`language` defaults to `en` if not set. `unit_system` and `language` are independent — you can use `fr` with imperial units or `en` with metric.

Want to add your language? The `I18N` object at the top of `psychrometric-card.js` is the only place to edit — add a new key with your translations and submit a PR.
