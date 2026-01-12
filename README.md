Psychrometric Card for Home AssistantA native, lightweight Lovelace card that renders a live Psychrometric Chart using real-time entity data.Designed for HVAC professionals and enthusiasts, this card visualizes the state of air in your home against the ASHRAE 55 Comfort Zone. It features unlimited custom state points, wet-bulb lines, and an innovative Annual Weather Heatmap layer driven by EPW climate files.(Replace this link with an actual screenshot of your card)FeaturesReal-Time Visualization: Plot indoor, outdoor, and HVAC supply points dynamically.ASHRAE 55 Comfort Zone: Calculates the comfort polygon based on metabolic rate, clothing level, and air velocity (PMV model).Weather Heatmap: Import standard .epw (EnergyPlus Weather) files to render a historical frequency heatmap directly on the chart.Zero Dependencies: Built with native SVG and HTML Canvas. No heavy libraries like D3.js or Chart.js.Theme Aware: Automatically adapts to Home Assistant Light and Dark modes.Mobile Friendly: Responsive design that scales to fit any dashboard column.InstallationMethod 1: HACS (Recommended)Go to HACS > Frontend.Click the 3 dots in the top right corner and select Custom repositories.Add https://github.com/corrgraphics/psychrometric-card as a Lovelace repository.Click Explore & Download Repositories and search for "Psychrometric Card".Click Download.Method 2: Manual InstallationDownload psychrometric-card.js from the Releases page.Upload the file to your Home Assistant config/www/ directory.Add the resource to your Dashboard configuration:Settings > Dashboards > Three dots (top right) > Resources.Add Resource: /local/psychrometric-card.jsType: JavaScript Module.ConfigurationBasic Exampletype: custom:psychrometric-card
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
Advanced Example (Comfort & Weather)type: custom:psychrometric-card
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
Configuration OptionsNameTypeDefaultDescriptionpointslistRequiredA list of point objects to plot (see below).altitudenumber0Elevation in feet above sea level (adjusts atmospheric pressure).titlestringnullOptional header text for the card.show_titlebooleantrueShow or hide the card header.weather_filestringnullPath to a .epw file (e.g., /local/weather.epw) for heatmap background.heatmap_colorslist[Blue/Teal]List of 3 colors for the weather frequency gradient (Low, Mid, High).clothing_levelnumber0.5Insulation of clothing (clo).metabolic_ratenumber1.1Metabolic activity level (met).air_velocitynumber20Air speed in feet per minute (fpm).Point ObjectEach item in the points list accepts:NameTypeDescriptiontemperature_entitystringRequired. The entity ID for Dry Bulb temperature (°F).humidity_entitystringRequired. The entity ID for Relative Humidity (%).namestringLabel shown in the legend.iconstringMDI icon to display on the chart (e.g., mdi:home).colorstringCSS color for the icon and legend dot.Weather Heatmap (.epw)To visualize historical weather data:Download an EPW file for your location (e.g., from Climate.OneBuilding.org).Place the .epw file in your config/www/ folder.Reference it in the config via /local/filename.epw.The card parses this file and bins the hourly data into a frequency heatmap rendered behind the chart lines.CreditsDeveloped by corrgraphics.Math engine adapted from:ASHRAE Fundamentals (IP Units)CBE Thermal Comfort Tool (ISO 7730 PMV implementation)LicenseMIT License

<img width="892" height="625" alt="image" src="https://github.com/user-attachments/assets/4ab6ca15-c177-4db4-9f4b-ad7928a7162f" />

Example Configuration:

```yaml
type: custom:psychrometric-card
title: Home Climate
points:
  - name: Outside
    icon: mdi:target-variant
    temperature_entity: sensor.outside_temperature
    humidity_entity: sensor.outside_humidity
    color: "#3b82f6"
  - name: Upper Floor
    icon: mdi:target-variant
    temperature_entity: sensor.upstaris_temp
    humidity_entity: sensor.upstairs_hum
    color: "#10b981"
  - name: Main Floor
    icon: mdi:target-variant
    temperature_entity: sensor.lower_thermostat_temp
    humidity_entity: sensor.lower_thermostat_hum
    color: "#ffcc00"
# OPTIONAL CONFIGURATION
clothing_level: 0.6
metabolic_rate: 1.25
air_velocity: 10
altitude: 5610
weather_file: /local/epw/co_golden.epw
heatmap_colors:
  - rgba(158, 1210, 196, 0)
  - rgba(158, 210, 196, .5)
  - rgba(218, 131, 30, .5)
```

Additional Resources

Energy Plus Climate Files
https://energyplus.net/weather-region/north_and_central_america_wmo_region_4/USA

Visual Color Gradiant Picker
https://cssgradient.io/
