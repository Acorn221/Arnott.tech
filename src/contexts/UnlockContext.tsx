import React, { createContext, useContext, useState, ReactNode } from 'react';

interface UnlockState {
  linkedinUnlocked: boolean;
  emailUnlocked: boolean;
  spinCount: number;
}

interface UnlockContextType {
  unlockState: UnlockState;
  updateSpinCount: (count: number) => void;
  unlockLinkedIn: () => void;
  unlockEmail: () => void;
}

const UnlockContext = createContext<UnlockContextType | undefined>(undefined);

export const useUnlock = () => {
  const context = useContext(UnlockContext);
  if (!context) {
    throw new Error('useUnlock must be used within an UnlockProvider');
  }
  return context;
};

interface UnlockProviderProps {
  children: ReactNode;
}

export const UnlockProvider: React.FC<UnlockProviderProps> = ({ children }) => {
  const [unlockState, setUnlockState] = useState<UnlockState>({
    linkedinUnlocked: false,
    emailUnlocked: false,
    spinCount: 0,
  });

  const updateSpinCount = (count: number) => {
    setUnlockState(prev => ({
      ...prev,
      spinCount: count,
    }));
  };

  const unlockLinkedIn = () => {
    setUnlockState(prev => ({
      ...prev,
      linkedinUnlocked: true,
    }));
  };

  const unlockEmail = () => {
    setUnlockState(prev => ({
      ...prev,
      emailUnlocked: true,
    }));
  };

  return (
    <UnlockContext.Provider
      value={{
        unlockState,
        updateSpinCount,
        unlockLinkedIn,
        unlockEmail,
      }}
    >
      {children}
    </UnlockContext.Provider>
  );
};
