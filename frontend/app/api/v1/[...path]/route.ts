import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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
    const targetUrl = `${backendBase}/api/v1/${pathSegment}${search}`;

    const headers = new Headers(req.headers);
    headers.delete('host');

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
      {
        error: 'Gagal menghubungkan ke backend FastAPI',
        details: error?.message || String(error),
      },
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
