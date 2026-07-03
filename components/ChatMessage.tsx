import type { Message } from "@/types";
import { SourceCard } from "./SourceCard";

export function ChatMessage({
  message,
  onTopicClick,
}: {
  message: Message;
  onTopicClick?: (topic: string) => void;
}) {
  const isUser = message.role === "user";

  function renderAnswer(text: string) {
    return text.split("\n").map((line, i) => (
      <p key={i} className="mb-1.5 last:mb-0">
        {line.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={j} className="font-semibold text-white">
              {part.slice(2, -2)}
            </strong>
          ) : (
            part
          )
        )}
      </p>
    ));
  }

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
          {renderAnswer(message.content)}
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
