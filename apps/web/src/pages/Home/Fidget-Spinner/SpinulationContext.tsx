import {
  createContext,
  useContext,
  useState,
  type FC,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";

interface SpinulationContextValue {
  spinCount: number;
  setSpinCount: Dispatch<SetStateAction<number>>;
}

const SpinulationContext = createContext<SpinulationContextValue | null>(null);

export const SpinulationProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [spinCount, setSpinCount] = useState(0);

  return (
    <SpinulationContext.Provider value={{ spinCount, setSpinCount }}>
      {children}
    </SpinulationContext.Provider>
  );
};

export const useSpinulation = (): SpinulationContextValue => {
  const context = useContext(SpinulationContext);
  if (!context) {
    throw new Error("useSpinulation must be used within a SpinulationProvider");
  }
  return context;
};
