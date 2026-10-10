# Published maritime reference network

Source: [searoute-py](https://github.com/genthalili/searoute-py), pinned commit and retrieval date in `source.json`.

- `marnet.geojson`: unchanged `searoute/data/marnet_searoute.geojson` from that revision.
- `ports.geojson`: unchanged upstream port reference; reserved for future verified port matching. Not used to generate current approach paths.
- Upstream license: Apache-2.0, retained unchanged in `LICENCE.txt`. See the [upstream repository](https://github.com/genthalili/searoute-py) for the license and attribution.
- Network provenance: Marnet / Eurostat SeaRoute, based on ORNL global shipping lanes with subsequent network enhancements.
- No AIS data, berth-level approach data, port navigation or vessel restrictions are provided by these files.

The cockpit export keeps existing edges, computes an undirected shortest network path, records the distance between each port and the nearest existing vertex, and excludes those unverified connectors. It is a geographic reference for visualization. It must not be represented as a recorded vessel journey or used for navigation.

OpenStreetMap rail references are separate from this maritime network: © OpenStreetMap contributors, ODbL, https://www.openstreetmap.org/copyright.
