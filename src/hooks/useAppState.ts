import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

export const useAppState = () => {
  const currentAppState = useRef(AppState.currentState);
  const [appState, setAppState] = useState(currentAppState.current);
  const [prevAppState, setPrevAppState] = useState('undefined');

  useEffect(() => {
    AppState.addEventListener('change', (nextAppState) => {
      setPrevAppState(currentAppState.current);
      currentAppState.current = nextAppState;
      setAppState(nextAppState);
    });
  }, []);

  return { appState, prevAppState };
};
