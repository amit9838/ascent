// Shared React binding for entity stores: initial load + re-read whenever
// the store changes (local writes and cloud-sync pulls arrive through the
// same subscribeRecords channel). Returns [value, setValue, ready] where
// setValue is React's state setter — use it for optimistic updates before
// the async entity write lands (the subscription re-read corrects it).

import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { subscribeRecords } from "./records.ts";
import type { StoreName } from "./types.ts";

export function useEntityState<T>(
  storeName: StoreName,
  load: () => Promise<T>,
  initial: T
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    load().then((loaded) => {
      if (!cancelled) {
        setValue(loaded);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
    // `load` is created once per mount by the caller's hook
  }, []);

  useEffect(
    () =>
      subscribeRecords((changedStore) => {
        if (changedStore !== storeName) return;
        load().then((loaded) => setValue(loaded));
      }),
    [storeName]
  );

  return [value, setValue, ready];
}
