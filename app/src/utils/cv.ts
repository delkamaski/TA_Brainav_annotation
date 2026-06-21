export const hexToRgbaArray = (hex: string, alpha: number = 255) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b, alpha];
};

export const doSmartFloodFill = (
  baseData: ImageData,
  maskData: ImageData,
  startX: number,
  startY: number,
  colorHex: string,
  threshold: number
) => {
  const width = baseData.width;
  const height = baseData.height;
  const x = Math.floor(startX);
  const y = Math.floor(startY);
  const startPos = (y * width + x) * 4;

  const sr = baseData.data[startPos], sg = baseData.data[startPos + 1], sb = baseData.data[startPos + 2];
  const [fR, fG, fB, fA] = hexToRgbaArray(colorHex, 255);
  const thresholdScaled = (threshold / 100) * 441.67;

  const matchStartColor = (pos: number) => {
    if (maskData.data[pos + 3] > 0) return false;
    const r = baseData.data[pos], g = baseData.data[pos + 1], b = baseData.data[pos + 2];
    const dist = Math.sqrt((r - sr) ** 2 + (g - sg) ** 2 + (b - sb) ** 2);
    return dist <= thresholdScaled;
  };

  const colorPixel = (pos: number) => {
    maskData.data[pos] = fR; maskData.data[pos + 1] = fG; maskData.data[pos + 2] = fB; maskData.data[pos + 3] = fA;
  };

  const pixelStack = [x, y];
  while (pixelStack.length > 0) {
    const cy = pixelStack.pop()!;
    const cx = pixelStack.pop()!;
    let currentY = cy;
    let pos = (currentY * width + cx) * 4;

    while (currentY >= 0 && matchStartColor(pos)) { currentY--; pos -= width * 4; }
    currentY++; pos += width * 4;

    let reachLeft = false, reachRight = false;
    while (currentY < height && matchStartColor(pos)) {
      colorPixel(pos);
      if (cx > 0) {
        if (matchStartColor(pos - 4)) {
          if (!reachLeft) { pixelStack.push(cx - 1, currentY); reachLeft = true; }
        } else if (reachLeft) { reachLeft = false; }
      }
      if (cx < width - 1) {
        if (matchStartColor(pos + 4)) {
          if (!reachRight) { pixelStack.push(cx + 1, currentY); reachRight = true; }
        } else if (reachRight) { reachRight = false; }
      }
      currentY++; pos += width * 4;
    }
  }
  return maskData;
};

export const doNormalBucketFill = (
  maskData: ImageData,
  startX: number,
  startY: number,
  colorHex: string
) => {
  const width = maskData.width;
  const height = maskData.height;
  const data = maskData.data;
  const x = Math.floor(startX);
  const y = Math.floor(startY);
  const startPos = (y * width + x) * 4;

  const startR = data[startPos], startG = data[startPos + 1], startB = data[startPos + 2], startA = data[startPos + 3];
  const [fR, fG, fB, fA] = hexToRgbaArray(colorHex, 255);

  if (startR === fR && startG === fG && startB === fB && startA === fA) return maskData;

  const matchStartColor = (pos: number) =>
    data[pos] === startR && data[pos + 1] === startG && data[pos + 2] === startB && data[pos + 3] === startA;

  const colorPixel = (pos: number) => {
    data[pos] = fR; data[pos + 1] = fG; data[pos + 2] = fB; data[pos + 3] = fA;
  };

  const pixelStack = [x, y];
  while (pixelStack.length > 0) {
    const cy = pixelStack.pop()!;
    const cx = pixelStack.pop()!;
    let currentY = cy;
    let pos = (currentY * width + cx) * 4;

    while (currentY >= 0 && matchStartColor(pos)) { currentY--; pos -= width * 4; }
    currentY++; pos += width * 4;

    let reachLeft = false, reachRight = false;
    while (currentY < height && matchStartColor(pos)) {
      colorPixel(pos);
      if (cx > 0) {
        if (matchStartColor(pos - 4)) {
          if (!reachLeft) { pixelStack.push(cx - 1, currentY); reachLeft = true; }
        } else if (reachLeft) { reachLeft = false; }
      }
      if (cx < width - 1) {
        if (matchStartColor(pos + 4)) {
          if (!reachRight) { pixelStack.push(cx + 1, currentY); reachRight = true; }
        } else if (reachRight) { reachRight = false; }
      }
      currentY++; pos += width * 4;
    }
  }
  return maskData;
};

export const applyEdgeDetectionAlgorithm = (
  baseData: ImageData,
  maskData: ImageData,
  colorHex: string
) => {
  const w = baseData.width;
  const h = baseData.height;
  const [mr, mg, mb, ma] = hexToRgbaArray(colorHex, 255);

  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  const intensity = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) {
    intensity[i] = (baseData.data[i * 4] * 0.3 + baseData.data[i * 4 + 1] * 0.59 + baseData.data[i * 4 + 2] * 0.11);
  }

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let px = 0, py = 0;
      for (let cy = -1; cy <= 1; cy++) {
        for (let cx = -1; cx <= 1; cx++) {
          const val = intensity[(y + cy) * w + (x + cx)];
          const weightIdx = (cy + 1) * 3 + (cx + 1);
          px += val * sobelX[weightIdx];
          py += val * sobelY[weightIdx];
        }
      }
      const mag = Math.sqrt(px * px + py * py);
      if (mag > 100) {
        const pos = (y * w + x) * 4;
        maskData.data[pos] = mr;
        maskData.data[pos + 1] = mg;
        maskData.data[pos + 2] = mb;
        maskData.data[pos + 3] = ma;
      }
    }
  }
  return maskData;
};