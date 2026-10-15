"""Build the regional satellite texture atlas (Python 3 + Pillow).

The atlas covers only the existing grain-source boundaries. Its exact Web
Mercator bounds are saved alongside it so UVs do not stretch the imagery.
All tiles must succeed before the published texture is replaced.
"""
import concurrent.futures
import argparse
import datetime
import hashlib
import io
import json
import math
from pathlib import Path
import subprocess
import time

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'map_data'
CACHE = ROOT.parent / '.local' / 'grain-satellite-tiles'
ZOOM = 7
SIZE = 256
N = 2 ** ZOOM
URL = 'https://webst01.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}'


def coordinates(value):
    if isinstance(value[0], (int, float)):
        yield value
    else:
        for child in value:
            yield from coordinates(child)


def tile_y(lat):
    return (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * N


def fetch_tile(position):
    x, y = position
    path = CACHE / f'{ZOOM}-{x}-{y}.jpg'
    for attempt in range(3):
        try:
            raw = path.read_bytes() if path.exists() else subprocess.run(
                ['curl', '--silent', '--show-error', '--fail', '--location', '--max-time', '25', URL.format(x=x, y=y, z=ZOOM)],
                check=True, capture_output=True, timeout=30
            ).stdout
            image = Image.open(io.BytesIO(raw)).convert('RGB')
            if image.size != (SIZE, SIZE):
                raise ValueError(f'Unexpected tile dimensions: {image.size}')
            path.write_bytes(raw)
            return position, image
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def main():
    global ZOOM, N
    parser = argparse.ArgumentParser()
    parser.add_argument('--national', action='store_true', help='Build the shared national cockpit atlas')
    args = parser.parse_args()
    if args.national:
        ZOOM = 6
        N = 2 ** ZOOM
    filename = 'china-provinces.geojson' if args.national else 'grain-source-boundaries.json'
    features = json.loads((DATA / filename).read_text(encoding='utf-8'))['features']
    points = [p for feature in features for p in coordinates(feature['geometry']['coordinates'])]
    xmin = math.floor((min(p[0] for p in points) + 180) / 360 * N)
    xmax = math.floor((max(p[0] for p in points) + 180) / 360 * N)
    ymin = math.floor(tile_y(max(p[1] for p in points)))
    ymax = math.floor(tile_y(min(p[1] for p in points)))
    CACHE.mkdir(parents=True, exist_ok=True)
    jobs = [(x, y) for y in range(ymin, ymax + 1) for x in range(xmin, xmax + 1)]
    atlas = Image.new('RGB', ((xmax - xmin + 1) * SIZE, (ymax - ymin + 1) * SIZE))
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for (x, y), tile in pool.map(fetch_tile, jobs):
            atlas.paste(tile, ((x - xmin) * SIZE, (y - ymin) * SIZE))
    stem = 'china-amap-satellite' if args.national else 'grain-source-amap-satellite'
    target = DATA / f'{stem}.webp'
    temporary = target.with_suffix('.tmp.webp')
    atlas.save(temporary, 'WEBP', quality=92, method=6)
    temporary.replace(target)
    metadata = {
        'provider': '高德地图', 'layer': '卫星影像',
        'attribution': '© 高德地图', 'source': 'https://www.amap.com/',
        'tileTemplate': URL, 'zoom': ZOOM, 'tileCount': len(jobs),
        'retrievedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'note': 'Regional satellite mosaic; acquisition dates vary by tile. Not real-time imagery.',
        'projection': 'Web Mercator', 'width': atlas.width, 'height': atlas.height,
        'bounds': {'west': xmin / N * 360 - 180, 'east': (xmax + 1) / N * 360 - 180,
                   'south': 180 - (ymax + 1) / N * 360, 'north': 180 - ymin / N * 360},
        'boundsUnits': 'longitude degrees and Mercator latitude degrees',
        'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
    }
    (DATA / f'{stem}.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{len(jobs)} tiles, {atlas.width}x{atlas.height}, {target.stat().st_size} bytes')


if __name__ == '__main__':
    main()
