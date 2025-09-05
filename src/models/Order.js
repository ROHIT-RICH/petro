import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Items in the order
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    title: String,
    price: Number,
    quantity: Number
  }],

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

  // Total amount
  total: { type: Number, required: true },

  // Order status
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'], 
    default: 'pending' 
  },

  // Payment Info (reference to Payments collection)
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },

}, { timestamps: true });

// Add virtual populate to fetch payment automatically
orderSchema.virtual('paymentDetails', {
  ref: 'Payment',        // The model to populate
  localField: '_id',     // Order _id
  foreignField: 'order', // Payment.order references this
  justOne: true          // Each order has only one payment
});

// Make virtuals show in JSON
orderSchema.set('toObject', { virtuals: true });
orderSchema.set('toJSON', { virtuals: true });

export default mongoose.model('Order', orderSchema);
