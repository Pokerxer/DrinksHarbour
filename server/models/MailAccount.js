// models/MailAccount.js
//
// A platform support mailbox added at runtime, complementing the env-defined
// accounts in mailAccount.service. The password is stored encrypted
// (utils/mailCrypto) and excluded from every query that does not opt in.

const mongoose = require('mongoose');
const { Schema } = mongoose;

const mailAccountSchema = new Schema(
  {
    address: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    displayName: { type: String, trim: true },
    // Login user when it differs from the address; resolve falls back to
    // the address, which is the common case on cPanel-style hosts.
    username: { type: String, trim: true },
    passwordEnc: { type: String, required: true, select: false },
    imapHost: { type: String, required: true, trim: true },
    imapPort: { type: Number, default: 993 },
    smtpHost: { type: String, required: true, trim: true },
    smtpPort: { type: Number, default: 465 },
    // null means "implied by the port" (465/993 ⇒ implicit TLS), matching how
    // the env-defined accounts behave.
    imapSecure: { type: Boolean, default: null },
    smtpSecure: { type: Boolean, default: null },
    scope: { type: String, enum: ['platform'], default: 'platform' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MailAccount', mailAccountSchema);
