// File: /src/components/CollapsibleDescription.tsx

import { useState } from 'react';

interface CollapsibleDescriptionProps {
  text: string;
  maxLength?: number;
  className?: string;
}

export default function CollapsibleDescription({ 
  text, 
  maxLength = 20, 
  className = '' 
}: CollapsibleDescriptionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!text) return null;
  
  const shouldTruncate = text.length > maxLength;
  
  if (!shouldTruncate) {
    return <p className={`text-gray-600 dark:text-gray-300 leading-relaxed ${className}`}>{text}</p>;
  }
  
  return (
    <div className={className}>
      {isExpanded ? (
        <p 
          className="text-gray-600 dark:text-gray-300 leading-relaxed cursor-pointer"
          onClick={() => setIsExpanded(false)}
        >
          {text}
        </p>
      ) : (
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          {text.slice(0, maxLength)}...
        </p>
      )}
      
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="mt-1 text-orange-600 hover:text-orange-700 text-sm font-medium"
      >
        {isExpanded ? 'Less' : 'More'}
      </button>
    </div>
  );
}