import { MultiImageUpload } from '../MultiImageUpload';

export function Step2Images({ images, onChange }: {
  images: string[];
  onChange: (urls: string[]) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-3">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Product Images</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Upload up to 5 images. First image is the main photo. Auto-compressed on upload.
        </p>
      </div>
      <MultiImageUpload value={images} onChange={onChange} maxImages={5} />
    </div>
  );
}