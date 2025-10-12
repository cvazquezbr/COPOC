import React, { createContext, useState, useContext } from 'react';

const LayoutContext = createContext(null);

export const useLayout = () => {
  const context = useContext(LayoutContext);
  if (context === null) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
};

export const LayoutProvider = ({ children }) => {
  const [briefingDrawerOpen, setBriefingDrawerOpen] = useState(true);

  const value = {
    briefingDrawerOpen,
    setBriefingDrawerOpen,
  };

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  );
};