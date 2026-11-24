export const translationStyles = {
  natural: { label: '自然通顺', instruction: '用流畅、自然的现代汉语忠实传达原意。' },
  formal: { label: '正式典雅', instruction: '语言端正、用词准确，保留诗词的情感和意境。' },
  humorous: { label: '幽默活泼', instruction: '用轻松俏皮的口吻表达，不虚构情节或改变诗意。' },
  simple: { label: '通俗易懂', instruction: '用简短、浅显的现代汉语表达，避免生僻词。' },
} as const;

export type TranslationStyle = keyof typeof translationStyles;
