import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import type { Message } from "@/types";
import { SourceCard } from "./SourceCard";

function prepareMarkdown(text: string): string {
  // Turn "[SOURCE 1]" into "**[1]**" so the strong renderer below can style it as a citation pill.
  return text.replace(/\[SOURCE\s*(\d+)\]/gi, "**[$1]**");
}

const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1 ml-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1 ml-1">{children}</ol>,
  li: ({ children }) => <li className="text-gray-200">{children}</li>,
  h1: ({ children }) => <p className="font-semibold text-white mb-1 mt-2">{children}</p>,
  h2: ({ children }) => <p className="font-semibold text-white mb-1 mt-2">{children}</p>,
  h3: ({ children }) => <p className="font-semibold text-white mb-1 mt-2">{children}</p>,
  code: ({ children }) => (
    <code className="bg-gray-900 px-1.5 py-0.5 rounded text-xs text-emerald-400 break-words">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="bg-gray-900 rounded-lg p-3 overflow-x-auto text-xs my-2">{children}</pre>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-blue-400 underline">
      {children}
    </a>
  ),
  strong: ({ children }) => {
    const text = String(children);
    const isCitation = /^\[\d+\]$/.test(text.trim());
    if (isCitation) {
      return (
        <sup className="inline-block px-1.5 py-0.5 mx-0.5 bg-blue-600/25 text-blue-300 rounded text-[10px] font-semibold not-italic">
          {text}
        </sup>
      );
    }
    return <strong className="font-semibold text-white">{children}</strong>;
  },
};

export function ChatMessage({
  message,
  onTopicClick,
}: {
  message: Message;
  onTopicClick?: (topic: string) => void;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div className={`max-w-[80%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-2`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "bg-blue-600 text-white rounded-br-sm"
              : "bg-gray-800 text-gray-200 rounded-bl-sm"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <ReactMarkdown components={markdownComponents}>
              {prepareMarkdown(message.content)}
            </ReactMarkdown>
          )}
        </div>

        {message.citations && message.citations.length > 0 && (
          <div className="flex flex-col gap-1.5 w-full">
            <p className="text-gray-500 text-xs ml-1">Sources</p>
            {message.citations.map((c, i) => (
              <SourceCard key={c.chunkId || i} citation={c} index={c.sourceNum ?? i + 1} />
            ))}
          </div>
        )}

        {message.relatedTopics && message.relatedTopics.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {message.relatedTopics.map((topic) => (
              <button
                key={topic}
                onClick={() => onTopicClick?.(topic)}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-blue-400 text-xs rounded-full border border-gray-700 transition-colors"
              >
                {topic} →
              </button>
            ))}
          </div>
        )}

        <span className="text-gray-600 text-xs ml-1">
          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}