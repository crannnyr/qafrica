import { TABS, type Tab } from './constants';

interface Props {
  activeTab: Tab;
  onChange: (tab: Tab) => void;
}

export default function TabNav({ activeTab, onChange }: Props) {
  return (
    <div className="flex items-center flex-wrap gap-0 border-b border-gray-200">
      {TABS.map((tab, i) => (
        <div key={tab.id} className="flex items-center">
          {i > 0 && <span className="text-gray-300 text-sm px-1 select-none">|</span>}
          <button
            onClick={() => onChange(tab.id)}
            className={`px-3 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        </div>
      ))}
    </div>
  );
}