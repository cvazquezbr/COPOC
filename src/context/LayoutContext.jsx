import React, {
  createContext, useState, useContext, useCallback,
} from 'react';
import { getBriefings } from '../utils/briefingState';
import { getTranscriptions } from '../utils/transcriptionState';

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
  const [transcriptions, setTranscriptions] = useState([]);
  const [selectedTranscriptionId, setSelectedTranscriptionId] = useState(null);

  const fetchBriefings = useCallback(async () => {
    try {
      const data = await getBriefings();
      setBriefings(data);
    } catch (err) {
      console.error('Failed to fetch briefings:', err);
    }
  }, []);

  const fetchTranscriptions = useCallback(async () => {
    try {
      const data = await getTranscriptions();
      setTranscriptions(data);
    } catch (err) {
      console.error('Failed to fetch transcriptions:', err);
    }
  }, []);

  const value = {
    isDrawerOpen,
    setDrawerOpen,
    briefings,
    fetchBriefings,
    selectedBriefingId,
    setSelectedBriefingId,
    transcriptions,
    fetchTranscriptions,
    selectedTranscriptionId,
    setSelectedTranscriptionId,
  };

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  );
};