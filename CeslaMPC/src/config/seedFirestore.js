import { db } from './firebase';
import { doc, setDoc, collection, writeBatch } from 'firebase/firestore';

const DEFAULT_ALL_SIZES = [
  'XS','S','M','L','XL','XXL','XXXL',
  '2T','3T','4T','5T','6','8','10','12','14'
];

const DEFAULT_ITEMS = [
  { id:'m1', name:'CESLA Polo Shirt', cat:'Shirts',
    price:350, stock:20, emoji:'👕', image:null, sizes:DEFAULT_ALL_SIZES },
  { id:'m2', name:'CESLA T-Shirt', cat:'Shirts',
    price:250, stock:30, emoji:'👕', image:null, sizes:DEFAULT_ALL_SIZES },
  // ... add all your items here
];

export const seedDatabase = async () => {
  const batch = writeBatch(db);
  DEFAULT_ITEMS.forEach(item => {
    const ref = doc(db, 'merchandise_items', item.id);
    batch.set(ref, item);
  });
  await batch.commit();
  console.log('Firestore seeded successfully!');
};