import PDFDocument from 'pdfkit/js/pdfkit.standalone';
import blobStream from 'blob-stream';
import { Buffer } from 'buffer';
import { readFile } from '@tauri-apps/plugin-fs';
import type { FontData } from '../types/font';

export interface GenerateCalligraphyPdfOptions {
  title: string;
  author: string;
  content: string[];
  mode: 'copy' | 'practice';
  coverImage?: string;
  pageSize?: string;
  cellSize?: number;
  margin?: number;
  gridVariant?: 'mi' | 'tian' | 'hui' | 'none';
  backgroundOpacity?: number;
  font?: FontData; // 可选字体
  showPinyin?: boolean; // 是否显示拼音
  pinyin?: string[]; // 拼音数组，与 content 对应
}

/**
 * 生成书法字帖 PDF
 */
export async function generateCalligraphyPdf(
  options: GenerateCalligraphyPdfOptions
): Promise<Blob> {
  const {
    title,
    author,
    content,
    mode,
    coverImage,
    pageSize = 'A4',
    cellSize = 50,
    margin = 40,
    gridVariant = 'mi', // 米字格
    backgroundOpacity = 0.2,
    font,
    showPinyin = false,
    pinyin = [],
  } = options;

  return new Promise(async (resolve, reject) => {
    try {
      // 创建 PDF 文档
      const doc = new PDFDocument({
        size: pageSize,
        margin: margin,
      });

      // 使用 blob-stream 收集 PDF 数据
      const stream = doc.pipe(blobStream());

      // 加载字体
      let fontLoaded = false;
      try {
        let fontBuffer: Buffer;

        if (font) {
          if (!font.isBuiltin) {
            // 使用用户上传的字体 - 路径已经是绝对路径
            const fontData = await readFile(font.path);
            fontBuffer = Buffer.from(fontData);

            // 尝试注册字体
            try {
              doc.registerFont('CustomFont', fontBuffer);
              doc.font('CustomFont');
              fontLoaded = true;
              console.log('使用自定义字体:', font.name);
            } catch (fontError) {
              console.warn('自定义字体加载失败:', fontError);
              fontLoaded = false;
            }
          } else {
            // 内置字体
            try {
              // 检查路径类型
              if (font.path.startsWith('builtin://')) {
                // 特殊标记：使用 fetch 从 /src/assets/ 加载
                const response = await fetch('/src/assets/SourceHanSerifCN-Regular-1.otf');
                if (!response.ok) {
                  throw new Error(`Failed to fetch font: ${response.status}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                fontBuffer = Buffer.from(arrayBuffer);
              } else {
                // 绝对路径：从 appData/fonts 读取
                const fontData = await readFile(font.path);
                fontBuffer = Buffer.from(fontData);
              }

              doc.registerFont('SourceHanSerifCN', fontBuffer);
              doc.font('SourceHanSerifCN');
              fontLoaded = true;
              console.log('使用内置思源宋体字体');
            } catch (builtinFontError) {
              console.warn('内置字体加载失败:', builtinFontError);
              fontLoaded = false;
            }
          }
        }

        if (!fontLoaded) {
          console.warn('没有可用的字体，使用 pdfkit 默认字体');
        }
      } catch (error) {
        console.error('字体加载失败:', error);
      }

      // 计算可用空间
      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const usableWidth = pageWidth - margin * 2;
      const columns = Math.max(1, Math.floor(usableWidth / cellSize));

      // 应用背景图
      const applyBackground = async () => {
        if (coverImage) {
          try {
            let imgBuffer: Buffer;

            // 判断路径类型
            if (coverImage.startsWith('asset://') || coverImage.startsWith('http')) {
              // 使用 fetch 获取（asset:// 协议在 Tauri 中可以通过 fetch 访问）
              const imgResponse = await fetch(coverImage);
              const arrayBuffer = await imgResponse.arrayBuffer();
              imgBuffer = Buffer.from(arrayBuffer);
            } else {
              // 绝对路径：使用 readFile 读取
              const imgData = await readFile(coverImage);
              imgBuffer = Buffer.from(imgData);
            }

            doc.save();
            doc.opacity(backgroundOpacity);
            doc.image(imgBuffer, 0, 0, {
              width: pageWidth,
              height: pageHeight,
            });
            doc.restore();
            console.log('✅ 背景图已应用');
          } catch (error) {
            console.warn('背景图加载失败:', error);
          }
        }
      };

      // 绘制田字格
      const drawGridCell = (
        x: number,
        y: number,
        size: number,
        _variant: 'normal' | 'practice'
      ) => {
        doc.save();

        // 外框 - 深色实线
        doc.lineWidth(1).strokeColor('#1a1a1a').opacity(0.8);
        doc.rect(x, y, size, size).stroke();

        // 田字格内部辅助线
        if (gridVariant !== 'none') {
          doc.save();

          if (gridVariant === 'mi' || gridVariant === 'tian') {
            // 横中线和竖中线 - 中等深度
            doc.lineWidth(1).strokeColor('#666666').opacity(0.6);
            doc
              .moveTo(x, y + size / 2)
              .lineTo(x + size, y + size / 2)
              .stroke();
            doc
              .moveTo(x + size / 2, y)
              .lineTo(x + size / 2, y + size)
              .stroke();
          }

          if (gridVariant === 'mi') {
            // 对角线 - 浅色虚线
            doc.lineWidth(0.5).strokeColor('#999999').opacity(0.4);
            doc.dash(3, { space: 3 });
            doc
              .moveTo(x, y)
              .lineTo(x + size, y + size)
              .stroke();
            doc
              .moveTo(x + size, y)
              .lineTo(x, y + size)
              .stroke();
            doc.undash();
          }

          if (gridVariant === 'hui') {
            // 回宫格内部小框
            doc.lineWidth(0.8).strokeColor('#808080').opacity(0.5);
            const innerSize = size * 0.5;
            const offset = (size - innerSize) / 2;
            doc.rect(x + offset, y + offset, innerSize, innerSize).stroke();
          }

          doc.restore();
        }

        doc.restore();
      };

      // 绘制字符
      const drawCharacter = (
        char: string,
        x: number,
        y: number,
        size: number,
        isGray: boolean
      ) => {
        // 临摹模式：淡灰色，练习模式：深黑色
        const color = isGray ? '#3a3a3a' : '#1a1a1a';
        const opacity = isGray ? 0.45 : 1;
        const fontSize = size * 0.7;

        doc.save();
        doc.fillColor(color).opacity(opacity).fontSize(fontSize);

        const textWidth = doc.widthOfString(char);
        const textHeight = fontSize;

        const textX = x + (size - textWidth) / 2;
        const textY = y + (size - textHeight) / 2;

        doc.text(char, textX, textY, {
          lineBreak: false,
        });

        doc.restore();
      };

      // 绘制拼音格子（矮格子，高度为正常格子的 35%）
      const drawPinyinCell = (
        x: number,
        y: number,
        width: number,
        height: number
      ) => {
        doc.save();

        // 外框 - 实线，深色，但不绘制下边框（与汉字行衔接）
        doc.lineWidth(0.8).strokeColor('#333333').opacity(0.6);
        // 绘制上边框
        doc.moveTo(x, y).lineTo(x + width, y).stroke();
        // 绘制左边框
        doc.moveTo(x, y).lineTo(x, y + height).stroke();
        // 绘制右边框
        doc.moveTo(x + width, y).lineTo(x + width, y + height).stroke();
        // 不绘制下边框，让它与汉字行自然衔接

        // 横中线（用于对齐拼音）
        doc.lineWidth(0.5).strokeColor('#666666').opacity(0.5);
        doc.moveTo(x, y + height / 2).lineTo(x + width, y + height / 2).stroke();

        doc.restore();
      };

      // 绘制拼音文字
      const drawPinyinText = (
        pinyinText: string,
        x: number,
        y: number,
        width: number,
        height: number
      ) => {
        if (!pinyinText || pinyinText.trim() === '') return;

        const fontSize = height * 0.7; // 拼音字体占格子高度的 70%，更大更醒目
        const color = '#1a1a1a'; // 深色，更醒目
        const opacity = 1; // 完全不透明

        doc.save();
        doc.fillColor(color).opacity(opacity).fontSize(fontSize);

        const textWidth = doc.widthOfString(pinyinText);
        // 拼音居中显示
        const textX = x + (width - textWidth) / 2;
        const textY = y + (height - fontSize) / 2;

        doc.text(pinyinText, textX, textY, {
          lineBreak: false,
        });

        doc.restore();
      };

      // 当前 Y 坐标（用于精确控制位置）
      let currentY = margin;

      // 确保有足够空间，否则新建页面
      const ensureSpace = async (requiredHeight: number) => {
        const pageHeight = doc.page.height;
        if (currentY + requiredHeight > pageHeight - margin) {
          doc.addPage();
          await applyBackground();
          currentY = margin;
        }
      };

      // 绘制一行田字格（汉字）
      const drawRow = async (
        chars: string[],
        variant: 'normal' | 'practice'
      ) => {
        await ensureSpace(cellSize);
        const y = currentY;

        // 补齐到列数上限
        const rowChars = [...chars];
        while (rowChars.length < columns) {
          rowChars.push(''); // 空白单元格
        }

        for (let col = 0; col < columns; col++) {
          const x = margin + col * cellSize;
          const char = rowChars[col];

          drawGridCell(x, y, cellSize, variant);

          // normal 行显示字符（临摹模式为灰色，练习模式为黑色）
          if (char && variant === 'normal') {
            const isGray = mode === 'copy';
            drawCharacter(char, x, y, cellSize, isGray);
          }
        }

        currentY += cellSize;
      };

      // 绘制一行拼音格子（矮格子）
      const drawPinyinRow = async (pinyinList: string[]) => {
        const pinyinCellHeight = 22; // 固定高度 22pt，更大字号
        await ensureSpace(pinyinCellHeight); // 无额外间距
        const y = currentY;

        // 补齐到列数上限
        const rowPinyin = [...pinyinList];
        while (rowPinyin.length < columns) {
          rowPinyin.push(''); // 空白单元格
        }

        for (let col = 0; col < columns; col++) {
          const x = margin + col * cellSize;
          const pinyinText = rowPinyin[col];

          // 绘制矮格子
          drawPinyinCell(x, y, cellSize, pinyinCellHeight);

          // 绘制拼音文字
          if (pinyinText) {
            drawPinyinText(pinyinText, x, y, cellSize, pinyinCellHeight);
          }
        }

        // 拼音行高度（无额外间距，与汉字行紧密衔接）
        currentY += pinyinCellHeight;
      };

      // 开始绘制
      await applyBackground();

      // 绘制标题
      doc.fillColor('#1a1a1a').opacity(1).fontSize(32);
      doc.text(title, margin, margin, {
        width: usableWidth,
        align: 'center',
      });

      const titleHeight = doc.heightOfString(title, {
        width: usableWidth,
      });

      // 绘制作者
      if (author) {
        doc.fillColor('#4a4a4a').opacity(0.9).fontSize(18);
        const authorY = margin + titleHeight + 10;
        doc.text(author, margin, authorY, {
          width: usableWidth,
          align: 'center',
        });

        const authorHeight = doc.heightOfString(author, {
          width: usableWidth,
        });
        currentY = authorY + authorHeight + 20;
      } else {
        currentY = margin + titleHeight + 20;
      }

      // 绘制内容（每个段落的每个字符）
      for (let lineIndex = 0; lineIndex < content.length; lineIndex++) {
        const line = content[lineIndex];
        const pinyinLine = showPinyin && pinyin[lineIndex] ? pinyin[lineIndex] : '';
        const chars = Array.from(line);
        // 拼音按空格分隔，每个拼音对应一个汉字
        const pinyinList = showPinyin && pinyinLine ? pinyinLine.trim().split(/\s+/) : [];

        if (chars.length === 0) {
          // 空行：如果有拼音则绘制拼音行，再绘制空白汉字行
          if (showPinyin && pinyinList.length > 0) {
            await drawPinyinRow(pinyinList);
          }
          await drawRow([], 'normal');
          if (mode === 'practice') {
            await drawRow([], 'practice'); // 练习模式下跟着空白行
          }
          continue;
        }

        let offset = 0;
        let pinyinOffset = 0;
        while (offset < chars.length) {
          const slice = chars.slice(offset, offset + columns);
          // 获取对应位置的拼音（按空格分隔的拼音列表）
          const pinyinSlice = showPinyin
            ? pinyinList.slice(pinyinOffset, pinyinOffset + columns)
            : [];

          // 先绘制拼音行（矮格子）
          if (showPinyin && pinyinSlice.length > 0) {
            await drawPinyinRow(pinyinSlice);
          }

          // 再绘制汉字行（正常田字格）
          await drawRow(slice, 'normal');

          // 练习模式下跟着空白练习行
          if (mode === 'practice') {
            await drawRow([], 'practice');
          }

          offset += columns;
          pinyinOffset += columns;
        }
      }

      // 结束文档
      doc.end();

      // 当流结束时，返回 Blob
      stream.on('finish', () => {
        const blob = stream.toBlob('application/pdf');
        resolve(blob);
      });

      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}
