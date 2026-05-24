// Quick migration script to drop old collections for schema update
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');
  
  // Drop old admin collection (old schema without schoolId)
  try {
    await mongoose.connection.db.collection('admins').drop();
    console.log('Dropped admins collection');
  } catch (e) { console.log('admins collection does not exist'); }

  // Drop old students collection (old schema without schoolId)
  try {
    await mongoose.connection.db.collection('students').drop();
    console.log('Dropped students collection');
  } catch (e) { console.log('students collection does not exist'); }

  // Drop old attendances collection (old schema without schoolId)
  try {
    await mongoose.connection.db.collection('attendances').drop();
    console.log('Dropped attendances collection');
  } catch (e) { console.log('attendances collection does not exist'); }

  console.log('Migration complete! Restart the server to create the new default admin.');
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });
