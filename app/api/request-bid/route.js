import { GET as contactGet, POST as contactPost } from '../contact/route';

export const runtime = 'nodejs';

export async function GET(request) {
	return contactGet(request);
}

export async function POST(request) {
	return contactPost(request);
}