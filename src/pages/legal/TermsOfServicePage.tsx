import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, ArrowLeft, Loader2 } from 'lucide-react';
import SEO from '@/components/SEO';
import CONFIG from '@/lib/config';
import { supabase } from '@/services/supabase';

export default function TermsOfServicePage() {
  const [content, setContent] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      const { data } = await supabase
        .from('legal_documents')
        .select('content, updated_at')
        .eq('type', 'terms')
        .single();

      if (data) {
        setContent(data.content);
        setUpdatedAt(
          new Date(data.updated_at).toLocaleDateString('en-NG', {
            day: 'numeric', month: 'long', year: 'numeric',
          })
        );
      }
      setIsLoading(false);
    };
    fetchContent();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title="Terms of Service | QAFRICA"
        description="Read QAFRICA's Terms of Service. Understand your rights and responsibilities as a seller or buyer on Nigeria's e-commerce platform."
        noindex={false}
        url="https://qafrica.store/terms-of-service"
      />

      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container-custom">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900">QAFRICA</span>
            </Link>
            <Link to="/" className="flex items-center gap-1 text-sm text-gray-500 hover:text-orange-600 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      <main className="container-custom max-w-3xl py-16">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Terms of Service</h1>
          {updatedAt && (
            <p className="text-gray-500 text-sm">Last updated: {updatedAt}</p>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : (
          <div
            className="prose prose-gray max-w-none text-gray-700 leading-relaxed
              prose-headings:text-gray-900 prose-a:text-orange-500 prose-a:no-underline
              hover:prose-a:underline prose-li:text-gray-600"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        )}
      </main>

      <footer className="border-t py-8 mt-8">
        <div className="container-custom flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <p>© {new Date().getFullYear()} QAFRICA. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/privacy-policy" className="hover:text-orange-500 transition-colors">Privacy Policy</Link>
            <Link to="/terms-of-service" className="text-orange-500">Terms of Service</Link>
            <Link to="/" className="hover:text-orange-500 transition-colors">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}