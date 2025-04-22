import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    type: { type: String, required: true }, // e.g. 'like', 'reply', 'follow', 'repost'
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' }, // optional
    message: String,
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
});


export default mongoose.model('Notification', notificationSchema);
