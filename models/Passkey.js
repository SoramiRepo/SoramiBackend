import mongoose from 'mongoose';

const passkeySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    credentialID: {
        type: String,
        required: true,
        unique: true
    },
    publicKey: {
        type: String,
        required: true
    },
    counter: {
        type: Number,
        required: true,
        default: 0
    },
    transports: [{
        type: String,
        enum: ['usb', 'nfc', 'ble', 'internal']
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastUsed: {
        type: Date,
        default: Date.now
    }
});

// 创建索引以提高查询性能
passkeySchema.index({ userId: 1 });
passkeySchema.index({ credentialID: 1 }, { unique: true });

const Passkey = mongoose.model('Passkey', passkeySchema);

export default Passkey;
