import mongoose from 'mongoose';

export const STATUSES = ['Applied', 'Interview', 'Offer', 'Rejected', 'Hired'];
const historySchema = new mongoose.Schema({
  status: { type: String, enum: STATUSES, required: true },
  date: { type: Date, required: true, default: Date.now },
  note: { type: String, trim: true, maxlength: 500, default: '' }
}, { _id: false });

const applicationSchema = new mongoose.Schema({
  applicationId: { type: String, required: true, unique: true, immutable: true },
  companyName: { type: String, required: [true, 'Company name is required'], trim: true, maxlength: 100 },
  jobRole: { type: String, required: [true, 'Job role is required'], trim: true, maxlength: 100 },
  jobType: { type: String, required: true, enum: ['Full-time', 'Internship', 'Contract'] },
  appliedDate: { type: Date, required: true },
  expectedSalary: { type: Number, min: 0, default: null },
  notes: { type: String, trim: true, maxlength: 2000, default: '' },
  status: { type: String, enum: STATUSES, default: 'Applied', required: true },
  statusHistory: { type: [historySchema], default: [] }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

applicationSchema.virtual('followUpDate').get(function () {
  const due = new Date(this.appliedDate);
  due.setDate(due.getDate() + 7);
  return due;
});
applicationSchema.virtual('isOverdue').get(function () {
  const due = new Date(this.appliedDate);
  due.setDate(due.getDate() + 7);
  return this.status === 'Applied' && new Date() > due;
});

export default mongoose.model('Application', applicationSchema);
