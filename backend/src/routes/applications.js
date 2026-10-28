import { Router } from 'express';
import Application, { STATUSES } from '../models/Application.js';
import Counter from '../models/Counter.js';

const router = Router();
const ACTIVE = ['Applied', 'Interview', 'Offer'];
const TRANSITIONS = { Applied: ['Interview', 'Rejected'], Interview: ['Offer', 'Rejected'], Offer: ['Hired', 'Rejected'], Rejected: [], Hired: [] };
const ok = (res, data, message = 'Success', status = 200) => res.status(status).json({ success: true, message, data });
const fail = (res, status, message) => res.status(status).json({ success: false, message, data: null });
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const companyKey = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const companyCode = name => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words.map(word => word[0]).join('') : words[0]?.replace(/[^a-z0-9]/gi, '').slice(0, 3);
  return (letters || 'JOB').toUpperCase().slice(0, 3).padEnd(3, 'X');
};

router.get('/counts', asyncRoute(async (_req, res) => {
  const grouped = await Application.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  const counts = Object.fromEntries(STATUSES.map(status => [status, 0]));
  grouped.forEach(item => { counts[item._id] = item.count; });
  ok(res, counts, 'Status counts loaded');
}));

router.get('/', asyncRoute(async (req, res) => {
  const filter = {};
  if (req.query.status && req.query.status !== 'All') {
    if (!STATUSES.includes(req.query.status)) return fail(res, 400, 'Invalid status filter');
    filter.status = req.query.status;
  }
  if (req.query.company) filter.companyName = { $regex: req.query.company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const applications = await Application.find(filter).sort({ appliedDate: -1, createdAt: -1 });
  ok(res, applications, 'Applications loaded');
}));

router.post('/', asyncRoute(async (req, res) => {
  const { companyName, jobRole, jobType, appliedDate, expectedSalary, notes } = req.body;
  if (![companyName, jobRole, jobType, appliedDate].every(value => typeof value === 'string' && value.trim())) return fail(res, 400, 'Company, role, job type, and applied date are required');
  if (!['Full-time', 'Internship', 'Contract'].includes(jobType)) return fail(res, 400, 'Invalid job type');
  if (Number.isNaN(Date.parse(appliedDate)) || new Date(appliedDate) > new Date()) return fail(res, 400, 'Applied date must be valid and cannot be in the future');
  if (expectedSalary !== undefined && expectedSalary !== null && expectedSalary !== '' && (!Number.isFinite(Number(expectedSalary)) || Number(expectedSalary) < 0)) return fail(res, 400, 'Expected salary must be a non-negative number');
  const company = companyName.trim(); const role = jobRole.trim();
  const duplicate = await Application.findOne({ companyName: { $regex: `^${company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }, jobRole: { $regex: `^${role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }, status: { $in: ACTIVE } });
  if (duplicate) return fail(res, 409, 'An active application already exists for this company and role');
  const code = companyCode(company); const key = companyKey(company);
  const counter = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  const date = new Date(appliedDate);
  const application = await Application.create({ applicationId: `JA-${code}-${String(counter.seq).padStart(3, '0')}`, companyName: company, jobRole: role, jobType, appliedDate: date, expectedSalary: expectedSalary === '' ? null : expectedSalary, notes, status: 'Applied', statusHistory: [{ status: 'Applied', date, note: 'Application submitted' }] });
  ok(res, application, 'Application created', 201);
}));

router.get('/:id', asyncRoute(async (req, res) => {
  const app = await Application.findById(req.params.id);
  if (!app) return fail(res, 404, 'Application not found');
  ok(res, app, 'Application loaded');
}));

router.patch('/:id/status', asyncRoute(async (req, res) => {
  const app = await Application.findById(req.params.id);
  if (!app) return fail(res, 404, 'Application not found');
  const { status, note = '' } = req.body;
  if (!STATUSES.includes(status)) return fail(res, 400, 'Invalid status');
  if (!TRANSITIONS[app.status].includes(status)) return fail(res, 400, `Status cannot move from ${app.status} to ${status}`);
  app.status = status;
  app.statusHistory.push({ status, date: new Date(), note: String(note).slice(0, 500) });
  await app.save();
  ok(res, app, 'Status updated');
}));

router.put('/:id', asyncRoute(async (req, res) => {
  const app = await Application.findById(req.params.id);
  if (!app) return fail(res, 404, 'Application not found');
  if ('_id' in req.body || 'id' in req.body || 'applicationId' in req.body || 'appliedDate' in req.body || 'status' in req.body || 'statusHistory' in req.body) return fail(res, 400, 'ID, applied date, and status history cannot be edited here');
  if (!['Applied', 'Interview', 'Offer'].includes(app.status)) return fail(res, 400, 'This application can no longer be edited');
  const fields = ['companyName', 'jobRole', 'jobType', 'expectedSalary', 'notes'];
  for (const field of fields) if (field in req.body) app[field] = req.body[field];
  if (!app.companyName.trim() || !app.jobRole.trim() || !['Full-time', 'Internship', 'Contract'].includes(app.jobType)) return fail(res, 400, 'Company, role, or job type is invalid');
  if (app.expectedSalary !== null && (!Number.isFinite(Number(app.expectedSalary)) || Number(app.expectedSalary) < 0)) return fail(res, 400, 'Expected salary must be a non-negative number');
  const duplicate = await Application.findOne({ _id: { $ne: app._id }, companyName: { $regex: `^${app.companyName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }, jobRole: { $regex: `^${app.jobRole.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }, status: { $in: ACTIVE } });
  if (duplicate) return fail(res, 409, 'An active application already exists for this company and role');
  await app.save();
  ok(res, app, 'Application updated');
}));

router.delete('/:id', asyncRoute(async (req, res) => {
  const app = await Application.findById(req.params.id);
  if (!app) return fail(res, 404, 'Application not found');
  if (['Interview', 'Offer'].includes(app.status)) return fail(res, 400, 'Applications in Interview or Offer status cannot be deleted');
  await app.deleteOne();
  ok(res, { id: req.params.id }, 'Application deleted');
}));

export default router;
