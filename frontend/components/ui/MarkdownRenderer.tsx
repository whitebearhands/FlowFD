"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  // 헤딩
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold text-zinc-900 mb-4 mt-2">{children}</h1>
  ),
  h2: ({ children, ...props }) => {
    const text = String(children);
    const id = text.toLowerCase().replace(/[^a-z0-9가-힣\s]/g, "").trim().replace(/\s+/g, "-");
    return (
      <h2 id={id} {...props} className="text-lg font-semibold text-zinc-800 mt-8 mb-3 pb-2 border-b scroll-mt-4">
        {children}
      </h2>
    );
  },
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-zinc-800 mt-5 mb-2">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-sm font-semibold text-zinc-700 mt-4 mb-1">{children}</h4>
  ),

  // 텍스트
  p: ({ children }) => (
    <p className="text-sm text-zinc-700 leading-relaxed my-2">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-zinc-800">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-zinc-600">{children}</em>,
  hr: () => <hr className="my-6 border-zinc-200" />,

  // 목록
  ul: ({ children }) => (
    <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-sm text-zinc-700 leading-relaxed">{children}</li>
  ),

  // 인용
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-zinc-300 pl-4 my-3 text-sm italic text-zinc-500">
      {children}
    </blockquote>
  ),

  // 인라인 코드
  code: ({ children, className }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) return <code className={className}>{children}</code>;
    return (
      <code className="bg-zinc-100 text-zinc-800 px-1.5 py-0.5 rounded text-xs font-mono">
        {children}
      </code>
    );
  },

  // 펜스 코드 블록 (```json 등)
  pre: ({ children }) => (
    <pre className="bg-zinc-900 text-zinc-100 rounded-lg px-4 py-3 my-4 overflow-x-auto text-xs font-mono leading-relaxed whitespace-pre-wrap break-words">
      {children}
    </pre>
  ),

  // 표 (remark-gfm 필요)
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-zinc-200">
      <table className="w-full text-sm text-left">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-zinc-50 text-xs text-zinc-500 uppercase">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-zinc-100">{children}</tbody>
  ),
  tr: ({ children }) => <tr className="hover:bg-zinc-50">{children}</tr>,
  th: ({ children }) => (
    <th className="px-4 py-2.5 font-semibold text-zinc-600 whitespace-nowrap">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2.5 text-zinc-700">{children}</td>
  ),

  // 링크
  a: ({ children, href }) => (
    <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

type Props = {
  children: string;
  className?: string;
};

export default function MarkdownRenderer({ children, className = "" }: Props) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
