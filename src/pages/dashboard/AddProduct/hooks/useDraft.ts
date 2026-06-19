import { useState, useEffect } from 'react';
import { EMPTY_FORM, getDraftKey } from '../constants';

interface UseDraftProps {
  user: any;
  setStep: (step: number) => void;
  setImages: (images: string[]) => void;
}

export function useDraft({ user, setStep, setImages }: UseDraftProps) {
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [hasDraft, setHasDraft] = useState(false);

  const draftKey = user?.id ? getDraftKey(user.id) : null;

  // Load draft on mount
  useEffect(() => {
    if (!draftKey) return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const { formData: fd, images: imgs, step: s } = JSON.parse(saved);
        if (fd?.name || imgs?.length) {
          setHasDraft(true);
          setFormData({ ...EMPTY_FORM, ...fd });
          setImages(imgs || []);
          setStep(s || 1);
        }
      }
    } catch {}
  }, [draftKey]);

  // Auto-save on every change
  useEffect(() => {
    if (!draftKey) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ formData }));
    } catch {}
  }, [formData, draftKey]);

  const set = (patch: Partial<typeof EMPTY_FORM>) =>
    setFormData(prev => ({ ...prev, ...patch }));

  const clearDraft = () => {
    if (draftKey) localStorage.removeItem(draftKey);
    setHasDraft(false);
    setFormData({ ...EMPTY_FORM });
    setImages([]);
    setStep(1);
  };

  return { formData, set, hasDraft, clearDraft };
}