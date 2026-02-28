declare module 'chinese-s2t' {
  /**
   * 简体中文转繁体中文
   * @param text 简体中文
   * @returns 繁体中文
   */
  export function s2t(text: string): string;

  /**
   * 繁体中文转简体中文
   * @param text 繁体中文
   * @returns 简体中文
   */
  export function t2s(text: string): string;
}
