import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
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

const STEPS = [
  { title: 'Browse', text: 'Explore the collection and add your favourites to the cart.' },
  { title: 'Check out securely', text: 'Enter your delivery details and pay through Paystack.' },
  { title: 'Track your order', text: 'Follow it from confirmation to delivery in your account.' },
  { title: 'Receive & enjoy', text: 'Your order arrives at your door. Reorder anytime.' },
];

const FAQS = [
  {
    q: 'How do I pay?',
    a: 'Payment is handled on Paystack’s secure checkout, which supports cards and the other methods Paystack offers. We never see or store your card details.',
  },
  {
    q: 'What if my payment fails or I close the page?',
    a: 'Nothing is lost. Your order stays in your account with the items reserved, and you can use “Pay now” from the order page to try again.',
  },
  {
    q: 'Can I cancel an order?',
    a: 'Yes. Orders that have not been paid for can be cancelled from your orders page, and the items go back into stock. For paid orders, please contact support.',
  },
  {
    q: 'How do I track my order?',
    a: 'Open “Orders” after logging in and choose “Track order”. You will see each stage: placed, paid, processing, shipped and delivered.',
  },
  {
    q: 'Are the prices and stock levels accurate?',
    a: 'Yes. Prices and availability come straight from our system at the moment you check out, so what you see is what you pay.',
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
  const { user } = useAuth();
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

  // One tile per category, illustrated by the first product that has an image.
  const categoryTiles = useMemo(() => {
    const groups = new Map();
    products.forEach((product) => {
      const group = groups.get(product.category) || { name: product.category, count: 0, image: '' };
      group.count += 1;
      if (!group.image && product.imageUrl) group.image = product.imageUrl;
      groups.set(product.category, group);
    });
    return [...groups.values()];
  }, [products]);

  const categories = useMemo(() => ['All', ...categoryTiles.map((tile) => tile.name)], [categoryTiles]);

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

  const showCategory = (name) => {
    setCategory(name);
    document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth' });
  };

  const countLabel = loading
    ? 'Loading products…'
    : `${visible.length} ${visible.length === 1 ? 'product' : 'products'}`;

  return (
    <div className="page">
      <section className="hero" aria-labelledby="hero-title">
        <span className="eyebrow">The collection</span>
        <h1 id="hero-title">
          Refined essentials, <em>delivered</em> with care.
        </h1>
        <p>
          Considered products at honest prices, with live stock levels, secure payments and
          tracking for every order.
        </p>
        <div className="hero-actions">
          <a href="#catalogue" className="hero-cta">
            Shop now <span aria-hidden="true">→</span>
          </a>
          {!user && (
            <Link to="/register" className="hero-cta hero-cta-ghost">
              Create an account
            </Link>
          )}
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

      {categoryTiles.length > 1 && (
        <section className="home-section" aria-labelledby="categories-title">
          <div className="section-head">
            <span className="eyebrow">Browse</span>
            <h2 id="categories-title">Shop by category</h2>
          </div>
          <div className="category-grid">
            {categoryTiles.map((tile) => (
              <button
                key={tile.name}
                type="button"
                className="category-tile"
                onClick={() => showCategory(tile.name)}
                style={tile.image ? { '--tile-image': `url("${tile.image}")` } : undefined}
              >
                <span className="category-name">{tile.name}</span>
                <span className="category-count">
                  {tile.count} {tile.count === 1 ? 'product' : 'products'} <span aria-hidden="true">→</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section id="catalogue" className="home-section" aria-labelledby="catalogue-title">
        <div className="catalogue-head">
          <div>
            <span className="eyebrow">The collection</span>
            <h2 id="catalogue-title">All products</h2>
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

      <section className="home-section" aria-labelledby="how-title">
        <div className="section-head section-head-center">
          <span className="eyebrow">How it works</span>
          <h2 id="how-title">From cart to doorstep, in four steps</h2>
        </div>
        <ol className="steps">
          {STEPS.map((step, index) => (
            <li key={step.title} className="step">
              <span className="step-number">{String(index + 1).padStart(2, '0')}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="faq" className="home-section faq-section" aria-labelledby="faq-title">
        <div className="section-head">
          <span className="eyebrow">Support</span>
          <h2 id="faq-title">Questions, answered</h2>
        </div>
        <div className="faq-list">
          {FAQS.map((item) => (
            <details key={item.q} className="faq-item">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="cta-band" aria-labelledby="cta-title">
        <div>
          <h2 id="cta-title">{user ? 'Welcome back.' : 'Ready when you are.'}</h2>
          <p>
            {user
              ? 'Pick up where you left off and follow your orders in one place.'
              : 'Create a free account to check out faster and track every order.'}
          </p>
        </div>
        <Link to={user ? '/orders' : '/register'} className="hero-cta">
          {user ? 'View my orders' : 'Create an account'} <span aria-hidden="true">→</span>
        </Link>
      </section>
    </div>
  );
}
