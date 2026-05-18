import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Shield, Save, Loader2, AlertCircle, CheckCircle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';

type DocType = 'terms' | 'privacy';

const DOCS: { type: DocType; label: string; icon: React.ElementType; description: string }[] = [
  {
    type: 'terms',
    label: 'Terms of Service',
    icon: FileText,
    description: 'User responsibilities, prohibited content, payment terms, dispute resolution',
  },
  {
    type: 'privacy',
    label: 'Privacy Policy',
    icon: Shield,
    description: 'Data collection, usage, sharing, retention, and user rights',
  },
];

export default function AdminLegal() {
  const [activeDoc, setActiveDoc] = useState<DocType>('terms');
  const [contents, setContents] = useState<Record<DocType, string>>({ terms: '', privacy: '' });
  const [updatedAts, setUpdatedAts] = useState<Record<DocType, string>>({ terms: '', privacy: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [changeNote, setChangeNote] = useState('');

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('legal_documents')
      .select('type, content, updated_at');

    if (data) {
      const map: Record<string, string> = {};
      const dates: Record<string, string> = {};
      data.forEach((d: any) => {
        map[d.type] = d.content;
        dates[d.type] = d.updated_at;
      });
      setContents({ terms: map.terms || '', privacy: map.privacy || '' });
      setUpdatedAts({ terms: dates.terms || '', privacy: dates.privacy || '' });
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    if (!contents[activeDoc].trim()) {
      toast.error('Content cannot be empty');
      return;
    }

    setIsSaving(true);

    // Get current admin user
    const { data: { user } } = await supabase.auth.getUser();

    // Update the document
    const { error } = await supabase
      .from('legal_documents')
      .update({
        content:    contents[activeDoc],
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('type', activeDoc);

    if (error) {
      toast.error('Failed to save document');
      setIsSaving(false);
      return;
    }

    // Send notification emails to all store owners if toggled on
    if (sendEmail) {
      try {
        // Fetch all active store owner emails
        const { data: profiles } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('role', 'store_owner');

        if (profiles && profiles.length > 0) {
          const docLabel = activeDoc === 'terms' ? 'Terms of Service' : 'Privacy Policy';
          const docUrl = activeDoc === 'terms'
            ? 'https://qafrica.store/terms-of-service'
            : 'https://qafrica.store/privacy-policy';

          // Send emails in batches via send-email edge function
          const emailPromises = profiles.map((profile: any) =>
            supabase.functions.invoke('send-email', {
              body: {
                to:      profile.email,
                subject: `Important: QAFRICA ${docLabel} Updated`,
                html: `
                  <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
                    <div style="background:#F97316;border-radius:12px;padding:16px 20px;margin-bottom:24px;display:inline-block;">
                      <span style="color:#fff;font-size:20px;font-weight:800;">QAFRICA</span>
                    </div>

                    <h2 style="color:#111827;margin:0 0 8px;">Our ${docLabel} Has Been Updated</h2>
                    <p style="color:#6B7280;margin:0 0 20px;">
                      Hi ${profile.full_name || 'there'}, we've made updates to our ${docLabel}.
                      Please take a moment to review the changes.
                    </p>

                    ${changeNote ? `
                    <div style="background:#FFF7ED;border-left:4px solid #F97316;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:20px;">
                      <p style="margin:0;font-size:14px;color:#374151;">
                        <strong>Summary of changes:</strong><br/>${changeNote}
                      </p>
                    </div>
                    ` : ''}

                    <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:16px;margin-bottom:20px;">
                      <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;font-weight:600;text-transform:uppercase;">
                        Effective Date
                      </p>
                      <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">
                        ${new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>

                    <p style="color:#6B7280;font-size:14px;margin-bottom:20px;">
                      Continued use of QAFRICA after this date constitutes acceptance of the updated ${docLabel}.
                    </p>

                    <a href="${docUrl}"
                       style="display:inline-block;background:#F97316;color:#fff;padding:12px 28px;
                              border-radius:10px;font-weight:700;text-decoration:none;font-size:15px;">
                      Read Updated ${docLabel} →
                    </a>

                    <p style="color:#9CA3AF;font-size:12px;margin-top:24px;">
                      If you have questions, contact us at support@qafrica.store
                    </p>
                  </div>
                `,
              },
            }).catch(() => null) // non-fatal per email
          );

          await Promise.allSettled(emailPromises);
          toast.success(`Document saved and ${profiles.length} store owners notified by email`);
        } else {
          toast.success('Document saved successfully');
        }
      } catch {
        // Email blast failed but document was saved — don't fail the whole operation
        toast.success('Document saved. Email notifications failed — try again from the page.');
      }
    } else {
      toast.success('Document saved successfully');
    }

    // Refresh updated_at timestamp
    setUpdatedAts(prev => ({ ...prev, [activeDoc]: new Date().toISOString() }));
    setChangeNote('');
    setIsSaving(false);
  };

  const currentDoc = DOCS.find(d => d.type === activeDoc)!;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Legal Documents</h1>
        <p className="text-gray-500 mt-1">
          Edit Terms of Service and Privacy Policy. Store owners are notified by email on save.
        </p>
      </div>

      {/* Doc Selector */}
      <div className="grid sm:grid-cols-2 gap-4">
        {DOCS.map(doc => {
          const Icon = doc.icon;
          const isActive = activeDoc === doc.type;
          return (
            <button
              key={doc.type}
              onClick={() => setActiveDoc(doc.type)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                isActive
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  isActive ? 'bg-orange-500' : 'bg-gray-100'
                }`}>
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                </div>
                <span className="font-semibold text-gray-900">{doc.label}</span>
              </div>
              <p className="text-xs text-gray-500">{doc.description}</p>
              {updatedAts[doc.type] && (
                <p className="text-xs text-gray-400 mt-2">
                  Last updated: {new Date(updatedAts[doc.type]).toLocaleDateString('en-NG', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Editor */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      ) : (
        <motion.div
          key={activeDoc}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-gray-100 p-6 space-y-5"
        >
          <div className="flex items-center gap-3">
            <currentDoc.icon className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              Editing: {currentDoc.label}
            </h2>
          </div>

          {/* HTML info banner */}
          <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Content is rendered as HTML. Use standard tags:
              <code className="bg-blue-100 px-1 rounded mx-1">&lt;h2&gt;</code>
              <code className="bg-blue-100 px-1 rounded mx-1">&lt;p&gt;</code>
              <code className="bg-blue-100 px-1 rounded mx-1">&lt;ul&gt;&lt;li&gt;</code>
              <code className="bg-blue-100 px-1 rounded mx-1">&lt;strong&gt;</code>
              <code className="bg-blue-100 px-1 rounded mx-1">&lt;a href="..."&gt;</code>
            </p>
          </div>

          {/* Textarea editor */}
          <textarea
            value={contents[activeDoc]}
            onChange={e => setContents(prev => ({ ...prev, [activeDoc]: e.target.value }))}
            rows={28}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none font-mono text-sm resize-y"
            placeholder="Enter HTML content..."
          />

          {/* Preview */}
          {contents[activeDoc] && (
            <div className="border border-orange-200 rounded-xl p-5 bg-orange-50/40">
              <p className="text-xs font-semibold text-orange-600 uppercase mb-3">Live Preview</p>
              <div
                className="prose prose-sm max-w-none text-gray-700
                  prose-headings:text-gray-900 prose-a:text-orange-500"
                dangerouslySetInnerHTML={{ __html: contents[activeDoc] }}
              />
            </div>
          )}

          {/* Change note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Summary of Changes <span className="text-gray-400 font-normal">(included in email to users)</span>
            </label>
            <textarea
              value={changeNote}
              onChange={e => setChangeNote(e.target.value)}
              rows={2}
              placeholder="e.g. Updated payment disbursement timeline from 7 to 3 days. Added dropshipping liability clause."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none text-sm resize-none"
            />
          </div>

          {/* Email toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">Notify store owners by email</p>
                <p className="text-xs text-gray-500">
                  Sends a branded update email to all active store owners
                </p>
              </div>
            </div>
            <button
              onClick={() => setSendEmail(v => !v)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                sendEmail ? 'bg-orange-500' : 'bg-gray-200'
              }`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                sendEmail ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* Save */}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12"
          >
            {isSaving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save {currentDoc.label}
                {sendEmail && ' & Notify Users'}
              </>
            )}
          </Button>
        </motion.div>
      )}
    </div>
  );
}