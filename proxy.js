import { NextResponse } from 'next/server';

export default function proxy(request) {
  const url = request.nextUrl.clone();
  url.pathname = '/';
  url.search = '';
  return NextResponse.redirect(url, 307);
}

export const config = {
  matcher: [
    '/property/:path*',
    '/world/:path*',
    '/vault/:path*',
    '/demo/:path*',
    '/more/:path*',
    '/about/:path*',
    '/studio/:path*',
    '/pack/:path*',
    '/voxelflip/:path*',
    '/privacy/:path*',
    '/terms/:path*',
  ],
};
