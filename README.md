# psychrometric-card
Lovelace card that will generate a live psychrometric chart updated in real time.

Includes:
* ASHRAE 55 comfort profiles
* Unlimited points 
* Annual weather heatmap via .epw file import
* Customizable colors
* Compatable with most lovelace themes

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
