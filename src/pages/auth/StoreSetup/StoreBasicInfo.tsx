// src/pages/auth/StoreSetup/StoreBasicInfo.tsx

interface FormData {
  name: string;
  slug: string;
  description: string;
}

interface Props {
  formData: FormData;
  onNameChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}

export default function StoreBasicInfo({
  formData,
  onNameChange,
  onSlugChange,
  onDescriptionChange,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Name Your Store</h2>
        <p className="text-gray-500">You can always change this later from settings.</p>
      </div>

      {/* Store Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Store Name *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => onNameChange(e.target.value)}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
          placeholder="e.g., Fashion Hub Nigeria"
        />
      </div>

      {/* Store URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Store URL *
        </label>
        <div className="flex w-full overflow-hidden">
          <span className="inline-flex items-center px-3 bg-gray-100 border border-r-0 border-gray-200 rounded-l-xl text-gray-500 text-sm whitespace-nowrap shrink-0">
            qafrica.store/
          </span>
          <input
            type="text"
            value={formData.slug}
            onChange={(e) => onSlugChange(e.target.value)}
            className="flex-1 min-w-0 px-4 py-3 border border-gray-200 rounded-r-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="your-store"
            autoComplete="off"
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Lowercase letters, numbers, and hyphens only.
        </p>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Store Description{' '}
          <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 min-h-[100px] resize-none"
          placeholder="Tell customers what your store is about…"
        />
      </div>
    </div>
  );
}