import React, {
  createContext, useState, useContext, useCallback,
} from 'react';
import { getBriefings } from '../utils/briefingState';

const LayoutContext = createContext(null);

export const useLayout = () => {
  const context = useContext(LayoutContext);
  if (context === null) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
};

export const LayoutProvider = ({ children }) => {
  const [isDrawerOpen, setDrawerOpen] = useState(true);
  const [briefings, setBriefings] = useState([]);
  const [selectedBriefingId, setSelectedBriefingId] = useState(null);

  const fetchBriefings = useCallback(async () => {
    try {
      const data = await getBriefings();
      setBriefings(data);
    } catch (err) {
      console.error('Failed to fetch briefings:', err);
      // Optionally, set an error state to show in the UI
    }
  }, []);

  const value = {
    isDrawerOpen,
    setDrawerOpen,
    briefings,
    fetchBriefings,
    selectedBriefingId,
    setSelectedBriefingId,
  };

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  );
};