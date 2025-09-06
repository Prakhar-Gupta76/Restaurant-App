const { z } = require('zod');
const { MenuItem } = require('../models');

// Validation schemas
const menuItemSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  price: z.number().positive('Price must be positive'),
  category: z.string().min(2, 'Category must be at least 2 characters'),
  imageUrl: z.string().url('Image URL must be a valid URL').optional(),
  available: z.boolean().default(true)
});

// Controller methods
exports.getMenuItems = async (req, res) => {
  try {
    const { category, q, page = 1, limit = 12 } = req.query;
    
    // Build query
    const query = {};
    
    // Add category filter if provided
    if (category) {
      query.category = category;
    }
    
    // Add search filter if provided
    if (q) {
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ];
    }
    
    // Parse pagination params
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;
    
    // Execute query with pagination
    const items = await MenuItem.find(query)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limitNum);
    
    // Get total count for pagination metadata
    const total = await MenuItem.countDocuments(query);
    
    res.json({
      items,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({ message: 'Server error while fetching menu items' });
  }
};

exports.getMenuItem = async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    
    res.json(item);
  } catch (error) {
    console.error('Error fetching menu item:', error);
    res.status(500).json({ message: 'Server error while fetching menu item' });
  }
};

exports.createMenuItem = async (req, res) => {
  try {
    // Validate request body
    const validatedData = menuItemSchema.parse(req.body);
    
    // Create new menu item
    const menuItem = await MenuItem.create(validatedData);
    
    res.status(201).json(menuItem);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors 
      });
    }
    console.error('Error creating menu item:', error);
    res.status(500).json({ message: 'Server error while creating menu item' });
  }
};

exports.updateMenuItem = async (req, res) => {
  try {
    // Validate request body
    const validatedData = menuItemSchema.parse(req.body);
    
    // Find and update menu item
    const menuItem = await MenuItem.findByIdAndUpdate(
      req.params.id,
      validatedData,
      { new: true, runValidators: true }
    );
    
    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    
    res.json(menuItem);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors 
      });
    }
    console.error('Error updating menu item:', error);
    res.status(500).json({ message: 'Server error while updating menu item' });
  }
};

exports.deleteMenuItem = async (req, res) => {
  try {
    const menuItem = await MenuItem.findByIdAndDelete(req.params.id);
    
    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    
    res.json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    res.status(500).json({ message: 'Server error while deleting menu item' });
  }
};

exports.toggleAvailability = async (req, res) => {
  try {
    // Find menu item
    const menuItem = await MenuItem.findById(req.params.id);
    
    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    
    // Toggle availability
    menuItem.available = !menuItem.available;
    await menuItem.save();
    
    res.json({
      message: `Menu item is now ${menuItem.available ? 'available' : 'unavailable'}`,
      available: menuItem.available
    });
  } catch (error) {
    console.error('Error toggling menu item availability:', error);
    res.status(500).json({ message: 'Server error while toggling menu item availability' });
  }
};