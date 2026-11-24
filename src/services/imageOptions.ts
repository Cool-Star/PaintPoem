export type ImageStyle = 'classic' | 'cartoon';

const compatibleSizes = [
  { label: '1:1 (1024×1024)', value: '1024x1024' },
  { label: '1:1 (2048×2048)', value: '2048x2048' },
  { label: '4:3 (2304×1728)', value: '2304x1728' },
  { label: '3:4 (1728×2304)', value: '1728x2304' },
  { label: '16:9 (2560×1440)', value: '2560x1440' },
  { label: '9:16 (1440×2560)', value: '1440x2560' },
  { label: '3:2 (2496×1664)', value: '2496x1664' },
  { label: '2:3 (1664×2496)', value: '1664x2496' },
  { label: '21:9 (3024×1296)', value: '3024x1296' },
];

const gptImageSizes = [
  compatibleSizes[0],
  { label: '3:2 (1536×1024)', value: '1536x1024' },
  { label: '2:3 (1024×1536)', value: '1024x1536' },
];

export function isGptImageModel(model: string) {
  return /^(?:gpt-image-|chatgpt-image-latest$)/i.test(model.trim());
}

export function getImageSizeOptions(model: string) {
  if (isGptImageModel(model)) return gptImageSizes;

  switch (model.trim().toLowerCase()) {
    case 'dall-e-2':
      return [
        compatibleSizes[0],
        { label: '1:1 (512×512)', value: '512x512' },
        { label: '1:1 (256×256)', value: '256x256' },
      ];
    case 'dall-e-3':
      return [
        compatibleSizes[0],
        { label: '7:4 (1792×1024)', value: '1792x1024' },
        { label: '4:7 (1024×1792)', value: '1024x1792' },
      ];
    default:
      return compatibleSizes;
  }
}

function getOrientation(size: string) {
  const [width, height] = size.split('x').map(Number);
  return Math.sign(width - height);
}

export function resolveImageSize(model: string, size: unknown = '1440x2560') {
  const options = getImageSizeOptions(model);
  const exact = options.find(option => option.value === size);
  if (exact) return exact.value;

  const orientation = getOrientation(typeof size === 'string' ? size : '1440x2560');
  return options.find(option => getOrientation(option.value) === orientation)?.value ?? options[0].value;
}
