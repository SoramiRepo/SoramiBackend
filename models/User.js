import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    avatarname: { type: String, default: '' },
    avatarimg: { type: String, default: '' },
    bio: { type: String, default: '' },
    registertime: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);
export default User;