to get started
run: npm run dev

Shared-link previews use `public/banner/og-image.jpg` with the default geooos
title and description. Set `NEXT_PUBLIC_SITE_URL` to the public site origin
(including `https://`) so preview images use the correct absolute URL. If unset,
the app uses `NEXTAUTH_URL`, then `https://mapbuilder.ucmercedhub.com`.
