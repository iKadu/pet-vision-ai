import { auth } from '@tccpet/auth';
import { env } from '@tccpet/env/server';
import { createHmac } from 'node:crypto';

export const runtime = 'nodejs';

async function forward(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: 'Autenticação necessária.' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id');
  if (request.method === 'GET' && (!id || !/^[a-f0-9]{32}$/.test(id))) {
    return Response.json({ error: 'Análise inválida.' }, { status: 400 });
  }
  const owner = createHmac('sha256', env.BETTER_AUTH_SECRET).update(`video-analysis:${session.user.id}`).digest('hex');
  const headers: Record<string, string> = { 'x-video-owner': owner };
  if (request.method === 'POST') {
    headers['content-type'] = request.headers.get('content-type') ?? '';
    if (Number(request.headers.get('content-length')) > 200 * 1024 * 1024) {
      return Response.json({ error: 'O vídeo deve ter no máximo 200 MB.' }, { status: 413 });
    }
  }
  try {
    const options: RequestInit & { duplex?: string } = {
      method: request.method, headers, cache: 'no-store',
      signal: AbortSignal.timeout(request.method === 'POST' ? 300_000 : 15_000),
    };
    if (request.method === 'POST') { options.body = request.body; options.duplex = 'half'; }
    const response = await fetch(`${env.AI_ENGINE_URL}/videos${id ? `/${id}` : ''}`, options);
    return new Response(response.body, { status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Motor de IA indisponível. Verifique se está em execução.' }, { status: 503 });
  }
}

export const POST = forward;
export const GET = forward;
