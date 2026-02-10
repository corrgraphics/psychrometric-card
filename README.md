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

### Basic Example

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
| `altitude` | number | `0` | Elevation in feet above sea level (adjusts atmospheric pressure). |
| `title` | string | `null` | Optional header text for the card. |
| `show_title` | boolean | `true` | Show or hide the card header. |
| `weather_file` | string | `null` | Path to a `.epw` file (e.g., `/local/weather.epw`) for heatmap background. |
| `weather_window_days` | string | `15` | Number of trailing and leading days to render for seasonal weather data. |
| `heatmap_colors` | list | `[Blue/Teal]` | List of 3 colors for the weather frequency gradient (Low, Mid, High). |
| `clothing_level` | number | `0.5` | Insulation of clothing (clo). |
| `metabolic_rate` | number | `1.1` | Metabolic activity level (met). |
| `air_velocity` | number | `20` | Air speed in feet per minute (fpm). |
| `chart_style` | list | `null` | Chart look and feel configuration. |
| `enable_trails` | boolean | `true` | Enable historical "ghost" trails to Chart. |
| `trail_hours` | number | `12` | Number of historical hours to show. |
| `enthalpy_trend_hours` | number | `24` | Number hours to show on enthalpy trend chart. Set to Zero to dissable. |
| `unit_system` | string | `imperial` | Set to mertic to convert to SI units. |

### Point Object
Each item in the `points` list accepts:

| Name | Type | Description |
|:-----|:-----|:------------|
| `temperature_entity` | string | **Required.** The entity ID for Dry Bulb temperature (°F). |
| `humidity_entity` | string | **Required.** The entity ID for Relative Humidity (%). |
| `name` | string | Label shown in the legend. |
| `color` | string | CSS color for the icon and legend dot. |

### Chart Style
Each item in the `chart_style` list accepts:

| Name | Type | Description |
|:-----|:-----|:------------|
| `saturation_line` | string | Saturation line color |
| `wet_bulb_lines` | string | Wet Bulb Temperature line color |
| `grid_lines` | string | Background grid line color |
| `axis_lines` | string | Axis line color |
| `comfort_zone_fill` | string | ASHRAE 55 Confort Zone fill color |
| `comfort_zone_stroke` | string | ASHRAE 55 Confort Zone fill color |
| `label_background` | string | Point label background color and opacity |

## Weather Heatmap (.epw)
To visualize historical weather data:
1.  Download an EPW file for your location (e.g., from [Climate.OneBuilding.org](https://climate.onebuilding.org/)).
2.  Place the `.epw` file in your `config/www/` folder.
3.  Reference it in the config via `/local/filename.epw`.

The card parses this file and bins the hourly data into a frequency heatmap rendered behind the chart lines.

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

Visual Color Gradiant Picker
https://cssgradient.io/

Resource for determining ASHRAE 55 parameters for your space.
https://comfort.cbe.berkeley.edu/

## ASHRAE 55 Information

The ASHRAE 55 Standard is: Thermal Environmental Conditions for Human Occupancy.

The green box labeled “comfort zone” in the screenshots shown above is rendered based on inputs to your yaml config.

| Air Velocity | The air moving around in your home. Do you have forced air hear or radiant heat. Fans, Poor Insulation, Etc.|
|:-----|:-----|
|.05 to .25 m/s | unnoticeably still|
|.3 to .5 m/s | pleasantly still|
|.55 to 1 m/s | pleasant but noticeable|
|1.05 to 1.5 | slightly draughty|
|1.55 to 2 | noticeably draughty|


Clothing Level - When you are at home, what are you typically wearing?

0 - Naked
.05 - Underwear Only
.1 to .15 - Shorts Only - No Shoes
.2 to .35 - Shorts and T-Shirt - No Shoes
.4 to .55 - Shorts and T-Shirt, Shoes
.6 to .75 - Pants, Shirt, Shoes
.8 to 1.15 - Pants, Shirt, Jacket, Shoes
1.2+ - You are probably heading outside…
Metabolic Rate - The heat your body is producing

0 - you are dead
.05 to .2 - approaching death
.25 to .4 - sleeping
.45 to .6 - resting
.65 to .8 - reclining and relaxed
.85 to .95 - seated and relaxed
1 to 1.1 - seated w/ sedentary activity
1.15 to 1.2 - standing and relaxed
1.25 to 1.4 - seated with light activity
1.45 to 1.6 - standing with light activity
1.65 to 1.95 - walking
2+ - working out

You can input these or leave them @ default. Or you can create input sensors in home assistant to dynamically change this. (ie, sleeping @ night, motion or presence sensors to detect motion, seasonal clothing changes, etc.) Just add the sensor entity to the corresponding yaml config.
