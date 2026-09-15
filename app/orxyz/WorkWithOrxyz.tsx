"use client";

import { useEffect } from 'react';
import css1 from './css1';
import css2 from './css2';
import css3 from './css3';
import markup1 from './markup1';
import markup2 from './markup2';
import markup3 from './markup3';
import { enhanceOrxyz } from './enhance';

const pageCss = css1 + css2 + css3;
const pageMarkup = markup1 + markup2 + markup3;

export default function WorkWithOrxyz() {
  useEffect(() => {
    enhanceOrxyz();
  }, []);

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
      <style dangerouslySetInnerHTML={{ __html: pageCss }} />
      <div data-orxyz-root dangerouslySetInnerHTML={{ __html: pageMarkup }} />
    </>
  );
}
