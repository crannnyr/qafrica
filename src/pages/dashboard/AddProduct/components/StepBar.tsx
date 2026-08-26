import { Check } from 'lucide-react';
import { STEPS } from '../constants';

export function StepBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="mb-6">
      {/* Mobile */}
      <div className="flex items-center justify-between mb-1.5 sm:hidden">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Step {current} of {total} — {STEPS[current - 1].name}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500">{Math.round((current / total) * 100)}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full sm:hidden">
        <div
          className="h-1.5 bg-orange-500 rounded-full transition-all duration-300"
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>

      {/* Desktop */}
      <div className="hidden sm:flex items-center">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isDone   = current > step.id;
          const isActive = current === step.id;

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                  isDone   ? 'bg-orange-500 border-orange-500 text-white' :
                  isActive ? 'bg-white dark:bg-gray-800 border-orange-500 text-orange-500' :
                             'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500'
                }`}>
                  {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className={`mt-1 text-[11px] font-medium whitespace-nowrap ${
                  isActive ? 'text-orange-600 dark:text-orange-400' : isDone ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400 dark:text-gray-500'
                }`}>
                  {step.name}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-1.5 mb-4 transition-all ${
                  current > step.id ? 'bg-orange-500' : 'bg-gray-200 dark:bg-gray-600'
                }`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}