
import { Router } from 'express';
import Application, {
  STATUSES,
  JOB_TYPES
} from '../models/Application.js';
import Counter from '../models/Counter.js';

const router = Router();

const ACTIVE = ['Applied', 'Interview', 'Offer'];

const EDITABLE_STATUSES = ['Applied', 'Interview', 'Offer'];

const DELETABLE_STATUSES = [
  'Applied',
  'Rejected',
  'Accepted',
  'Declined'
];

const TRANSITIONS = {
  Applied: ['Interview', 'Rejected'],
  Interview: ['Offer', 'Rejected'],
  Offer: ['Accepted', 'Declined'],
  Accepted: [],
  Declined: [],
  Rejected: []
};

const ok = (
  res,
  data,
  message = 'Success',
  status = 200
) => res.status(status).json({
  success: true,
  message,
  data
});

const fail = (res, status, message) =>
  res.status(status).json({
    success: false,
    message,
    data: null
  });

const asyncRoute = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const escapeRegex = value =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const companyKey = name =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const companyCode = name =>
  name.replace(/[^a-z0-9]/gi, '')
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, 'X');

const isValidObjectId = id =>
  /^[a-f\d]{24}$/i.test(id);

const findApplication = async id => {
  if (!isValidObjectId(id)) return null;
  return Application.findById(id);
};

const isValidAppliedDate = value => {
  if (typeof value !== 'string' || !value.trim()) {
    return false;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  return date <= today;
};

const hasValidSalary = value =>
  value === undefined ||
  value === null ||
  value === '' ||
  (
    Number.isFinite(Number(value)) &&
    Number(value) >= 0
  );

const findActiveDuplicate = async (
  companyName,
  jobRole,
  excludeId = null
) => {
  const filter = {
    companyName: {
      $regex: `^${escapeRegex(companyName.trim())}$`,
      $options: 'i'
    },
    jobRole: {
      $regex: `^${escapeRegex(jobRole.trim())}$`,
      $options: 'i'
    },
    status: { $in: ACTIVE }
  };

  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  return Application.findOne(filter);
};

// GET /api/applications/counts
router.get('/counts', asyncRoute(async (_req, res) => {
  const grouped = await Application.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const counts = Object.fromEntries(
    STATUSES.map(status => [status, 0])
  );

  grouped.forEach(item => {
    counts[item._id] = item.count;
  });

  ok(res, counts, 'Status counts loaded');
}));

// GET /api/applications?status=Applied&company=Infosys
router.get('/', asyncRoute(async (req, res) => {
  const filter = {};

  if (req.query.status && req.query.status !== 'All') {
    if (!STATUSES.includes(req.query.status)) {
      return fail(res, 400, 'Invalid status filter');
    }

    filter.status = req.query.status;
  }

  if (req.query.company) {
    filter.companyName = {
      $regex: escapeRegex(String(req.query.company)),
      $options: 'i'
    };
  }

  const applications = await Application.find(filter)
    .sort({ appliedDate: -1, createdAt: -1 });

  ok(res, applications, 'Applications loaded');
}));

// POST /api/applications
router.post('/', asyncRoute(async (req, res) => {
  const {
    companyName,
    jobRole,
    jobType,
    appliedDate,
    expectedSalary,
    notes
  } = req.body;

  if (
    typeof companyName !== 'string' ||
    !companyName.trim() ||
    typeof jobRole !== 'string' ||
    !jobRole.trim() ||
    typeof jobType !== 'string' ||
    !jobType.trim() ||
    typeof appliedDate !== 'string' ||
    !appliedDate.trim()
  ) {
    return fail(
      res,
      400,
      'Company, role, job type, and applied date are required'
    );
  }

  if (
    companyName.trim().length > 100 ||
    jobRole.trim().length > 100
  ) {
    return fail(res, 400, 'Company and role must be at most 100 characters');
  }

  if (!JOB_TYPES.includes(jobType)) {
    return fail(res, 400, 'Invalid job type');
  }

  if (!isValidAppliedDate(appliedDate)) {
    return fail(
      res,
      400,
      'Applied date must be valid and cannot be in the future'
    );
  }

  if (!hasValidSalary(expectedSalary)) {
    return fail(
      res,
      400,
      'Expected salary must be a non-negative number'
    );
  }

  if (typeof notes === 'string' && notes.length > 2000) {
    return fail(res, 400, 'Notes must be at most 2000 characters');
  }

  const company = companyName.trim();
  const role = jobRole.trim();

  const duplicate = await findActiveDuplicate(company, role);

  if (duplicate) {
    return fail(
      res,
      409,
      'An active application already exists for this company and role'
    );
  }

  const code = companyCode(company);
  const key = companyKey(company);

  const counter = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const date = new Date(appliedDate);

  const application = await Application.create({
    applicationId: `JA-${code}-${String(counter.seq).padStart(3, '0')}`,
    companyName: company,
    jobRole: role,
    jobType,
    appliedDate: date,
    expectedSalary:
      expectedSalary === undefined ||
      expectedSalary === null ||
      expectedSalary === ''
        ? null
        : Number(expectedSalary),
    notes: notes || '',
    status: 'Applied',
    statusHistory: [{
      status: 'Applied',
      date,
      note: 'Application submitted'
    }]
  });

  ok(res, application, 'Application created', 201);
}));

// GET /api/applications/:id
router.get('/:id', asyncRoute(async (req, res) => {
  const app = await findApplication(req.params.id);

  if (!app) {
    return fail(res, 404, 'Application not found');
  }

  ok(res, app, 'Application loaded');
}));

// PATCH /api/applications/:id/status
router.patch('/:id/status', asyncRoute(async (req, res) => {
  const app = await findApplication(req.params.id);

  if (!app) {
    return fail(res, 404, 'Application not found');
  }

  const { status, note = '' } = req.body;

  if (!STATUSES.includes(status)) {
    return fail(res, 400, 'Invalid status');
  }

  if (!TRANSITIONS[app.status].includes(status)) {
    return fail(
      res,
      400,
      `Status cannot move from ${app.status} to ${status}`
    );
  }

  if (typeof note !== 'string') {
    return fail(res, 400, 'Status note must be text');
  }

  app.status = status;
  app.statusHistory.push({
    status,
    date: new Date(),
    note: note.slice(0, 500)
  });

  await app.save();

  ok(res, app, 'Status updated');
}));

// PUT /api/applications/:id
router.put('/:id', asyncRoute(async (req, res) => {
  const app = await findApplication(req.params.id);

  if (!app) {
    return fail(res, 404, 'Application not found');
  }

  const forbiddenFields = [
    '_id',
    'id',
    'applicationId',
    'appliedDate',
    'status',
    'statusHistory',
    'createdAt',
    'updatedAt'
  ];

  if (forbiddenFields.some(field => field in req.body)) {
    return fail(
      res,
      400,
      'Application ID, applied date, status, and history cannot be edited here'
    );
  }

  if (!EDITABLE_STATUSES.includes(app.status)) {
    return fail(
      res,
      400,
      'Only applications in Applied, Interview, or Offer can be edited'
    );
  }

  const allowedFields = [
    'companyName',
    'jobRole',
    'jobType',
    'expectedSalary',
    'notes'
  ];

  if (Object.keys(req.body).some(
    field => !allowedFields.includes(field)
  )) {
    return fail(res, 400, 'One or more fields are not editable');
  }

  const nextCompany =
    'companyName' in req.body
      ? req.body.companyName
      : app.companyName;

  const nextRole =
    'jobRole' in req.body
      ? req.body.jobRole
      : app.jobRole;

  const nextJobType =
    'jobType' in req.body
      ? req.body.jobType
      : app.jobType;

  const nextSalary =
    'expectedSalary' in req.body
      ? req.body.expectedSalary
      : app.expectedSalary;

  const nextNotes =
    'notes' in req.body
      ? req.body.notes
      : app.notes;

  if (
    typeof nextCompany !== 'string' ||
    !nextCompany.trim() ||
    nextCompany.trim().length > 100 ||
    typeof nextRole !== 'string' ||
    !nextRole.trim() ||
    nextRole.trim().length > 100
  ) {
    return fail(res, 400, 'Company name and job role are invalid');
  }

  if (!JOB_TYPES.includes(nextJobType)) {
    return fail(res, 400, 'Invalid job type');
  }

  if (!hasValidSalary(nextSalary)) {
    return fail(
      res,
      400,
      'Expected salary must be a non-negative number'
    );
  }

  if (
    typeof nextNotes !== 'string' ||
    nextNotes.length > 2000
  ) {
    return fail(res, 400, 'Notes must be text up to 2000 characters');
  }

  const company = nextCompany.trim();
  const role = nextRole.trim();

  const duplicate = await findActiveDuplicate(
    company,
    role,
    app._id
  );

  if (duplicate) {
    return fail(
      res,
      409,
      'An active application already exists for this company and role'
    );
  }

  app.companyName = company;
  app.jobRole = role;
  app.jobType = nextJobType;
  app.expectedSalary =
    nextSalary === '' || nextSalary === null
      ? null
      : Number(nextSalary);
  app.notes = nextNotes.trim();

  await app.save();

  ok(res, app, 'Application updated');
}));

// DELETE /api/applications/:id
router.delete('/:id', asyncRoute(async (req, res) => {
  const app = await findApplication(req.params.id);

  if (!app) {
    return fail(res, 404, 'Application not found');
  }

  if (!DELETABLE_STATUSES.includes(app.status)) {
    return fail(
      res,
      400,
      'Only Applied, Rejected, Accepted, and Declined applications can be deleted'
    );
  }

  await app.deleteOne();

  ok(res, { id: req.params.id }, 'Application deleted');
}));

export default router;
