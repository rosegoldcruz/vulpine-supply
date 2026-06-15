import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';

export async function GET() {
  return Response.json({ success: true, message: 'Contact intake endpoint is available.' });
}

function cleanString(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizePayload(raw) {
  const fullName = cleanString(raw.fullName || raw.name);
  const email = cleanString(raw.email).toLowerCase();
  const phone = cleanString(raw.phone);
  const projectType = cleanString(raw.projectType || raw.project_type);
  const projectDetails = cleanString(raw.projectDetails || raw.message);

  return {
    fullName,
    email,
    phone,
    projectType,
    projectDetails,
  };
}

function validatePayload(payload) {
  if (!payload.fullName) return 'Full name is required.';
  if (!payload.email && !payload.phone) return 'Email or phone is required.';
  if (!payload.projectType) return 'Project type is required.';
  if (!payload.projectDetails) return 'Project details are required.';
  return '';
}

async function forwardToCrm(record) {
  const url = process.env.VULPINE_CRM_INTAKE_URL;
  if (!url) {
    return { syncStatus: 'pending' };
  }

  const headers = {
    'Content-Type': 'application/json',
  };

  if (process.env.VULPINE_SUPPLY_INTAKE_TOKEN) {
    headers.Authorization = `Bearer ${process.env.VULPINE_SUPPLY_INTAKE_TOKEN}`;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(record),
    });

    if (response.ok) {
      return { syncStatus: 'forwarded' };
    }

    return { syncStatus: 'pending' };
  } catch {
    return { syncStatus: 'pending' };
  }
}

async function persistSubmission(record) {
  const payload = `${JSON.stringify(record)}\n`;
  const candidateDirs = [path.join(process.cwd(), '.data'), path.join('/tmp', 'vulpine-supply-data')];

  for (const dir of candidateDirs) {
    try {
      await mkdir(dir, { recursive: true });
      await appendFile(path.join(dir, 'contact-submissions.jsonl'), payload, 'utf8');
      return true;
    } catch {
      // Keep trying fallbacks. On serverless environments the project root may be read-only.
    }
  }

  return false;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const normalized = normalizePayload(body || {});
    const validationError = validatePayload(normalized);

    if (validationError) {
      return Response.json({ success: false, error: validationError }, { status: 400 });
    }

    const submittedAt = new Date().toISOString();
    const userAgent = request.headers.get('user-agent') || '';
    const referer = request.headers.get('referer') || '';

    const baseRecord = {
      ...normalized,
      submittedAt,
      source: 'vulpine-supply',
      userAgent,
      referer,
    };

    const { syncStatus } = await forwardToCrm(baseRecord);

    const record = {
      ...baseRecord,
      syncStatus,
    };

    const stored = await persistSubmission(record);

    return Response.json({ success: true, syncStatus, stored });
  } catch {
    return Response.json(
      { success: false, error: 'Unable to process your request at this time.' },
      { status: 500 }
    );
  }
}
