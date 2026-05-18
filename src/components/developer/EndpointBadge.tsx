// src/components/developer/EndpointBadge.tsx

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface EndpointBadgeProps {
  method: HttpMethod;
  path?: string;
  size?: 'sm' | 'md';
}

const METHOD_CONFIG: Record<HttpMethod, string> = {
  GET:    'bg-green-500/15 text-green-600 border border-green-500/25',
  POST:   'bg-blue-500/15 text-blue-600 border border-blue-500/25',
  PUT:    'bg-orange-500/15 text-orange-600 border border-orange-500/25',
  PATCH:  'bg-yellow-500/15 text-yellow-700 border border-yellow-500/25',
  DELETE: 'bg-red-500/15 text-red-600 border border-red-500/25',
};

export function EndpointBadge({ method, path, size = 'md' }: EndpointBadgeProps) {
  const cls     = METHOD_CONFIG[method] ?? METHOD_CONFIG.GET;
  const textCls = size === 'sm' ? 'text-xs' : 'text-xs';

  return (
    <span className="inline-flex items-center gap-2">
      <span className={`font-bold font-mono px-1.5 py-0.5 rounded ${textCls} ${cls}`}>
        {method}
      </span>
      {path && (
        <code className={`font-mono text-gray-600 ${textCls}`}>{path}</code>
      )}
    </span>
  );
}

export default EndpointBadge;