import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';

export default function ProductCard({ product }) {
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = product.imageUrl && !imageFailed;

  const handleAddToCart = () => {
    addToCart(product);
    showToast(`${product.name} added to cart`);
  };

  return (
    <div className="product-card">
      <Link to={`/products/${product._id}`} className="product-card-image">
        {showImage ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="product-card-image-fallback">
            {product.name.charAt(0)}
          </span>
        )}
        <span className="product-category-tag">{product.category}</span>
      </Link>

      <div className="product-card-body">
        <Link to={`/products/${product._id}`} className="product-card-title-link">
          <h3>{product.name}</h3>
        </Link>
        <p className="product-description">{product.description}</p>

        <div className="product-card-footer">
          <span className="product-price">₦{product.price.toLocaleString()}</span>
          <span
            className={
              product.stockQuantity > 0 ? 'product-stock in-stock' : 'product-stock out-of-stock'
            }
          >
            {product.stockQuantity > 0 ? `${product.stockQuantity} in stock` : 'Out of stock'}
          </span>
        </div>

        <button disabled={product.stockQuantity === 0} onClick={handleAddToCart}>
          Add to Cart
        </button>
      </div>
    </div>
  );
}