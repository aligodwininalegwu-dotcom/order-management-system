import { useEffect, useState } from 'react';
import { api } from '../api/client';
import ProductCard from '../components/ProductCard';

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError('');
        const query = search ? `?search=${encodeURIComponent(search)}` : '';
        const res = await api.get(`/products${query}`, {
          auth: false,
          signal: controller.signal,
        });
        setProducts(res.data);
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    // Debounce the search slightly so we don't fire a request on every keystroke,
    // and cancel any in-flight request so stale results can't overwrite fresh ones.
    const timeoutId = setTimeout(fetchProducts, 300);
    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [search]);

  return (
    <div className="page">
      <div className="hero">
        <h1>Everything you need, one order away.</h1>
        <p>
          Browse quality products with transparent pricing and secure
          checkout via Paystack.
        </p>
      </div>

      <h1>Products</h1>
      <input
        type="text"
        placeholder="Search products..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="search-input"
      />

      {loading && <p>Loading products...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && products.length === 0 && (
        <p>No products found.</p>
      )}

      <div className="product-grid">
        {products.map((product) => (
          <ProductCard key={product._id} product={product} />
        ))}
      </div>
    </div>
  );
}