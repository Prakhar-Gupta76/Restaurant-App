const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const { User, MenuItem } = require('../src/models');

// Load environment variables
dotenv.config();

// Sample menu items data
const sampleMenuItems = [
  // Starters
  {
    name: "Caesar Salad",
    description: "Fresh romaine lettuce with parmesan cheese, croutons, and our signature caesar dressing",
    price: 8.99,
    category: "Starters",
    imageUrl: "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400",
    available: true
  },
  {
    name: "Buffalo Wings",
    description: "Crispy chicken wings tossed in spicy buffalo sauce, served with celery and blue cheese dip",
    price: 12.99,
    category: "Starters",
    imageUrl: "https://images.unsplash.com/photo-1567620832904-9fe5cf23db13?w=400",
    available: true
  },
  {
    name: "Garlic Bread",
    description: "Freshly baked bread with garlic butter and herbs, toasted to perfection",
    price: 6.99,
    category: "Starters",
    imageUrl: "https://images.unsplash.com/photo-1572441713132-51c75654db73?w=400",
    available: true
  },

  // Mains
  {
    name: "Margherita Pizza",
    description: "Classic pizza with tomato sauce, fresh mozzarella, basil, and extra virgin olive oil",
    price: 16.99,
    category: "Mains",
    imageUrl: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=400",
    available: true
  },
  {
    name: "Grilled Salmon",
    description: "Fresh Atlantic salmon grilled with herbs, served with seasonal vegetables and rice",
    price: 22.99,
    category: "Mains",
    imageUrl: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400",
    available: true
  },
  {
    name: "Beef Burger",
    description: "Juicy beef patty with lettuce, tomato, onion, pickles, and our special sauce on a brioche bun",
    price: 14.99,
    category: "Mains",
    imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400",
    available: true
  },
  {
    name: "Chicken Pasta",
    description: "Tender chicken breast with penne pasta in creamy alfredo sauce, topped with parmesan",
    price: 18.99,
    category: "Mains",
    imageUrl: "https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=400",
    available: true
  },

  // Desserts
  {
    name: "Chocolate Cake",
    description: "Rich chocolate layer cake with chocolate ganache frosting and fresh berries",
    price: 7.99,
    category: "Desserts",
    imageUrl: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400",
    available: true
  },
  {
    name: "Tiramisu",
    description: "Classic Italian dessert with coffee-soaked ladyfingers and mascarpone cream",
    price: 8.99,
    category: "Desserts",
    imageUrl: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400",
    available: true
  },
  {
    name: "Ice Cream Sundae",
    description: "Three scoops of vanilla ice cream with chocolate sauce, whipped cream, and a cherry",
    price: 6.99,
    category: "Desserts",
    imageUrl: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400",
    available: true
  },

  // Drinks
  {
    name: "Fresh Orange Juice",
    description: "Freshly squeezed orange juice, served chilled",
    price: 4.99,
    category: "Drinks",
    imageUrl: "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400",
    available: true
  },
  {
    name: "Craft Beer",
    description: "Local craft beer selection, ask server for today's available options",
    price: 5.99,
    category: "Drinks",
    imageUrl: "https://images.unsplash.com/photo-1608270586620-248524c67de9?w=400",
    available: true
  }
];

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Create admin user (upsert)
    const adminPassword = 'Admin@123';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    const adminUser = await User.findOneAndUpdate(
      { email: 'admin@demo.com' },
      {
        name: 'Admin User',
        email: 'admin@demo.com',
        passwordHash: hashedPassword,
        role: 'admin'
      },
      { upsert: true, new: true }
    );

    console.log('✅ Admin user created/updated:', {
      id: adminUser.id,
      email: adminUser.email,
      role: adminUser.role
    });

    // Create sample menu items (upsert by name)
    const createdMenuItems = [];
    
    for (const itemData of sampleMenuItems) {
      const menuItem = await MenuItem.findOneAndUpdate(
        { name: itemData.name },
        itemData,
        { upsert: true, new: true }
      );
      createdMenuItems.push(menuItem);
    }

    console.log(`✅ Created/updated ${createdMenuItems.length} menu items`);
    
    // Display summary
    console.log('\n📊 Seeding Summary:');
    console.log(`- Admin user: ${adminUser.email}`);
    console.log(`- Menu items: ${createdMenuItems.length}`);
    console.log(`- Categories: ${[...new Set(createdMenuItems.map(item => item.category))].join(', ')}`);
    
    console.log('\n🎉 Database seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run the seed function
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
