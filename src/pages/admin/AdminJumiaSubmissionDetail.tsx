// src/pages/admin/AdminJumiaSubmissionDetail.tsx
// Route: /admin/jumia/:id — fetches the single submission (with owner joined) and
// renders the read-only info panel alongside the action panel.

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useJumiaStore, type JumiaSubmission } from '@/stores/jumiaStore';
import JumiaSubmissionStatusBadge from '../dashboard/Jumia/JumiaSubmissionStatusBadge';
import AdminJumiaUserInfoPanel from './Jumia/AdminJumiaUserInfoPanel';
import AdminJumiaActionPanel from './Jumia/AdminJumiaActionPanel';

export default function AdminJumiaSubmissionDetail() {
  const { id } = useParams<{ id: string }>();
  const { fetchSubmissionById } = useJumiaStore();
  const [submission, setSubmission] = useState<JumiaSubmission | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    if (!id) return;
    setIsLoading(true);
    const data = await fetchSubmissionById(id);
    setSubmission(data);
    setIsLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (isLoading) {
    return <div className="p-12 text-center text-gray-400 text-sm">Loading…</div>;
  }

  if (!submission) {
    return (
      <div className="p-12 text-center">
        <p className="text-gray-500 font-medium">Submission not found</p>
        <Link to="/admin/jumia" className="text-orange-500 text-sm font-bold mt-2 inline-block">Back to Jumia Submissions</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/jumia" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to Jumia Submissions
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{submission.name}</h1>
          <JumiaSubmissionStatusBadge status={submission.status} />
        </div>
        {submission.status_note && (
          <p className="text-sm text-gray-500 mt-1">Note: {submission.status_note}</p>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <AdminJumiaUserInfoPanel submission={submission} />
        </div>
        <div className="lg:col-span-2">
          <AdminJumiaActionPanel submission={submission} onUpdated={load} />
        </div>
      </div>
    </div>
  );
}
