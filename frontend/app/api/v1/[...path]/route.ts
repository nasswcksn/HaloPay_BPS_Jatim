import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_PREFIX = '/api/v1/';

// Hanya header ini yang diteruskan ke backend; header lain dari klien (X-Forwarded-*,
// Expect, Content-Length, dsb.) dibuang agar tidak dapat dipalsukan atau merusak request.
const FORWARDED_HEADERS = ['cookie', 'authorization', 'content-type', 'accept'];

async function handleProxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const pathSegment = Array.isArray(resolvedParams?.path)
      ? resolvedParams.path.join('/')
      : '';
    const search = req.nextUrl.search || '';
    const backendBase =
      process.env.FASTAPI_INTERNAL_URL || 'http://127.0.0.1:8000';
    const targetUrl = new URL(`${backendBase}${API_PREFIX}${pathSegment}${search}`);

    // Segmen ter-encode seperti '..%2F..%2Fdocs' didekode menjadi '../../docs' dan dinormalisasi
    // oleh URL parser; tolak setiap target yang keluar dari prefix /api/v1/.
    if (!targetUrl.pathname.startsWith(API_PREFIX)) {
      return NextResponse.json({ detail: 'Not Found' }, { status: 404 });
    }

    const headers = new Headers();
    for (const name of FORWARDED_HEADERS) {
      const value = req.headers.get(name);
      if (value) headers.set(name, value);
    }

    const body = ['GET', 'HEAD'].includes(req.method)
      ? undefined
      : await req.arrayBuffer();

    const backendRes = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: body,
      redirect: 'manual',
    });

    const responseHeaders = new Headers(backendRes.headers);
    // Hapus transfer-encoding atau content-encoding yang dapat memicu konflik streaming
    responseHeaders.delete('transfer-encoding');

    return new Response(backendRes.body, {
      status: backendRes.status,
      statusText: backendRes.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error('FastAPI proxy error:', error);
    return NextResponse.json(
      { error: 'Gagal menghubungkan ke backend FastAPI' },
      { status: 502 }
    );
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const DELETE = handleProxy;
export const PATCH = handleProxy;
export const OPTIONS = handleProxy;
