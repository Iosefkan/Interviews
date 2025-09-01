import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const hrUserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    default: 'hr@job.com'
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  name: {
    type: String,
    required: true,
    trim: true,
    default: 'HR Manager'
  },
  role: {
    type: String,
    default: 'hr',
    enum: ['hr']
  },
  lastLogin: {
    type: Date
  },
  passwordChangedAt: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { 
  timestamps: true 
});

// Index for better query performance
hrUserSchema.index({ email: 1 });

// Hash password before saving
hrUserSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();

  try {
    // Hash the password with cost of 12
    const hashedPassword = await bcrypt.hash(this.password, 12);
    this.password = hashedPassword;

    // Set passwordChangedAt if this is not a new document
    if (!this.isNew) {
      this.passwordChangedAt = new Date();
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to check password
hrUserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to check if password changed after JWT was issued
hrUserSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  // False means NOT changed
  return false;
};

// Static method to create default HR user
hrUserSchema.statics.createDefaultUser = async function() {
  try {
    const existingUser = await this.findOne({ email: process.env.DEFAULT_HR_EMAIL || 'hr@job.com' });
    
    if (!existingUser) {
      const defaultUser = new this({
        email: process.env.DEFAULT_HR_EMAIL || 'hr@job.com',
        password: process.env.DEFAULT_HR_PASSWORD || 'password',
        name: process.env.DEFAULT_HR_NAME || 'HR Manager',
        role: 'hr'
      });
      
      await defaultUser.save();
      console.log('✅ Default HR user created successfully');
      return defaultUser;
    }
    
    console.log('✅ Default HR user already exists');
    return existingUser;
  } catch (error) {
    console.error('❌ Error creating default HR user:', error);
    throw error;
  }
};

export default mongoose.model('HRUser', hrUserSchema);