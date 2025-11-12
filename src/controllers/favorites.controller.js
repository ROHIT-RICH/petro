import User from "../models/User.js";
import Product from "../models/Product.js";

export const getFavorites = async (req, res) => {
  const user = await User.findById(req.user.id).populate({
    path: "favorites",
    select: "title brand price images stock active",
  });
  res.json({ ids: user.favorites.map((p) => String(p._id)), products: user.favorites });
};

export const toggleFavorite = async (req, res) => {
  const { productId } = req.params;
  const exists = await Product.exists({ _id: productId, active: true });
  if (!exists) return res.status(404).json({ message: "Product not found" });

  const user = await User.findById(req.user.id);
  const idx = user.favorites.findIndex((id) => String(id) === String(productId));
  if (idx > -1) user.favorites.splice(idx, 1);
  else user.favorites.push(productId);
  await user.save();

  res.json({ ids: user.favorites.map(String) });
};