// src/components/developer/ApiKeyCard.tsx
// Renders a single API key row. Used by DeveloperApiKeysPage.
// Separate so it can be reused anywhere keys need to be displayed.

import { Clock, Shield, AlertTriangle, Trash2, Key } from 'lucide-react';
import type { DeveloperApiKey } from '@/types/developer';
import { CopyButton } from './CopyButton';

interface ApiKeyCardProps {
  apiKey:    Omit<DeveloperApiKey, 'key_hash'>;
  onRevoke:  (id: string, name: string) => void;
}

export function ApiKeyCard({ apiKey, onRevoke }: ApiKeyCardProps) {
  const isTest = apiKey.environment === 'test';

  const lastUsed = apiKey.last_used_at
    ? new Date(apiKey.last_used_at).toLocaleDateString('en-NG', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : 'Never';

  const created = new Date(apiKey.created_at).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  const isExpiringSoon = apiKey.expires_at
    ? Math.ceil((new Date(apiKey.expires_at).getTime() - Date.now()) / 86_400_000) <= 7
    : false;

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 flex items-start
      gap-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
        isTest ? 'bg-blue-50' : 'bg-orange-50'
      }`}>
        <Key className={`w-4.5 h-4.5 ${isTest ? 'text-blue-500' : 'text-orange-500'}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Name + env badge */}
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-semibold text-gray-900 text-sm">{apiKey.name}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            isTest
              ? 'bg-blue-100 text-blue-700'
              : 'bg-orange-100 text-orange-700'
          }`}>
            {isTest ? 'Test' : 'Production'}
          </span>
          {isExpiringSoon && (
            <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Expiring soon
            </span>
          )}
        </div>

        {/* Key prefix */}
        <div className="flex items-center gap-1.5 mb-2">
          <code className="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-0.5
            rounded border border-gray-100">
            {apiKey.key_prefix}{'•'.repeat(24)}
          </code>
          <CopyButton text={apiKey.key_prefix} size="sm" silent />
        </div>

        {/* Meta */}
        <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3" />
            Created {created}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Last used: {lastUsed}
          </span>
          {apiKey.expires_at && (
            <span className={`flex items-center gap-1 ${isExpiringSoon ? 'text-amber-600' : ''}`}>
              <AlertTriangle className="w-3 h-3" />
              Expires {new Date(apiKey.expires_at).toLocaleDateString('en-NG', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </span>
          )}
        </div>
      </div>

      {/* Revoke */}
      <button
        onClick={() => onRevoke(apiKey.id, apiKey.name)}
        title="Revoke this key"
        className="flex-shrink-0 p-2 rounded-lg text-gray-300 hover:text-red-500
          hover:bg-red-50 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export default ApiKeyCard;