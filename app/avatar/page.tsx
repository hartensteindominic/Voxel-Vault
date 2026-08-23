import Link from 'next/link';
import PersonalAvatarStudio from '../components/PersonalAvatarStudio';
import './avatar.css';

export default function AvatarPage() {
  return <main className="avatarPage"><header><Link href="/">VOXEL VAULT</Link><nav><Link href="/discover">World</Link><Link href="/room">Room</Link><Link href="/trade">Trade</Link></nav></header><PersonalAvatarStudio/><section className="avatarRoadmap"><article><small>NEXT</small><h2>Wear what you own.</h2><p>Wearable metadata will map verified product twins to avatar attachment slots, with fit validation before rendering.</p></article><article><small>PRIVACY</small><h2>You control your likeness.</h2><p>Face scans and personal geometry will be opt-in, encrypted, deletable, and never used to authorize wallet transactions.</p></article></section></main>;
}
