import ReactMarkdown from "react-markdown";

type MarkdownMessageProps = {
  content: string;
};

export default function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      <ReactMarkdown
        components={{
          p: ({ ...props }) => <p className="mb-2 last:mb-0" {...props} />,
          ul: ({ ...props }) => (
            <ul className="mb-2 list-disc space-y-1 pl-5" {...props} />
          ),
          ol: ({ ...props }) => (
            <ol className="mb-2 list-decimal space-y-1 pl-5" {...props} />
          ),
          li: ({ ...props }) => <li className="" {...props} />,
          h1: ({ ...props }) => (
            <h1 className="mb-2 mt-3 text-lg font-bold" {...props} />
          ),
          h2: ({ ...props }) => (
            <h2 className="mb-2 mt-3 text-base font-bold" {...props} />
          ),
          h3: ({ ...props }) => (
            <h3 className="mb-2 mt-3 text-sm font-bold" {...props} />
          ),
          strong: ({ ...props }) => (
            <strong className="font-semibold" {...props} />
          ),
          em: ({ ...props }) => <em className="italic" {...props} />,
          code: ({ ...props }) => (
            <code
              className="rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-xs"
              {...props}
            />
          ),
          blockquote: ({ ...props }) => (
            <blockquote
              className="mb-2 border-l-4 border-zinc-300 pl-3 italic text-zinc-600"
              {...props}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
