import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

interface RetroMarkdownProps {
  content: string;
}

// 清理 HTML 内容，移除所有 JavaScript 代码
const sanitizeHtml = (html: string): string => {
  let sanitized = html;
  
  // 1. 移除所有 <script> 标签及其内容（包括各种变体，不区分大小写）
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // 2. 移除所有事件处理器属性（onclick, onerror, onload 等，包括大小写变体）
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '');
  
  // 3. 移除 javascript: URL（在 href, src, action 等属性中，包括编码变体）
  // 处理普通 javascript: URL
  sanitized = sanitized.replace(/\s+(href|src|action|formaction|background|cite|codebase|data|dynsrc|lowsrc|manifest|poster|profile)\s*=\s*["']?\s*j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t\s*:/gi, '');
  sanitized = sanitized.replace(/\s+(href|src|action|formaction|background|cite|codebase|data|dynsrc|lowsrc|manifest|poster|profile)\s*=\s*["']?\s*javascript:/gi, '');
  // 处理编码的 javascript:（如 &#106;avascript:）
  sanitized = sanitized.replace(/\s+(href|src|action|formaction|background|cite|codebase|data|dynsrc|lowsrc|manifest|poster|profile)\s*=\s*["']?\s*&#\d+;?[a-z]*script:/gi, '');
  
  // 4. 移除危险的标签（iframe, object, embed, form 等可能执行代码的标签）
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
  sanitized = sanitized.replace(/<embed\b[^>]*>/gi, '');
  sanitized = sanitized.replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '');
  
  // 5. 移除 style 属性中的 javascript: 和 expression()
  sanitized = sanitized.replace(/\s+style\s*=\s*["'][^"']*javascript:[^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s+style\s*=\s*["'][^"']*expression\s*\([^"']*["']/gi, '');
  
  // 6. 移除 data: URL 中的危险内容（防止 data:text/html 等可执行内容）
  sanitized = sanitized.replace(/\s+(href|src|action)\s*=\s*["']?\s*data:\s*text\/html/gi, '');
  sanitized = sanitized.replace(/\s+(href|src|action)\s*=\s*["']?\s*data:\s*text\/javascript/gi, '');
  
  // 7. 移除 <link> 标签中的 javascript:（防止通过 link 标签执行代码）
  sanitized = sanitized.replace(/<link\b[^>]*href\s*=\s*["']?\s*javascript:[^>]*>/gi, '');
  
  // 8. 移除 <meta> 标签中的 http-equiv="refresh"（可能用于重定向到恶意页面）
  sanitized = sanitized.replace(/<meta\b[^>]*http-equiv\s*=\s*["']?\s*refresh[^>]*>/gi, '');
  
  return sanitized;
};

// 解析行内元素：粗体、斜体、链接、图片、行内代码、行内公式
const parseInline = (text: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // 匹配图片 ![alt](url)
    const imageMatch = remaining.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imageMatch) {
      parts.push(
        <img
          key={key++}
          src={imageMatch[2]}
          alt={imageMatch[1]}
          className="max-w-full h-auto my-2 border border-cyan-500/30 rounded shadow-lg"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      );
      remaining = remaining.slice(imageMatch[0].length);
      continue;
    }

    // 匹配链接 [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      parts.push(
        <a
          key={key++}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 hover:text-cyan-300 underline decoration-cyan-500/50 hover:decoration-cyan-400 text-glow-cyan"
        >
          {parseInline(linkMatch[1])}
        </a>
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // 匹配自动 URL (http:// 或 https://)
    const urlMatch = remaining.match(/^(https?:\/\/[^\s]+)/);
    if (urlMatch) {
      parts.push(
        <a
          key={key++}
          href={urlMatch[1]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 hover:text-cyan-300 underline decoration-cyan-500/50 hover:decoration-cyan-400 text-glow-cyan"
        >
          {urlMatch[1]}
        </a>
      );
      remaining = remaining.slice(urlMatch[1].length);
      continue;
    }

    // 匹配行内代码 `code`
    const inlineCodeMatch = remaining.match(/^`([^`]+)`/);
    if (inlineCodeMatch) {
      parts.push(
        <code key={key++} className="bg-gray-800 text-green-400 px-1.5 py-0.5 rounded font-mono text-sm border border-gray-700 text-glow-green">
          {inlineCodeMatch[1]}
        </code>
      );
      remaining = remaining.slice(inlineCodeMatch[0].length);
      continue;
    }

    // 匹配行内 LaTeX 公式 $...$
    const inlineLatexMatch = remaining.match(/^\$([^$]+)\$/);
    if (inlineLatexMatch) {
      try {
        parts.push(
          <span key={key++} className="text-purple-400 bg-purple-900/20 px-1 text-glow-purple inline-block">
            <InlineMath math={inlineLatexMatch[1]} />
          </span>
        );
      } catch (e) {
        // 如果公式解析失败，显示原始文本
        parts.push(
          <span key={key++} className="text-purple-400 font-mono italic bg-purple-900/20 px-1 text-glow-purple">
            ${inlineLatexMatch[1]}$
          </span>
        );
      }
      remaining = remaining.slice(inlineLatexMatch[0].length);
      continue;
    }

    // 匹配粗体 **text**（优先匹配，避免与斜体冲突）
    const boldMatch = remaining.match(/^\*\*([^*]+?)\*\*/);
    if (boldMatch) {
      parts.push(
        <strong key={key++} className="font-bold text-pink-400 text-glow-pink">
          {parseInline(boldMatch[1])}
        </strong>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // 匹配斜体 *text* 或 _text_（在粗体之后匹配，避免冲突）
    const italicMatch = remaining.match(/^\*([^*]+)\*/) || remaining.match(/^_([^_]+)_/);
    if (italicMatch) {
      parts.push(
        <em key={key++} className="italic text-amber-300 text-glow-amber">
          {parseInline(italicMatch[1])}
        </em>
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // 普通文本，找到下一个特殊字符的位置
    const nextSpecial = remaining.search(/[!\[*_`$]/);
    if (nextSpecial === -1) {
      parts.push(remaining);
      break;
    }
    if (nextSpecial > 0) {
      parts.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    } else {
      parts.push(remaining[0]);
      remaining = remaining.slice(1);
    }
  }

  return parts;
};

export const RetroMarkdown = ({ content }: RetroMarkdownProps) => {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLang = '';
  let consecutiveEmptyLines = 0;
  let paragraphLines: string[] = [];
  let paragraphKey = 0;

  // 检查是否是标题行
  const isHeading = (line: string): boolean => {
    return /^#{1,4}\s+/.test(line);
  };

  // 检查是否是列表项（有序或无序）
  const isListItem = (line: string): { type: 'ordered' | 'unordered' | null; level: number } => {
    const orderedMatch = line.match(/^(\d+)\.\s+/);
    if (orderedMatch) {
      return { type: 'ordered', level: 0 };
    }
    const unorderedMatch = line.match(/^([-\*])\s+/);
    if (unorderedMatch) {
      return { type: 'unordered', level: 0 };
    }
    return { type: null, level: 0 };
  };

  // 结束当前段落（如果有的话）
  const finishParagraph = () => {
    if (paragraphLines.length > 0) {
      const paragraphText = paragraphLines.join(' ').trim();
      if (paragraphText) {
        elements.push(
          <p key={`p-${paragraphKey++}`} className="opacity-90 break-words text-cyan-100 text-glow-cyan">
            {parseInline(paragraphText)}
          </p>
        );
      }
      paragraphLines = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // 处理代码块
    if (line.trim().startsWith('```')) {
      finishParagraph();
      if (inCodeBlock) {
        // 结束代码块
        const codeContent = codeBlockContent.join('\n');
        const language = codeBlockLang || 'text';
        elements.push(
          <div key={i} className="my-2 rounded overflow-hidden border border-gray-700 shadow-inner">
            <SyntaxHighlighter
              language={language}
              style={vscDarkPlus}
              customStyle={{
                margin: 0,
                padding: '12px',
                fontSize: '14px',
                background: '#111827',
                border: 'none',
              }}
              codeTagProps={{
                style: {
                  fontFamily: 'monospace',
                },
              }}
              PreTag="div"
            >
              {codeContent}
            </SyntaxHighlighter>
          </div>
        );
        codeBlockContent = [];
        inCodeBlock = false;
        codeBlockLang = '';
        consecutiveEmptyLines = 0;
      } else {
        // 开始代码块
        codeBlockLang = line.trim().slice(3).trim();
        inCodeBlock = true;
        consecutiveEmptyLines = 0;
      }
      i++;
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      i++;
      continue;
    }

    // 处理 HTML 块 <html>...</html>
    if (line.trim().startsWith('<html>')) {
      finishParagraph();
      let htmlContent = '';
      
      // 检查是否是单行：<html>...</html>
      if (line.trim().endsWith('</html>')) {
        // 单行 HTML 块
        const match = line.trim().match(/<html>(.*?)<\/html>/s);
        if (match) {
          htmlContent = match[1];
        }
        i++;
      } else {
        // 多行 HTML 块，收集直到 </html>
        const htmlLines: string[] = [line];
        i++;
        while (i < lines.length && !lines[i].trim().endsWith('</html>')) {
          htmlLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) {
          htmlLines.push(lines[i]); // 包含结束标签的行
          i++;
        }
        // 提取 <html> 和 </html> 之间的内容
        const fullHtml = htmlLines.join('\n');
        const match = fullHtml.match(/<html>(.*?)<\/html>/s);
        if (match) {
          htmlContent = match[1];
        }
      }
      
      if (htmlContent) {
        // 清理 HTML 内容，移除所有 JavaScript 代码
        const sanitizedContent = sanitizeHtml(htmlContent);
        elements.push(
          <div 
            key={`html-${i}`} 
            className="html-block"
            style={{
              fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontSize: '16px',
              lineHeight: '1.5',
              color: '#000',
              backgroundColor: 'transparent',
              textShadow: 'none',
              display: 'block',
              margin: '0.5rem 0',
              isolation: 'isolate',
            }}
            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
          />
        );
      }
      consecutiveEmptyLines = 0;
      continue;
    }

    // 处理标题
    if (line.startsWith('# ')) {
      finishParagraph();
      elements.push(
        <h1 key={i} className="text-2xl font-bold text-pink-500 border-b border-pink-500/50 pb-1 mt-4 shadow-[0_0_10px_rgba(236,72,153,0.3)] text-glow-pink">
          {parseInline(line.replace(/^#\s+/, ''))}
        </h1>
      );
      consecutiveEmptyLines = 0;
      i++;
      continue;
    }

    if (line.startsWith('## ')) {
      finishParagraph();
      elements.push(
        <h2 key={i} className="text-xl font-bold text-cyan-400 mt-3 text-glow-cyan">
          {parseInline(line.replace(/^##\s+/, ''))}
        </h2>
      );
      consecutiveEmptyLines = 0;
      i++;
      continue;
    }

    if (line.startsWith('### ')) {
      finishParagraph();
      elements.push(
        <h3 key={i} className="text-lg font-bold text-emerald-400 mt-2 text-glow-emerald">
          {parseInline(line.replace(/^###\s+/, ''))}
        </h3>
      );
      consecutiveEmptyLines = 0;
      i++;
      continue;
    }

    if (line.startsWith('#### ')) {
      finishParagraph();
      elements.push(
        <h4 key={i} className="text-base font-bold text-purple-400 mt-2 text-glow-purple">
          {parseInline(line.replace(/^####\s+/, ''))}
        </h4>
      );
      consecutiveEmptyLines = 0;
      i++;
      continue;
    }

    // 处理块级 LaTeX 公式 $$...$$
    if (line.trim().startsWith('$$') && line.trim().endsWith('$$') && line.trim().length > 4) {
      finishParagraph();
      const formula = line.trim().slice(2, -2).trim();
      try {
        elements.push(
          <div key={i} className="my-4 p-3 bg-purple-900/20 border border-purple-500/30 rounded text-center overflow-x-auto text-glow-purple">
            <BlockMath math={formula} />
          </div>
        );
      } catch (e) {
        // 如果公式解析失败，显示原始文本
        elements.push(
          <div key={i} className="my-4 p-3 bg-purple-900/20 border border-purple-500/30 rounded text-purple-300 font-mono text-center overflow-x-auto text-glow-purple">
            {formula}
          </div>
        );
      }
      consecutiveEmptyLines = 0;
      i++;
      continue;
    }

    // 处理多行块级 LaTeX 公式（简单处理）
    if (line.trim() === '$$') {
      finishParagraph();
      const formulaLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '$$') {
        formulaLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // 跳过结束的 $$
      const formula = formulaLines.join('\n').trim();
      try {
        elements.push(
          <div key={i} className="my-4 p-3 bg-purple-900/20 border border-purple-500/30 rounded text-center overflow-x-auto whitespace-pre-wrap text-glow-purple">
            <BlockMath math={formula} />
          </div>
        );
      } catch (e) {
        // 如果公式解析失败，显示原始文本
        elements.push(
          <div key={i} className="my-4 p-3 bg-purple-900/20 border border-purple-500/30 rounded text-purple-300 font-mono text-center overflow-x-auto whitespace-pre-wrap text-glow-purple">
            {formula}
          </div>
        );
      }
      consecutiveEmptyLines = 0;
      continue;
    }

    // 处理有序列表
    const orderedListMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (orderedListMatch) {
      finishParagraph();
      const orderedListItems: React.ReactNode[] = [];
      const orderedListStartIndex = i;
      let listItemNumber = 1; // 维护列表编号
      
      // 收集有序列表项及其子段落
      while (i < lines.length) {
        const currentLine = lines[i];
        const match = currentLine.match(/^(\d+)\.\s+(.+)$/);
        
        if (match) {
          // 新的列表项开始
          const itemContent: React.ReactNode[] = [];
          itemContent.push(parseInline(match[2]));
          
          // 收集该列表项下方的段落内容，直到遇到边界
          i++;
          let itemConsecutiveEmpty = 0;
          const itemParagraphLines: string[] = [];
          
          while (i < lines.length) {
            const nextLine = lines[i];
            
            // 检查是否是代码块
            if (nextLine.trim().startsWith('```')) {
              // 遇到代码块，先处理已收集的段落
              if (itemParagraphLines.length > 0) {
                const paraText = itemParagraphLines.join(' ').trim();
                if (paraText) {
                  itemContent.push(
                    <p key={`item-p-${i}`} className="opacity-90 break-words text-cyan-100 text-glow-cyan ml-4 mt-1">
                      {parseInline(paraText)}
                    </p>
                  );
                }
                itemParagraphLines.length = 0;
              }
              // 代码块属于当前列表项，收集整个代码块
              const codeBlockStart = i;
              const codeBlockLines: string[] = [];
              codeBlockLines.push(nextLine);
              i++;
              while (i < lines.length && !lines[i].trim().startsWith('```')) {
                codeBlockLines.push(lines[i]);
                i++;
              }
              if (i < lines.length) {
                codeBlockLines.push(lines[i]); // 结束标记
                i++;
              }
              const codeContent = codeBlockLines.slice(1, -1).join('\n');
              const language = nextLine.trim().slice(3).trim() || 'text';
              itemContent.push(
                <div key={`item-code-${codeBlockStart}`} className="my-2 rounded overflow-hidden border border-gray-700 shadow-inner ml-4">
                  <SyntaxHighlighter
                    language={language}
                    style={vscDarkPlus}
                    customStyle={{
                      margin: 0,
                      padding: '12px',
                      fontSize: '14px',
                      background: '#111827',
                      border: 'none',
                    }}
                    codeTagProps={{
                      style: {
                        fontFamily: 'monospace',
                      },
                    }}
                    PreTag="div"
                  >
                    {codeContent}
                  </SyntaxHighlighter>
                </div>
              );
              itemConsecutiveEmpty = 0;
              continue;
            }
            
            // 检查是否是块边界
            const nextListItem = isListItem(nextLine);
            const nextHeading = isHeading(nextLine);
            
            // 遇到新的有序列表项（边界）
            if (nextListItem.type === 'ordered') {
              break;
            }
            
            // 遇到无序列表项（边界）
            if (nextListItem.type === 'unordered') {
              break;
            }
            
            // 遇到标题（边界）
            if (nextHeading) {
              break;
            }
            
            // 遇到引用（边界）
            if (nextLine.startsWith('> ')) {
              break;
            }
            
            // 遇到表格（边界）
            if (nextLine.includes('|') && (nextLine.match(/\|/g) || []).length >= 2) {
              break;
            }
            
            // 遇到块级公式（边界）
            if (nextLine.trim().startsWith('$$')) {
              break;
            }
            
            // 遇到分割线（边界）
            if (/^[\s]*-{3,}[\s]*$/.test(nextLine)) {
              break;
            }
            
            // 遇到双空行（边界）
            if (nextLine.trim() === '') {
              itemConsecutiveEmpty++;
              if (itemConsecutiveEmpty >= 2) {
                i++; // 跳过这个空行
                break;
              }
              // 单个空行，添加到段落
              if (itemParagraphLines.length > 0) {
                const paraText = itemParagraphLines.join(' ').trim();
                if (paraText) {
                  itemContent.push(
                    <p key={`item-p-${i}`} className="opacity-90 break-words text-cyan-100 text-glow-cyan ml-4 mt-1">
                      {parseInline(paraText)}
                    </p>
                  );
                }
                itemParagraphLines.length = 0;
              }
              i++;
              continue;
            }
            
            // 普通行，收集到段落
            itemParagraphLines.push(nextLine);
            itemConsecutiveEmpty = 0;
            i++;
          }
          
          // 处理最后收集的段落
          if (itemParagraphLines.length > 0) {
            const paraText = itemParagraphLines.join(' ').trim();
            if (paraText) {
              itemContent.push(
                <p key={`item-p-final-${i}`} className="opacity-90 break-words text-cyan-100 text-glow-cyan ml-4 mt-1">
                  {parseInline(paraText)}
                </p>
              );
            }
          }
          
          orderedListItems.push(
            <li key={i} className="ml-4 text-emerald-400 text-glow-emerald">
              {itemContent}
            </li>
          );
          listItemNumber++;
        } else {
          // 不是列表项，停止收集
          break;
        }
      }
      
      if (orderedListItems.length > 0) {
        elements.push(
          <ol key={orderedListStartIndex} className="list-decimal ml-4 my-2">
            {orderedListItems}
          </ol>
        );
      }
      consecutiveEmptyLines = 0;
      continue;
    }

    // 处理分割线（--- 三个或以上的连续 -）
    if (/^[\s]*-{3,}[\s]*$/.test(line)) {
      finishParagraph();
      elements.push(
        <hr key={i} className="my-4 border-0 border-t-2 border-cyan-500/50 shadow-[0_0_8px_rgba(6,182,212,0.3)]" />
      );
      consecutiveEmptyLines = 0;
      i++;
      continue;
    }

    // 处理无序列表
    if (line.startsWith('- ') || line.startsWith('* ')) {
      finishParagraph();
      elements.push(
        <li key={i} className="ml-4 text-emerald-400 list-disc marker:text-emerald-500 text-glow-emerald">
          {parseInline(line.replace(/^[-\*]\s+/, ''))}
        </li>
      );
      consecutiveEmptyLines = 0;
      i++;
      continue;
    }

    // 处理引用
    if (line.startsWith('> ')) {
      finishParagraph();
      elements.push(
        <blockquote key={i} className="border-l-4 border-amber-500 pl-3 italic text-amber-200 bg-amber-900/20 py-1 text-glow-amber">
          {parseInline(line.replace(/^>\s+/, ''))}
        </blockquote>
      );
      consecutiveEmptyLines = 0;
      i++;
      continue;
    }

    // 处理表格
    // 检测表格行：包含 | 且至少有 2 个 |
    if (line.includes('|') && (line.match(/\|/g) || []).length >= 2) {
      finishParagraph();
      const tableRows: string[] = [];
      const tableStartIndex = i;
      
      // 收集表格行，直到遇到空行或非表格行
      while (i < lines.length) {
        const currentLine = lines[i];
        // 如果是空行，停止收集
        if (currentLine.trim() === '') {
          break;
        }
        // 如果包含 | 且至少有 2 个 |，继续收集
        if (currentLine.includes('|') && (currentLine.match(/\|/g) || []).length >= 2) {
          tableRows.push(currentLine);
          i++;
        } else {
          // 如果不是表格行，停止收集
          break;
        }
      }

      // 至少需要表头行和分隔行
      if (tableRows.length >= 2) {
        // 解析表头
        const headerRow = tableRows[0];
        const headerCells = headerRow.split('|').map(cell => cell.trim()).filter(cell => cell);
        
        // 解析分隔行，确定对齐方式
        const separatorRow = tableRows[1];
        const separatorCells = separatorRow.split('|').map(cell => cell.trim()).filter(cell => cell);
        const alignments: ('left' | 'center' | 'right')[] = separatorCells.map(cell => {
          const trimmed = cell.replace(/-/g, '');
          if (trimmed.startsWith(':') && trimmed.endsWith(':')) {
            return 'center';
          } else if (trimmed.endsWith(':')) {
            return 'right';
          } else {
            return 'left';
          }
        });

        // 解析数据行
        const dataRows = tableRows.slice(2).map(row => {
          const cells = row.split('|').map(cell => cell.trim());
          // 过滤掉首尾的空元素（如果行首或行尾有 |）
          const filtered = cells.filter((cell, index, arr) => {
            return !(index === 0 && cell === '' && arr.length > headerCells.length) &&
                   !(index === arr.length - 1 && cell === '' && arr.length > headerCells.length);
          });
          return filtered;
        });

        // 渲染表格
        elements.push(
          <div key={tableStartIndex} className="my-4 overflow-x-auto">
            <table className="border-collapse border border-cyan-500/30 w-full">
              <thead>
                <tr>
                  {headerCells.map((cell, idx) => (
                    <th
                      key={idx}
                      className={`border border-cyan-500/30 px-3 py-2 bg-cyan-900/20 text-cyan-300 font-bold text-glow-cyan ${
                        alignments[idx] === 'center' ? 'text-center' :
                        alignments[idx] === 'right' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {parseInline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-cyan-900/10">
                    {row.map((cell, cellIdx) => (
                      <td
                        key={cellIdx}
                        className={`border border-cyan-500/30 px-3 py-2 text-cyan-100 ${
                          alignments[cellIdx] === 'center' ? 'text-center' :
                          alignments[cellIdx] === 'right' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {parseInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      consecutiveEmptyLines = 0;
      continue;
    }

    // 处理空行：单个空行渲染为一个换行，两个以上空行渲染为一个空行
    if (line.trim() === '') {
      finishParagraph();
      consecutiveEmptyLines++;
      if (consecutiveEmptyLines === 1) {
        // 第一个空行：使用空段落但设置最小高度，使用 !m-0 强制覆盖 space-y-2 的间距
        elements.push(
          <p key={`p-br-${paragraphKey++}`} className="!m-0 h-0 leading-none">
            <br />
          </p>
        );
      } else if (consecutiveEmptyLines === 2) {
        // 第二个空行：添加空段落来产生空行效果
        elements.push(
          <p key={`p-empty-${paragraphKey++}`} className="opacity-90 break-words text-cyan-100 text-glow-cyan">
            &nbsp;
          </p>
        );
      }
      // 第三个及以上空行：忽略
      i++;
      continue;
    }

    // 普通段落：收集到 paragraphLines 中，遇到空行或其他块级元素时再渲染
    paragraphLines.push(line);
    consecutiveEmptyLines = 0;
    i++;
  }

  // 处理最后一段（如果有的话）
  finishParagraph();

  return (
    <div className="markdown-container font-mono text-sm leading-relaxed text-cyan-100 selection:bg-pink-500 selection:text-white">
      {elements}
    </div>
  );
};

