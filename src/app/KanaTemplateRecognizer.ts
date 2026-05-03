const HIRAGANA =
  'ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅゆょよらりるれろゎわゐゑをんゔゕゖゝゞ';
const KATAKANA =
  'ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴヵヶヽヾー';

const KANA_CHARACTERS = Array.from(new Set([...HIRAGANA, ...KATAKANA]));
const TEMPLATE_SIZE = 32;
const DRAW_SIZE = 28;
const FONT_SIZE = 52;
const FONT_STACKS = [
  '"BIZ UDPGothic", "Yu Gothic UI", "Yu Gothic", Meiryo, sans-serif',
  '"Hiragino Sans", "Noto Sans JP", sans-serif',
  '"Hiragino Mincho ProN", "Yu Mincho", serif',
];

interface GlyphTemplate {
  char: string;
  bitmap: Uint8Array;
  rowProfile: Float32Array;
  colProfile: Float32Array;
}

export interface KanaSuggestion {
  text: string;
  score: number;
}

export interface KanaRecognitionResult {
  text: string;
  score: number;
  characterCount: number;
  suggestions: KanaSuggestion[];
}

export class KanaTemplateRecognizer {
  private templates: GlyphTemplate[] = [];
  private initialized = false;

  initialize(): void {
    if (this.initialized) {
      return;
    }

    this.templates = [];
    for (const char of KANA_CHARACTERS) {
      for (const fontStack of FONT_STACKS) {
        const bitmap = renderCharacterTemplate(char, fontStack);
        this.templates.push({
          char,
          bitmap,
          rowProfile: buildRowProfile(bitmap),
          colProfile: buildColProfile(bitmap),
        });
      }
    }
    this.initialized = true;
  }

  recognize(imageData: ImageData): KanaRecognitionResult | null {
    this.initialize();

    const mask = createInkMask(imageData);
    const components = extractInkComponents(mask, imageData.width, imageData.height).filter(component => component.pixels >= 24);
    if (components.length === 0) {
      return null;
    }

    const groups = groupComponentsIntoCharacters(components);
    if (groups.length === 0 || groups.length > 4) {
      return null;
    }

    const topCandidatesByGroup: Array<Array<{ char: string; score: number }>> = [];
    for (const group of groups) {
      const bitmap = normalizeMaskToTemplate(mask, imageData.width, imageData.height, group);
      const rowProfile = buildRowProfile(bitmap);
      const colProfile = buildColProfile(bitmap);
      const candidates = findTopTemplateMatches(bitmap, rowProfile, colProfile, this.templates, 4);
      const best = candidates[0];
      if (!best || best.score < 0.42) {
        return null;
      }
      topCandidatesByGroup.push(candidates);
    }

    const suggestions = combineSuggestions(topCandidatesByGroup).slice(0, 5);
    const bestSuggestion = suggestions[0];
    if (!bestSuggestion) {
      return null;
    }

    return {
      text: bestSuggestion.text,
      score: bestSuggestion.score,
      characterCount: groups.length,
      suggestions,
    };
  }
}

function renderCharacterTemplate(char: string, fontStack: string): Uint8Array {
  const canvas = new OffscreenCanvas(TEMPLATE_SIZE, TEMPLATE_SIZE);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('OffscreenCanvas 2D context is not available.');
  }

  ctx.clearRect(0, 0, TEMPLATE_SIZE, TEMPLATE_SIZE);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, TEMPLATE_SIZE, TEMPLATE_SIZE);
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${FONT_SIZE}px ${fontStack}`;
  ctx.fillText(char, TEMPLATE_SIZE / 2, TEMPLATE_SIZE / 2 + 1);

  const imageData = ctx.getImageData(0, 0, TEMPLATE_SIZE, TEMPLATE_SIZE);
  const mask = createInkMask(imageData);
  const components = extractInkComponents(mask, TEMPLATE_SIZE, TEMPLATE_SIZE);
  const bounds = mergeComponents(components);
  return bounds
    ? normalizeMaskToTemplate(mask, TEMPLATE_SIZE, TEMPLATE_SIZE, bounds)
    : new Uint8Array(TEMPLATE_SIZE * TEMPLATE_SIZE);
}

function findTopTemplateMatches(
  bitmap: Uint8Array,
  rowProfile: Float32Array,
  colProfile: Float32Array,
  templates: GlyphTemplate[],
  limit: number
): Array<{ char: string; score: number }> {
  const scores = new Map<string, number>();

  for (const template of templates) {
    const iou = bitmapIoU(bitmap, template.bitmap);
    const rowDistance = profileDistance(rowProfile, template.rowProfile);
    const colDistance = profileDistance(colProfile, template.colProfile);
    const score = iou * 0.72 + (1 - rowDistance) * 0.14 + (1 - colDistance) * 0.14;
    const previous = scores.get(template.char) ?? Number.NEGATIVE_INFINITY;
    if (score > previous) {
      scores.set(template.char, score);
    }
  }

  return [...scores.entries()]
    .map(([char, score]) => ({ char, score }))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

function combineSuggestions(
  groups: Array<Array<{ char: string; score: number }>>,
  limit = 8
): KanaSuggestion[] {
  let suggestions: KanaSuggestion[] = [{ text: '', score: 1 }];

  for (const group of groups) {
    const next: KanaSuggestion[] = [];
    for (const prefix of suggestions) {
      for (const candidate of group) {
        const prefixLength = [...prefix.text].length;
        const nextLength = prefixLength + 1;
        next.push({
          text: prefix.text + candidate.char,
          score: (prefix.score * prefixLength + candidate.score) / nextLength,
        });
      }
    }
    suggestions = next.sort((left, right) => right.score - left.score).slice(0, limit);
  }

  const unique = new Map<string, KanaSuggestion>();
  for (const suggestion of suggestions) {
    const existing = unique.get(suggestion.text);
    if (!existing || suggestion.score > existing.score) {
      unique.set(suggestion.text, suggestion);
    }
  }

  return [...unique.values()].sort((left, right) => right.score - left.score);
}

function groupComponentsIntoCharacters(
  components: Array<{ left: number; top: number; right: number; bottom: number; pixels: number }>
): Array<{ left: number; top: number; right: number; bottom: number }> {
  const sorted = [...components].sort((left, right) => left.left - right.left || left.top - right.top);
  const groups: Array<{ left: number; top: number; right: number; bottom: number }> = [];

  for (const component of sorted) {
    const last = groups.at(-1);
    if (!last) {
      groups.push({ ...component });
      continue;
    }

    const horizontalGap = component.left - last.right;
    const verticalOverlap =
      Math.max(0, Math.min(last.bottom, component.bottom) - Math.max(last.top, component.top) + 1);
    const minHeight = Math.min(last.bottom - last.top + 1, component.bottom - component.top + 1);
    const mergeGap = Math.max(10, Math.round(minHeight * 0.45));

    if (horizontalGap <= mergeGap || verticalOverlap >= Math.max(8, Math.round(minHeight * 0.3))) {
      last.left = Math.min(last.left, component.left);
      last.top = Math.min(last.top, component.top);
      last.right = Math.max(last.right, component.right);
      last.bottom = Math.max(last.bottom, component.bottom);
      continue;
    }

    groups.push({ ...component });
  }

  return groups;
}

function normalizeMaskToTemplate(
  mask: Uint8Array,
  width: number,
  height: number,
  bounds: { left: number; top: number; right: number; bottom: number }
): Uint8Array {
  const target = new Uint8Array(TEMPLATE_SIZE * TEMPLATE_SIZE);
  const cropWidth = bounds.right - bounds.left + 1;
  const cropHeight = bounds.bottom - bounds.top + 1;
  const scale = DRAW_SIZE / Math.max(cropWidth, cropHeight);
  const scaledWidth = Math.max(1, Math.round(cropWidth * scale));
  const scaledHeight = Math.max(1, Math.round(cropHeight * scale));
  const offsetX = Math.floor((TEMPLATE_SIZE - scaledWidth) / 2);
  const offsetY = Math.floor((TEMPLATE_SIZE - scaledHeight) / 2);

  for (let targetY = 0; targetY < scaledHeight; targetY += 1) {
    const sourceY = bounds.top + Math.min(cropHeight - 1, Math.floor(targetY / scale));
    for (let targetX = 0; targetX < scaledWidth; targetX += 1) {
      const sourceX = bounds.left + Math.min(cropWidth - 1, Math.floor(targetX / scale));
      if (mask[sourceY * width + sourceX] > 0) {
        target[(offsetY + targetY) * TEMPLATE_SIZE + offsetX + targetX] = 1;
      }
    }
  }

  return target;
}

function createInkMask(imageData: ImageData): Uint8Array {
  const mask = new Uint8Array(imageData.width * imageData.height);
  const { data } = imageData;
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * 4;
    const grayscale = (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
    const ink = 255 - grayscale;
    mask[index] = ink > 28 ? 1 : 0;
  }
  return mask;
}

function extractInkComponents(
  mask: Uint8Array,
  width: number,
  height: number
): Array<{ left: number; top: number; right: number; bottom: number; pixels: number }> {
  const visited = new Uint8Array(mask.length);
  const components: Array<{ left: number; top: number; right: number; bottom: number; pixels: number }> = [];
  const stack = new Int32Array(mask.length);

  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] === 0 || visited[start] === 1) {
      continue;
    }

    let stackSize = 0;
    stack[stackSize] = start;
    stackSize += 1;
    visited[start] = 1;

    let left = width;
    let right = -1;
    let top = height;
    let bottom = -1;
    let pixels = 0;

    while (stackSize > 0) {
      stackSize -= 1;
      const index = stack[stackSize];
      const x = index % width;
      const y = Math.floor(index / width);
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      pixels += 1;

      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        const nextY = y + offsetY;
        if (nextY < 0 || nextY >= height) {
          continue;
        }
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) {
            continue;
          }
          const nextX = x + offsetX;
          if (nextX < 0 || nextX >= width) {
            continue;
          }
          const nextIndex = nextY * width + nextX;
          if (mask[nextIndex] === 0 || visited[nextIndex] === 1) {
            continue;
          }
          visited[nextIndex] = 1;
          stack[stackSize] = nextIndex;
          stackSize += 1;
        }
      }
    }

    components.push({ left, top, right, bottom, pixels });
  }

  return components;
}

function mergeComponents(
  components: Array<{ left: number; top: number; right: number; bottom: number }>
): { left: number; top: number; right: number; bottom: number } | null {
  if (components.length === 0) {
    return null;
  }

  return components.reduce(
    (bounds, component) => ({
      left: Math.min(bounds.left, component.left),
      top: Math.min(bounds.top, component.top),
      right: Math.max(bounds.right, component.right),
      bottom: Math.max(bounds.bottom, component.bottom),
    }),
    { ...components[0] }
  );
}

function buildRowProfile(bitmap: Uint8Array): Float32Array {
  const profile = new Float32Array(TEMPLATE_SIZE);
  for (let y = 0; y < TEMPLATE_SIZE; y += 1) {
    let count = 0;
    for (let x = 0; x < TEMPLATE_SIZE; x += 1) {
      count += bitmap[y * TEMPLATE_SIZE + x];
    }
    profile[y] = count / TEMPLATE_SIZE;
  }
  return profile;
}

function buildColProfile(bitmap: Uint8Array): Float32Array {
  const profile = new Float32Array(TEMPLATE_SIZE);
  for (let x = 0; x < TEMPLATE_SIZE; x += 1) {
    let count = 0;
    for (let y = 0; y < TEMPLATE_SIZE; y += 1) {
      count += bitmap[y * TEMPLATE_SIZE + x];
    }
    profile[x] = count / TEMPLATE_SIZE;
  }
  return profile;
}

function bitmapIoU(left: Uint8Array, right: Uint8Array): number {
  let intersection = 0;
  let union = 0;
  for (let index = 0; index < left.length; index += 1) {
    const hasLeft = left[index] === 1;
    const hasRight = right[index] === 1;
    if (hasLeft && hasRight) {
      intersection += 1;
    }
    if (hasLeft || hasRight) {
      union += 1;
    }
  }
  return union === 0 ? 0 : intersection / union;
}

function profileDistance(left: Float32Array, right: Float32Array): number {
  let total = 0;
  for (let index = 0; index < left.length; index += 1) {
    total += Math.abs(left[index] - right[index]);
  }
  return total / left.length;
}
