import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { formatNaira, stockLabel } from '../utils/format';

export default function ProductDetail() {
  const { id } = useParams();
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setError('');
        setImageFailed(false);
        const res = await api.get(`/products/${id}`, { auth: false, signal: controller.signal });
        setProduct(res.data);
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (product) document.title = `${product.name} · Online Store`;
    return () => {
      document.title = 'Online Store';
    };
  }, [product]);

  if (loading) {
    return (
      <div className="page page-loading" role="status">
        <span className="spinner" />
        <span className="visually-hidden">Loading product…</span>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="page">
        <div className="empty-state">
          <h1>Product not found</h1>
          <p>{error || 'This product may have been removed.'}</p>
          <Link to="/">
            <button type="button" tabIndex={-1}>
              Back to the store
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const showImage = product.imageUrl && !imageFailed;
  const stock = stockLabel(product.stockQuantity);
  const maxQuantity = Math.min(product.stockQuantity, 100);

  const handleAddToCart = () => {
    addToCart(product, quantity);
    showToast(`${quantity} × ${product.name} added to cart`);
  };

  return (
    <div className="page">
      <Link to="/" className="back-link">
        <span aria-hidden="true">←</span> Back to products
      </Link>

      <div className="product-detail">
        <div className="product-detail-image">
          {showImage ? (
            <img src={product.imageUrl} alt={product.name} onError={() => setImageFailed(true)} />
          ) : (
            <span className="product-card-image-fallback" aria-hidden="true">
              {product.name.charAt(0)}
            </span>
          )}
        </div>

        <div className="product-detail-info">
          <span className="product-category-tag product-category-tag-static">
            {product.category}
          </span>
          <h1>{product.name}</h1>
          <span className="product-price product-detail-price">{formatNaira(product.price)}</span>
          <p className="product-detail-description">{product.description}</p>
          <p className={`product-stock ${stock.tone}-stock`}>
            {stock.tone === 'in' ? `${product.stockQuantity} units in stock` : stock.text}
          </p>

          {product.stockQuantity > 0 && (
            <div className="product-detail-actions">
              <label className="qty-label">
                Quantity
                <input
                  type="number"
                  min="1"
                  max={maxQuantity}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(Math.min(maxQuantity, Math.max(1, Math.floor(Number(e.target.value)) || 1)))
                  }
                />
              </label>
              <button type="button" className="btn-accent btn-lg" onClick={handleAddToCart}>
                Add to cart
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
