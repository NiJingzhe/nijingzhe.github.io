import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

interface RetroMarkdownProps {
  content: string;
}

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
        <code key={key++} className="bg-gray-800 text-green-400 px-1.5 py-0.5 rounded font-mono text-xs border border-gray-700 text-glow-green">
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

  while (i < lines.length) {
    const line = lines[i];

    // 处理代码块
    if (line.trim().startsWith('```')) {
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
                fontSize: '12px',
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
      } else {
        // 开始代码块
        codeBlockLang = line.trim().slice(3).trim();
        inCodeBlock = true;
      }
      i++;
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      i++;
      continue;
    }

    // 处理标题
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={i} className="text-2xl font-bold text-pink-500 border-b border-pink-500/50 pb-1 mt-4 shadow-[0_0_10px_rgba(236,72,153,0.3)] text-glow-pink">
          {parseInline(line.replace(/^#\s+/, ''))}
        </h1>
      );
      i++;
      continue;
    }

    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="text-xl font-bold text-cyan-400 mt-3 text-glow-cyan">
          {parseInline(line.replace(/^##\s+/, ''))}
        </h2>
      );
      i++;
      continue;
    }

    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="text-lg font-bold text-emerald-400 mt-2 text-glow-emerald">
          {parseInline(line.replace(/^###\s+/, ''))}
        </h3>
      );
      i++;
      continue;
    }

    // 处理块级 LaTeX 公式 $$...$$
    if (line.trim().startsWith('$$') && line.trim().endsWith('$$') && line.trim().length > 4) {
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
      i++;
      continue;
    }

    // 处理多行块级 LaTeX 公式（简单处理）
    if (line.trim() === '$$') {
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
      continue;
    }

    // 处理列表
    if (line.startsWith('- ')) {
      elements.push(
        <li key={i} className="ml-4 text-emerald-400 list-disc marker:text-emerald-500 text-glow-emerald">
          {parseInline(line.replace(/^-\s+/, ''))}
        </li>
      );
      i++;
      continue;
    }

    // 处理引用
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={i} className="border-l-4 border-amber-500 pl-3 italic text-amber-200 bg-amber-900/20 py-1 text-glow-amber">
          {parseInline(line.replace(/^>\s+/, ''))}
        </blockquote>
      );
      i++;
      continue;
    }

    // 处理空行
    if (line.trim() === '') {
      elements.push(<br key={i} />);
      i++;
      continue;
    }

    // 普通段落
    elements.push(
      <p key={i} className="opacity-90 break-words text-cyan-100 text-glow-cyan">
        {parseInline(line)}
      </p>
    );
    i++;
  }

  return (
    <div className="font-mono text-sm leading-relaxed text-cyan-100 space-y-2 selection:bg-pink-500 selection:text-white">
      {elements}
    </div>
  );
};

