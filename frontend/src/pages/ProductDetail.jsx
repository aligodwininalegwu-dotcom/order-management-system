import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';

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
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/products/${id}`, { auth: false });
        setProduct(res.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const handleAddToCart = () => {
    addToCart(product, quantity);
    showToast(`${quantity} × ${product.name} added to cart`);
  };

  if (loading) return <div className="page">Loading product...</div>;
  if (error) return <div className="page error-text">{error}</div>;
  if (!product) return null;

  const showImage = product.imageUrl && !imageFailed;

  return (
    <div className="page">
      <Link to="/" className="back-link">
        ← Back to products
      </Link>

      <div className="product-detail">
        <div className="product-detail-image">
          {showImage ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span className="product-card-image-fallback">{product.name.charAt(0)}</span>
          )}
        </div>

        <div className="product-detail-info">
          <span className="product-category-tag product-category-tag-static">
            {product.category}
          </span>
          <h1>{product.name}</h1>
          <p className="product-detail-description">{product.description}</p>
          <span className="product-price product-detail-price">
            ₦{product.price.toLocaleString()}
          </span>
          <p
            className={
              product.stockQuantity > 0 ? 'product-stock in-stock' : 'product-stock out-of-stock'
            }
          >
            {product.stockQuantity > 0
              ? `${product.stockQuantity} units in stock`
              : 'Currently out of stock'}
          </p>

          {product.stockQuantity > 0 && (
            <div className="product-detail-actions">
              <label className="qty-label">
                Quantity
                <input
                  type="number"
                  min="1"
                  max={product.stockQuantity}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                />
              </label>
              <button className="btn-accent" onClick={handleAddToCart}>
                Add to Cart
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}