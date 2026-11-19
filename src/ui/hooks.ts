import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useData } from '../data/AppData';

/** Recharge à chaque affichage de l'écran et à chaque modification des données. */
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = []): { data: T | undefined; loading: boolean; reload: () => void } {
  const { version } = useData();
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const run = useCallback(() => {
    const id = ++seq.current;
    setLoading(true);
    loader().then((d) => { if (id === seq.current) { setData(d); setLoading(false); } }, () => { if (id === seq.current) setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useFocusEffect(useCallback(() => { run(); }, [run, version]));
  useEffect(() => () => { seq.current++; }, []);
  return { data, loading, reload: run };
}
