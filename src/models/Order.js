import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Items in the order (with variant snapshot)
  items: [
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },

      // Variant reference + snapshot at order time
      variantId: { type: mongoose.Schema.Types.ObjectId }, 
      variant: {
        size: String,    // e.g., "Size M", "Red"
        price: Number,   // variant price at order time
        sku: String      // optional unique SKU
      },

      // Product snapshot
      title: String,
      price: Number,     // product price at order time
      quantity: Number,
      subtotal: Number   // price * quantity at order time
    }
  ],

  // Customer information
  customer: {
    name: String,
    phone: String,
    email: String
  },

  // Shipping address
  address: {
    recipientName: String,
    recipientPhone: String,
    line1: String,
    line2: String,
    city: String,
    state: String,
    postalCode: String,
    country: String
  },

  // Total amount (calculated at order time)
  total: { type: Number, required: true },

  // Delivery charges
  shipping: { type: Number, default: 0 },

  // Order status
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'], 
    default: 'pending' 
  },

  // Payment Info (reference to Payments collection)
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },

}, { timestamps: true });

// Virtual populate for payment
orderSchema.virtual('paymentDetails', {
  ref: 'Payment',        // Model to populate
  localField: '_id',     // Order _id
  foreignField: 'order', // Payment.order references this
  justOne: true
});

// Make virtuals appear in JSON
orderSchema.set('toObject', { virtuals: true });
orderSchema.set('toJSON', { virtuals: true });

export default mongoose.model('Order', orderSchema);
