import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { burn, logCommit, tick, useStoreValue } from './counters.mjs';

// ---- data helpers (module level, so identities are stable across renders) ----

const itemCache = new Map();
export function getItems(n) {
  if (!itemCache.has(n)) {
    const items = [];
    for (let i = 0; i < n; i++) {
      items.push({ id: i, label: `item-${i}` });
    }
    itemCache.set(n, items);
  }
  return itemCache.get(n);
}

const productCache = new Map();
export function getProducts(n) {
  if (!productCache.has(n)) {
    const products = [];
    let seed = 12345;
    for (let i = 0; i < n; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      products.push({
        id: i,
        name: `Product ${seed.toString(36)}`,
        category: seed % 4 === 0 ? 'tools' : 'other',
        price: seed % 500,
      });
    }
    productCache.set(n, products);
  }
  return productCache.get(n);
}

// ---- rows ----

function PlainRow({ label, onSelect, style, children, work }) {
  tick('row');
  burn(work);
  return (
    <li style={style} onClick={onSelect}>
      {label}
      {children}
    </li>
  );
}

const MemoRow = memo(function MemoRow({ label, onSelect, style, children, work }) {
  tick('row');
  burn(work);
  return (
    <li style={style} onClick={onSelect}>
      {label}
      {children}
    </li>
  );
});

const ThemeContext = createContext({ mode: 'light' });

const ContextRow = memo(function ContextRow({ label, onSelect, work }) {
  const theme = useContext(ThemeContext);
  tick('row');
  burn(work);
  return (
    <li data-mode={theme.mode} onClick={onSelect}>
      {label}
    </li>
  );
});

// ---- scenario 1: what does a parent update cost the children? ----
// Every parent reads the "tick" key, so one setStore({tick}) re-renders it.

export function PlainInline({ n, work = 0 }) {
  const t = useStoreValue('tick');
  const onSelect = () => tick('select');
  return (
    <div>
      <span>{t}</span>
      <ul>
        {getItems(n).map((it) => (
          <PlainRow key={it.id} label={it.label} onSelect={onSelect} work={work} />
        ))}
      </ul>
    </div>
  );
}

export function MemoInline({ n, work = 0 }) {
  const t = useStoreValue('tick');
  const onSelect = () => tick('select');
  return (
    <div>
      <span>{t}</span>
      <ul>
        {getItems(n).map((it) => (
          <MemoRow key={it.id} label={it.label} onSelect={onSelect} work={work} />
        ))}
      </ul>
    </div>
  );
}

export function MemoCallback({ n, work = 0 }) {
  const t = useStoreValue('tick');
  const onSelect = useCallback(() => tick('select'), []);
  return (
    <div>
      <span>{t}</span>
      <ul>
        {getItems(n).map((it) => (
          <MemoRow key={it.id} label={it.label} onSelect={onSelect} work={work} />
        ))}
      </ul>
    </div>
  );
}

export function PlainCallback({ n, work = 0 }) {
  const t = useStoreValue('tick');
  const onSelect = useCallback(() => tick('select'), []);
  return (
    <div>
      <span>{t}</span>
      <ul>
        {getItems(n).map((it) => (
          <PlainRow key={it.id} label={it.label} onSelect={onSelect} work={work} />
        ))}
      </ul>
    </div>
  );
}

export function MemoCallbackInlineStyle({ n, work = 0 }) {
  const t = useStoreValue('tick');
  const onSelect = useCallback(() => tick('select'), []);
  return (
    <div>
      <span>{t}</span>
      <ul>
        {getItems(n).map((it) => (
          <MemoRow key={it.id} label={it.label} onSelect={onSelect} work={work} style={{ color: 'teal' }} />
        ))}
      </ul>
    </div>
  );
}

export function MemoCallbackMemoStyle({ n, work = 0 }) {
  const t = useStoreValue('tick');
  const onSelect = useCallback(() => tick('select'), []);
  const style = useMemo(() => ({ color: 'teal' }), []);
  return (
    <div>
      <span>{t}</span>
      <ul>
        {getItems(n).map((it) => (
          <MemoRow key={it.id} label={it.label} onSelect={onSelect} work={work} style={style} />
        ))}
      </ul>
    </div>
  );
}

export function MemoCallbackChildren({ n, work = 0 }) {
  const t = useStoreValue('tick');
  const onSelect = useCallback(() => tick('select'), []);
  return (
    <div>
      <span>{t}</span>
      <ul>
        {getItems(n).map((it) => (
          <MemoRow key={it.id} label={it.label} onSelect={onSelect} work={work}>
            <b>new</b>
          </MemoRow>
        ))}
      </ul>
    </div>
  );
}

export function ContextInlineValue({ n, work = 0 }) {
  const t = useStoreValue('tick');
  const onSelect = useCallback(() => tick('select'), []);
  return (
    <ThemeContext.Provider value={{ mode: 'dark' }}>
      <span>{t}</span>
      <ul>
        {getItems(n).map((it) => (
          <ContextRow key={it.id} label={it.label} onSelect={onSelect} work={work} />
        ))}
      </ul>
    </ThemeContext.Provider>
  );
}

export function ContextMemoValue({ n, work = 0 }) {
  const t = useStoreValue('tick');
  const onSelect = useCallback(() => tick('select'), []);
  const value = useMemo(() => ({ mode: 'dark' }), []);
  return (
    <ThemeContext.Provider value={value}>
      <span>{t}</span>
      <ul>
        {getItems(n).map((it) => (
          <ContextRow key={it.id} label={it.label} onSelect={onSelect} work={work} />
        ))}
      </ul>
    </ThemeContext.Provider>
  );
}

// ---- scenario 2: is useMemo worth its dependency check? ----

function CellPlain({ first, last }) {
  const full = `${first} ${last}`;
  return <li>{full}</li>;
}

function CellMemo({ first, last }) {
  const full = useMemo(() => `${first} ${last}`, [first, last]);
  return <li>{full}</li>;
}

export function CheapPlain({ n }) {
  const t = useStoreValue('tick');
  return (
    <div>
      <span>{t}</span>
      <ul>
        {getItems(n).map((it) => (
          <CellPlain key={it.id} first="Ada" last={it.label} />
        ))}
      </ul>
    </div>
  );
}

export function CheapMemo({ n }) {
  const t = useStoreValue('tick');
  return (
    <div>
      <span>{t}</span>
      <ul>
        {getItems(n).map((it) => (
          <CellMemo key={it.id} first="Ada" last={it.label} />
        ))}
      </ul>
    </div>
  );
}

function filterAndSort(products, category, maxPrice) {
  return products
    .filter((p) => p.category === category && p.price <= maxPrice)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function ListPlain({ n }) {
  const t = useStoreValue('tick');
  const visible = filterAndSort(getProducts(n), 'tools', 400);
  return (
    <div>
      <span>{t}</span>
      <ul>
        {visible.slice(0, 20).map((p) => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>
    </div>
  );
}

export function ListMemo({ n }) {
  const t = useStoreValue('tick');
  const products = getProducts(n);
  const visible = useMemo(() => filterAndSort(products, 'tools', 400), [products]);
  return (
    <div>
      <span>{t}</span>
      <ul>
        {visible.slice(0, 20).map((p) => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>
    </div>
  );
}

// ---- scenario 3: derived state, effect versus render ----

export function DerivedEffect({ n }) {
  const query = useStoreValue('query');
  const items = getItems(n);
  const [filtered, setFiltered] = useState(items);
  const ref = useRef(null);
  tick('derived.effect.render');
  useEffect(() => {
    setFiltered(items.filter((it) => it.label.includes(query)));
  }, [items, query]);
  useLayoutEffect(() => {
    logCommit(ref.current.textContent);
  });
  return <p ref={ref}>{`${query}:${filtered.length}`}</p>;
}

export function DerivedRender({ n }) {
  const query = useStoreValue('query');
  const items = getItems(n);
  const filtered = items.filter((it) => it.label.includes(query));
  const ref = useRef(null);
  tick('derived.render.render');
  useLayoutEffect(() => {
    logCommit(ref.current.textContent);
  });
  return <p ref={ref}>{`${query}:${filtered.length}`}</p>;
}

export function DerivedMemo({ n }) {
  const query = useStoreValue('query');
  const items = getItems(n);
  const filtered = useMemo(() => items.filter((it) => it.label.includes(query)), [items, query]);
  const ref = useRef(null);
  tick('derived.memo.render');
  useLayoutEffect(() => {
    logCommit(ref.current.textContent);
  });
  return <p ref={ref}>{`${query}:${filtered.length}`}</p>;
}

// ---- scenario 4: StrictMode bookkeeping ----

export function StrictProbe() {
  const t = useStoreValue('tick');
  const [local] = useState(() => {
    tick('strict.initializer');
    return 1;
  });
  const memoValue = useMemo(() => {
    tick('strict.useMemoFactory');
    return local + 1;
  }, [local]);
  tick('strict.render');
  useEffect(() => {
    tick('strict.effectSetup');
    return () => tick('strict.effectCleanup');
  }, []);
  const refCallback = useCallback((node) => {
    if (node) {
      tick('strict.refAttach');
    }
    return () => tick('strict.refCleanup');
  }, []);
  return (
    <p ref={refCallback}>
      {t}:{memoValue}
    </p>
  );
}

// ---- scenario 5: the closure facts the article states ----

export function ClickCounter({ functional }) {
  const [count, setCount] = useState(0);
  const handleClick = () => {
    if (functional) {
      setCount((prev) => prev + 1);
      setCount((prev) => prev + 1);
    } else {
      setCount(count + 1);
      setCount(count + 1);
    }
  };
  return (
    <button onClick={handleClick} data-count={count}>
      {count}
    </button>
  );
}

export function EagerInit({ lazy, parse }) {
  useStoreValue('tick');
  const [user] = useState(lazy ? () => parse() : parse());
  return <p>{user}</p>;
}

export function FetchOnMount({ fetcher, withAbort }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    fetcher(controller.signal)
      .then((value) => {
        tick('fetch.applied');
        setData(value);
      })
      .catch((err) => {
        if (err.name === 'AbortError') {
          tick('fetch.abortSeen');
        }
      });
    return withAbort ? () => controller.abort() : undefined;
  }, [fetcher, withAbort]);
  return <p>{data ?? 'loading'}</p>;
}
