import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import ProductCard from '../components/ProductCard';

const SORTS = {
  featured: { label: 'Featured', compare: null },
  'price-asc': { label: 'Price: low to high', compare: (a, b) => a.price - b.price },
  'price-desc': { label: 'Price: high to low', compare: (a, b) => b.price - a.price },
  name: { label: 'Name: A to Z', compare: (a, b) => a.name.localeCompare(b.name) },
};

const TRUST_POINTS = [
  {
    title: 'Secure payments',
    text: 'Checkout is handled by Paystack',
    icon: <path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6l-8-3Zm-1 12-3-3 1.4-1.4L11 12.2l3.6-3.6L16 10l-5 5Z" />,
  },
  {
    title: 'Live availability',
    text: 'Stock levels are always current',
    icon: <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Zm9 1.4L6.6 6.2 12 8.9l5.4-2.7L12 8.9Zm-7 1.1v5.5l6 3v-5.5l-6-3Zm8 8.5 6-3V10l-6 3v5.5Z" />,
  },
  {
    title: 'Order tracking',
    text: 'Follow every order, start to finish',
    icon: <path d="M4 4h16v4H4V4Zm0 6h10v10H4V10Zm12 0h4v10h-4V10Z" />,
  },
];

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState('featured');

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await api.get('/products', { auth: false, signal: controller.signal });
        setProducts(res.data);
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, []);

  const categories = useMemo(
    () => ['All', ...new Set(products.map((product) => product.category))],
    [products]
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = products.filter(
      (product) =>
        (category === 'All' || product.category === category) &&
        (!term ||
          product.name.toLowerCase().includes(term) ||
          product.description.toLowerCase().includes(term))
    );
    const { compare } = SORTS[sort];
    return compare ? [...filtered].sort(compare) : filtered;
  }, [products, search, category, sort]);

  const countLabel = loading
    ? 'Loading products…'
    : `${visible.length} ${visible.length === 1 ? 'product' : 'products'}`;

  return (
    <div className="page">
      <section className="hero" aria-labelledby="hero-title">
        <span className="eyebrow">The collection</span>
        <h1 id="hero-title">
          Everything you need, <em>delivered</em> with care.
        </h1>
        <p>
          Considered products at honest prices, with transparent stock levels and a secure,
          effortless checkout.
        </p>
        <div className="hero-actions">
          <a href="#catalogue" className="hero-cta">
            Shop now <span aria-hidden="true">→</span>
          </a>
        </div>
      </section>

      <ul className="trust-bar" aria-label="Why shop with us">
        {TRUST_POINTS.map((point) => (
          <li key={point.title} className="trust-item">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              {point.icon}
            </svg>
            <div>
              <strong>{point.title}</strong>
              <span>{point.text}</span>
            </div>
          </li>
        ))}
      </ul>

      <section id="catalogue" aria-labelledby="catalogue-title">
        <div className="catalogue-head">
          <div>
            <h2 id="catalogue-title">Shop the collection</h2>
            <p aria-live="polite">{countLabel}</p>
          </div>

          <div className="catalogue-tools">
            <div className="search-field">
              <SearchIcon />
              <input
                type="search"
                placeholder="Search products"
                aria-label="Search products"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="search-input"
              />
            </div>
            <select
              className="sort-select"
              aria-label="Sort products"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              {Object.entries(SORTS).map(([value, { label }]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {categories.length > 2 && (
          <div className="chip-row" role="group" aria-label="Filter by category">
            {categories.map((name) => (
              <button
                key={name}
                type="button"
                className="chip"
                aria-pressed={category === name}
                onClick={() => setCategory(name)}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {error && <p className="error-text">{error}</p>}

        {loading && (
          <div className="product-grid" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="skeleton skeleton-card" />
            ))}
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <div className="empty-state">
            <h2>No products found</h2>
            <p>Try a different search term or clear the category filter.</p>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setSearch('');
                setCategory('All');
              }}
            >
              Clear filters
            </button>
          </div>
        )}

        {!loading && visible.length > 0 && (
          <div className="product-grid">
            {visible.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
