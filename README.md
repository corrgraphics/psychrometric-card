# Psychrometric Card for Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/release/corrgraphics/psychrometric-card.svg)](https://github.com/corrgraphics/psychrometric-card/releases)

A native, lightweight Lovelace card that renders a live **Psychrometric Chart** using real-time entity data.

This card visualizes the state of air in your home against the **ASHRAE 55 Comfort Zone**. It features unlimited custom state points, wet-bulb lines, and an innovative **Annual Weather Heatmap** layer driven by EPW climate files.

<img width="892" height="625" alt="image" src="https://github.com/user-attachments/assets/4ab6ca15-c177-4db4-9f4b-ad7928a7162f" />

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
    icon: "mdi:sofa"
    temperature_entity: sensor.living_room_temperature
    humidity_entity: sensor.living_room_humidity
    color: "#10b981"
  - name: "Outside"
    icon: "mdi:tree"
    temperature_entity: sensor.outdoor_temperature
    humidity_entity: sensor.outdoor_humidity
    color: "#3b82f6"
```

### Advanced Example (Comfort & Weather)

```yaml
type: custom:psychrometric-card
title: "Denver Weather Analysis"
altitude: 5280
# ASHRAE 55 Comfort Parameters
clothing_level: 0.6       # 0.5 = Shorts/Tee, 1.0 = Suit
metabolic_rate: 1.1       # 1.0 = Seated, 1.2 = Standing
air_velocity: 40          # fpm (feet per minute)
mean_radiant_temp_offset: 0 

# Weather Heatmap
weather_file: /local/weather/USA_CO_Denver.Intl.AP.725650_TMY3.epw
heatmap_colors:
  - "rgba(96, 165, 250, 0)"  # Low Freq (Transparent)
  - "#60a5fa"                # Mid Freq (Blue)
  - "#0f766e"                # High Freq (Teal)

points:
  - name: "Supply Air"
    icon: "mdi:air-conditioner"
    temperature_entity: sensor.hvac_supply_temp
    humidity_entity: sensor.hvac_supply_humidity
    color: "#ef4444"
```

### Configuration Options

| Name | Type | Default | Description |
|:-----|:-----|:--------|:------------|
| `points` | list | **Required** | A list of point objects to plot (see below). |
| `altitude` | number | `0` | Elevation in feet above sea level (adjusts atmospheric pressure). |
| `title` | string | `null` | Optional header text for the card. |
| `show_title` | boolean | `true` | Show or hide the card header. |
| `weather_file` | string | `null` | Path to a `.epw` file (e.g., `/local/weather.epw`) for heatmap background. |
| `heatmap_colors` | list | `[Blue/Teal]` | List of 3 colors for the weather frequency gradient (Low, Mid, High). |
| `clothing_level` | number | `0.5` | Insulation of clothing (clo). |
| `metabolic_rate` | number | `1.1` | Metabolic activity level (met). |
| `air_velocity` | number | `20` | Air speed in feet per minute (fpm). |

### Point Object
Each item in the `points` list accepts:

| Name | Type | Description |
|:-----|:-----|:------------|
| `temperature_entity` | string | **Required.** The entity ID for Dry Bulb temperature (°F). |
| `humidity_entity` | string | **Required.** The entity ID for Relative Humidity (%). |
| `name` | string | Label shown in the legend. |
| `icon` | string | MDI icon to display on the chart (e.g., `mdi:home`). |
| `color` | string | CSS color for the icon and legend dot. |

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
