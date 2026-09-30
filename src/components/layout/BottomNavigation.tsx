import React from 'react';
import { Home, BookOpen, Brain, Heart, MoreHorizontal } from 'lucide-react';

export type TabType = 'home' | 'mushaf' | 'memorize' | 'athkar' | 'more';

interface Props {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  kidsMode?: boolean;
}

export const BottomNavigation: React.FC<Props> = ({ activeTab, onTabChange, kidsMode }) => {
  const tabs = [
    { id: 'home' as TabType, label: 'الرئيسية', icon: Home },
    { id: 'mushaf' as TabType, label: 'المصحف', icon: BookOpen },
    { id: 'memorize' as TabType, label: kidsMode ? 'الحفظ ⭐' : 'الحفظ', icon: Brain },
    { id: 'athkar' as TabType, label: 'الأذكار', icon: Heart },
    { id: 'more' as TabType, label: 'المزيد', icon: MoreHorizontal },
  ];

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border-t ${
        kidsMode ? 'border-amber-400 bg-amber-50/90 dark:bg-stone-900/90' : 'border-emerald-100 dark:border-stone-800'
      } px-2 py-1 safe-area-pb transition-colors`}
    >
      <div className="max-w-lg mx-auto flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all relative ${
                isActive
                  ? kidsMode
                    ? 'text-amber-700 dark:text-amber-400 font-bold scale-105'
                    : 'text-emerald-700 dark:text-emerald-400 font-bold scale-105'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
              }`}
            >
              <div
                className={`p-1 rounded-xl transition-all ${
                  isActive
                    ? kidsMode
                      ? 'bg-amber-100 dark:bg-amber-950/60'
                      : 'bg-emerald-50 dark:bg-emerald-950/60'
                    : 'bg-transparent'
                }`}
              >
                <Icon size={22} className={isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'} />
              </div>
              <span className="text-[11px] mt-0.5 tracking-tight">{tab.label}</span>
              {isActive && (
                <div
                  className={`w-1.5 h-1.5 rounded-full absolute -bottom-0.5 ${
                    kidsMode ? 'bg-amber-500' : 'bg-emerald-600'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
