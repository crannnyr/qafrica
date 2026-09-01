// src/pages/import-admin/MessageTemplatesEditor.tsx
// Admin editing UI for the 4 required message templates (spec Section 1).
// The templates themselves are already fully wired into every actual send
// (consolidation notice, consolidation bill, shipping bill, shipped) —
// this is purely the missing "let admin change the wording" screen.
import { useState, useEffect, useCallback } from 'react';
import { Loader, Save, ChevronDown, ChevronUp, Info } from 'lucide-react';
import CONFIG from '@/lib/config';
import { toast } from 'sonner';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;

interface Template {
  key: string;
  label: string;
  description: string;
  subject: string;
  body_html: string;
  available_placeholders: string[];
  updated_at: string;
}

export default function MessageTemplatesEditor({ token }: { token: string }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { subject: string; body_html: string }>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-get-templates`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token }),
      });
      const data = await res.json();
      const rows: Template[] = data.templates ?? [];
      setTemplates(rows);
      setDrafts(Object.fromEntries(rows.map(t => [t.key, { subject: t.subject, body_html: t.body_html }])));
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const save = async (key: string) => {
    const draft = drafts[key];
    if (!draft) return;
    setSavingKey(key);
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-update-template`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, key, subject: draft.subject, body_html: draft.body_html }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      toast.success('Template saved — takes effect on the next send');
      await load();
    } finally {
      setSavingKey(null);
    }
  };

  const hasChanges = (t: Template) => {
    const d = drafts[t.key];
    return d && (d.subject !== t.subject || d.body_html !== t.body_html);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
        <Loader className="w-5 h-5 animate-spin text-gray-300 mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">
        Edit the wording sent for each stage. Every send already pulls from these — changes take effect immediately on the next send, nothing to redeploy.
      </p>

      {templates.map(t => {
        const isOpen = expandedKey === t.key;
        const draft = drafts[t.key] ?? { subject: t.subject, body_html: t.body_html };
        return (
          <div key={t.key} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <button
              onClick={() => setExpandedKey(isOpen ? null : t.key)}
              className="w-full flex items-center justify-between px-4 py-3.5 text-left"
            >
              <div>
                <p className="text-sm font-bold text-gray-900">{t.label}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{t.description}</p>
              </div>
              {isOpen ? <ChevronUp className="w-4 h-4 text-gray-300 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-300 flex-shrink-0" />}
            </button>

            {isOpen && (
              <div className="px-4 pb-4 space-y-3 border-t border-gray-50 pt-3">
                {t.available_placeholders.length > 0 && (
                  <div className="flex items-start gap-1.5 bg-orange-50 rounded-xl p-2.5">
                    <Info className="w-3.5 h-3.5 text-orange-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-orange-600">
                      Available placeholders: {t.available_placeholders.map(p => `{{${p}}}`).join(', ')}
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-bold text-gray-500 mb-1 block">Subject line</label>
                  <input
                    type="text"
                    value={draft.subject}
                    onChange={e => setDrafts(prev => ({ ...prev, [t.key]: { ...draft, subject: e.target.value } }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-500 mb-1 block">Body (HTML)</label>
                  <textarea
                    value={draft.body_html}
                    onChange={e => setDrafts(prev => ({ ...prev, [t.key]: { ...draft, body_html: e.target.value } }))}
                    rows={10}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs font-mono focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none resize-y"
                  />
                </div>

                <button
                  onClick={() => save(t.key)}
                  disabled={savingKey === t.key || !hasChanges(t)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-40 transition-colors"
                >
                  {savingKey === t.key ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save changes
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
