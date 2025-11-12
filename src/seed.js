import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "./models/Product.js";
import Order from "./models/Order.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ecommerce";

const seed = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB connected");

    // Clear old data
    await Product.deleteMany({});
    await Order.deleteMany({});

    // Insert Petroleum Products
    const products = await Product.insertMany([
      {
        title: "Fuel Nozzle",
        slug: "fuel-nozzle",
        description: "Durable and automatic fuel nozzle for petrol pumps.",
        images: [
          "https://thepetroshop.com/wp-content/uploads/2025/06/WhatsApp_Image_2025-06-05_at_14.33.14_dd70604b-removebg-preview-300x300.png",
        ],
        price: 1200,
        category: "Fuel Equipment",
        brand: "Standard",
        stock: 15,
      },
      {
        title: "Diesel Dispenser",
        slug: "diesel-dispenser",
        description: "Portable diesel dispenser with digital meter.",
        images: [
          "https://thepetroshop.com/wp-content/uploads/2025/06/Diesel-Dispenser.png",
        ],
        price: 45000,
        category: "Fuel Equipment",
        brand: "PetroTech",
        stock: 10,
      },
      {
        title: "Fuel Transfer Pump",
        slug: "fuel-transfer-pump",
        description: "High-flow fuel transfer pump for industrial use.",
        images: [
          "https://thepetroshop.com/wp-content/uploads/2025/06/Fuel-Transfer-Pump.png",
        ],
        price: 18000,
        category: "Fuel Equipment",
        brand: "FuelMaster",
        stock: 20,
      },
      {
        title: "Fuel Flow Meter",
        slug: "fuel-flow-meter",
        description: "Digital fuel flow meter for accurate measurement.",
        images: [
          "https://thepetroshop.com/wp-content/uploads/2025/06/Fuel-Flow-Meter.png",
        ],
        price: 6500,
        category: "Fuel Equipment",
        brand: "FlowTech",
        stock: 25,
      },
    ]);

    console.log(`📦 Inserted ${products.length} products`);

    // Insert Orders (spread across past 6 months)
    const now = new Date();
    const orders = [
      {
        user: new mongoose.Types.ObjectId(),
        items: [
          {
            product: products[0]._id,
            title: products[0].title,
            price: products[0].price,
            quantity: 2,
          },
        ],
        total: products[0].price * 2,
        status: "delivered",
        createdAt: new Date(now.setMonth(now.getMonth() - 5)),
      },
      {
        user: new mongoose.Types.ObjectId(),
        items: [
          {
            product: products[1]._id,
            title: products[1].title,
            price: products[1].price,
            quantity: 1,
          },
        ],
        total: products[1].price,
        status: "paid",
        createdAt: new Date(now.setMonth(now.getMonth() - 4)),
      },
      {
        user: new mongoose.Types.ObjectId(),
        items: [
          {
            product: products[2]._id,
            title: products[2].title,
            price: products[2].price,
            quantity: 3,
          },
        ],
        total: products[2].price * 3,
        status: "pending",
        createdAt: new Date(now.setMonth(now.getMonth() - 2)),
      },
      {
        user: new mongoose.Types.ObjectId(),
        items: [
          {
            product: products[3]._id,
            title: products[3].title,
            price: products[3].price,
            quantity: 5,
          },
        ],
        total: products[3].price * 5,
        status: "shipped",
        createdAt: new Date(),
      },
    ];

    await Order.insertMany(orders);
    console.log(`🧾 Inserted ${orders.length} orders`);

    console.log("✅ Petroleum seeding completed!");
    process.exit();
  } catch (err) {
    console.error("❌ Seeding error:", err);
    process.exit(1);
  }
};

seed();
