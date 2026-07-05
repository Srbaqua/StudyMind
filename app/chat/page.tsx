"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useDocuments } from "@/hooks/useDocuments";
import { ChatInterface } from "@/components/ChatInterface";
import { MemoryPanel } from "@/components/MemoryPanel";
import Link from "next/link";

function ChatPageContent() {
  const { documents, isLoading } = useDocuments();
  const searchParams = useSearchParams();
  const topicFromUrl = searchParams.get("topic");
  const initialInput = topicFromUrl ? `Tell me about ${topicFromUrl}` : undefined;

  if (!isLoading && documents.filter((d) => d.status === "ready").length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-4xl mb-4">📚</p>
          <p className="text-white font-medium mb-2">No documents ready yet</p>
          <p className="text-gray-400 text-sm mb-4">Upload some notes first</p>
          <Link
            href="/"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors"
          >
            Go upload →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="flex-1">
        <ChatInterface initialInput={initialInput} />
      </div>
      <MemoryPanel />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-500">Loading…</div>}>
      <ChatPageContent />
    </Suspense>
  );
}


// "use client";

// import { Suspense } from "react";
// import { useSearchParams } from "next/navigation";
// import { useDocuments } from "@/hooks/useDocuments";
// import { ChatInterface } from "@/components/ChatInterface";
// import Link from "next/link";

// function ChatPageContent() {
//   const { documents, isLoading } = useDocuments();
//   const searchParams = useSearchParams();
//   const topicFromUrl = searchParams.get("topic");
//   const initialInput = topicFromUrl ? `Tell me about ${topicFromUrl}` : undefined;

//   if (!isLoading && documents.filter((d) => d.status === "ready").length === 0) {
//     return (
//       <div className="flex items-center justify-center h-full">
//         <div className="text-center">
//           <p className="text-4xl mb-4">📚</p>
//           <p className="text-white font-medium mb-2">No documents ready yet</p>
//           <p className="text-gray-400 text-sm mb-4">Upload some notes first</p>
//           <Link
//             href="/"
//             className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors"
//           >
//             Go upload →
//           </Link>
//         </div>
//       </div>
//     );
//   }

//   return <ChatInterface initialInput={initialInput} />;
// }

// export default function ChatPage() {
//   return (
//     <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-500">Loading…</div>}>
//       <ChatPageContent />
//     </Suspense>
//   );
// }
