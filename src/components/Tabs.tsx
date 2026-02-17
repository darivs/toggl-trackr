import React, { useState } from "react";

export type Tab = {
  id: string;
  label: string;
};

type Props = {
  tabs: Tab[];
  initialId?: string;
  onChange?: (id: string) => void;
  centerAction?: React.ReactNode;
  children: (id: string) => React.ReactNode;
};

const Tabs: React.FC<Props> = ({ tabs, initialId, onChange, centerAction, children }) => {
  const [active, setActive] = useState(initialId ?? tabs[0]?.id);

  const handleSelect = (id: string) => {
    setActive(id);
    onChange?.(id);
  };

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="flex w-full items-center">
        <div className="inline-flex gap-2 rounded-full bg-muted/60 p-1 text-sm">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`rounded-full px-4 py-2 font-semibold transition-colors ${
                tab.id === active ? "bg-card text-foreground shadow" : "text-subtle hover:text-foreground"
              }`}
              onClick={() => handleSelect(tab.id)}
              aria-pressed={tab.id === active}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {centerAction && (
          <div className="flex flex-1 justify-center">{centerAction}</div>
        )}
      </div>
      <div className="w-full animate-fade-in flex justify-center">{children(active)}</div>
    </div>
  );
};

export default Tabs;
