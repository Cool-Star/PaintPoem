/// <reference types="vite/client" />

// 支持导入字体文件
declare module '*.ttf' {
  const src: string;
  export default src;
}

// blob-stream 模块声明
declare module 'blob-stream' {
  import { Writable } from 'stream';

  interface BlobStream extends Writable {
    toBlob(type?: string): Blob;
    toBlobURL(type?: string): string;
  }

  function blobStream(): BlobStream;
  export default blobStream;
}

// pdfkit standalone 声明
declare module 'pdfkit/js/pdfkit.standalone' {
  import PDFDocument from 'pdfkit';
  export default PDFDocument;
}

// 全局类型扩展
declare global {
  interface Window {
    Buffer: typeof Buffer;
    process: NodeJS.Process;
    global: Window;
  }
}
