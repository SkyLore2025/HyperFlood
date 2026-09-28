# HyperFlood V10 — Rivers & Drainage Intelligence

V10 builds on the stable V9 accordion version.

New layer 04:
- scans mapped rivers, streams, canals, drains and ditches within 5 km
- reports nearest mapped waterway, type, distance and feature count
- draws returned waterways on the Leaflet map
- uses a Vercel serverless `/api/waterways` proxy to OpenStreetMap Overpass
- preserves spinner → tick/error roadmap states and one-open-at-a-time accordion behaviour

Scientific note: mapped-waterway proximity is contextual evidence, not flood probability or hydraulic modelling. OpenStreetMap coverage varies by location. NASA remains used in the historical/soil layers; the drainage geometry itself is from OpenStreetMap.
