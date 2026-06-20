import Link from 'next/link';

interface Props {
  result: {
    result_id: string;
    source: string;
    source_type: string;
    summary: string;
    topic_tags: string[];
    created_at: number;
  };
}

const TYPE_LABEL: Record<string, string> = {
  SOURCE_TYPE_YOUTUBE_URL: 'YouTube',
  SOURCE_TYPE_ARTICLE_URL: 'Article',
  SOURCE_TYPE_RAW_TEXT:    'Text',
};

export default function ResultCard({ result }: Props) {
  return (
    <Link
      href={`/results/${result.result_id}`}
      className="block bg-white border rounded-2xl shadow-sm p-5 hover:shadow-md transition"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
          {TYPE_LABEL[result.source_type] ?? result.source_type}
        </span>
        <span className="text-xs text-gray-400">
          {new Date(result.created_at * 1000).toLocaleDateString()}
        </span>
      </div>

      <p className="text-xs text-gray-400 truncate mb-2">{result.source}</p>

      <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed">
        {result.summary}
      </p>

      {result.topic_tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {result.topic_tags.slice(0, 4).map(tag => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}