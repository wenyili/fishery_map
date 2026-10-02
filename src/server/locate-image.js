const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const areaData = require('../../data/area.json');

const TILE = 256;
const ZOOM = 9;
const GRID_N = 5; // 5x5 瓦片，z=9 时约覆盖 3.5° x 3.5°（沿海一带够看到海岸线）

function lon2x(lon, z) {
  return ((lon + 180) / 360) * TILE * Math.pow(2, z);
}
function lat2y(lat, z) {
  const r = (lat * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) *
    TILE *
    Math.pow(2, z)
  );
}
function x2lon(x, z) {
  return (x / (TILE * Math.pow(2, z))) * 360 - 180;
}
function y2lat(y, z) {
  const n = Math.PI - (2 * Math.PI * y) / (TILE * Math.pow(2, z));
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

// 仿照 fishery_map 前端 fishery_area.js / spider.js 里同一套 0.5° 网格算法
function gridFloor(v) {
  const floor = Math.floor(v);
  const frac = v - floor;
  return frac >= 0.5 ? floor + 0.5 : floor;
}

function escapeXml(s) {
  return String(s).replace(/[<>&"]/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;',
  }[c]));
}

/**
 * 生成以 (lat, lon) 为中心的定位图：Navionics 瓦片拼图 + 经纬度网格 + 0.5° 海区网格编号 + 定位标记。
 * 返回 PNG Buffer。
 */
async function renderLocateImage({ lat, lon, name, time, navionicsDict }) {
  const z = ZOOM;
  const gridN = GRID_N;
  const tilesRootZ = path.join(navionicsDict, String(z));

  const cx = Math.floor(lon2x(lon, z) / TILE);
  const cyXyz = Math.floor(lat2y(lat, z) / TILE);
  const half = Math.floor(gridN / 2);
  const minX = cx - half;
  const minXyzY = cyXyz - half;

  const canvasW = gridN * TILE;
  const canvasH = gridN * TILE;

  const composites = [];
  for (let row = 0; row < gridN; row++) {
    const xyzY = minXyzY + row;
    const tmsY = Math.pow(2, z) - 1 - xyzY;
    for (let col = 0; col < gridN; col++) {
      const tx = minX + col;
      const p = path.join(tilesRootZ, String(tx), `${tmsY}.png`);
      if (fs.existsSync(p)) {
        composites.push({ input: p, left: col * TILE, top: row * TILE });
      }
    }
  }

  const originPxX = minX * TILE;
  const originPxY = minXyzY * TILE;

  function geoToPixel(latV, lonV) {
    return {
      px: lon2x(lonV, z) - originPxX,
      py: lat2y(latV, z) - originPxY,
    };
  }

  const westLon = x2lon(originPxX, z);
  const eastLon = x2lon(originPxX + canvasW, z);
  const northLat = y2lat(originPxY, z);
  const southLat = y2lat(originPxY + canvasH, z);

  const svgParts = [];
  svgParts.push(
    `<svg width="${canvasW}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg">`
  );

  // 经纬度网格线（每 1 度），白色半透明 + 边缘标注
  const lonStart = Math.ceil(westLon);
  const lonEnd = Math.floor(eastLon);
  for (let lo = lonStart; lo <= lonEnd; lo++) {
    const { px } = geoToPixel(northLat, lo);
    svgParts.push(
      `<line x1="${px}" y1="0" x2="${px}" y2="${canvasH}" stroke="white" stroke-opacity="0.55" stroke-width="1" stroke-dasharray="2,3"/>`
    );
    svgParts.push(
      `<text x="${px + 3}" y="14" font-size="12" fill="white" stroke="black" stroke-width="0.6" paint-order="stroke">${lo}°E</text>`
    );
  }
  const latStart = Math.ceil(southLat);
  const latEnd = Math.floor(northLat);
  for (let la = latStart; la <= latEnd; la++) {
    const { py } = geoToPixel(la, westLon);
    svgParts.push(
      `<line x1="0" y1="${py}" x2="${canvasW}" y2="${py}" stroke="white" stroke-opacity="0.55" stroke-width="1" stroke-dasharray="2,3"/>`
    );
    svgParts.push(
      `<text x="4" y="${py - 3}" font-size="12" fill="white" stroke="black" stroke-width="0.6" paint-order="stroke">${la}°N</text>`
    );
  }

  // 0.5° 海区网格 + 编号
  const gLonStart = gridFloor(westLon);
  const gLonEnd = gridFloor(eastLon);
  const gLatStart = gridFloor(southLat);
  const gLatEnd = gridFloor(northLat);
  for (let g = gLatStart; g <= gLatEnd + 0.001; g += 0.5) {
    for (let h = gLonStart; h <= gLonEnd + 0.001; h += 0.5) {
      const key = `[${h}, ${g}]`;
      const area = areaData[key];
      const p1 = geoToPixel(g, h);
      const p2 = geoToPixel(g + 0.5, h + 0.5);
      const x = Math.min(p1.px, p2.px);
      const y = Math.min(p1.py, p2.py);
      const w = Math.abs(p2.px - p1.px);
      const h2 = Math.abs(p2.py - p1.py);
      svgParts.push(
        `<rect x="${x}" y="${y}" width="${w}" height="${h2}" fill="none" stroke="yellow" stroke-opacity="0.5" stroke-width="1" stroke-dasharray="4,3"/>`
      );
      if (area != null) {
        svgParts.push(
          `<text x="${x + w / 2}" y="${y + h2 / 2}" font-size="13" fill="yellow" text-anchor="middle" stroke="black" stroke-width="0.6" paint-order="stroke">${area}</text>`
        );
      }
    }
  }

  // 目标点标记
  const target = geoToPixel(lat, lon);
  svgParts.push(
    `<circle cx="${target.px}" cy="${target.py}" r="24" fill="#ff3b30" stroke="white" stroke-width="6"/>`
  );
  svgParts.push(
    `<line x1="${target.px - 44}" y1="${target.py}" x2="${target.px + 44}" y2="${target.py}" stroke="#ff3b30" stroke-width="5"/>`
  );
  svgParts.push(
    `<line x1="${target.px}" y1="${target.py - 44}" x2="${target.px}" y2="${target.py + 44}" stroke="#ff3b30" stroke-width="5"/>`
  );

  // 信息文字框（左下角）：船名、经纬度、海区（跟叠加层用同一份 area.json 查）、更新时间
  const targetArea = areaData[`[${gridFloor(lon)}, ${gridFloor(lat)}]`];
  const info = [
    name,
    `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`,
    targetArea != null ? `海区：${targetArea}` : null,
    time ? `更新：${time}` : null,
  ]
    .filter(Boolean)
    .map(escapeXml);
  if (info.length > 0) {
    const boxW = 480;
    const boxH = 52 * info.length + 40;
    const boxX = 10;
    const boxY = canvasH - boxH - 10;
    svgParts.push(
      `<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" fill="black" fill-opacity="0.55" rx="12"/>`
    );
    info.forEach((line, i) => {
      svgParts.push(
        `<text x="${boxX + 28}" y="${boxY + 60 + i * 52}" font-size="38" fill="white">${line}</text>`
      );
    });
  }

  svgParts.push('</svg>');
  const svg = svgParts.join('\n');

  return sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 3,
      background: { r: 200, g: 220, b: 230 },
    },
  })
    .composite([...composites, { input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

module.exports = { renderLocateImage };
