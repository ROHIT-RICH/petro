import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },

  mode: { type: String, enum: ['cod', 'online'], required: true ,default: null },

  status: { 
    type: String, 
    enum: ['pending', 'success', 'failed', 'refunded'], 
    default: 'pending' 
  },

  amount: { type: Number, required: true },

  // For online gateways (Razorpay/Stripe etc.)
  gateway: { type: String }, 
  transactionId: { type: String },   // Razorpay/Stripe payment id
  signature: { type: String },       // for verification

  // For COD collection
  collectedBy: { type: String },     // delivery boy name/id
  collectedAt: { type: Date }
}, { timestamps: true });

export default mongoose.model('Payment', paymentSchema);
