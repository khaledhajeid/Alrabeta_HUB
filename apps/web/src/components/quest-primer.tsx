import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { BookIcon } from "@/components/quest-style-badge";

// Phase 8: the structural half of "Educational" — a primer used to be
// folded into the same prose as the challenge (one promptMarkdown blob),
// distinguishable only by reading it. This gives it its own surface
// (bg-surface-2, the existing "elevated" token, not a new one) sitting
// above the challenge, so the two are visually different before a single
// word is read, and closes the moment it's read: nothing here is gated
// behind an interaction, unlike the Pure quest's hints (see
// research-hints.tsx) — a primer is meant to be read, not optionally dug up.
export function QuestPrimer({ markdown }: { markdown: string }) {
  return (
    <div className="mb-8 rounded-lg border border-line bg-surface-2 p-5">
      <div className="flex items-center gap-2 text-accent">
        <BookIcon width="15" height="15" />
        <h2 className="text-sm font-semibold">Before you start</h2>
      </div>
      <div className="quest-prose mt-3 text-sm leading-relaxed text-text">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
          {markdown}
        </ReactMarkdown>
      </div>
    </div>
  );
}
