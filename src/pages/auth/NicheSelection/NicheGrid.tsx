// src/pages/auth/NicheSelection/NicheGrid.tsx

import NicheCard from './NicheCard';

interface Niche {
  id: string;
  name: string;
  icon: string;
  description: string;
}

interface Props {
  niches: Niche[];
  selectedNiches: string[];
  onToggle: (id: string) => void;
}

export default function NicheGrid({ niches, selectedNiches, onToggle }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
      {niches.map((niche, index) => (
        <NicheCard
          key={niche.id}
          niche={niche}
          index={index}
          isSelected={selectedNiches.includes(niche.id)}
          isLocked={!selectedNiches.includes(niche.id) && selectedNiches.length >= 1}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}